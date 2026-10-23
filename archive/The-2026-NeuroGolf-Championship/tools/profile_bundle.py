#!/usr/bin/env python3
"""Validate and score a NeuroGolf ONNX bundle locally.

The script intentionally mirrors the downloaded competition utility instead of
using a hand-rolled metric.  It runs each model over train + test + arc-gen
examples, then asks the official scorer helpers for memory and parameter cost.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import pathlib
import sys
import tempfile
import time
from dataclasses import dataclass

import numpy as np
import onnx
import onnxruntime


ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "neurogolf-2026"
sys.path.insert(0, str(DATA_DIR))

from neurogolf_utils import neurogolf_utils as ng  # noqa: E402


@dataclass
class TaskResult:
    task: int
    status: str
    arc_agi_right: int = 0
    arc_agi_wrong: int = 0
    arc_gen_right: int = 0
    arc_gen_wrong: int = 0
    memory: int | None = None
    params: int | None = None
    cost: int | None = None
    points: float | None = None
    filesize: int | None = None
    nodes: int | None = None
    seconds: float = 0.0
    error: str = ""

    def row(self) -> dict[str, object]:
        return {
            "task": self.task,
            "status": self.status,
            "arc_agi_right": self.arc_agi_right,
            "arc_agi_wrong": self.arc_agi_wrong,
            "arc_gen_right": self.arc_gen_right,
            "arc_gen_wrong": self.arc_gen_wrong,
            "memory": self.memory if self.memory is not None else "",
            "params": self.params if self.params is not None else "",
            "cost": self.cost if self.cost is not None else "",
            "points": f"{self.points:.6f}" if self.points is not None else "",
            "filesize": self.filesize if self.filesize is not None else "",
            "nodes": self.nodes if self.nodes is not None else "",
            "seconds": f"{self.seconds:.3f}",
            "error": self.error,
        }


def task_numbers(task_arg: str | None) -> list[int]:
    if not task_arg:
        return list(range(1, 401))
    out: list[int] = []
    for part in task_arg.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = part.split("-", 1)
            out.extend(range(int(start), int(end) + 1))
        else:
            out.append(int(part))
    return sorted(set(out))


def provider_list(provider_arg: str | None) -> list[str]:
    if not provider_arg:
        return ["CPUExecutionProvider"]
    providers = [provider.strip() for provider in provider_arg.split(",") if provider.strip()]
    return providers or ["CPUExecutionProvider"]


def preload_provider_libraries(providers: list[str]) -> None:
    if providers == ["CPUExecutionProvider"]:
        return
    preload = getattr(onnxruntime, "preload_dlls", None)
    if preload is not None:
        preload()


def load_examples(task: int) -> dict:
    with (DATA_DIR / f"task{task:03d}.json").open() as f:
        return json.load(f)


def score_points(memory: int, params: int) -> float:
    return max(1.0, 25.0 - math.log(max(1.0, memory + params)))


def verify_examples(session: onnxruntime.InferenceSession, examples: list[dict]) -> tuple[int, int]:
    right = 0
    wrong = 0
    for example in examples:
        benchmark = ng.convert_to_numpy(example)
        if benchmark is None:
            continue
        output = ng.run_network(session, benchmark["input"])
        if np.array_equal(output, benchmark["output"]):
            right += 1
        else:
            wrong += 1
    return right, wrong


def profile_task(
    bundle_dir: pathlib.Path,
    task: int,
    profile_dir: pathlib.Path,
    providers: list[str] | None = None,
) -> TaskResult:
    started = time.time()
    filename = bundle_dir / f"task{task:03d}.onnx"
    result = TaskResult(task=task, status="error")
    if not filename.exists():
        result.status = "missing"
        result.seconds = time.time() - started
        return result
    result.filesize = filename.stat().st_size
    if not ng.check_network(filename):
        result.status = "invalid_file"
        result.seconds = time.time() - started
        return result

    try:
        model = onnx.load(filename)
        result.nodes = len(model.graph.node)
        sanitized = ng.sanitize_model(model)
        if sanitized is None:
            result.status = "sanitize_failed"
            result.seconds = time.time() - started
            return result

        options = onnxruntime.SessionOptions()
        options.enable_profiling = True
        options.graph_optimization_level = onnxruntime.GraphOptimizationLevel.ORT_DISABLE_ALL
        options.profile_file_prefix = str(profile_dir / f"task{task:03d}")
        active_providers = providers or ["CPUExecutionProvider"]
        preload_provider_libraries(active_providers)
        session = onnxruntime.InferenceSession(
            sanitized.SerializeToString(),
            options,
            providers=active_providers,
        )

        examples = load_examples(task)
        result.arc_agi_right, result.arc_agi_wrong = verify_examples(
            session, examples["train"] + examples["test"]
        )
        result.arc_gen_right, result.arc_gen_wrong = verify_examples(session, examples["arc-gen"])

        trace_path = session.end_profiling()
        memory, params = ng.score_network(sanitized, trace_path)
        result.memory = memory
        result.params = params
        if memory is None or params is None or memory < 0 or params < 0:
            result.status = "unmeasurable"
            return result
        result.cost = memory + params
        result.points = score_points(memory, params)
        if result.arc_agi_wrong or result.arc_gen_wrong:
            result.status = "wrong"
        else:
            result.status = "ok"
        return result
    except Exception as exc:  # noqa: BLE001 - this is a diagnostic script.
        result.error = f"{type(exc).__name__}: {exc}"
        return result
    finally:
        result.seconds = time.time() - started


def write_csv(path: pathlib.Path, results: list[TaskResult]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(results[0].row().keys()))
        writer.writeheader()
        for result in results:
            writer.writerow(result.row())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle-dir", type=pathlib.Path, default=ROOT / "previoussubmission")
    parser.add_argument("--tasks", help="Comma/range task selector, e.g. 1,5,20-25")
    parser.add_argument("--out", type=pathlib.Path, default=ROOT / "reports" / "submissions" / "profile.csv")
    parser.add_argument(
        "--providers",
        help="Comma-separated ONNX Runtime providers. Defaults to CPUExecutionProvider.",
    )
    args = parser.parse_args()

    tasks = task_numbers(args.tasks)
    providers = provider_list(args.providers)
    results: list[TaskResult] = []
    with tempfile.TemporaryDirectory(dir=ROOT / "artifacts" / "profiles") as tmp:
        profile_dir = pathlib.Path(tmp)
        for index, task in enumerate(tasks, start=1):
            result = profile_task(args.bundle_dir, task, profile_dir, providers=providers)
            results.append(result)
            print(
                f"{index:03d}/{len(tasks):03d} task{task:03d} "
                f"{result.status} points={result.points if result.points is not None else ''} "
                f"wrong={result.arc_agi_wrong + result.arc_gen_wrong} "
                f"seconds={result.seconds:.2f}",
                flush=True,
            )

    if not results:
        print("No tasks selected", file=sys.stderr)
        return 2
    write_csv(args.out, results)
    total = sum(r.points or 0.0 for r in results)
    ok = sum(1 for r in results if r.status == "ok")
    wrong = sum(1 for r in results if r.status == "wrong")
    errors = len(results) - ok - wrong
    print(f"Wrote {args.out}")
    print(f"tasks={len(results)} ok={ok} wrong={wrong} errors={errors} total_points={total:.6f}")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
