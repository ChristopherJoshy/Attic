"""
NeuroGolf 2026 — cost-optimal ONNX solver for ARC-AGI tasks
=============================================================

Scoring: max(1, 25 - ln(cost)) per task, cost = params + bytes + MACs.

Key ideas vs. the starter code:

1.  Rotations/flips use Transpose + Slice (0 params, 0 MACs) instead of a
    900-element int64 gather table (7200 bytes). Same-canvas variants for
    30x30 inputs, and "framed" variants (Slice content -> transform -> Pad)
    for any fixed non-30x30 size.

2.  Color remaps use Gather on the channel axis: 10 int64 params, 0 MACs.
    The starter's 1x1 Conv cost 100 params + 90 000 MACs for the same thing.

3.  Constant outputs emit Constant + Identity — no Mul(x,0) + Add chain
    (which wasted 9 000 MACs in the starter).

4.  Crop = Slice + Pad.  Translation = Slice + Pad.  Zero params, zero MACs.

5.  Every candidate is measured via cost(model) and the cheapest correct one
    wins — we don't take the first correct one.

6.  Validation uses train + test + up to 10 arc-gen samples so the model
    generalises to the private benchmark.

Running this in a Kaggle notebook:
  * Place the 400 task*.json files under the input path (default tries several
    common Kaggle mount points).
  * Run the cell. ONNX files are emitted to /kaggle/working and bundled into
    submission.zip at the end.
"""

import os, json, math, zipfile, copy, itertools, sys
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any, Iterable

import numpy as np

# Robust onnx/onnxruntime bootstrap (Kaggle kernels usually have both) ---------
try:
    import onnx
    import onnx.helper as oh
    import onnx.numpy_helper as onh
    from onnx import TensorProto
except ImportError:
    os.system("pip install onnx -q")
    import onnx
    import onnx.helper as oh
    import onnx.numpy_helper as onh
    from onnx import TensorProto

try:
    import onnxruntime as ort
except ImportError:
    os.system("pip install onnxruntime -q")
    import onnxruntime as ort


# =============================================================================
# Constants
# =============================================================================

C, H, W = 10, 30, 30
MAX_FILE_BYTES = int(1.44 * 1024 * 1024)
DISALLOWED_OPS = {"Loop", "Scan", "NonZero", "Unique", "Script", "Function"}
OPSET = [oh.make_opsetid("", 17)]
IR_VERSION = 8


# =============================================================================
# Tensor <-> grid
# =============================================================================

def grid_to_tensor(grid) -> np.ndarray:
    g = np.asarray(grid, dtype=np.int32)
    h, w = g.shape
    t = np.zeros((1, C, H, W), dtype=np.float32)
    for r in range(h):
        for c in range(w):
            v = int(g[r, c])
            if 0 <= v < C:
                t[0, v, r, c] = 1.0
    return t

def tensor_to_grid(t: np.ndarray, out_h: int, out_w: int) -> List[List[int]]:
    arr = t[0, :, :out_h, :out_w]
    grid: List[List[int]] = []
    for r in range(out_h):
        row = []
        for c in range(out_w):
            col_vals = arr[:, r, c]
            if col_vals.max() < 0.5:
                row.append(0)
            else:
                row.append(int(np.argmax(col_vals)))
        grid.append(row)
    return grid


# =============================================================================
# Graph helpers
# =============================================================================

def _X():
    return oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])

def _Y():
    return oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])

def _const(name: str, arr: np.ndarray):
    t = onh.from_array(arr, name=name + "_v")
    return oh.make_node("Constant", [], [name], value=t)

def _make_model(nodes, graph_name="net"):
    g = oh.make_graph(nodes, graph_name, [_X()], [_Y()])
    m = oh.make_model(g, opset_imports=OPSET)
    m.ir_version = IR_VERSION
    return m


# =============================================================================
# Cost / validation
# =============================================================================

def model_bytes(model) -> bytes:
    return model.SerializeToString()

def check_fits(model) -> bool:
    return len(model_bytes(model)) <= MAX_FILE_BYTES

def check_ops_allowed(model) -> bool:
    for node in model.graph.node:
        if node.op_type in DISALLOWED_OPS:
            return False
    return True

def _iter_constants(model):
    for init in model.graph.initializer:
        yield onh.to_array(init)
    for node in model.graph.node:
        if node.op_type == "Constant":
            for attr in node.attribute:
                if attr.name == "value":
                    yield onh.to_array(attr.t)

def count_params(model) -> int:
    return sum(int(a.size) for a in _iter_constants(model))

def _shape_map(model):
    shapes: Dict[str, Tuple[int, ...]] = {}
    for vi in list(model.graph.input) + list(model.graph.output):
        dims = tuple(d.dim_value if d.dim_value > 0 else 1
                     for d in vi.type.tensor_type.shape.dim)
        shapes[vi.name] = dims
    for init in model.graph.initializer:
        shapes[init.name] = tuple(init.dims)
    for node in model.graph.node:
        if node.op_type == "Constant":
            for attr in node.attribute:
                if attr.name == "value":
                    shapes[node.output[0]] = tuple(attr.t.dims) if attr.t.dims else ()
    return shapes

def estimate_macs(model) -> int:
    """Conservative MAC estimate.

    Organisers count "multiply-accumulate operations required to execute the
    network". For Conv/Gemm/MatMul this is standard. We additionally count
    element-wise Mul's output element count as a safety margin — a scalar
    mul+add doesn't accumulate across inputs but we'd rather over-count than
    under-count when picking the cheapest candidate."""
    macs = 0
    shapes = _shape_map(model)
    for node in model.graph.node:
        if node.op_type == "Conv":
            w = shapes.get(node.input[1]); x = shapes.get(node.input[0])
            if w and x and len(w) == 4 and len(x) == 4:
                out_c, in_c, kh, kw = w
                _, _, xh, xw = x
                macs += int(out_c * in_c * kh * kw * xh * xw)
        elif node.op_type == "Gemm":
            a = shapes.get(node.input[0]); w = shapes.get(node.input[1])
            if a and w and len(a) >= 2 and len(w) >= 2:
                m = int(a[0]); k = int(a[1]); n = int(w[0] if w[0] != k else w[1])
                macs += m * k * n
        elif node.op_type == "MatMul":
            a = shapes.get(node.input[0]); b = shapes.get(node.input[1])
            if a and b and len(a) >= 2 and len(b) >= 2:
                macs += int(a[-2]) * int(a[-1]) * int(b[-1])
    return macs

def cost(model) -> int:
    return count_params(model) + len(model_bytes(model)) + estimate_macs(model)


def check_model_correct(model, pairs) -> bool:
    if not pairs:
        return False
    if not check_fits(model):
        return False
    if not check_ops_allowed(model):
        return False
    try:
        so = ort.SessionOptions()
        so.log_severity_level = 3
        sess = ort.InferenceSession(model_bytes(model), sess_options=so,
                                    providers=["CPUExecutionProvider"])
    except Exception:
        return False
    try:
        for p in pairs:
            inp = grid_to_tensor(p["input"])
            og = np.asarray(p["output"])
            oh_, ow_ = og.shape
            pred = sess.run(None, {"input": inp})[0]
            outside = pred.copy()
            outside[0, :, :oh_, :ow_] = 0.0
            if np.max(np.abs(outside)) > 1e-4:
                return False
            if tensor_to_grid(pred, oh_, ow_) != p["output"]:
                return False
        return True
    except Exception:
        return False


# =============================================================================
# Model constructions (ordered by typical cost)
# =============================================================================

# --- Identity ----------------------------------------------------------------

def make_identity():
    return _make_model([oh.make_node("Identity", ["input"], ["output"])], "identity")


# --- Pure constant output ----------------------------------------------------

def make_const(output_grid: np.ndarray):
    og = np.asarray(output_grid, dtype=np.int32)
    oh_, ow_ = og.shape
    padded = np.zeros((1, C, H, W), dtype=np.float32)
    for r in range(oh_):
        for c in range(ow_):
            v = int(og[r, c])
            if 0 <= v < C:
                padded[0, v, r, c] = 1.0
    nodes = [_const("K", padded), oh.make_node("Identity", ["K"], ["output"])]
    return _make_model(nodes, "const_net")


# --- Full-canvas Transpose / Slice-reverse (0 params, 0 MACs) ----------------

def make_transpose_hw():
    return _make_model(
        [oh.make_node("Transpose", ["input"], ["output"], perm=[0, 1, 3, 2])],
        "transpose_hw")

def _slice_reverse_nodes(axes, dims, in_name, out_name, suf=""):
    starts = [d - 1 for d in dims]
    ends   = [-d - 1 for d in dims]
    steps  = [-1] * len(dims)
    return [
        _const(f"rs_s{suf}", np.asarray(starts, dtype=np.int64)),
        _const(f"rs_e{suf}", np.asarray(ends,   dtype=np.int64)),
        _const(f"rs_a{suf}", np.asarray(axes,   dtype=np.int64)),
        _const(f"rs_p{suf}", np.asarray(steps,  dtype=np.int64)),
        oh.make_node("Slice",
                     [in_name, f"rs_s{suf}", f"rs_e{suf}", f"rs_a{suf}", f"rs_p{suf}"],
                     [out_name]),
    ]

def make_flip_h():
    return _make_model(_slice_reverse_nodes([2], [H], "input", "output"), "flip_h")

def make_flip_w():
    return _make_model(_slice_reverse_nodes([3], [W], "input", "output"), "flip_w")

def make_flip_both():
    return _make_model(_slice_reverse_nodes([2, 3], [H, W], "input", "output"), "flip_both")

def make_rot_180():
    return make_flip_both()

def make_rot_90_cw():
    nodes = [oh.make_node("Transpose", ["input"], ["t"], perm=[0, 1, 3, 2])]
    nodes += _slice_reverse_nodes([3], [W], "t", "output")
    return _make_model(nodes, "rot_90_cw")

def make_rot_90_ccw():
    nodes = [oh.make_node("Transpose", ["input"], ["t"], perm=[0, 1, 3, 2])]
    nodes += _slice_reverse_nodes([2], [H], "t", "output")
    return _make_model(nodes, "rot_90_ccw")

def make_anti_transpose():
    nodes = [oh.make_node("Transpose", ["input"], ["t"], perm=[0, 1, 3, 2])]
    nodes += _slice_reverse_nodes([2, 3], [H, W], "t", "output")
    return _make_model(nodes, "anti_transpose")


# --- Framed rotations/flips for fixed (h, w) != 30x30 -----------------------

def _pad_to_canvas(in_name, out_name, out_h, out_w, suf=""):
    pads = np.asarray([0, 0, 0, 0, 0, 0, H - out_h, W - out_w], dtype=np.int64)
    return [
        _const(f"pd{suf}", pads),
        oh.make_node("Pad", [in_name, f"pd{suf}"], [out_name], mode="constant"),
    ]

def _crop_to_content(in_name, out_name, h, w, suf=""):
    return [
        _const(f"cs{suf}", np.asarray([0, 0], dtype=np.int64)),
        _const(f"ce{suf}", np.asarray([h, w], dtype=np.int64)),
        _const(f"ca{suf}", np.asarray([2, 3], dtype=np.int64)),
        oh.make_node("Slice",
                     [in_name, f"cs{suf}", f"ce{suf}", f"ca{suf}"],
                     [out_name]),
    ]

def make_framed_rot180(h, w):
    nodes = _crop_to_content("input", "content", h, w, "0")
    nodes += _slice_reverse_nodes([2, 3], [h, w], "content", "rotated", "r")
    nodes += _pad_to_canvas("rotated", "output", h, w, "p")
    return _make_model(nodes, "framed_rot180")

def make_framed_flip_h(h, w):
    nodes = _crop_to_content("input", "content", h, w, "0")
    nodes += _slice_reverse_nodes([2], [h], "content", "flipped", "r")
    nodes += _pad_to_canvas("flipped", "output", h, w, "p")
    return _make_model(nodes, "framed_flip_h")

def make_framed_flip_w(h, w):
    nodes = _crop_to_content("input", "content", h, w, "0")
    nodes += _slice_reverse_nodes([3], [w], "content", "flipped", "r")
    nodes += _pad_to_canvas("flipped", "output", h, w, "p")
    return _make_model(nodes, "framed_flip_w")

def make_framed_transpose(h, w):
    nodes = _crop_to_content("input", "content", h, w, "0")
    nodes += [oh.make_node("Transpose", ["content"], ["transposed"], perm=[0, 1, 3, 2])]
    nodes += _pad_to_canvas("transposed", "output", w, h, "p")
    return _make_model(nodes, "framed_transpose")

def make_framed_rot_90_cw(h, w):
    nodes = _crop_to_content("input", "content", h, w, "0")
    nodes += [oh.make_node("Transpose", ["content"], ["t"], perm=[0, 1, 3, 2])]
    nodes += _slice_reverse_nodes([3], [h], "t", "rotated", "r")
    nodes += _pad_to_canvas("rotated", "output", w, h, "p")
    return _make_model(nodes, "framed_rot_90_cw")

def make_framed_rot_90_ccw(h, w):
    nodes = _crop_to_content("input", "content", h, w, "0")
    nodes += [oh.make_node("Transpose", ["content"], ["t"], perm=[0, 1, 3, 2])]
    nodes += _slice_reverse_nodes([2], [w], "t", "rotated", "r")
    nodes += _pad_to_canvas("rotated", "output", w, h, "p")
    return _make_model(nodes, "framed_rot_90_ccw")


# --- Color remap via channel-axis Gather ------------------------------------

def make_color_remap_gather(color_map: Dict[int, int]):
    inv: Dict[int, int] = {}
    for s, d in color_map.items():
        inv[d] = s
    idx = np.arange(C, dtype=np.int64)
    mask = np.ones(C, dtype=np.float32)
    src_remapped_away = {s for s, d in color_map.items() if s != d}
    for d in range(C):
        if d in inv:
            idx[d] = inv[d]
        elif d in src_remapped_away:
            idx[d] = 0
            mask[d] = 0.0
        else:
            idx[d] = d
    gi = _const("gi", idx)
    if mask.min() == 1.0:
        gnode = oh.make_node("Gather", ["input", "gi"], ["output"], axis=1)
        return _make_model([gi, gnode], "color_remap")
    gnode = oh.make_node("Gather", ["input", "gi"], ["gathered"], axis=1)
    mk = _const("cm", mask.reshape(1, C, 1, 1))
    mul = oh.make_node("Mul", ["gathered", "cm"], ["output"])
    return _make_model([gi, gnode, mk, mul], "color_remap_masked")


# --- Crop (Slice + Pad) -----------------------------------------------------

def make_crop(r0: int, c0: int, out_h: int, out_w: int):
    nodes = [
        _const("cs", np.asarray([r0, c0], dtype=np.int64)),
        _const("ce", np.asarray([r0 + out_h, c0 + out_w], dtype=np.int64)),
        _const("ca", np.asarray([2, 3], dtype=np.int64)),
        oh.make_node("Slice", ["input", "cs", "ce", "ca"], ["cropped"]),
    ]
    nodes += _pad_to_canvas("cropped", "output", out_h, out_w, "p")
    return _make_model(nodes, "crop_net")


# --- Translation (Slice + Pad with different offsets) -----------------------

def make_translation(dr: int, dc: int):
    """Full-canvas translation. USE ONLY when fixed_size == (H, W), since the
    padded-background region gets shifted and can leak non-zero channel-0
    activations outside the real grid for smaller inputs. For smaller fixed
    sizes, use make_framed_translation."""
    src_r0 = max(0, -dr); src_r1 = min(H, H - dr)
    src_c0 = max(0, -dc); src_c1 = min(W, W - dc)
    dst_r0 = max(0, dr);  dst_c0 = max(0, dc)
    rh = src_r1 - src_r0; rw = src_c1 - src_c0
    if rh <= 0 or rw <= 0:
        return make_const(np.zeros((1, 1), dtype=np.int32))
    nodes = [
        _const("ts", np.asarray([src_r0, src_c0], dtype=np.int64)),
        _const("te", np.asarray([src_r1, src_c1], dtype=np.int64)),
        _const("ta", np.asarray([2, 3], dtype=np.int64)),
        oh.make_node("Slice", ["input", "ts", "te", "ta"], ["sliced"]),
    ]
    pads = np.asarray([
        0, 0, dst_r0, dst_c0,
        0, 0, H - dst_r0 - rh, W - dst_c0 - rw
    ], dtype=np.int64)
    nodes += [
        _const("pp", pads),
        oh.make_node("Pad", ["sliced", "pp"], ["output"], mode="constant"),
    ]
    return _make_model(nodes, "translate_net")


def make_framed_translation(grid_h: int, grid_w: int, dr: int, dc: int):
    """Translate only within the grid's content rectangle [0:grid_h, 0:grid_w],
    leaving the rest of the 30x30 canvas at zero. Used when every example has
    the same grid size (grid_h, grid_w) and content shifts by (dr, dc)."""
    # Source region inside the content rect:
    src_r0 = max(0, -dr); src_r1 = min(grid_h, grid_h - dr)
    src_c0 = max(0, -dc); src_c1 = min(grid_w, grid_w - dc)
    dst_r0 = max(0, dr);  dst_c0 = max(0, dc)
    rh = src_r1 - src_r0; rw = src_c1 - src_c0
    if rh <= 0 or rw <= 0:
        # Everything shifts out of frame -> all-zero output.
        return make_const(np.zeros((1, 1), dtype=np.int32))
    nodes = [
        _const("fts", np.asarray([src_r0, src_c0], dtype=np.int64)),
        _const("fte", np.asarray([src_r1, src_c1], dtype=np.int64)),
        _const("fta", np.asarray([2, 3], dtype=np.int64)),
        oh.make_node("Slice", ["input", "fts", "fte", "fta"], ["fsliced"]),
    ]
    # Pad so that the sliced piece lands at (dst_r0, dst_c0) and the canvas
    # becomes (H, W). End-pads finish the canvas to the right and bottom.
    pads = np.asarray([
        0, 0, dst_r0, dst_c0,
        0, 0, H - dst_r0 - rh, W - dst_c0 - rw
    ], dtype=np.int64)
    nodes += [
        _const("fpp", pads),
        oh.make_node("Pad", ["fsliced", "fpp"], ["output"], mode="constant"),
    ]
    return _make_model(nodes, "framed_translate_net")


# --- Upscale via Resize (nearest), 0 MACs ----------------------------------

def make_upscale(f: int, in_h: int, in_w: int):
    """Nearest-neighbor upscale of the content region [0:in_h, 0:in_w] by
    factor f. The real content region is first sliced out, then Resize
    upsamples each axis by f, then Pad brings it back to (H, W)."""
    nodes = _crop_to_content("input", "content", in_h, in_w, "0")
    # Resize: needs 'roi' and 'scales' (empty roi). Use sizes for deterministic output.
    nodes += [
        _const("rsz_roi", np.asarray([], dtype=np.float32)),
        _const("rsz_scales", np.asarray([], dtype=np.float32)),
        _const("rsz_sizes", np.asarray([1, C, in_h * f, in_w * f], dtype=np.int64)),
        oh.make_node(
            "Resize",
            ["content", "rsz_roi", "rsz_scales", "rsz_sizes"],
            ["upscaled"],
            mode="nearest",
            coordinate_transformation_mode="asymmetric",
            nearest_mode="floor",
        ),
    ]
    nodes += _pad_to_canvas("upscaled", "output", in_h * f, in_w * f, "p")
    return _make_model(nodes, "upscale_net")


# --- Downscale via Slice with stride, 0 MACs -------------------------------

def make_downscale(f: int, in_h: int, in_w: int):
    """Take every f-th pixel along H and W from the [0:in_h, 0:in_w] region."""
    out_h = in_h // f
    out_w = in_w // f
    nodes = [
        _const("ds_s", np.asarray([0, 0], dtype=np.int64)),
        _const("ds_e", np.asarray([in_h, in_w], dtype=np.int64)),
        _const("ds_a", np.asarray([2, 3], dtype=np.int64)),
        _const("ds_p", np.asarray([f, f], dtype=np.int64)),
        oh.make_node("Slice", ["input", "ds_s", "ds_e", "ds_a", "ds_p"], ["downsampled"]),
    ]
    nodes += _pad_to_canvas("downsampled", "output", out_h, out_w, "p")
    return _make_model(nodes, "downscale_net")


# --- Tile via Tile op, 0 MACs ----------------------------------------------

def make_tile(tr: int, tc: int, in_h: int, in_w: int):
    """Slice the content region then Tile it (tr, tc) times along H, W."""
    nodes = _crop_to_content("input", "content", in_h, in_w, "0")
    repeats = np.asarray([1, 1, tr, tc], dtype=np.int64)
    nodes += [
        _const("tile_r", repeats),
        oh.make_node("Tile", ["content", "tile_r"], ["tiled"]),
    ]
    nodes += _pad_to_canvas("tiled", "output", in_h * tr, in_w * tc, "p")
    return _make_model(nodes, "tile_net")


# --- Concatenate-with-mirror: output = [input | flip(input)] ---------------

def make_concat_flip_w(in_h: int, in_w: int):
    """Output (h, 2w) = [input (h, w) | flip_w(input)]. 0 MACs."""
    nodes = _crop_to_content("input", "content", in_h, in_w, "0")
    nodes += _slice_reverse_nodes([3], [in_w], "content", "flipped", "fw")
    nodes += [oh.make_node("Concat", ["content", "flipped"], ["concated"], axis=3)]
    nodes += _pad_to_canvas("concated", "output", in_h, in_w * 2, "p")
    return _make_model(nodes, "concat_flip_w")


def make_concat_flip_h(in_h: int, in_w: int):
    """Output (2h, w) = [input; flip_h(input)]. 0 MACs."""
    nodes = _crop_to_content("input", "content", in_h, in_w, "0")
    nodes += _slice_reverse_nodes([2], [in_h], "content", "flipped", "fh")
    nodes += [oh.make_node("Concat", ["content", "flipped"], ["concated"], axis=2)]
    nodes += _pad_to_canvas("concated", "output", in_h * 2, in_w, "p")
    return _make_model(nodes, "concat_flip_h")


def make_concat_rot180_w(in_h: int, in_w: int):
    """Output (h, 2w) = [input | rot180(input)]. 0 MACs."""
    nodes = _crop_to_content("input", "content", in_h, in_w, "0")
    nodes += _slice_reverse_nodes([2, 3], [in_h, in_w], "content", "rotated", "r")
    nodes += [oh.make_node("Concat", ["content", "rotated"], ["concated"], axis=3)]
    nodes += _pad_to_canvas("concated", "output", in_h, in_w * 2, "p")
    return _make_model(nodes, "concat_rot180_w")


# --- Quadrant mirror: 2h × 2w output from h × w input ----------------------

def make_quadrant_mirror(in_h: int, in_w: int):
    """Top-left    = input
       Top-right   = flip_w(input)
       Bottom-left = flip_h(input)
       Bottom-right= rot180(input)  ( = flip_h(flip_w(input)) )
    Built in two Concat stages. 0 MACs."""
    nodes = _crop_to_content("input", "content", in_h, in_w, "0")
    # Build top row: [content | flip_w(content)]
    nodes += _slice_reverse_nodes([3], [in_w], "content", "fw", "fw")
    nodes += [oh.make_node("Concat", ["content", "fw"], ["top_row"], axis=3)]
    # Build bottom row: [flip_h(content) | rot180(content)]
    nodes += _slice_reverse_nodes([2], [in_h], "content", "fh", "fh")
    nodes += _slice_reverse_nodes([2, 3], [in_h, in_w], "content", "fr", "fr")
    nodes += [oh.make_node("Concat", ["fh", "fr"], ["bot_row"], axis=3)]
    # Stack rows along H
    nodes += [oh.make_node("Concat", ["top_row", "bot_row"], ["full"], axis=2)]
    nodes += _pad_to_canvas("full", "output", in_h * 2, in_w * 2, "p")
    return _make_model(nodes, "quadrant_mirror")


# --- Row/column broadcast: every row = row 0 (or col 0) of input -----------

def make_row_broadcast(in_h: int, in_w: int, row_idx: int = 0):
    """Output[r, c] = input[row_idx, c] for r in [0..in_h), c in [0..in_w)."""
    # Slice a single row, then Tile along H axis to replicate.
    starts = np.asarray([row_idx], dtype=np.int64)
    ends = np.asarray([row_idx + 1], dtype=np.int64)
    axes = np.asarray([2], dtype=np.int64)
    nodes = [
        _const("rb_s", starts),
        _const("rb_e", ends),
        _const("rb_a", axes),
        oh.make_node("Slice", ["input", "rb_s", "rb_e", "rb_a"], ["one_row"]),
    ]
    # After slice: shape (1, C, 1, W). Tile along H to get (1, C, in_h, W).
    nodes += [
        _const("rb_r", np.asarray([1, 1, in_h, 1], dtype=np.int64)),
        oh.make_node("Tile", ["one_row", "rb_r"], ["tiled"]),
    ]
    # Now crop width to in_w, then pad.
    nodes += [
        _const("rb_cs", np.asarray([0, 0], dtype=np.int64)),
        _const("rb_ce", np.asarray([in_h, in_w], dtype=np.int64)),
        _const("rb_ca", np.asarray([2, 3], dtype=np.int64)),
        oh.make_node("Slice", ["tiled", "rb_cs", "rb_ce", "rb_ca"], ["cropped"]),
    ]
    nodes += _pad_to_canvas("cropped", "output", in_h, in_w, "p")
    return _make_model(nodes, "row_broadcast")


def make_col_broadcast(in_h: int, in_w: int, col_idx: int = 0):
    """Output[r, c] = input[r, col_idx]."""
    starts = np.asarray([col_idx], dtype=np.int64)
    ends = np.asarray([col_idx + 1], dtype=np.int64)
    axes = np.asarray([3], dtype=np.int64)
    nodes = [
        _const("cb_s", starts),
        _const("cb_e", ends),
        _const("cb_a", axes),
        oh.make_node("Slice", ["input", "cb_s", "cb_e", "cb_a"], ["one_col"]),
    ]
    nodes += [
        _const("cb_r", np.asarray([1, 1, 1, in_w], dtype=np.int64)),
        oh.make_node("Tile", ["one_col", "cb_r"], ["tiled"]),
    ]
    nodes += [
        _const("cb_cs", np.asarray([0, 0], dtype=np.int64)),
        _const("cb_ce", np.asarray([in_h, in_w], dtype=np.int64)),
        _const("cb_ca", np.asarray([2, 3], dtype=np.int64)),
        oh.make_node("Slice", ["tiled", "cb_cs", "cb_ce", "cb_ca"], ["cropped"]),
    ]
    nodes += _pad_to_canvas("cropped", "output", in_h, in_w, "p")
    return _make_model(nodes, "col_broadcast")


# --- Crop + transform composition -----------------------------------------

def _crop_nodes(r0: int, c0: int, out_h: int, out_w: int,
                in_name: str, out_name: str, suf: str = "ct"):
    return [
        _const(f"{suf}_s", np.asarray([r0, c0], dtype=np.int64)),
        _const(f"{suf}_e", np.asarray([r0 + out_h, c0 + out_w], dtype=np.int64)),
        _const(f"{suf}_a", np.asarray([2, 3], dtype=np.int64)),
        oh.make_node("Slice", [in_name, f"{suf}_s", f"{suf}_e", f"{suf}_a"], [out_name]),
    ]


def make_crop_then_color(r0, c0, out_h, out_w, color_map):
    """Crop and apply color remap (Gather on channels)."""
    # Build crop nodes into 'cropped', then gather channels, then pad.
    nodes = _crop_nodes(r0, c0, out_h, out_w, "input", "cropped", "ctc")

    inv: Dict[int, int] = {}
    for s, d in color_map.items():
        inv[d] = s
    idx = np.arange(C, dtype=np.int64)
    mask = np.ones(C, dtype=np.float32)
    src_remapped_away = {s for s, d in color_map.items() if s != d}
    for d in range(C):
        if d in inv:
            idx[d] = inv[d]
        elif d in src_remapped_away:
            idx[d] = 0
            mask[d] = 0.0
        else:
            idx[d] = d
    gi = _const("gi_ctc", idx)
    if mask.min() == 1.0:
        gnode = oh.make_node("Gather", ["cropped", "gi_ctc"], ["colored"], axis=1)
        nodes += [gi, gnode]
    else:
        gnode = oh.make_node("Gather", ["cropped", "gi_ctc"], ["g_ctc"], axis=1)
        mk = _const("cm_ctc", mask.reshape(1, C, 1, 1))
        mul = oh.make_node("Mul", ["g_ctc", "cm_ctc"], ["colored"])
        nodes += [gi, gnode, mk, mul]

    nodes += _pad_to_canvas("colored", "output", out_h, out_w, "pctc")
    return _make_model(nodes, "crop_color")


def make_pad_with_border(grid_h, grid_w, border: int, fill_color: int):
    """Add a border of `border` thickness around the grid, filled with fill_color.
    Output shape = (grid_h + 2*border, grid_w + 2*border).

    Approach: write a full constant of shape (1, C, grid_h+2b, grid_w+2b) where
    fill-color channel is all ones (for the border region) and zero inside;
    then slice the content from input and put it inside. This uses 2 Pad's
    with different constant values... more cleanly: we build the output by
    concatenating a pre-filled border around the content.

    Cheaper: do Pad with mode='constant' and value=(1-hot tensor via channel).
    Since channel axis is not padded, Pad adds zeros everywhere. We need the
    border cells to have channel `fill_color` = 1. So we mask them on via Add
    with a precomputed border mask (only border cells non-zero, only on the
    fill_color channel).
    """
    oh_ = grid_h + 2 * border
    ow_ = grid_w + 2 * border
    if oh_ > H or ow_ > W:
        return None

    # Slice content, pad with zeros to (oh_, ow_), then add a border mask that
    # has 1's at fill_color channel in the border region.
    nodes = _crop_to_content("input", "content", grid_h, grid_w, "pb0")
    # Pad content with border zeros:
    pads_border = np.asarray([
        0, 0, border, border,
        0, 0, border, border
    ], dtype=np.int64)
    nodes += [
        _const("pb_pads", pads_border),
        oh.make_node("Pad", ["content", "pb_pads"], ["padded"], mode="constant"),
    ]
    # Now the result has shape (1, C, oh_, ow_) with zeros where the border goes.
    # Build a mask (1, C, oh_, ow_) with 1 at [fill_color, border-cells]:
    mask = np.zeros((1, C, oh_, ow_), dtype=np.float32)
    if 0 <= fill_color < C:
        # border rows and cols
        mask[0, fill_color, :border, :] = 1.0
        mask[0, fill_color, -border:, :] = 1.0
        mask[0, fill_color, :, :border] = 1.0
        mask[0, fill_color, :, -border:] = 1.0
    nodes += [
        _const("pb_mask", mask),
        oh.make_node("Add", ["padded", "pb_mask"], ["bordered"]),
    ]
    # Pad to full canvas (H, W)
    nodes += _pad_to_canvas("bordered", "output", oh_, ow_, "pbfinal")
    return _make_model(nodes, "pad_with_border")


# --- Inset: place input inside a larger canvas at fixed position, rest=0 ---

def make_inset(grid_h, grid_w, offset_r, offset_w):
    """Move input's content [0:grid_h, 0:grid_w] to [offset_r:+grid_h, offset_w:+grid_w]
    in the output. Everything else = 0. Essentially a framed translation."""
    return make_framed_translation(grid_h + offset_r, grid_w + offset_w,
                                    offset_r, offset_w)


# --- Composition: transform then color remap --------------------------------

def make_transform_plus_color(base_fn, color_map: Dict[int, int]):
    """Run a transform model, then Gather on channel axis for color remap.
    We splice the two subgraphs together by renaming the base's 'output' to
    'mid' and feeding 'mid' into a Gather.
    """
    base = base_fn()
    base_nodes = [copy.deepcopy(n) for n in base.graph.node]
    for node in base_nodes:
        for i, o in enumerate(node.output):
            if o == "output":
                node.output[i] = "mid"

    inv: Dict[int, int] = {}
    for s, d in color_map.items():
        inv[d] = s
    idx = np.arange(C, dtype=np.int64)
    mask = np.ones(C, dtype=np.float32)
    src_remapped_away = {s for s, d in color_map.items() if s != d}
    for d in range(C):
        if d in inv:
            idx[d] = inv[d]
        elif d in src_remapped_away:
            idx[d] = 0
            mask[d] = 0.0
        else:
            idx[d] = d
    gi = _const("gi2", idx)
    if mask.min() == 1.0:
        gnode = oh.make_node("Gather", ["mid", "gi2"], ["output"], axis=1)
        return _make_model(base_nodes + [gi, gnode], "xform_color")
    gnode = oh.make_node("Gather", ["mid", "gi2"], ["gathered2"], axis=1)
    mk = _const("cm2", mask.reshape(1, C, 1, 1))
    mul = oh.make_node("Mul", ["gathered2", "cm2"], ["output"])
    return _make_model(base_nodes + [gi, gnode, mk, mul], "xform_color_masked")


# =============================================================================
# Detectors
# =============================================================================

def all_same_io_shape(pairs) -> bool:
    return all(np.asarray(p["input"]).shape == np.asarray(p["output"]).shape
               for p in pairs)

def all_square_io(pairs) -> bool:
    return all(np.asarray(p["input"]).shape[0] == np.asarray(p["input"]).shape[1]
               for p in pairs)

def fixed_input_size(pairs):
    if not pairs:
        return None
    first = np.asarray(pairs[0]["input"]).shape
    for p in pairs[1:]:
        if np.asarray(p["input"]).shape != first:
            return None
    return first

def detect_identity(pairs) -> bool:
    for p in pairs:
        ig = np.asarray(p["input"]); og = np.asarray(p["output"])
        if ig.shape != og.shape or not np.array_equal(ig, og):
            return False
    return True

def detect_const(pairs):
    if not pairs:
        return None
    first = np.asarray(pairs[0]["output"])
    for p in pairs[1:]:
        o = np.asarray(p["output"])
        if o.shape != first.shape or not np.array_equal(o, first):
            return None
    ins = {str(p["input"]) for p in pairs}
    if len(ins) < 2 and detect_identity(pairs):
        return None
    return first

def detect_rotation(pairs):
    for label, k in [("180", 2), ("90cw", -1), ("90ccw", 1)]:
        ok = True
        for p in pairs:
            ig = np.asarray(p["input"]); og = np.asarray(p["output"])
            r = np.rot90(ig, k)
            if r.shape != og.shape or not np.array_equal(r, og):
                ok = False; break
        if ok:
            return label
    return None

def detect_flip(pairs):
    for name, fn in [("h", np.flipud), ("w", np.fliplr),
                     ("both", lambda a: np.flipud(np.fliplr(a)))]:
        ok = True
        for p in pairs:
            ig = np.asarray(p["input"]); og = np.asarray(p["output"])
            f = fn(ig)
            if f.shape != og.shape or not np.array_equal(f, og):
                ok = False; break
        if ok:
            return name
    return None

def detect_transpose(pairs):
    for p in pairs:
        ig = np.asarray(p["input"]); og = np.asarray(p["output"])
        if ig.T.shape != og.shape or not np.array_equal(ig.T, og):
            return False
    return True

def detect_anti_transpose(pairs):
    for p in pairs:
        ig = np.asarray(p["input"]); og = np.asarray(p["output"])
        exp = np.flipud(np.fliplr(ig.T))
        if exp.shape != og.shape or not np.array_equal(exp, og):
            return False
    return True

def detect_color_map(pairs):
    if not all_same_io_shape(pairs):
        return None
    mapping: Dict[int, int] = {}
    for p in pairs:
        ig = np.asarray(p["input"]).flatten().tolist()
        og = np.asarray(p["output"]).flatten().tolist()
        for a, b in zip(ig, og):
            a, b = int(a), int(b)
            if a in mapping and mapping[a] != b:
                return None
            mapping[a] = b
    if all(k == v for k, v in mapping.items()):
        return None
    return mapping

def detect_rotation_plus_color(pairs):
    for rot_label, k in [("180", 2), ("90cw", -1), ("90ccw", 1)]:
        mapping: Dict[int, int] = {}
        ok = True
        for p in pairs:
            ig = np.asarray(p["input"]); og = np.asarray(p["output"])
            r = np.rot90(ig, k)
            if r.shape != og.shape:
                ok = False; break
            for a, b in zip(r.flatten().tolist(), og.flatten().tolist()):
                a, b = int(a), int(b)
                if a in mapping and mapping[a] != b:
                    ok = False; break
                mapping[a] = b
            if not ok: break
        if ok and any(k2 != v for k2, v in mapping.items()):
            return rot_label, mapping
    return None

def detect_flip_plus_color(pairs):
    for name, fn in [("h", np.flipud), ("w", np.fliplr),
                     ("both", lambda a: np.flipud(np.fliplr(a)))]:
        mapping: Dict[int, int] = {}
        ok = True
        for p in pairs:
            ig = np.asarray(p["input"]); og = np.asarray(p["output"])
            f = fn(ig)
            if f.shape != og.shape:
                ok = False; break
            for a, b in zip(f.flatten().tolist(), og.flatten().tolist()):
                a, b = int(a), int(b)
                if a in mapping and mapping[a] != b:
                    ok = False; break
                mapping[a] = b
            if not ok: break
        if ok and any(k2 != v for k2, v in mapping.items()):
            return name, mapping
    return None

def detect_transpose_plus_color(pairs):
    mapping: Dict[int, int] = {}
    for p in pairs:
        ig = np.asarray(p["input"]); og = np.asarray(p["output"])
        if ig.T.shape != og.shape:
            return None
        for a, b in zip(ig.T.flatten().tolist(), og.flatten().tolist()):
            a, b = int(a), int(b)
            if a in mapping and mapping[a] != b:
                return None
            mapping[a] = b
    if any(k != v for k, v in mapping.items()):
        return mapping
    return None

def detect_fixed_crop(pairs):
    if not pairs:
        return None
    first_in = np.asarray(pairs[0]["input"])
    first_out = np.asarray(pairs[0]["output"])
    oh_, ow_ = first_out.shape
    ih, iw = first_in.shape
    if oh_ > ih or ow_ > iw:
        return None
    for r0 in range(ih - oh_ + 1):
        for c0 in range(iw - ow_ + 1):
            if not np.array_equal(first_in[r0:r0+oh_, c0:c0+ow_], first_out):
                continue
            ok = True
            for p in pairs[1:]:
                ig = np.asarray(p["input"]); og = np.asarray(p["output"])
                if og.shape != (oh_, ow_):
                    ok = False; break
                if r0 + oh_ > ig.shape[0] or c0 + ow_ > ig.shape[1]:
                    ok = False; break
                if not np.array_equal(ig[r0:r0+oh_, c0:c0+ow_], og):
                    ok = False; break
            if ok:
                return (r0, c0, oh_, ow_)
    return None

def detect_translation(pairs):
    if not all_same_io_shape(pairs):
        return None
    first_in = np.asarray(pairs[0]["input"])
    ih, iw = first_in.shape
    # Limit search to reasonable shifts to keep this fast (|dr|, |dc| ≤ 10).
    rng_r = min(ih, 11)
    rng_c = min(iw, 11)
    for dr in range(-rng_r + 1, rng_r):
        for dc in range(-rng_c + 1, rng_c):
            if dr == 0 and dc == 0:
                continue
            ok = True
            for p in pairs:
                ig = np.asarray(p["input"]); og = np.asarray(p["output"])
                if ig.shape != og.shape:
                    ok = False; break
                hh, ww = ig.shape
                shifted = np.zeros_like(ig)
                src_r0 = max(0, -dr); src_r1 = min(hh, hh - dr)
                src_c0 = max(0, -dc); src_c1 = min(ww, ww - dc)
                dst_r0 = max(0, dr);  dst_c0 = max(0, dc)
                rh = src_r1 - src_r0; rw = src_c1 - src_c0
                if rh > 0 and rw > 0:
                    shifted[dst_r0:dst_r0+rh, dst_c0:dst_c0+rw] = \
                        ig[src_r0:src_r1, src_c0:src_c1]
                if not np.array_equal(shifted, og):
                    ok = False; break
            if ok:
                return (dr, dc)
    return None

def detect_color_filter(pairs):
    """Set of colours that get replaced with 0, everything else unchanged."""
    if not all_same_io_shape(pairs):
        return None
    candidate: Optional[set] = None
    for p in pairs:
        ig = np.asarray(p["input"]); og = np.asarray(p["output"])
        diff = (ig != og)
        if not np.any(diff):
            continue
        if not np.all(og[diff] == 0):
            return None
        local = set(int(x) for x in ig[diff].tolist())
        candidate = local if candidate is None else candidate | local
    if not candidate:
        return None
    for p in pairs:
        ig = np.asarray(p["input"]).copy()
        for c_ in candidate:
            ig[ig == c_] = 0
        if not np.array_equal(ig, np.asarray(p["output"])):
            return None
    return candidate


def detect_upscale(pairs):
    """Nearest-neighbor integer upscale by factor f; same f for all pairs."""
    if not pairs:
        return None
    for f in [2, 3, 4, 5]:
        ok = True
        for p in pairs:
            ig = np.asarray(p["input"]); og = np.asarray(p["output"])
            ih, iw = ig.shape
            oh_, ow_ = og.shape
            if oh_ != ih * f or ow_ != iw * f:
                ok = False; break
            if ih * f > H or iw * f > W:
                ok = False; break
            scaled = np.repeat(np.repeat(ig, f, axis=0), f, axis=1)
            if not np.array_equal(scaled, og):
                ok = False; break
        if ok:
            return f
    return None


def detect_downscale(pairs):
    """Downsample by taking every f-th pixel; same f for all pairs."""
    if not pairs:
        return None
    for f in [2, 3, 4, 5]:
        ok = True
        for p in pairs:
            ig = np.asarray(p["input"]); og = np.asarray(p["output"])
            ih, iw = ig.shape
            oh_, ow_ = og.shape
            if ih != oh_ * f or iw != ow_ * f:
                ok = False; break
            if not np.array_equal(ig[::f, ::f], og):
                ok = False; break
        if ok:
            return f
    return None


def detect_tile(pairs):
    """Output is input tiled tr × tc times."""
    if not pairs:
        return None
    # Deduce (tr, tc) from first pair.
    first_in = np.asarray(pairs[0]["input"])
    first_out = np.asarray(pairs[0]["output"])
    ih, iw = first_in.shape
    oh_, ow_ = first_out.shape
    if ih == 0 or iw == 0:
        return None
    if oh_ % ih != 0 or ow_ % iw != 0:
        return None
    tr, tc = oh_ // ih, ow_ // iw
    if tr * ih > H or tc * iw > W:
        return None
    if tr == 1 and tc == 1:
        return None
    for p in pairs:
        ig = np.asarray(p["input"]); og = np.asarray(p["output"])
        ih2, iw2 = ig.shape
        if og.shape != (ih2 * tr, iw2 * tc):
            return None
        tiled = np.tile(ig, (tr, tc))
        if not np.array_equal(tiled, og):
            return None
    return (tr, tc)


def detect_concat_flip_w(pairs):
    """Output = [input | fliplr(input)]."""
    if not pairs: return None
    for p in pairs:
        ig = np.asarray(p["input"]); og = np.asarray(p["output"])
        ih, iw = ig.shape
        if og.shape != (ih, iw * 2): return None
        if not np.array_equal(np.concatenate([ig, np.fliplr(ig)], axis=1), og):
            return None
    return True


def detect_concat_flip_h(pairs):
    if not pairs: return None
    for p in pairs:
        ig = np.asarray(p["input"]); og = np.asarray(p["output"])
        ih, iw = ig.shape
        if og.shape != (ih * 2, iw): return None
        if not np.array_equal(np.concatenate([ig, np.flipud(ig)], axis=0), og):
            return None
    return True


def detect_concat_rot180_w(pairs):
    if not pairs: return None
    for p in pairs:
        ig = np.asarray(p["input"]); og = np.asarray(p["output"])
        ih, iw = ig.shape
        if og.shape != (ih, iw * 2): return None
        if not np.array_equal(np.concatenate([ig, np.rot90(ig, 2)], axis=1), og):
            return None
    return True


def detect_quadrant_mirror(pairs):
    """Output (2h, 2w) = quadrant mirror of input (h, w)."""
    if not pairs: return None
    for p in pairs:
        ig = np.asarray(p["input"]); og = np.asarray(p["output"])
        ih, iw = ig.shape
        if og.shape != (ih * 2, iw * 2): return None
        top = np.concatenate([ig, np.fliplr(ig)], axis=1)
        bot = np.concatenate([np.flipud(ig), np.rot90(ig, 2)], axis=1)
        expected = np.concatenate([top, bot], axis=0)
        if not np.array_equal(expected, og): return None
    return True


def detect_row_broadcast(pairs):
    """Every row of output == some specific row of input (same index for all pairs)."""
    if not all_same_io_shape(pairs):
        return None
    chosen_row = None
    for p in pairs:
        ig = np.asarray(p["input"]); og = np.asarray(p["output"])
        ih, iw = ig.shape
        matched = None
        for r in range(ih):
            if np.all(og == ig[r, :]):
                matched = r; break
        if matched is None:
            return None
        if chosen_row is None:
            chosen_row = matched
        elif chosen_row != matched:
            return None
    return chosen_row


def detect_col_broadcast(pairs):
    if not all_same_io_shape(pairs):
        return None
    chosen_col = None
    for p in pairs:
        ig = np.asarray(p["input"]); og = np.asarray(p["output"])
        ih, iw = ig.shape
        matched = None
        for c in range(iw):
            if np.all(og == ig[:, c:c+1]):
                matched = c; break
        if matched is None:
            return None
        if chosen_col is None:
            chosen_col = matched
        elif chosen_col != matched:
            return None
    return chosen_col


def detect_crop_plus_color(pairs):
    """Output = crop with same offset + a color remap applied."""
    if not pairs: return None
    first_in = np.asarray(pairs[0]["input"])
    first_out = np.asarray(pairs[0]["output"])
    oh_, ow_ = first_out.shape
    ih, iw = first_in.shape
    if oh_ > ih or ow_ > iw:
        return None
    for r0 in range(ih - oh_ + 1):
        for c0 in range(iw - ow_ + 1):
            # Aggregate cmap across ALL pairs so partial colors don't bite us.
            cmap: Dict[int, int] = {}
            valid = True
            for p in pairs:
                ig = np.asarray(p["input"]); og = np.asarray(p["output"])
                if og.shape != (oh_, ow_):
                    valid = False; break
                if r0 + oh_ > ig.shape[0] or c0 + ow_ > ig.shape[1]:
                    valid = False; break
                region = ig[r0:r0+oh_, c0:c0+ow_]
                for a, b in zip(region.flatten().tolist(), og.flatten().tolist()):
                    a, b = int(a), int(b)
                    if a in cmap and cmap[a] != b:
                        valid = False; break
                    cmap[a] = b
                if not valid: break
            if not valid:
                continue
            if all(k == v for k, v in cmap.items()):
                continue  # pure crop, let detect_fixed_crop handle it
            # Final verification (paranoia)
            ok = True
            for p in pairs:
                ig = np.asarray(p["input"]); og = np.asarray(p["output"])
                region2 = ig[r0:r0+oh_, c0:c0+ow_]
                mapped = region2.copy()
                for k, v in cmap.items():
                    mapped[region2 == k] = v
                if not np.array_equal(mapped, og):
                    ok = False; break
            if ok:
                return (r0, c0, oh_, ow_, cmap)
    return None


def detect_border_add(pairs):
    """Output = input with a uniform border of thickness b, color fill."""
    if not pairs: return None
    first_in = np.asarray(pairs[0]["input"])
    first_out = np.asarray(pairs[0]["output"])
    ih, iw = first_in.shape
    oh_, ow_ = first_out.shape
    if (oh_ - ih) != (ow_ - iw):
        return None
    delta = oh_ - ih
    if delta <= 0 or delta % 2 != 0:
        return None
    b = delta // 2
    if not np.array_equal(first_out[b:b+ih, b:b+iw], first_in):
        return None
    vals = set(first_out[:b, :].flatten().tolist())
    vals |= set(first_out[-b:, :].flatten().tolist())
    vals |= set(first_out[:, :b].flatten().tolist())
    vals |= set(first_out[:, -b:].flatten().tolist())
    if len(vals) != 1:
        return None
    fill = int(vals.pop())
    for p in pairs[1:]:
        ig = np.asarray(p["input"]); og = np.asarray(p["output"])
        ih2, iw2 = ig.shape
        if og.shape != (ih2 + 2*b, iw2 + 2*b):
            return None
        if not np.array_equal(og[b:b+ih2, b:b+iw2], ig):
            return None
        m = np.zeros(og.shape, dtype=bool)
        m[:b, :] = True; m[-b:, :] = True
        m[:, :b] = True; m[:, -b:] = True
        if not np.all(og[m] == fill):
            return None
    return (b, fill)


# =============================================================================
# Orchestrator: try all applicable candidates, pick cheapest correct one
# =============================================================================

def _candidates(train_pairs, all_pairs):
    """`train_pairs` drives pattern detection (the transformation rule must be
    visible there). `all_pairs` — which includes test and arc-gen — is used
    only to decide whether input sizes are truly fixed across all examples,
    so framed builders don't over-commit to a size that test/arc-gen break."""
    fixed_size = fixed_input_size(all_pairs)
    is_full_canvas = (fixed_size == (30, 30))
    same_shape = all_same_io_shape(train_pairs)

    # 1. Identity
    if detect_identity(train_pairs):
        yield "identity", make_identity

    # 2. Rotations / flips / transposes
    rot = detect_rotation(train_pairs)
    if rot == "180":
        if is_full_canvas:
            yield "rot180", make_rot_180
        if fixed_size is not None:
            h, w = fixed_size
            yield f"rot180_framed", (lambda h=h, w=w: make_framed_rot180(h, w))
    if rot == "90cw":
        if is_full_canvas:
            yield "rot90cw", make_rot_90_cw
        if fixed_size is not None:
            h, w = fixed_size
            yield f"rot90cw_framed", (lambda h=h, w=w: make_framed_rot_90_cw(h, w))
    if rot == "90ccw":
        if is_full_canvas:
            yield "rot90ccw", make_rot_90_ccw
        if fixed_size is not None:
            h, w = fixed_size
            yield f"rot90ccw_framed", (lambda h=h, w=w: make_framed_rot_90_ccw(h, w))

    flip = detect_flip(train_pairs)
    if flip == "h":
        if is_full_canvas:
            yield "flip_h", make_flip_h
        if fixed_size is not None:
            h, w = fixed_size
            yield f"flip_h_framed", (lambda h=h, w=w: make_framed_flip_h(h, w))
    if flip == "w":
        if is_full_canvas:
            yield "flip_w", make_flip_w
        if fixed_size is not None:
            h, w = fixed_size
            yield f"flip_w_framed", (lambda h=h, w=w: make_framed_flip_w(h, w))
    if flip == "both":
        if is_full_canvas:
            yield "flip_both", make_flip_both
        if fixed_size is not None:
            h, w = fixed_size
            yield f"flip_both_framed", (lambda h=h, w=w: make_framed_rot180(h, w))

    if detect_transpose(train_pairs):
        if is_full_canvas:
            yield "transpose", make_transpose_hw
        if fixed_size is not None:
            h, w = fixed_size
            yield f"transpose_framed", (lambda h=h, w=w: make_framed_transpose(h, w))

    if detect_anti_transpose(train_pairs) and is_full_canvas:
        yield "anti_transpose", make_anti_transpose

    # 3. Color map
    cmap = detect_color_map(train_pairs)
    if cmap is not None and same_shape:
        yield "color_remap", (lambda cm=cmap: make_color_remap_gather(cm))

    # 4. Compositions: rotation/flip/transpose + color
    rot_col = detect_rotation_plus_color(train_pairs)
    if rot_col is not None and same_shape:
        rl, cm = rot_col
        if rl == "180":
            if is_full_canvas:
                yield "rot180_color", (lambda cm=cm: make_transform_plus_color(make_rot_180, cm))
            if fixed_size is not None:
                h, w = fixed_size
                yield "rot180_framed_color", (
                    lambda h=h, w=w, cm=cm: make_transform_plus_color(
                        lambda h=h, w=w: make_framed_rot180(h, w), cm
                    )
                )
        elif rl == "90cw":
            if is_full_canvas:
                yield "rot90cw_color", (lambda cm=cm: make_transform_plus_color(make_rot_90_cw, cm))
            if fixed_size is not None:
                h, w = fixed_size
                yield "rot90cw_framed_color", (
                    lambda h=h, w=w, cm=cm: make_transform_plus_color(
                        lambda h=h, w=w: make_framed_rot_90_cw(h, w), cm
                    )
                )
        elif rl == "90ccw":
            if is_full_canvas:
                yield "rot90ccw_color", (lambda cm=cm: make_transform_plus_color(make_rot_90_ccw, cm))
            if fixed_size is not None:
                h, w = fixed_size
                yield "rot90ccw_framed_color", (
                    lambda h=h, w=w, cm=cm: make_transform_plus_color(
                        lambda h=h, w=w: make_framed_rot_90_ccw(h, w), cm
                    )
                )

    flip_col = detect_flip_plus_color(train_pairs)
    if flip_col is not None and same_shape:
        fl, cm = flip_col
        if is_full_canvas:
            base_full = {"h": make_flip_h, "w": make_flip_w, "both": make_flip_both}[fl]
            yield f"flip_{fl}_color", (lambda b=base_full, cm=cm: make_transform_plus_color(b, cm))
        if fixed_size is not None:
            h, w = fixed_size
            base_framed = {
                "h":    lambda h=h, w=w: make_framed_flip_h(h, w),
                "w":    lambda h=h, w=w: make_framed_flip_w(h, w),
                "both": lambda h=h, w=w: make_framed_rot180(h, w),
            }[fl]
            yield f"flip_{fl}_framed_color", (
                lambda base_framed=base_framed, cm=cm:
                    make_transform_plus_color(base_framed, cm)
            )

    trp_col = detect_transpose_plus_color(train_pairs)
    if trp_col is not None:
        if is_full_canvas:
            yield "transpose_color", (lambda cm=trp_col: make_transform_plus_color(make_transpose_hw, cm))
        if fixed_size is not None:
            h, w = fixed_size
            yield "transpose_framed_color", (
                lambda h=h, w=w, cm=trp_col:
                    make_transform_plus_color(lambda h=h, w=w: make_framed_transpose(h, w), cm)
            )

    # 5. Color filter
    cf = detect_color_filter(train_pairs)
    if cf is not None and same_shape:
        mapping = {c_: 0 for c_ in cf}
        yield "color_filter", (lambda cm=mapping: make_color_remap_gather(cm))

    # 6. Fixed crop
    crop = detect_fixed_crop(train_pairs)
    if crop is not None:
        r0, c0, oh_, ow_ = crop
        yield f"crop_{r0}_{c0}", (
            lambda r0=r0, c0=c0, oh_=oh_, ow_=ow_: make_crop(r0, c0, oh_, ow_)
        )

    # 7. Fixed translation
    tr = detect_translation(train_pairs)
    if tr is not None:
        dr, dc = tr
        if is_full_canvas:
            yield f"translate_{dr}_{dc}", (lambda dr=dr, dc=dc: make_translation(dr, dc))
        if fixed_size is not None:
            h, w = fixed_size
            yield f"translate_framed_{dr}_{dc}", (
                lambda h=h, w=w, dr=dr, dc=dc: make_framed_translation(h, w, dr, dc)
            )

    # 8. Upscale (nearest-neighbor, integer factor)
    if fixed_size is not None:
        up_f = detect_upscale(train_pairs)
        if up_f is not None:
            h, w = fixed_size
            yield f"upscale_{up_f}x", (
                lambda f=up_f, h=h, w=w: make_upscale(f, h, w)
            )

    # 9. Downscale
    if fixed_size is not None:
        down_f = detect_downscale(train_pairs)
        if down_f is not None:
            h, w = fixed_size
            yield f"downscale_{down_f}x", (
                lambda f=down_f, h=h, w=w: make_downscale(f, h, w)
            )

    # 10. Tile
    if fixed_size is not None:
        tile = detect_tile(train_pairs)
        if tile is not None:
            tr_, tc_ = tile
            h, w = fixed_size
            yield f"tile_{tr_}x{tc_}", (
                lambda tr_=tr_, tc_=tc_, h=h, w=w: make_tile(tr_, tc_, h, w)
            )

    # 10b. Concat-mirror patterns (fixed size only)
    if fixed_size is not None:
        h, w = fixed_size
        if detect_concat_flip_w(train_pairs) and h * 1 <= H and w * 2 <= W:
            yield "concat_flip_w", (lambda h=h, w=w: make_concat_flip_w(h, w))
        if detect_concat_flip_h(train_pairs) and h * 2 <= H and w <= W:
            yield "concat_flip_h", (lambda h=h, w=w: make_concat_flip_h(h, w))
        if detect_concat_rot180_w(train_pairs) and h <= H and w * 2 <= W:
            yield "concat_rot180_w", (lambda h=h, w=w: make_concat_rot180_w(h, w))
        if detect_quadrant_mirror(train_pairs) and h * 2 <= H and w * 2 <= W:
            yield "quadrant_mirror", (lambda h=h, w=w: make_quadrant_mirror(h, w))

    # 10c. Row/col broadcast (same-size)
    if fixed_size is not None:
        h, w = fixed_size
        rb = detect_row_broadcast(train_pairs)
        if rb is not None:
            yield f"row_broadcast_{rb}", (
                lambda h=h, w=w, rb=rb: make_row_broadcast(h, w, rb)
            )
        cb = detect_col_broadcast(train_pairs)
        if cb is not None:
            yield f"col_broadcast_{cb}", (
                lambda h=h, w=w, cb=cb: make_col_broadcast(h, w, cb)
            )

    # 10d. Crop + color
    ccp = detect_crop_plus_color(train_pairs)
    if ccp is not None:
        r0, c0, oh_, ow_, cmap = ccp
        yield f"crop_color_{r0}_{c0}", (
            lambda r0=r0, c0=c0, oh_=oh_, ow_=ow_, cmap=cmap:
                make_crop_then_color(r0, c0, oh_, ow_, cmap)
        )

    # 10e. Border add
    if fixed_size is not None:
        ba = detect_border_add(train_pairs)
        if ba is not None:
            b, fill = ba
            h, w = fixed_size
            if h + 2*b <= H and w + 2*b <= W:
                def _build_border(h=h, w=w, b=b, fill=fill):
                    m = make_pad_with_border(h, w, b, fill)
                    if m is None:
                        raise ValueError("border add exceeds canvas")
                    return m
                yield f"border_add_{b}_{fill}", _build_border

    # 11. Constant output
    cst = detect_const(train_pairs)
    if cst is not None:
        yield "const", (lambda k=cst: make_const(k))


def solve_task(task_data: dict, task_name: str = "") -> Optional[Any]:
    train_pairs = task_data.get("train", []) or []
    test_pairs = task_data.get("test", []) or []
    arc_gen = task_data.get("arc-gen", []) or []
    arc_sample = arc_gen[:10] if arc_gen else []
    all_pairs = train_pairs + test_pairs + arc_sample
    if not all_pairs or not train_pairs:
        return None, None, None

    best_model = None
    best_cost = float("inf")
    best_label = None

    for label, builder in _candidates(train_pairs, all_pairs):
        try:
            model = builder()
        except Exception:
            continue
        if not check_fits(model) or not check_ops_allowed(model):
            continue
        if not check_model_correct(model, all_pairs):
            continue
        c = cost(model)
        if c < best_cost:
            best_cost = c
            best_model = model
            best_label = label

    return best_model, best_label, best_cost


# =============================================================================
# Driver: process all tasks, emit submission.zip
# =============================================================================

def load_task(path):
    with open(path) as f:
        return json.load(f)

def save_model(model, path):
    try:
        onnx.checker.check_model(model)
    except Exception:
        pass
    with open(path, "wb") as f:
        f.write(model.SerializeToString())


def find_task_files():
    candidates = [
        Path("/kaggle/input/competitions/neurogolf-2026"),
        Path("/kaggle/input/neurogolf-2026"),
        Path("/kaggle/input/arc-prize-2025/arc-agi-1-training"),
        Path("/kaggle/input"),
        Path("."),
    ]
    for d in candidates:
        if d.exists():
            files = sorted(d.glob("task*.json"))
            if files:
                return files
    task_files = []
    root_base = "/kaggle/input" if Path("/kaggle/input").exists() else "."
    for root, _, files in os.walk(root_base):
        for fname in files:
            if fname.startswith("task") and fname.endswith(".json"):
                task_files.append(Path(root) / fname)
    return sorted(task_files)
