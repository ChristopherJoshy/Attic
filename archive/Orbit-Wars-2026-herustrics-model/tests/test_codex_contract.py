import importlib.util
import pathlib
import py_compile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class CodexContractTests(unittest.TestCase):
    def test_submission_exists_compiles_and_exports_agent(self):
        submission = ROOT / "main.py"
        self.assertTrue(submission.exists(), "main.py is the submission artifact")
        py_compile.compile(str(submission), doraise=True)
        module = load_module(submission, "codex_submission_contract")
        self.assertTrue(callable(getattr(module, "agent", None)))
        self.assertTrue(callable(getattr(module, "plan_codex_moves", None)))
        self.assertTrue(callable(getattr(module, "build_neutral_sweep_moves", None)))

    def test_benchmark_harness_exists_and_exposes_required_helpers(self):
        harness = ROOT / "scripts" / "benchmark_codex.py"
        self.assertTrue(harness.exists(), "scripts/benchmark_codex.py runs local gates")
        py_compile.compile(str(harness), doraise=True)
        module = load_module(harness, "benchmark_codex_contract")
        self.assertTrue(callable(getattr(module, "load_agent", None)))
        self.assertTrue(callable(getattr(module, "run_match", None)))
        self.assertTrue(callable(getattr(module, "hard_seeds", None)))

    def test_hard_seed_set_has_requested_size(self):
        harness = load_module(ROOT / "scripts" / "benchmark_codex.py", "benchmark_codex_seeds")
        seeds = harness.hard_seeds(100)
        self.assertEqual(len(seeds), 100)
        self.assertEqual(len(set(seeds)), 100)

    def test_submission_has_no_broad_exception_fallbacks(self):
        text = (ROOT / "main.py").read_text()
        self.assertNotIn("except Exception", text)
        self.assertNotIn("OnlineMetaBandit", text)

    def test_sun_contact_counts_as_collision(self):
        module = load_module(ROOT / "main.py", "codex_submission_sun_contract")
        self.assertTrue(module.segment_hits_sun(40.0, 50.0, 60.0, 50.0, safety=0.0))


if __name__ == "__main__":
    unittest.main()
