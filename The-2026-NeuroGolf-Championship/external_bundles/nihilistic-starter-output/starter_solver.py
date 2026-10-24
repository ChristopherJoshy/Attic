
import os, json, zipfile, math, copy, sys, time, traceback, random, tempfile, importlib.util
import numpy as np
from pathlib import Path
from itertools import product as iprod

import onnx
import onnx.helper as oh
import onnx.numpy_helper as onh
from onnx import TensorProto

try:
    import onnxruntime as ort
except ImportError:
    os.system("pip install onnxruntime -q")
    import onnxruntime as ort

try:
    import onnx_tool
except ImportError:
    os.system("pip install onnx-tool -q")

# ============================================================
# CONFIG
# ============================================================
TASK_DIR = Path("/kaggle/input/competitions/neurogolf-2026")
OUTPUT_DIR = Path("/kaggle/working") if Path("/kaggle/working").exists() else Path(".")
C, H, W = 10, 30, 30
HW = H * W
CHW = C * H * W
MAX_ARC_GEN_VALIDATE = 9999  # FIX #2: validate ALL arc-gen, not just 50

# ============================================================
# EXACT SCORING via neurogolf_utils
# ============================================================
_UTILS = None
def _load_utils():
    global _UTILS
    if _UTILS is not None: return _UTILS
    for d in [TASK_DIR, Path('/kaggle/input/competitions/neurogolf-2026')]:
        up = d / 'neurogolf_utils' / 'neurogolf_utils.py'
        if up.exists():
            spec = importlib.util.spec_from_file_location('ng', up)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            _UTILS = mod
            return mod
    return None

def exact_cost_via_utils(model):
    """Use neurogolf_utils.score_network for EXACT cost."""
    utils = _load_utils()
    if utils is None: return None
    try:
        with tempfile.NamedTemporaryFile(suffix=".onnx", delete=False) as f:
            f.write(model.SerializeToString()); f.flush(); fname = f.name
        macs, mem, params = utils.score_network(fname)
        os.unlink(fname)
        return int(macs + mem + params)
    except:
        try: os.unlink(fname)
        except: pass
        return None

# ============================================================
# DATA UTILS
# ============================================================
def load_task(path):
    with open(path) as f:
        return json.load(f)

def grid_to_tensor(grid):
    g = np.array(grid, dtype=np.int32)
    h, w = g.shape
    t = np.zeros((1, C, H, W), dtype=np.float32)
    if h > H or w > W:
        return t
    for v in range(C):
        t[0, v, :h, :w] = (g == v).astype(np.float32)
    return t

def tensor_to_grid(t, out_h, out_w):
    arr = t[0]
    out_h = min(out_h, H)
    out_w = min(out_w, W)
    slice_ = arr[:, :out_h, :out_w]
    max_vals = slice_.max(axis=0)
    argmax = slice_.argmax(axis=0)
    grid = np.where(max_vals < 0.5, 0, argmax).astype(int)
    return grid.tolist()

def shapes_match(p):
    return np.array(p["input"]).shape == np.array(p["output"]).shape

# ============================================================
# MODEL CHECK + COST
# ============================================================
def check_model_correct(model, pairs):
    try:
        buf = model.SerializeToString()
        so = ort.SessionOptions(); so.log_severity_level = 3
        sess = ort.InferenceSession(buf, sess_options=so, providers=["CPUExecutionProvider"])
        for p in pairs:
            inp = grid_to_tensor(p["input"])
            out_g = np.array(p["output"])
            oh_, ow_ = out_g.shape
            pred = sess.run(None, {"input": inp})[0]
            pred_grid = tensor_to_grid(pred, oh_, ow_)
            if pred_grid != p["output"]:
                return False
        return True
    except Exception:
        return False

def estimate_model_cost(model):
    """FIX #1: Don't count elementwise ops as MACs — organizers only count Conv/Gemm/MatMul."""
    try:
        # First try exact scoring
        ec = exact_cost_via_utils(model)
        if ec is not None:
            return ec

        # Fallback estimate
        total_params = 0
        total_bytes = 0
        tensors = {}

        for init in model.graph.initializer:
            arr = onh.to_array(init)
            tensors[init.name] = arr
            total_params += arr.size
            total_bytes += arr.nbytes
        for node in model.graph.node:
            if node.op_type == "Constant":
                for attr in node.attribute:
                    if attr.t and (attr.t.raw_data or list(attr.t.float_data)
                                   or list(attr.t.int64_data) or list(attr.t.int32_data)):
                        arr = onh.to_array(attr.t)
                        if node.output:
                            tensors[node.output[0]] = arr
                        total_params += arr.size
                        total_bytes += arr.nbytes

        total_macs = 0
        for node in model.graph.node:
            if node.op_type == "Conv":
                if len(node.input) >= 2 and node.input[1] in tensors:
                    w = tensors[node.input[1]]
                    if w.ndim == 4:
                        c_out, c_in, kh, kw = w.shape
                        total_macs += c_out * c_in * kh * kw * H * W
            elif node.op_type == "Gemm":
                if len(node.input) >= 2 and node.input[1] in tensors:
                    w = tensors[node.input[1]]
                    if w.ndim == 2:
                        total_macs += w.shape[0] * w.shape[1]
            # FIX: Do NOT count Mul/Add/Max/Relu as MACs

        return total_params + total_bytes + total_macs
    except Exception:
        return float('inf')

# ============================================================
# ONNX BUILDERS
# ============================================================

def make_identity_onnx():
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    node = oh.make_node("Identity", ["input"], ["output"])
    graph = oh.make_graph([node], "identity", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model

# ============================================================
# CHEAP PRIMITIVES (Transpose/Slice/Pad — 0 MACs)
# ============================================================

def _const_node(name, arr):
    t = onh.from_array(arr, name=name + "_v")
    return oh.make_node("Constant", [], [name], value=t)

def _slice_reverse_nodes(axes, dims, in_name, out_name, suf=""):
    starts = [d - 1 for d in dims]
    ends = [-d - 1 for d in dims]
    steps = [-1] * len(dims)
    return [
        _const_node(f"rs_s{suf}", np.asarray(starts, dtype=np.int64)),
        _const_node(f"rs_e{suf}", np.asarray(ends, dtype=np.int64)),
        _const_node(f"rs_a{suf}", np.asarray(axes, dtype=np.int64)),
        _const_node(f"rs_p{suf}", np.asarray(steps, dtype=np.int64)),
        oh.make_node("Slice",
                     [in_name, f"rs_s{suf}", f"rs_e{suf}", f"rs_a{suf}", f"rs_p{suf}"],
                     [out_name]),
    ]

def _pad_to_canvas_nodes(in_name, out_name, out_h, out_w, suf=""):
    pads = np.asarray([0, 0, 0, 0, 0, 0, H - out_h, W - out_w], dtype=np.int64)
    return [
        _const_node(f"pd{suf}", pads),
        oh.make_node("Pad", [in_name, f"pd{suf}"], [out_name], mode="constant"),
    ]

def _crop_nodes(in_name, out_name, h, w, suf=""):
    return [
        _const_node(f"cs{suf}", np.asarray([0, 0], dtype=np.int64)),
        _const_node(f"ce{suf}", np.asarray([h, w], dtype=np.int64)),
        _const_node(f"ca{suf}", np.asarray([2, 3], dtype=np.int64)),
        oh.make_node("Slice", [in_name, f"cs{suf}", f"ce{suf}", f"ca{suf}"], [out_name]),
    ]

def _build_model_from_nodes(nodes, name):
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    graph = oh.make_graph(nodes, name, [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model

def make_cheap_rot180_framed(h, w):
    nodes = _crop_nodes("input", "content", h, w, "0")
    nodes += _slice_reverse_nodes([2, 3], [h, w], "content", "rotated", "r")
    nodes += _pad_to_canvas_nodes("rotated", "output", h, w, "p")
    return _build_model_from_nodes(nodes, "rot180_framed")

def make_cheap_rot90cw_framed(h, w):
    nodes = _crop_nodes("input", "content", h, w, "0")
    nodes += [oh.make_node("Transpose", ["content"], ["t"], perm=[0, 1, 3, 2])]
    nodes += _slice_reverse_nodes([3], [h], "t", "rotated", "r")
    nodes += _pad_to_canvas_nodes("rotated", "output", w, h, "p")
    return _build_model_from_nodes(nodes, "rot90cw_framed")

def make_cheap_rot90ccw_framed(h, w):
    nodes = _crop_nodes("input", "content", h, w, "0")
    nodes += [oh.make_node("Transpose", ["content"], ["t"], perm=[0, 1, 3, 2])]
    nodes += _slice_reverse_nodes([2], [w], "t", "rotated", "r")
    nodes += _pad_to_canvas_nodes("rotated", "output", w, h, "p")
    return _build_model_from_nodes(nodes, "rot90ccw_framed")

def make_cheap_flip_h_framed(h, w):
    nodes = _crop_nodes("input", "content", h, w, "0")
    nodes += _slice_reverse_nodes([2], [h], "content", "flipped", "r")
    nodes += _pad_to_canvas_nodes("flipped", "output", h, w, "p")
    return _build_model_from_nodes(nodes, "flip_h_framed")

def make_cheap_flip_w_framed(h, w):
    nodes = _crop_nodes("input", "content", h, w, "0")
    nodes += _slice_reverse_nodes([3], [w], "content", "flipped", "r")
    nodes += _pad_to_canvas_nodes("flipped", "output", h, w, "p")
    return _build_model_from_nodes(nodes, "flip_w_framed")

def make_cheap_transpose_framed(h, w):
    nodes = _crop_nodes("input", "content", h, w, "0")
    nodes += [oh.make_node("Transpose", ["content"], ["t"], perm=[0, 1, 3, 2])]
    nodes += _pad_to_canvas_nodes("t", "output", w, h, "p")
    return _build_model_from_nodes(nodes, "transpose_framed")

def make_cheap_anti_transpose_framed(h, w):
    nodes = _crop_nodes("input", "content", h, w, "0")
    nodes += [oh.make_node("Transpose", ["content"], ["t"], perm=[0, 1, 3, 2])]
    nodes += _slice_reverse_nodes([2, 3], [w, h], "t", "rotated", "r")
    nodes += _pad_to_canvas_nodes("rotated", "output", w, h, "p")
    return _build_model_from_nodes(nodes, "anti_transpose_framed")

def make_cheap_crop(r0, c0, out_h, out_w):
    nodes = [
        _const_node("cs", np.asarray([r0, c0], dtype=np.int64)),
        _const_node("ce", np.asarray([r0 + out_h, c0 + out_w], dtype=np.int64)),
        _const_node("ca", np.asarray([2, 3], dtype=np.int64)),
        oh.make_node("Slice", ["input", "cs", "ce", "ca"], ["cropped"]),
    ]
    nodes += _pad_to_canvas_nodes("cropped", "output", out_h, out_w, "p")
    return _build_model_from_nodes(nodes, "crop_net")

def make_cheap_tile(tr, tc, in_h, in_w):
    nodes = _crop_nodes("input", "content", in_h, in_w, "0")
    nodes += [
        _const_node("tile_r", np.asarray([1, 1, tr, tc], dtype=np.int64)),
        oh.make_node("Tile", ["content", "tile_r"], ["tiled"]),
    ]
    nodes += _pad_to_canvas_nodes("tiled", "output", in_h * tr, in_w * tc, "p")
    return _build_model_from_nodes(nodes, "tile_net")

def make_cheap_upscale(f, in_h, in_w):
    nodes = _crop_nodes("input", "content", in_h, in_w, "0")
    nodes += [
        _const_node("rsz_roi", np.asarray([], dtype=np.float32)),
        _const_node("rsz_scales", np.asarray([], dtype=np.float32)),
        _const_node("rsz_sizes", np.asarray([1, C, in_h * f, in_w * f], dtype=np.int64)),
        oh.make_node("Resize", ["content", "rsz_roi", "rsz_scales", "rsz_sizes"], ["upscaled"],
                     mode="nearest", coordinate_transformation_mode="asymmetric", nearest_mode="floor"),
    ]
    nodes += _pad_to_canvas_nodes("upscaled", "output", in_h * f, in_w * f, "p")
    return _build_model_from_nodes(nodes, "upscale_net")

def make_cheap_concat_flip_w(in_h, in_w):
    nodes = _crop_nodes("input", "content", in_h, in_w, "0")
    nodes += _slice_reverse_nodes([3], [in_w], "content", "flipped", "fw")
    nodes += [oh.make_node("Concat", ["content", "flipped"], ["concated"], axis=3)]
    nodes += _pad_to_canvas_nodes("concated", "output", in_h, in_w * 2, "p")
    return _build_model_from_nodes(nodes, "concat_flip_w")

def make_cheap_concat_flip_h(in_h, in_w):
    nodes = _crop_nodes("input", "content", in_h, in_w, "0")
    nodes += _slice_reverse_nodes([2], [in_h], "content", "flipped", "fh")
    nodes += [oh.make_node("Concat", ["content", "flipped"], ["concated"], axis=2)]
    nodes += _pad_to_canvas_nodes("concated", "output", in_h * 2, in_w, "p")
    return _build_model_from_nodes(nodes, "concat_flip_h")

def make_cheap_quadrant_mirror(in_h, in_w):
    nodes = _crop_nodes("input", "content", in_h, in_w, "0")
    nodes += _slice_reverse_nodes([3], [in_w], "content", "fw", "fw")
    nodes += [oh.make_node("Concat", ["content", "fw"], ["top_row"], axis=3)]
    nodes += _slice_reverse_nodes([2], [in_h], "content", "fh", "fh")
    nodes += _slice_reverse_nodes([2, 3], [in_h, in_w], "content", "fr", "fr")
    nodes += [oh.make_node("Concat", ["fh", "fr"], ["bot_row"], axis=3)]
    nodes += [oh.make_node("Concat", ["top_row", "bot_row"], ["full"], axis=2)]
    nodes += _pad_to_canvas_nodes("full", "output", in_h * 2, in_w * 2, "p")
    return _build_model_from_nodes(nodes, "quadrant_mirror")

def make_cheap_self_concat_h(in_h, in_w):
    nodes = _crop_nodes("input", "content", in_h, in_w, "0")
    nodes += [oh.make_node("Concat", ["content", "content"], ["concated"], axis=2)]
    nodes += _pad_to_canvas_nodes("concated", "output", in_h * 2, in_w, "p")
    return _build_model_from_nodes(nodes, "self_concat_h")

def make_cheap_self_concat_w(in_h, in_w):
    nodes = _crop_nodes("input", "content", in_h, in_w, "0")
    nodes += [oh.make_node("Concat", ["content", "content"], ["concated"], axis=3)]
    nodes += _pad_to_canvas_nodes("concated", "output", in_h, in_w * 2, "p")
    return _build_model_from_nodes(nodes, "self_concat_w")

def make_cheap_framed_translation(grid_h, grid_w, dr, dc):
    src_r0 = max(0, -dr); src_r1 = min(grid_h, grid_h - dr)
    src_c0 = max(0, -dc); src_c1 = min(grid_w, grid_w - dc)
    dst_r0 = max(0, dr);  dst_c0 = max(0, dc)
    rh = src_r1 - src_r0; rw = src_c1 - src_c0
    if rh <= 0 or rw <= 0: return None
    nodes = [
        _const_node("fts", np.asarray([src_r0, src_c0], dtype=np.int64)),
        _const_node("fte", np.asarray([src_r1, src_c1], dtype=np.int64)),
        _const_node("fta", np.asarray([2, 3], dtype=np.int64)),
        oh.make_node("Slice", ["input", "fts", "fte", "fta"], ["fsliced"]),
    ]
    pads = np.asarray([0, 0, dst_r0, dst_c0, 0, 0, H - dst_r0 - rh, W - dst_c0 - rw], dtype=np.int64)
    nodes += [_const_node("fpp", pads), oh.make_node("Pad", ["fsliced", "fpp"], ["output"], mode="constant")]
    return _build_model_from_nodes(nodes, "framed_translate")

def make_cheap_downscale(f, in_h, in_w):
    out_h = in_h // f; out_w = in_w // f
    nodes = [
        _const_node("ds_s", np.asarray([0, 0], dtype=np.int64)),
        _const_node("ds_e", np.asarray([in_h, in_w], dtype=np.int64)),
        _const_node("ds_a", np.asarray([2, 3], dtype=np.int64)),
        _const_node("ds_p", np.asarray([f, f], dtype=np.int64)),
        oh.make_node("Slice", ["input", "ds_s", "ds_e", "ds_a", "ds_p"], ["downsampled"]),
    ]
    nodes += _pad_to_canvas_nodes("downsampled", "output", out_h, out_w, "p")
    return _build_model_from_nodes(nodes, "downscale")

def make_cheap_row_broadcast(in_h, in_w, row_idx=0):
    nodes = [
        _const_node("rb_s", np.asarray([row_idx], dtype=np.int64)),
        _const_node("rb_e", np.asarray([row_idx + 1], dtype=np.int64)),
        _const_node("rb_a", np.asarray([2], dtype=np.int64)),
        oh.make_node("Slice", ["input", "rb_s", "rb_e", "rb_a"], ["one_row"]),
        _const_node("rb_r", np.asarray([1, 1, in_h, 1], dtype=np.int64)),
        oh.make_node("Tile", ["one_row", "rb_r"], ["tiled"]),
        _const_node("rb_cs", np.asarray([0, 0], dtype=np.int64)),
        _const_node("rb_ce", np.asarray([in_h, in_w], dtype=np.int64)),
        _const_node("rb_ca", np.asarray([2, 3], dtype=np.int64)),
        oh.make_node("Slice", ["tiled", "rb_cs", "rb_ce", "rb_ca"], ["cropped"]),
    ]
    nodes += _pad_to_canvas_nodes("cropped", "output", in_h, in_w, "p")
    return _build_model_from_nodes(nodes, "row_broadcast")

def make_cheap_col_broadcast(in_h, in_w, col_idx=0):
    nodes = [
        _const_node("cb_s", np.asarray([col_idx], dtype=np.int64)),
        _const_node("cb_e", np.asarray([col_idx + 1], dtype=np.int64)),
        _const_node("cb_a", np.asarray([3], dtype=np.int64)),
        oh.make_node("Slice", ["input", "cb_s", "cb_e", "cb_a"], ["one_col"]),
        _const_node("cb_r", np.asarray([1, 1, 1, in_w], dtype=np.int64)),
        oh.make_node("Tile", ["one_col", "cb_r"], ["tiled"]),
        _const_node("cb_cs", np.asarray([0, 0], dtype=np.int64)),
        _const_node("cb_ce", np.asarray([in_h, in_w], dtype=np.int64)),
        _const_node("cb_ca", np.asarray([2, 3], dtype=np.int64)),
        oh.make_node("Slice", ["tiled", "cb_cs", "cb_ce", "cb_ca"], ["cropped"]),
    ]
    nodes += _pad_to_canvas_nodes("cropped", "output", in_h, in_w, "p")
    return _build_model_from_nodes(nodes, "col_broadcast")

def make_cheap_border_add(grid_h, grid_w, border, fill_color):
    oh_ = grid_h + 2 * border; ow_ = grid_w + 2 * border
    if oh_ > H or ow_ > W: return None
    nodes = _crop_nodes("input", "content", grid_h, grid_w, "pb0")
    nodes += [_const_node("pb_pads", np.asarray([0, 0, border, border, 0, 0, border, border], dtype=np.int64)),
              oh.make_node("Pad", ["content", "pb_pads"], ["padded"], mode="constant")]
    mask = np.zeros((1, C, oh_, ow_), dtype=np.float32)
    if 0 <= fill_color < C:
        mask[0, fill_color, :border, :] = 1.0; mask[0, fill_color, -border:, :] = 1.0
        mask[0, fill_color, :, :border] = 1.0; mask[0, fill_color, :, -border:] = 1.0
    nodes += [_const_node("pb_mask", mask), oh.make_node("Add", ["padded", "pb_mask"], ["bordered"])]
    nodes += _pad_to_canvas_nodes("bordered", "output", oh_, ow_, "pbf")
    return _build_model_from_nodes(nodes, "border_add")

def make_cheap_concat_rot180_w(in_h, in_w):
    nodes = _crop_nodes("input", "content", in_h, in_w, "0")
    nodes += _slice_reverse_nodes([2, 3], [in_h, in_w], "content", "rotated", "r")
    nodes += [oh.make_node("Concat", ["content", "rotated"], ["concated"], axis=3)]
    nodes += _pad_to_canvas_nodes("concated", "output", in_h, in_w * 2, "p")
    return _build_model_from_nodes(nodes, "concat_rot180_w")

def make_cheap_crop_then_color(r0, c0, out_h, out_w, color_map):
    nodes = [
        _const_node("ctc_s", np.asarray([r0, c0], dtype=np.int64)),
        _const_node("ctc_e", np.asarray([r0 + out_h, c0 + out_w], dtype=np.int64)),
        _const_node("ctc_a", np.asarray([2, 3], dtype=np.int64)),
        oh.make_node("Slice", ["input", "ctc_s", "ctc_e", "ctc_a"], ["cropped"]),
    ]
    inv = {d: s for s, d in color_map.items()}
    idx = np.arange(C, dtype=np.int64); mask = np.ones(C, dtype=np.float32)
    src_away = {s for s, d in color_map.items() if s != d}
    for d in range(C):
        if d in inv: idx[d] = inv[d]
        elif d in src_away: idx[d] = 0; mask[d] = 0.0
    nodes += [_const_node("gi_ctc", idx)]
    if mask.min() == 1.0:
        nodes += [oh.make_node("Gather", ["cropped", "gi_ctc"], ["colored"], axis=1)]
    else:
        nodes += [oh.make_node("Gather", ["cropped", "gi_ctc"], ["g_ctc"], axis=1),
                  _const_node("cm_ctc", mask.reshape(1, C, 1, 1)),
                  oh.make_node("Mul", ["g_ctc", "cm_ctc"], ["colored"])]
    nodes += _pad_to_canvas_nodes("colored", "output", out_h, out_w, "pctc")
    return _build_model_from_nodes(nodes, "crop_color")

# ============================================================
# GATHER-BASED BUILDERS
# ============================================================
SAFE_PAD_IDX = HW - 1

def _compact_mask(mask):
    if mask.ndim == 4 and mask.shape[0] == 1 and mask.shape[1] == C:
        if np.all(mask[0, 0:1] == mask[0, :]):
            return mask[:, 0:1].copy()
    return mask

def make_gather_onnx(gather_indices, mask=None):
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    shape_chw = onh.from_array(np.array([1, C, HW], dtype=np.int64), name="shape_chw")
    shape_chw_node = oh.make_node("Constant", [], ["shape_chw"], value=shape_chw)
    inp_reshape = oh.make_node("Reshape", ["input", "shape_chw"], ["inp_chw"])
    gi_tensor = onh.from_array(gather_indices.astype(np.int32), name="gather_idx")
    gi_node = oh.make_node("Constant", [], ["gather_idx"], value=gi_tensor)
    gather_node = oh.make_node("Gather", ["inp_chw", "gather_idx"], ["gathered"], axis=2)
    out_shape = onh.from_array(np.array([1, C, H, W], dtype=np.int64), name="out_shape")
    out_shape_node = oh.make_node("Constant", [], ["out_shape"], value=out_shape)

    if mask is not None:
        reshape_back = oh.make_node("Reshape", ["gathered", "out_shape"], ["gathered_4d"])
        mask = _compact_mask(mask)
        mask_tensor = onh.from_array(mask.astype(np.float32), name="mask")
        mask_node = oh.make_node("Constant", [], ["mask"], value=mask_tensor)
        mul_node = oh.make_node("Mul", ["gathered_4d", "mask"], ["output"])
        nodes = [shape_chw_node, inp_reshape, gi_node, gather_node,
                 out_shape_node, reshape_back, mask_node, mul_node]
    else:
        reshape_back = oh.make_node("Reshape", ["gathered", "out_shape"], ["output"])
        nodes = [shape_chw_node, inp_reshape, gi_node, gather_node, out_shape_node, reshape_back]

    graph = oh.make_graph(nodes, "gather_net", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model

def make_const_onnx(const_output):
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    const_tensor = onh.from_array(const_output.astype(np.float32), name="const_out")
    const_node = oh.make_node("Constant", [], ["const_out"], value=const_tensor)
    id_node = oh.make_node("Identity", ["const_out"], ["output"])
    graph = oh.make_graph([const_node, id_node], "const_net", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model

def make_conv1x1_onnx(weight):
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    w_tensor = onh.from_array(weight.astype(np.float32), name="conv_weight")
    w_node = oh.make_node("Constant", [], ["conv_weight"], value=w_tensor)
    conv_node = oh.make_node("Conv", ["input", "conv_weight"], ["output"],
                             kernel_shape=[1, 1], pads=[0, 0, 0, 0])
    graph = oh.make_graph([w_node, conv_node], "conv1x1", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model

def make_channel_gather_onnx(gather_ch):
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    gi_tensor = onh.from_array(gather_ch.astype(np.int32), name="gi")
    gi_node = oh.make_node("Constant", [], ["gi"], value=gi_tensor)
    gather = oh.make_node("Gather", ["input", "gi"], ["output"], axis=1)
    graph = oh.make_graph([gi_node, gather], "ch_gather", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model

def make_conv_onnx(weight, bias=None, kernel_size=3):
    pad = kernel_size // 2
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    w_tensor = onh.from_array(weight.astype(np.float32), name="conv_weight")
    w_node = oh.make_node("Constant", [], ["conv_weight"], value=w_tensor)
    if bias is not None:
        b_tensor = onh.from_array(bias.astype(np.float32), name="conv_bias")
        b_node = oh.make_node("Constant", [], ["conv_bias"], value=b_tensor)
        conv_node = oh.make_node("Conv", ["input", "conv_weight", "conv_bias"], ["output"],
                                 kernel_shape=[kernel_size, kernel_size], pads=[pad]*4)
        nodes = [w_node, b_node, conv_node]
    else:
        conv_node = oh.make_node("Conv", ["input", "conv_weight"], ["output"],
                                 kernel_shape=[kernel_size, kernel_size], pads=[pad]*4)
        nodes = [w_node, conv_node]
    graph = oh.make_graph(nodes, "conv_net", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model

def make_spatial_then_channel_gather_onnx(spatial_idx, channel_idx):
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    shape_chw = onh.from_array(np.array([1, C, HW], dtype=np.int64), name="shape_chw")
    nodes = [
        oh.make_node("Constant", [], ["shape_chw"], value=shape_chw),
        oh.make_node("Reshape", ["input", "shape_chw"], ["inp_chw"]),
        oh.make_node("Constant", [], ["si"], value=onh.from_array(spatial_idx.astype(np.int32), name="si")),
        oh.make_node("Gather", ["inp_chw", "si"], ["spatial_out"], axis=2),
        oh.make_node("Constant", [], ["out_shape"], value=onh.from_array(np.array([1, C, H, W], dtype=np.int64), name="out_shape")),
        oh.make_node("Reshape", ["spatial_out", "out_shape"], ["spatial_4d"]),
        oh.make_node("Constant", [], ["ci"], value=onh.from_array(channel_idx.astype(np.int32), name="ci")),
        oh.make_node("Gather", ["spatial_4d", "ci"], ["output"], axis=1),
    ]
    graph = oh.make_graph(nodes, "spatial_ch_gather", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model

def make_gather_then_conv1x1_onnx(gather_indices, conv_weight, mask=None):
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    nodes = [
        oh.make_node("Constant", [], ["shape_chw"], value=onh.from_array(np.array([1, C, HW], dtype=np.int64), name="shape_chw")),
        oh.make_node("Reshape", ["input", "shape_chw"], ["inp_chw"]),
        oh.make_node("Constant", [], ["gather_idx"], value=onh.from_array(gather_indices.astype(np.int32), name="gather_idx")),
        oh.make_node("Gather", ["inp_chw", "gather_idx"], ["gathered"], axis=2),
        oh.make_node("Constant", [], ["out_shape"], value=onh.from_array(np.array([1, C, H, W], dtype=np.int64), name="out_shape")),
        oh.make_node("Reshape", ["gathered", "out_shape"], ["gathered_4d"]),
    ]
    w_tensor = onh.from_array(conv_weight.astype(np.float32), name="conv_weight")
    if mask is not None:
        mask = _compact_mask(mask)
        nodes += [
            oh.make_node("Constant", [], ["mask"], value=onh.from_array(mask.astype(np.float32), name="mask")),
            oh.make_node("Mul", ["gathered_4d", "mask"], ["masked"]),
            oh.make_node("Constant", [], ["conv_weight"], value=w_tensor),
            oh.make_node("Conv", ["masked", "conv_weight"], ["output"], kernel_shape=[1, 1], pads=[0, 0, 0, 0]),
        ]
    else:
        nodes += [
            oh.make_node("Constant", [], ["conv_weight"], value=w_tensor),
            oh.make_node("Conv", ["gathered_4d", "conv_weight"], ["output"], kernel_shape=[1, 1], pads=[0, 0, 0, 0]),
        ]
    graph = oh.make_graph(nodes, "gather_conv1x1", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model

def make_symmetry_completion_onnx(gather_index_list, mask=None):
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    ch_mask = np.ones((1, C, 1, 1), dtype=np.float32); ch_mask[0, 0, 0, 0] = 0.0
    nodes = [
        oh.make_node("Constant", [], ["ch_mask"], value=onh.from_array(ch_mask, name="ch_mask")),
        oh.make_node("Mul", ["input", "ch_mask"], ["input_nobg"]),
        oh.make_node("Constant", [], ["shape_chw"], value=onh.from_array(np.array([1, C, HW], dtype=np.int64), name="shape_chw")),
        oh.make_node("Reshape", ["input_nobg", "shape_chw"], ["inp_chw"]),
        oh.make_node("Constant", [], ["out_shape"], value=onh.from_array(np.array([1, C, H, W], dtype=np.int64), name="out_shape")),
    ]
    reshape_names = []
    for i, gi in enumerate(gather_index_list):
        gn = f"gi_{i}"; rn = f"r_{i}"
        nodes += [
            oh.make_node("Constant", [], [gn], value=onh.from_array(gi.astype(np.int32), name=gn)),
            oh.make_node("Gather", ["inp_chw", gn], [f"g_{i}"], axis=2),
            oh.make_node("Reshape", [f"g_{i}", "out_shape"], [rn]),
        ]
        reshape_names.append(rn)
    if len(reshape_names) == 1:
        nodes.append(oh.make_node("Identity", [reshape_names[0]], ["output"]))
    else:
        prev = reshape_names[0]
        for i in range(1, len(reshape_names)):
            out = "output" if (i == len(reshape_names) - 1 and mask is None) else f"max_{i}"
            nodes.append(oh.make_node("Max", [prev, reshape_names[i]], [out]))
            prev = out
    if mask is not None:
        mask = _compact_mask(mask)
        nodes += [
            oh.make_node("Constant", [], ["mask"], value=onh.from_array(mask.astype(np.float32), name="mask")),
            oh.make_node("Mul", [prev, "mask"], ["output"]),
        ]
    graph = oh.make_graph(nodes, "sym_complete", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model

# ============================================================
# DETECTORS
# ============================================================

def detect_rotation(pairs):
    for angle in [90, 180, 270]:
        k = angle // 90
        if all(np.rot90(np.array(p["input"]), k).shape == np.array(p["output"]).shape and
               np.array_equal(np.rot90(np.array(p["input"]), k), np.array(p["output"])) for p in pairs):
            return angle
    return None

def detect_flip(pairs):
    for axis_val, name in [(0, "vertical"), (1, "horizontal"), (-1, "both")]:
        def do_flip(ig, a=axis_val):
            return np.flip(np.flip(ig, 0), 1) if a == -1 else np.flip(ig, axis=a)
        if all(do_flip(np.array(p["input"])).shape == np.array(p["output"]).shape and
               np.array_equal(do_flip(np.array(p["input"])), np.array(p["output"])) for p in pairs):
            return name
    return None

def detect_transpose(pairs):
    return all(np.array(p["input"]).T.shape == np.array(p["output"]).shape and
               np.array_equal(np.array(p["input"]).T, np.array(p["output"])) for p in pairs)

def detect_anti_transpose(pairs):
    return all(np.flip(np.flip(np.array(p["input"]).T, 0), 1).shape == np.array(p["output"]).shape and
               np.array_equal(np.flip(np.flip(np.array(p["input"]).T, 0), 1), np.array(p["output"])) for p in pairs)

def detect_crop(pairs):
    results = []
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        ih, iw = ig.shape; oh_, ow_ = og.shape
        if oh_ > ih or ow_ > iw: return None
        found = False
        for r in range(ih - oh_ + 1):
            for c in range(iw - ow_ + 1):
                if np.array_equal(ig[r:r+oh_, c:c+ow_], og):
                    results.append((r, c, oh_, ow_)); found = True; break
            if found: break
        if not found: return None
    if len(set((r[0], r[1]) for r in results)) == 1:
        return results[0]
    return None

def detect_tile(pairs):
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        ih, iw = ig.shape; oh_, ow_ = og.shape
        if oh_ % ih != 0 or ow_ % iw != 0: return None
        tr = oh_ // ih; tc = ow_ // iw
        if not np.array_equal(np.tile(ig, (tr, tc)), og): return None
    return (np.array(pairs[0]["output"]).shape[0] // np.array(pairs[0]["input"]).shape[0],
            np.array(pairs[0]["output"]).shape[1] // np.array(pairs[0]["input"]).shape[1])

def detect_scale(pairs):
    for factor in [2, 3, 4, 5]:
        if all(np.array(p["output"]).shape == (np.array(p["input"]).shape[0]*factor, np.array(p["input"]).shape[1]*factor) and
               np.array_equal(np.repeat(np.repeat(np.array(p["input"]), factor, 0), factor, 1), np.array(p["output"])) for p in pairs):
            return factor
    return None

def detect_color_replace(pairs):
    if not all(shapes_match(p) for p in pairs): return None
    replacements = {}
    for p in pairs:
        for a, b in zip(np.array(p["input"]).flat, np.array(p["output"]).flat):
            if a != b:
                if a in replacements and replacements[a] != b: return None
                replacements[a] = b
    if not replacements: return None
    for p in pairs:
        ig = np.array(p["input"]); exp = ig.copy()
        for s, d in replacements.items(): exp[ig == s] = d
        if not np.array_equal(exp, np.array(p["output"])): return None
    return replacements

def detect_color_swap(pairs):
    if not all(shapes_match(p) for p in pairs): return None
    swap_pairs = set()
    for p in pairs:
        for a, b in zip(np.array(p["input"]).flat, np.array(p["output"]).flat):
            if a != b: swap_pairs.add((min(a,b), max(a,b)))
    if len(swap_pairs) != 1: return None
    a, b = list(swap_pairs)[0]
    saw_ab = saw_ba = False
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        exp = ig.copy(); exp[ig==a]=b; exp[ig==b]=a
        if not np.array_equal(exp, og): return None
        if np.any((ig==a)&(og==b)): saw_ab = True
        if np.any((ig==b)&(og==a)): saw_ba = True
    return (a,b) if saw_ab and saw_ba else None

def detect_pixel_permutation(pairs):
    if not all(shapes_match(p) for p in pairs): return None
    if len(set(np.array(p["input"]).shape for p in pairs)) != 1: return None
    ih, iw = np.array(pairs[0]["input"]).shape
    if ih > H or iw > W: return None
    all_inputs = [np.array(p["input"]).flatten() for p in pairs]
    all_outputs = [np.array(p["output"]).flatten() for p in pairs]
    grid_size = ih * iw
    assignment = {}
    for dst_idx in range(grid_size):
        targets = [all_outputs[pi][dst_idx] for pi in range(len(pairs))]
        candidates = None
        for pi in range(len(pairs)):
            match = set(np.where(all_inputs[pi] == targets[pi])[0].tolist())
            candidates = match if candidates is None else candidates & match
            if not candidates: return None
        if len(candidates) != 1: return None
        assignment[dst_idx] = candidates.pop()
    gi = np.arange(HW, dtype=np.int64)
    for dst, src in assignment.items():
        dr, dc = divmod(dst, iw); sr, sc = divmod(src, iw)
        gi[dr*W+dc] = sr*W+sc
    for p in pairs:
        ig = np.array(p["input"]); padded = np.zeros((H, W), dtype=np.int32)
        padded[:ih, :iw] = ig
        pred = padded.flatten()[gi].reshape(H, W)[:ih, :iw]
        if not np.array_equal(pred, np.array(p["output"])): return None
    return gi

def detect_mirror_h_concat(pairs):
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        if og.shape != (ig.shape[0], ig.shape[1]*2): return False
        if not np.array_equal(np.concatenate([ig, np.flip(ig, 1)], 1), og): return False
    return True

def detect_mirror_v_concat(pairs):
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        if og.shape != (ig.shape[0]*2, ig.shape[1]): return False
        if not np.array_equal(np.concatenate([ig, np.flip(ig, 0)], 0), og): return False
    return True

def detect_self_concat_h(pairs):
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        if og.shape != (ig.shape[0], ig.shape[1]*2): return False
        if not np.array_equal(np.concatenate([ig, ig], 1), og): return False
    return True

def detect_self_concat_v(pairs):
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        if og.shape != (ig.shape[0]*2, ig.shape[1]): return False
        if not np.array_equal(np.concatenate([ig, ig], 0), og): return False
    return True

def detect_quad_mirror(pairs):
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        ih, iw = ig.shape
        if og.shape != (ih*2, iw*2): return None
        exp = np.block([[ig, np.flip(ig,1)], [np.flip(ig,0), np.flip(np.flip(ig,0),1)]])
        if np.array_equal(exp, og): continue
        return None
    return "tl"

def detect_h_symmetry_complete(pairs):
    if not all(shapes_match(p) for p in pairs): return False
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        if not np.array_equal(np.where(ig != 0, ig, np.flip(ig, 1)), og): return False
    return True

def detect_v_symmetry_complete(pairs):
    if not all(shapes_match(p) for p in pairs): return False
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        if not np.array_equal(np.where(ig != 0, ig, np.flip(ig, 0)), og): return False
    return True

def detect_both_symmetry_complete(pairs):
    if not all(shapes_match(p) for p in pairs): return False
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        stack = np.stack([ig, np.flip(ig,1), np.flip(ig,0), np.flip(np.flip(ig,0),1)], 0)
        if not np.array_equal(np.where(ig != 0, ig, stack.max(0)), og): return False
    return True

def detect_diag_symmetry_complete(pairs):
    if not all(shapes_match(p) for p in pairs): return False
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        if ig.shape[0] != ig.shape[1]: return False
        if not np.array_equal(np.where(ig != 0, ig, ig.T), og): return False
    return True

def detect_translation(pairs):
    if not all(shapes_match(p) for p in pairs): return None
    ih, iw = np.array(pairs[0]["input"]).shape
    for dr in range(-min(ih,11)+1, min(ih,11)):
        for dc in range(-min(iw,11)+1, min(iw,11)):
            if dr == 0 and dc == 0: continue
            ok = True
            for p in pairs:
                ig = np.array(p["input"]); og = np.array(p["output"])
                hh, ww = ig.shape; s = np.zeros_like(ig)
                sr0=max(0,-dr); sr1=min(hh,hh-dr); sc0=max(0,-dc); sc1=min(ww,ww-dc)
                dr0=max(0,dr); dc0=max(0,dc); rh=sr1-sr0; rw=sc1-sc0
                if rh>0 and rw>0: s[dr0:dr0+rh,dc0:dc0+rw]=ig[sr0:sr1,sc0:sc1]
                if not np.array_equal(s, og): ok = False; break
            if ok: return (dr, dc)
    return None

def detect_downscale(pairs):
    for f in [2,3,4,5]:
        if all(np.array(p["input"]).shape == (np.array(p["output"]).shape[0]*f, np.array(p["output"]).shape[1]*f) and
               np.array_equal(np.array(p["input"])[::f,::f], np.array(p["output"])) for p in pairs):
            return f
    return None

def detect_color_filter(pairs):
    if not all(shapes_match(p) for p in pairs): return None
    cand = None
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        diff = (ig != og)
        if not np.any(diff): continue
        if not np.all(og[diff] == 0): return None
        local = set(int(x) for x in ig[diff])
        cand = local if cand is None else cand | local
    if not cand: return None
    for p in pairs:
        ig = np.array(p["input"]).copy()
        for c in cand: ig[ig == c] = 0
        if not np.array_equal(ig, np.array(p["output"])): return None
    return cand

def detect_row_broadcast(pairs):
    if not all(shapes_match(p) for p in pairs): return None
    chosen = None
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        m = None
        for r in range(ig.shape[0]):
            if np.all(og == ig[r, :]): m = r; break
        if m is None: return None
        if chosen is None: chosen = m
        elif chosen != m: return None
    return chosen

def detect_col_broadcast(pairs):
    if not all(shapes_match(p) for p in pairs): return None
    chosen = None
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        m = None
        for c in range(ig.shape[1]):
            if np.all(og == ig[:, c:c+1]): m = c; break
        if m is None: return None
        if chosen is None: chosen = m
        elif chosen != m: return None
    return chosen

def detect_border_add(pairs):
    if not pairs: return None
    fi = np.array(pairs[0]["input"]); fo = np.array(pairs[0]["output"])
    ih, iw = fi.shape; oh_, ow_ = fo.shape
    if oh_-ih != ow_-iw or oh_ <= ih: return None
    d = oh_-ih
    if d % 2: return None
    b = d // 2
    if not np.array_equal(fo[b:b+ih, b:b+iw], fi): return None
    vals = set(fo[:b,:].flat) | set(fo[-b:,:].flat) | set(fo[:,:b].flat) | set(fo[:,-b:].flat)
    if len(vals) != 1: return None
    fill = int(vals.pop())
    for p in pairs[1:]:
        ig = np.array(p["input"]); og = np.array(p["output"])
        if og.shape != (ig.shape[0]+2*b, ig.shape[1]+2*b): return None
        if not np.array_equal(og[b:b+ig.shape[0], b:b+ig.shape[1]], ig): return None
        m = np.zeros(og.shape, dtype=bool); m[:b,:]=1; m[-b:,:]=1; m[:,:b]=1; m[:,-b:]=1
        if not np.all(og[m] == fill): return None
    return (b, fill)

def detect_crop_plus_color(pairs):
    if not pairs: return None
    fi = np.array(pairs[0]["input"]); fo = np.array(pairs[0]["output"])
    oh_, ow_ = fo.shape; ih, iw = fi.shape
    if oh_ > ih or ow_ > iw: return None
    for r0 in range(ih-oh_+1):
        for c0 in range(iw-ow_+1):
            cm = {}; ok = True
            for p in pairs:
                ig = np.array(p["input"]); og = np.array(p["output"])
                if og.shape != (oh_,ow_) or r0+oh_>ig.shape[0] or c0+ow_>ig.shape[1]: ok=False; break
                for a, b in zip(ig[r0:r0+oh_,c0:c0+ow_].flat, og.flat):
                    a,b=int(a),int(b)
                    if a in cm and cm[a]!=b: ok=False; break
                    cm[a]=b
                if not ok: break
            if not ok: continue
            if all(k==v for k,v in cm.items()): continue
            v = True
            for p in pairs:
                ig = np.array(p["input"]); og = np.array(p["output"])
                reg = ig[r0:r0+oh_,c0:c0+ow_].copy()
                for k2,v2 in cm.items(): reg[reg==k2]=v2
                if not np.array_equal(reg,og): v=False; break
            if v: return (r0,c0,oh_,ow_,cm)
    return None

def detect_concat_rot180_w(pairs):
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        if og.shape != (ig.shape[0], ig.shape[1]*2): return None
        if not np.array_equal(np.concatenate([ig, np.rot90(ig, 2)], 1), og): return None
    return True

def detect_nonzero_recolor(pairs):
    if not all(shapes_match(p) for p in pairs): return None
    tc = None
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        if not np.all(og[ig==0]==0): return None
        nb = og[ig!=0]
        if nb.size == 0: continue
        u = np.unique(nb)
        if len(u) != 1: return None
        if tc is None: tc = u[0]
        elif tc != u[0]: return None
    return tc

def detect_bg_recolor(pairs):
    if not all(shapes_match(p) for p in pairs): return None
    tc = None
    for p in pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        if not np.array_equal(og[ig!=0], ig[ig!=0]): return None
        bo = og[ig==0]
        if bo.size == 0: continue
        u = np.unique(bo)
        if len(u) != 1: return None
        if tc is None: tc = u[0]
        elif tc != u[0]: return None
    return tc

# ============================================================
# SPATIAL SOLVERS (FIX #4: add relaxed version)
# ============================================================

def try_spatial_zero_ambiguity(all_pairs):
    for p in all_pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        if ig.shape[0]>H or ig.shape[1]>W or og.shape[0]>H or og.shape[1]>W: return None

    inputs = np.stack([grid_to_tensor(p["input"])[0].reshape(C, -1) for p in all_pairs])
    outputs = np.stack([grid_to_tensor(p["output"])[0].reshape(C, -1) for p in all_pairs])

    lookup = {}
    for si in range(HW):
        lookup.setdefault(inputs[:,:,si].tobytes(), []).append(si)

    gi = np.full(HW, SAFE_PAD_IDX, dtype=np.int64)
    for oi in range(HW):
        sa = outputs[:,:,oi]
        if np.all(sa == 0): continue
        cands = lookup.get(sa.tobytes())
        if not cands or len(cands) > 1: return None
        gi[oi] = cands[0]
    return make_gather_onnx(gi)

def try_spatial_relaxed(all_pairs, max_ambig=12):
    """FIX #4: Try spatial with ambiguity — brute-force combinations."""
    for p in all_pairs:
        ig = np.array(p["input"]); og = np.array(p["output"])
        if ig.shape[0]>H or ig.shape[1]>W or og.shape[0]>H or og.shape[1]>W: return None

    inputs = np.stack([grid_to_tensor(p["input"])[0].reshape(C, -1) for p in all_pairs])
    outputs = np.stack([grid_to_tensor(p["output"])[0].reshape(C, -1) for p in all_pairs])

    lookup = {}
    for si in range(HW):
        lookup.setdefault(inputs[:,:,si].tobytes(), []).append(si)

    gi = np.full(HW, SAFE_PAD_IDX, dtype=np.int64)
    ambig = []
    for oi in range(HW):
        sa = outputs[:,:,oi]
        if np.all(sa == 0): continue
        cands = lookup.get(sa.tobytes())
        if not cands: return None
        gi[oi] = cands[0]
        if len(cands) > 1: ambig.append((oi, cands))

    if len(ambig) > max_ambig: return None
    if not ambig:
        m = make_gather_onnx(gi)
        return m if check_model_correct(m, all_pairs) else None

    # Try default
    m = make_gather_onnx(gi)
    if check_model_correct(m, all_pairs): return m

    # Brute force (limit to 8 ambiguous positions)
    if len(ambig) > 8: return None
    for combo in iprod(*(c for _, c in ambig)):
        for idx, (oi, _) in enumerate(ambig): gi[oi] = combo[idx]
        m = make_gather_onnx(gi)
        if check_model_correct(m, all_pairs): return m
    return None

# ============================================================
# GATHER INDEX BUILDERS
# ============================================================

def build_rotation_gather(angle, ih, iw):
    k = angle // 90
    idx = np.full(HW, SAFE_PAD_IDX, dtype=np.int64)
    if k == 1:
        for r in range(iw):
            for c in range(ih): idx[r*W+c] = c*W+(iw-1-r)
    elif k == 2:
        for r in range(ih):
            for c in range(iw): idx[r*W+c] = (ih-1-r)*W+(iw-1-c)
    elif k == 3:
        for r in range(iw):
            for c in range(ih): idx[r*W+c] = (ih-1-c)*W+r
    return idx

def build_flip_gather(direction, ih, iw):
    idx = np.full(HW, SAFE_PAD_IDX, dtype=np.int64)
    for r in range(ih):
        for c in range(iw):
            if direction == "vertical": idx[r*W+c] = (ih-1-r)*W+c
            elif direction == "horizontal": idx[r*W+c] = r*W+(iw-1-c)
            else: idx[r*W+c] = (ih-1-r)*W+(iw-1-c)
    return idx

def build_h_sym_complete_gathers(ih, iw):
    idx_id = np.full(HW, SAFE_PAD_IDX, dtype=np.int64)
    idx_m = np.full(HW, SAFE_PAD_IDX, dtype=np.int64)
    for r in range(ih):
        for c in range(iw):
            idx_id[r*W+c] = r*W+c; idx_m[r*W+c] = r*W+(iw-1-c)
    return [idx_id, idx_m]

def build_v_sym_complete_gathers(ih, iw):
    idx_id = np.full(HW, SAFE_PAD_IDX, dtype=np.int64)
    idx_m = np.full(HW, SAFE_PAD_IDX, dtype=np.int64)
    for r in range(ih):
        for c in range(iw):
            idx_id[r*W+c] = r*W+c; idx_m[r*W+c] = (ih-1-r)*W+c
    return [idx_id, idx_m]

def build_both_sym_complete_gathers(ih, iw):
    idxs = []
    for t in range(4):
        idx = np.full(HW, SAFE_PAD_IDX, dtype=np.int64)
        for r in range(ih):
            for c in range(iw):
                if t==0: sr,sc=r,c
                elif t==1: sr,sc=r,iw-1-c
                elif t==2: sr,sc=ih-1-r,c
                else: sr,sc=ih-1-r,iw-1-c
                idx[r*W+c] = sr*W+sc
        idxs.append(idx)
    return idxs

def build_diag_sym_complete_gathers(ih, iw):
    if ih != iw: return None
    idx_id = np.full(HW, SAFE_PAD_IDX, dtype=np.int64)
    idx_m = np.full(HW, SAFE_PAD_IDX, dtype=np.int64)
    for r in range(ih):
        for c in range(iw):
            idx_id[r*W+c] = r*W+c; idx_m[r*W+c] = c*W+r
    return [idx_id, idx_m]

# ============================================================
# WEIGHT BUILDERS
# ============================================================

def can_use_channel_gather_for_cmap(cmap, train_pairs):
    if cmap is None: return False
    changed = {s: d for s, d in cmap.items() if s != d}
    if not changed: return False
    if set(changed.keys()) == set(changed.values()): return True
    return False

def build_channel_gather_indices(cmap):
    gi = np.arange(C, dtype=np.int32)
    for src, dst in cmap.items():
        if src != dst: gi[dst] = src
    return gi

def build_color_map_weight(color_map):
    w = np.zeros((C, C, 1, 1), dtype=np.float32)
    for src, dst in color_map.items():
        if 0 <= src < C and 0 <= dst < C: w[dst, src, 0, 0] = 1.0
    for ch in range(C):
        if ch not in color_map: w[ch, ch, 0, 0] = 1.0
    return w

def build_nonzero_recolor_weight(tc):
    w = np.zeros((C,C,1,1), dtype=np.float32); w[0,0,0,0]=1.0
    for s in range(1,C): w[tc,s,0,0]=1.0
    return w

def build_bg_recolor_weight(tc):
    w = np.zeros((C,C,1,1), dtype=np.float32); w[tc,0,0,0]=1.0
    for s in range(1,C): w[s,s,0,0]=1.0
    return w

# ============================================================
# LEARNED CONV (FIX #3: threshold 0.05, FIX #5: add bias, FIX #6: add 3-layer)
# ============================================================

def try_learned_conv_fast(pairs, all_pairs, kernel_size=1, max_steps=1500, lr=0.02, use_bias=False):
    try:
        import torch, torch.nn as nn
    except: return None

    inp = torch.tensor(np.stack([grid_to_tensor(p["input"])[0] for p in pairs]), dtype=torch.float32)
    out = torch.tensor(np.stack([grid_to_tensor(p["output"])[0] for p in pairs]), dtype=torch.float32)

    pad = kernel_size // 2
    conv = nn.Conv2d(C, C, kernel_size=kernel_size, padding=pad, bias=use_bias)
    nn.init.zeros_(conv.weight)
    if use_bias: nn.init.zeros_(conv.bias)
    for i in range(C): conv.weight.data[i, i, pad, pad] = 1.0

    optimizer = torch.optim.Adam(conv.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=500, gamma=0.5)
    best_loss = float("inf"); best_state = None; plateau = 0

    for step in range(max_steps):
        optimizer.zero_grad()
        loss = nn.functional.mse_loss(conv(inp), out)
        loss.backward(); optimizer.step(); scheduler.step()
        l = loss.item()
        if l < best_loss - 1e-7:
            best_loss = l; best_state = copy.deepcopy(conv.state_dict()); plateau = 0
        else: plateau += 1
        if step == 250 and best_loss > 0.3: return None
        if step == 600 and best_loss > 0.1: return None
        if plateau > 400 and best_loss > 0.01: return None
        if best_loss < 1e-6: break

    if best_loss > 0.05: return None  # FIX #3: was 0.005
    conv.load_state_dict(best_state)
    w = conv.weight.detach().numpy()
    b = conv.bias.detach().numpy() if use_bias else None

    # Try rounded, pruned, original
    best_model = None; best_cost = float('inf')
    for w_try in [np.round(w), np.where(np.abs(w)<0.01, 0, w), w]:
        b_try = np.round(b) if b is not None else None
        m = make_conv_onnx(w_try, bias=b_try, kernel_size=kernel_size)
        if check_model_correct(m, all_pairs):
            c = estimate_model_cost(m)
            if c < best_cost: best_cost = c; best_model = m
    return best_model

def try_two_layer_conv_fast(pairs, all_pairs, ks1=3, ks2=1, hidden=16, max_steps=2500, lr=0.015):
    try:
        import torch, torch.nn as nn
    except: return None

    inp = torch.tensor(np.stack([grid_to_tensor(p["input"])[0] for p in pairs]), dtype=torch.float32)
    out = torch.tensor(np.stack([grid_to_tensor(p["output"])[0] for p in pairs]), dtype=torch.float32)

    pad1 = ks1//2; pad2 = ks2//2
    torch.manual_seed(0)
    net = nn.Sequential(
        nn.Conv2d(C, hidden, kernel_size=ks1, padding=pad1, bias=True),
        nn.ReLU(),
        nn.Conv2d(hidden, C, kernel_size=ks2, padding=pad2, bias=False),
    )
    optimizer = torch.optim.Adam(net.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max_steps)
    best_loss = float("inf"); best_state = None; plateau = 0

    for step in range(max_steps):
        optimizer.zero_grad()
        loss = nn.functional.mse_loss(net(inp), out)
        loss.backward(); optimizer.step(); scheduler.step()
        l = loss.item()
        if l < best_loss - 1e-7:
            best_loss = l; best_state = copy.deepcopy(net.state_dict()); plateau = 0
        else: plateau += 1
        if step == 300 and best_loss > 0.5: return None
        if step == 800 and best_loss > 0.15: return None
        if plateau > 500 and best_loss > 0.005: return None
        if best_loss < 1e-6: break

    if best_loss > 0.05: return None  # FIX #3: was 0.005
    net.load_state_dict(best_state)
    w1 = np.where(np.abs(v:=net[0].weight.detach().numpy())<0.01,0,v)
    b1 = net[0].bias.detach().numpy()
    w2 = np.where(np.abs(v:=net[2].weight.detach().numpy())<0.01,0,v)

    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    nodes = [
        oh.make_node("Constant", [], ["w1"], value=onh.from_array(w1.astype(np.float32), name="w1")),
        oh.make_node("Constant", [], ["b1"], value=onh.from_array(b1.astype(np.float32), name="b1")),
        oh.make_node("Conv", ["input", "w1", "b1"], ["c1"], kernel_shape=[ks1,ks1], pads=[pad1]*4),
        oh.make_node("Relu", ["c1"], ["r1"]),
        oh.make_node("Constant", [], ["w2"], value=onh.from_array(w2.astype(np.float32), name="w2")),
        oh.make_node("Conv", ["r1", "w2"], ["output"], kernel_shape=[ks2,ks2], pads=[pad2]*4),
    ]
    graph = oh.make_graph(nodes, "two_layer", [X], [Y])
    m = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)]); m.ir_version = 8
    return m if check_model_correct(m, all_pairs) else None

def try_three_layer_conv(pairs, all_pairs, max_steps=3000):
    """FIX #6: 3-layer conv for harder tasks."""
    try:
        import torch, torch.nn as nn
    except: return None

    inp = torch.tensor(np.stack([grid_to_tensor(p["input"])[0] for p in pairs]), dtype=torch.float32)
    out = torch.tensor(np.stack([grid_to_tensor(p["output"])[0] for p in pairs]), dtype=torch.float32)

    class Net(nn.Module):
        def __init__(s):
            super().__init__()
            s.c1=nn.Conv2d(C,16,3,padding=1,bias=True)
            s.c2=nn.Conv2d(16,16,3,padding=1,bias=True)
            s.c3=nn.Conv2d(16,C,1,bias=True)
        def forward(s,x): return s.c3(torch.relu(s.c2(torch.relu(s.c1(x)))))

    torch.manual_seed(0)
    net = Net(); optimizer = torch.optim.Adam(net.parameters(), lr=0.005)
    best_loss = float("inf"); best_state = None
    for step in range(max_steps):
        optimizer.zero_grad()
        loss = nn.functional.mse_loss(net(inp), out)
        loss.backward(); optimizer.step()
        if loss.item() < best_loss:
            best_loss = loss.item(); best_state = copy.deepcopy(net.state_dict())
        if step == 500 and best_loss > 0.3: return None
        if best_loss < 1e-6: break
    if best_loss > 0.05: return None
    net.load_state_dict(best_state)

    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    nodes = [
        oh.make_node("Constant", [], ["w1"], value=onh.from_array(net.c1.weight.detach().numpy().astype(np.float32), name="w1")),
        oh.make_node("Constant", [], ["b1"], value=onh.from_array(net.c1.bias.detach().numpy().astype(np.float32), name="b1")),
        oh.make_node("Conv", ["input","w1","b1"], ["c1"], kernel_shape=[3,3], pads=[1,1,1,1]),
        oh.make_node("Relu", ["c1"], ["r1"]),
        oh.make_node("Constant", [], ["w2"], value=onh.from_array(net.c2.weight.detach().numpy().astype(np.float32), name="w2")),
        oh.make_node("Constant", [], ["b2"], value=onh.from_array(net.c2.bias.detach().numpy().astype(np.float32), name="b2")),
        oh.make_node("Conv", ["r1","w2","b2"], ["c2"], kernel_shape=[3,3], pads=[1,1,1,1]),
        oh.make_node("Relu", ["c2"], ["r2"]),
        oh.make_node("Constant", [], ["w3"], value=onh.from_array(net.c3.weight.detach().numpy().astype(np.float32), name="w3")),
        oh.make_node("Constant", [], ["b3"], value=onh.from_array(net.c3.bias.detach().numpy().astype(np.float32), name="b3")),
        oh.make_node("Conv", ["r2","w3","b3"], ["output"], kernel_shape=[1,1], pads=[0,0,0,0]),
    ]
    graph = oh.make_graph(nodes, "three_layer", [X], [Y])
    m = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)]); m.ir_version = 8
    return m if check_model_correct(m, all_pairs) else None

# ============================================================
# SOLVER
# ============================================================
def analyze_transformation(pairs):
    info = {}
    in_sizes = [np.array(p["input"]).shape for p in pairs]
    out_sizes = [np.array(p["output"]).shape for p in pairs]
    info["in_sizes"] = in_sizes; info["out_sizes"] = out_sizes
    info["same_size"] = all(i==o for i,o in zip(in_sizes, out_sizes))
    info["const_output"] = len(set(json.dumps(p["output"]) for p in pairs)) == 1
    info["all_same_in_size"] = len(set(in_sizes)) == 1
    info["identity"] = info["same_size"] and all(np.array_equal(np.array(p["input"]),np.array(p["output"])) for p in pairs)
    if info["same_size"]:
        m = {}; valid = True
        for p in pairs:
            for a,b in zip(np.array(p["input"]).flat, np.array(p["output"]).flat):
                if a in m and m[a]!=b: valid=False; break
                m[a]=b
            if not valid: break
        info["color_map"] = m if valid and any(k!=v for k,v in m.items()) else None
    else:
        info["color_map"] = None
    return info

def solve_task(task_data, task_name="", time_budget=15.0):
    train_pairs = task_data.get("train", [])
    test_pairs = task_data.get("test", [])
    arc_gen = task_data.get("arc-gen", [])

    if not train_pairs: return make_identity_onnx()

    # FIX #2: validate on ALL pairs
    all_pairs = train_pairs + test_pairs + arc_gen

    info = analyze_transformation(train_pairs)
    best_model = None; best_cost = float('inf')
    t_start = time.time()

    def try_model(model, label=""):
        nonlocal best_model, best_cost
        if model is None: return False
        if check_model_correct(model, all_pairs):
            cost = estimate_model_cost(model)
            if cost < best_cost:
                best_cost = cost; best_model = model
            return True
        return False

    def elapsed(): return time.time() - t_start

    # ---- RULE-BASED ----
    if info.get("identity"):
        try_model(make_identity_onnx(), "identity")
        if best_model: return best_model

    # Color maps
    has_spatial = (detect_rotation(train_pairs) is not None or detect_flip(train_pairs) is not None or
                   detect_transpose(train_pairs) or detect_anti_transpose(train_pairs))

    if info.get("color_map") and info["same_size"]:
        cmap = info["color_map"]
        if can_use_channel_gather_for_cmap(cmap, train_pairs) and not has_spatial:
            try_model(make_channel_gather_onnx(build_channel_gather_indices(cmap)), "cmap_ch")
        try_model(make_conv1x1_onnx(build_color_map_weight(cmap)), "cmap_conv")

    tc = detect_nonzero_recolor(train_pairs)
    if tc is not None: try_model(make_conv1x1_onnx(build_nonzero_recolor_weight(tc)), "nz_recolor")

    tc = detect_bg_recolor(train_pairs)
    if tc is not None: try_model(make_conv1x1_onnx(build_bg_recolor_weight(tc)), "bg_recolor")

    repl = detect_color_replace(train_pairs)
    if repl:
        cmap = {i:i for i in range(C)}; cmap.update(repl)
        if can_use_channel_gather_for_cmap(cmap, train_pairs) and not has_spatial:
            try_model(make_channel_gather_onnx(build_channel_gather_indices(cmap)), "repl_ch")
        try_model(make_conv1x1_onnx(build_color_map_weight(cmap)), "repl_conv")

    sw = detect_color_swap(train_pairs)
    if sw and not has_spatial:
        a,b = sw; cmap = {i:i for i in range(C)}; cmap[a]=b; cmap[b]=a
        try_model(make_channel_gather_onnx(build_channel_gather_indices(cmap)), "swap_ch")

    # FIX #7: Color filter with conv1x1 fallback
    cf = detect_color_filter(train_pairs)
    if cf and info["same_size"]:
        cmap = {c_:0 for c_ in cf}; cmap.update({c_:c_ for c_ in range(C) if c_ not in cf})
        if can_use_channel_gather_for_cmap(cmap, train_pairs):
            try_model(make_channel_gather_onnx(build_channel_gather_indices(cmap)), "cf_ch")
        try_model(make_conv1x1_onnx(build_color_map_weight(cmap)), "cf_conv")  # FIX #7: always try conv fallback

    # Rotations
    rot = detect_rotation(train_pairs)
    if rot:
        in_shapes = set(np.array(p["input"]).shape for p in train_pairs)
        if len(in_shapes) == 1:
            ih, iw = list(in_shapes)[0]
            try_model(make_gather_onnx(build_rotation_gather(rot, ih, iw)), f"rot_{rot}")
            if rot == 90: try_model(make_cheap_rot90ccw_framed(ih, iw), f"rot90_cheap")
            elif rot == 180: try_model(make_cheap_rot180_framed(ih, iw), f"rot180_cheap")
            elif rot == 270: try_model(make_cheap_rot90cw_framed(ih, iw), f"rot270_cheap")

    flip = detect_flip(train_pairs)
    if flip:
        in_shapes = set(np.array(p["input"]).shape for p in train_pairs)
        if len(in_shapes) == 1:
            ih, iw = list(in_shapes)[0]
            try_model(make_gather_onnx(build_flip_gather(flip, ih, iw)), f"flip_{flip}")
            if flip == "vertical": try_model(make_cheap_flip_h_framed(ih, iw), "flip_v_cheap")
            elif flip == "horizontal": try_model(make_cheap_flip_w_framed(ih, iw), "flip_h_cheap")
            elif flip == "both": try_model(make_cheap_rot180_framed(ih, iw), "flip_b_cheap")

    if detect_transpose(train_pairs):
        in_shapes = set(np.array(p["input"]).shape for p in train_pairs)
        if len(in_shapes) == 1:
            ih, iw = list(in_shapes)[0]
            try_model(make_cheap_transpose_framed(ih, iw), "tr_cheap")

    if detect_anti_transpose(train_pairs):
        in_shapes = set(np.array(p["input"]).shape for p in train_pairs)
        if len(in_shapes) == 1:
            ih, iw = list(in_shapes)[0]
            try_model(make_cheap_anti_transpose_framed(ih, iw), "atr_cheap")

    # Composite: spatial + color
    if rot and info.get("color_map"):
        in_shapes = set(np.array(p["input"]).shape for p in train_pairs)
        if len(in_shapes) == 1:
            ih, iw = list(in_shapes)[0]
            gi = build_rotation_gather(rot, ih, iw); cmap = info["color_map"]
            if can_use_channel_gather_for_cmap(cmap, train_pairs):
                try_model(make_spatial_then_channel_gather_onnx(gi, build_channel_gather_indices(cmap)), "rot_ch_cm")
            try_model(make_gather_then_conv1x1_onnx(gi, build_color_map_weight(cmap)), "rot_cm")

    if flip and info.get("color_map"):
        in_shapes = set(np.array(p["input"]).shape for p in train_pairs)
        if len(in_shapes) == 1:
            ih, iw = list(in_shapes)[0]
            gi = build_flip_gather(flip, ih, iw); cmap = info["color_map"]
            if can_use_channel_gather_for_cmap(cmap, train_pairs):
                try_model(make_spatial_then_channel_gather_onnx(gi, build_channel_gather_indices(cmap)), "flip_ch_cm")
            try_model(make_gather_then_conv1x1_onnx(gi, build_color_map_weight(cmap)), "flip_cm")

    # Crop / tile / scale
    crop = detect_crop(train_pairs)
    if crop:
        r0,c0,oh_,ow_ = crop
        try_model(make_cheap_crop(r0,c0,oh_,ow_), "crop")

    tile = detect_tile(train_pairs)
    if tile:
        tr,tc = tile; ih,iw = np.array(train_pairs[0]["input"]).shape
        if ih*tr<=H and iw*tc<=W: try_model(make_cheap_tile(tr,tc,ih,iw), "tile")

    sc = detect_scale(train_pairs)
    if sc:
        ih,iw = np.array(train_pairs[0]["input"]).shape
        if ih*sc<=H and iw*sc<=W: try_model(make_cheap_upscale(sc,ih,iw), "scale")

    ds = detect_downscale(train_pairs)
    if ds:
        ih,iw = np.array(train_pairs[0]["input"]).shape
        try_model(make_cheap_downscale(ds,ih,iw), "downscale")

    perm = detect_pixel_permutation(train_pairs)
    if perm is not None: try_model(make_gather_onnx(perm), "perm")

    # Mirror/concat patterns
    in_shapes = set(np.array(p["input"]).shape for p in train_pairs)
    if len(in_shapes) == 1:
        ih,iw = list(in_shapes)[0]
        if detect_mirror_h_concat(train_pairs) and iw*2<=W: try_model(make_cheap_concat_flip_w(ih,iw), "mirror_h")
        if detect_mirror_v_concat(train_pairs) and ih*2<=H: try_model(make_cheap_concat_flip_h(ih,iw), "mirror_v")
        if detect_self_concat_h(train_pairs) and iw*2<=W: try_model(make_cheap_self_concat_w(ih,iw), "self_h")
        if detect_self_concat_v(train_pairs) and ih*2<=H: try_model(make_cheap_self_concat_h(ih,iw), "self_v")
        qm = detect_quad_mirror(train_pairs)
        if qm and ih*2<=H and iw*2<=W: try_model(make_cheap_quadrant_mirror(ih,iw), "quad")
        if detect_concat_rot180_w(train_pairs) and iw*2<=W: try_model(make_cheap_concat_rot180_w(ih,iw), "cat_r180")

    # Translation
    trans = detect_translation(train_pairs)
    if trans:
        dr,dc = trans
        in_shapes = set(np.array(p["input"]).shape for p in train_pairs)
        if len(in_shapes)==1:
            ih,iw = list(in_shapes)[0]
            m = make_cheap_framed_translation(ih,iw,dr,dc)
            if m: try_model(m, "translate")

    # Row/col broadcast
    in_shapes = set(np.array(p["input"]).shape for p in train_pairs)
    if len(in_shapes)==1:
        ih,iw = list(in_shapes)[0]
        rb = detect_row_broadcast(train_pairs)
        if rb is not None: try_model(make_cheap_row_broadcast(ih,iw,rb), "rb")
        cb = detect_col_broadcast(train_pairs)
        if cb is not None: try_model(make_cheap_col_broadcast(ih,iw,cb), "cb")

    # Border add
    ba = detect_border_add(train_pairs)
    if ba:
        b,fill = ba
        in_shapes = set(np.array(p["input"]).shape for p in train_pairs)
        if len(in_shapes)==1:
            ih,iw = list(in_shapes)[0]
            if ih+2*b<=H and iw+2*b<=W:
                m = make_cheap_border_add(ih,iw,b,fill)
                if m: try_model(m, "border")

    # Crop + color
    ccp = detect_crop_plus_color(train_pairs)
    if ccp:
        r0,c0,oh_,ow_,cm = ccp
        try_model(make_cheap_crop_then_color(r0,c0,oh_,ow_,cm), "crop_color")

    # Symmetry completion
    if info["same_size"] and info["all_same_in_size"]:
        ih,iw = np.array(train_pairs[0]["input"]).shape
        if detect_h_symmetry_complete(train_pairs):
            try_model(make_symmetry_completion_onnx(build_h_sym_complete_gathers(ih,iw)), "h_sym")
        if detect_v_symmetry_complete(train_pairs):
            try_model(make_symmetry_completion_onnx(build_v_sym_complete_gathers(ih,iw)), "v_sym")
        if detect_both_symmetry_complete(train_pairs):
            try_model(make_symmetry_completion_onnx(build_both_sym_complete_gathers(ih,iw)), "both_sym")
        if ih==iw and detect_diag_symmetry_complete(train_pairs):
            g = build_diag_sym_complete_gathers(ih,iw)
            if g: try_model(make_symmetry_completion_onnx(g), "diag_sym")

    # Spatial solvers
    m = try_spatial_zero_ambiguity(all_pairs)
    if m: try_model(m, "spatial_0")

    if best_model is None and elapsed() < time_budget:
        m = try_spatial_relaxed(all_pairs, max_ambig=12)
        if m: try_model(m, "spatial_r")

    if best_model is not None:
        return best_model

    # ---- LEARNED CONV ----
    for ks in [1, 3, 5]:
        if elapsed() > time_budget: break
        m = try_learned_conv_fast(train_pairs, all_pairs, kernel_size=ks, use_bias=False)
        if try_model(m, f"lconv_{ks}"): break
        m = try_learned_conv_fast(train_pairs, all_pairs, kernel_size=ks, use_bias=True)
        if try_model(m, f"lconv_{ks}b"): break

    if best_model is not None: return best_model

    for ks1,ks2,hidden in [(3,1,16),(3,1,24),(3,1,8),(5,1,12)]:
        if elapsed() > time_budget: break
        m = try_two_layer_conv_fast(train_pairs, all_pairs, ks1=ks1, ks2=ks2, hidden=hidden)
        if try_model(m, f"l2_{ks1}_{hidden}"): break

    if best_model is not None: return best_model

    if elapsed() < time_budget:
        m = try_three_layer_conv(train_pairs, all_pairs)
        try_model(m, "l3")

    if best_model is not None: return best_model

    # Constant output (last resort)
    if info.get("const_output"):
        try_model(make_const_onnx(grid_to_tensor(train_pairs[0]["output"])), "const")

    return best_model

# ============================================================
# MAIN
# ============================================================
def save_model(model, path):
    with open(path, "wb") as f:
        f.write(model.SerializeToString())
