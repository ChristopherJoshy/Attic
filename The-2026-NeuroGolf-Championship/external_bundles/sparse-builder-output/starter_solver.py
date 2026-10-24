import os, json, zipfile, copy, itertools
import numpy as np
from pathlib import Path
from collections import defaultdict
from scipy.ndimage import label as scipy_label

import onnx
import onnx.helper as oh
import onnx.numpy_helper as onh
from onnx import TensorProto
TASK_DIR = Path("/kaggle/input/competitions/neurogolf-2026")
OUTPUT_DIR = Path("/kaggle/working") if Path("/kaggle/working").exists() else Path(".")
C, H, W = 10, 30, 30

def load_task(path):
    with open(path) as f:
        return json.load(f)


def grid_to_tensor(grid):
    g = np.array(grid, dtype=np.int32)
    h, w = g.shape
    t = np.zeros((1, C, H, W), dtype=np.float32)
    for r in range(h):
        for c in range(w):
            v = g[r, c]
            if 0 <= v <= 9:
                t[0, v, r, c] = 1.0
    return t


def tensor_to_grid(t, out_h, out_w):
    arr = t[0]
    grid = []
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


def check_model_correct(model, pairs):
    try:
        import onnxruntime as ort
    except ImportError:
        os.system("pip install onnxruntime -q")
        import onnxruntime as ort
    try:
        buf = model.SerializeToString()
        sess = ort.InferenceSession(buf, providers=["CPUExecutionProvider"])
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


def make_onnx_from_gather(gather_indices, graph_name="permute"):
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    shape_chw = onh.from_array(np.array([1, C, H * W], dtype=np.int64), name="shape_chw")
    shape_chw_node = oh.make_node("Constant", [], ["shape_chw"], value=shape_chw)
    inp_reshape = oh.make_node("Reshape", ["input", "shape_chw"], ["inp_chw"])
    gi_tensor = onh.from_array(gather_indices.astype(np.int64), name="gather_idx")
    gi_node = oh.make_node("Constant", [], ["gather_idx"], value=gi_tensor)
    gather_node = oh.make_node("Gather", ["inp_chw", "gather_idx"], ["gathered"], axis=2)
    out_shape = onh.from_array(np.array([1, C, H, W], dtype=np.int64), name="out_shape")
    out_shape_node = oh.make_node("Constant", [], ["out_shape"], value=out_shape)
    reshape_back = oh.make_node("Reshape", ["gathered", "out_shape"], ["output"])
    nodes = [shape_chw_node, inp_reshape, gi_node, gather_node, out_shape_node, reshape_back]
    graph = oh.make_graph(nodes, graph_name, [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model


def make_identity_onnx():
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    node = oh.make_node("Identity", ["input"], ["output"])
    graph = oh.make_graph([node], "identity", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model


def make_const_onnx(const_output):
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    const_val = const_output.astype(np.float32)
    const_tensor = onh.from_array(const_val, name="const_out")
    const_node = oh.make_node("Constant", [], ["const_out"], value=const_tensor)
    zero_tensor = onh.from_array(np.zeros((1, C, H, W), dtype=np.float32), name="zero_val")
    zero_node = oh.make_node("Constant", [], ["zero_val"], value=zero_tensor)
    mul_node = oh.make_node("Mul", ["input", "zero_val"], ["zeroed"])
    add_node = oh.make_node("Add", ["zeroed", "const_out"], ["output"])
    graph = oh.make_graph([const_node, zero_node, mul_node, add_node], "const_net", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model


def make_color_remap_onnx(color_map):
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    weight = np.zeros((C, C, 1, 1), dtype=np.float32)
    for src, dst in color_map.items():
        if 0 <= src < C and 0 <= dst < C:
            weight[dst, src, 0, 0] = 1.0
    for ch in range(C):
        if ch not in color_map and not any(v == ch for v in color_map.values()):
            weight[ch, ch, 0, 0] = 1.0
    w_tensor = onh.from_array(weight, name="conv_weight")
    w_node = oh.make_node("Constant", [], ["conv_weight"], value=w_tensor)
    conv_node = oh.make_node("Conv", ["input", "conv_weight"], ["output"],
                             kernel_shape=[1, 1], pads=[0, 0, 0, 0])
    nodes = [w_node, conv_node]
    graph = oh.make_graph(nodes, "color_remap", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model


def make_conv_onnx(weight_np, kernel_size, graph_name="conv_net"):
    pad = kernel_size // 2
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    w_tensor = onh.from_array(weight_np.astype(np.float32), name="conv_weight")
    w_node = oh.make_node("Constant", [], ["conv_weight"], value=w_tensor)
    conv_node = oh.make_node("Conv", ["input", "conv_weight"], ["output"],
                             kernel_shape=[kernel_size, kernel_size],
                             pads=[pad, pad, pad, pad])
    nodes = [w_node, conv_node]
    graph = oh.make_graph(nodes, graph_name, [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model


def make_masked_gather_onnx(gather_indices, mask, graph_name="masked_gather"):
    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])
    shape_chw = onh.from_array(np.array([1, C, H * W], dtype=np.int64), name="shape_chw")
    shape_chw_node = oh.make_node("Constant", [], ["shape_chw"], value=shape_chw)
    inp_reshape = oh.make_node("Reshape", ["input", "shape_chw"], ["inp_chw"])
    gi_tensor = onh.from_array(gather_indices.astype(np.int64), name="gather_idx")
    gi_node = oh.make_node("Constant", [], ["gather_idx"], value=gi_tensor)
    gather_node = oh.make_node("Gather", ["inp_chw", "gather_idx"], ["gathered"], axis=2)
    out_shape = onh.from_array(np.array([1, C, H, W], dtype=np.int64), name="out_shape")
    out_shape_node = oh.make_node("Constant", [], ["out_shape"], value=out_shape)
    reshape_back = oh.make_node("Reshape", ["gathered", "out_shape"], ["gathered_4d"])
    mask_tensor = onh.from_array(mask.astype(np.float32), name="mask")
    mask_node = oh.make_node("Constant", [], ["mask"], value=mask_tensor)
    mul_node = oh.make_node("Mul", ["gathered_4d", "mask"], ["output"])
    nodes = [shape_chw_node, inp_reshape, gi_node, gather_node,
             out_shape_node, reshape_back, mask_node, mul_node]
    graph = oh.make_graph(nodes, graph_name, [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model


def gather_indices_for_transform(transform_fn):
    indices = np.zeros(H * W, dtype=np.int64)
    for r in range(H):
        for c in range(W):
            nr, nc = transform_fn(r, c)
            nr = max(0, min(H - 1, nr))
            nc = max(0, min(W - 1, nc))
            indices[r * W + c] = nr * W + nc
    return indices


def detect_rotation(pairs):
    for angle in [90, 180, 270]:
        k = angle // 90
        valid = True
        for p in pairs:
            ig = np.array(p["input"])
            og = np.array(p["output"])
            if np.rot90(ig, k).shape != og.shape or not np.array_equal(np.rot90(ig, k), og):
                valid = False
                break
        if valid:
            return angle
    return None


def make_rotation_onnx(angle):
    k = angle // 90
    if k == 1:
        fn = lambda r, c: (c, H - 1 - r)
    elif k == 2:
        fn = lambda r, c: (H - 1 - r, W - 1 - c)
    elif k == 3:
        fn = lambda r, c: (W - 1 - c, r)
    else:
        return make_identity_onnx()
    return make_onnx_from_gather(gather_indices_for_transform(fn), "rotation_net")


def detect_flip(pairs):
    for axis, name in [(0, "vertical"), (1, "horizontal"), (-1, "both")]:
        valid = True
        for p in pairs:
            ig, og = np.array(p["input"]), np.array(p["output"])
            flipped = np.flip(ig, axis=(0, 1) if axis == -1 else axis)
            if not np.array_equal(flipped, og):
                valid = False
                break
        if valid:
            return name
    return None


def make_flip_onnx(direction):
    if direction == "vertical":
        fn = lambda r, c: (H - 1 - r, c)
    elif direction == "horizontal":
        fn = lambda r, c: (r, W - 1 - c)
    else:
        fn = lambda r, c: (H - 1 - r, W - 1 - c)
    return make_onnx_from_gather(gather_indices_for_transform(fn), "flip_net")


def detect_transpose(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.T.shape != og.shape or not np.array_equal(ig.T, og):
            return False
    return True


def make_transpose_onnx():
    fn = lambda r, c: (c, r)
    return make_onnx_from_gather(gather_indices_for_transform(fn), "transpose_net")


def detect_color_map(pairs):
    if not all(np.array(p["input"]).shape == np.array(p["output"]).shape for p in pairs):
        return None
    color_maps = []
    for p in pairs:
        ig = np.array(p["input"]).flatten()
        og = np.array(p["output"]).flatten()
        cmap = {}
        valid = True
        for a, b in zip(ig, og):
            if a in cmap and cmap[a] != b:
                valid = False
                break
            cmap[a] = b
        if not valid:
            return None
        color_maps.append(cmap)
    if not color_maps:
        return None
    common = color_maps[0]
    for cm in color_maps[1:]:
        if cm != common:
            return None
    return common


def detect_crop(pairs):
    results = []
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        ih, iw = ig.shape
        oh_, ow_ = og.shape
        if oh_ > ih or ow_ > iw:
            return None
        found = False
        for r0 in range(ih - oh_ + 1):
            for c0 in range(iw - ow_ + 1):
                if np.array_equal(ig[r0:r0 + oh_, c0:c0 + ow_], og):
                    results.append((r0, c0))
                    found = True
                    break
            if found:
                break
        if not found:
            return None
    if len(set(results)) == 1:
        r0, c0 = results[0]
        oh_ = np.array(pairs[0]["output"]).shape[0]
        ow_ = np.array(pairs[0]["output"]).shape[1]
        return r0, c0, oh_, ow_
    return None


def make_crop_onnx(r0, c0, oh_, ow_):
    gather_indices = np.zeros(H * W, dtype=np.int64)
    for r in range(H):
        for c_ in range(W):
            if r < oh_ and c_ < ow_:
                src_r = min(r0 + r, H - 1)
                src_c = min(c0 + c_, W - 1)
                gather_indices[r * W + c_] = src_r * W + src_c
    if oh_ < H or ow_ < W:
        mask = np.zeros((1, C, H, W), dtype=np.float32)
        mask[0, :, :oh_, :ow_] = 1.0
        return make_masked_gather_onnx(gather_indices, mask, "crop_net")
    return make_onnx_from_gather(gather_indices, "crop_net")


def detect_tile(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        ih, iw = ig.shape
        oh_, ow_ = og.shape
        if oh_ % ih != 0 or ow_ % iw != 0:
            return None
        tr, tc = oh_ // ih, ow_ // iw
        if not np.array_equal(np.tile(ig, (tr, tc)), og):
            return None
    ih, iw = np.array(pairs[0]["input"]).shape
    oh_, ow_ = np.array(pairs[0]["output"]).shape
    return oh_ // ih, ow_ // iw


def make_tile_onnx(tile_r, tile_c):
    ih = H // tile_r if H % tile_r == 0 else H
    iw = W // tile_c if W % tile_c == 0 else W
    gather_indices = np.zeros(H * W, dtype=np.int64)
    mask = np.zeros((1, C, H, W), dtype=np.float32)
    oh_ = ih * tile_r
    ow_ = iw * tile_c
    for r in range(H):
        for c in range(W):
            if r < oh_ and c < ow_:
                src_r = r % ih
                src_c = c % iw
                gather_indices[r * W + c] = src_r * W + src_c
                mask[0, :, r, c] = 1.0
    if oh_ < H or ow_ < W:
        return make_masked_gather_onnx(gather_indices, mask, "tile_net")
    return make_onnx_from_gather(gather_indices, "tile_net")


def detect_scale(pairs):
    for factor in [2, 3, 4, 5]:
        valid = True
        for p in pairs:
            ig, og = np.array(p["input"]), np.array(p["output"])
            ih, iw = ig.shape
            oh_, ow_ = og.shape
            if oh_ != ih * factor or ow_ != iw * factor:
                valid = False
                break
            scaled = np.repeat(np.repeat(ig, factor, axis=0), factor, axis=1)
            if not np.array_equal(scaled, og):
                valid = False
                break
        if valid:
            return factor
    return None


def make_scale_onnx(factor):
    gather_indices = np.zeros(H * W, dtype=np.int64)
    mask = np.zeros((1, C, H, W), dtype=np.float32)
    for p_ih in range(1, 31):
        for p_iw in range(1, 31):
            oh_ = p_ih * factor
            ow_ = p_iw * factor
            if oh_ <= H and ow_ <= W:
                for r in range(oh_):
                    for c in range(ow_):
                        src_r = r // factor
                        src_c = c // factor
                        gather_indices[r * W + c] = src_r * W + src_c
                        mask[0, :, r, c] = 1.0
                break
        break
    for r in range(H):
        for c in range(W):
            if mask[0, 0, r, c] < 0.5:
                gather_indices[r * W + c] = 0

    gather_indices_final = np.zeros(H * W, dtype=np.int64)
    mask_final = np.zeros((1, C, H, W), dtype=np.float32)
    for r in range(H):
        for c in range(W):
            src_r = (r // factor)
            src_c = (c // factor)
            if src_r < H and src_c < W:
                gather_indices_final[r * W + c] = src_r * W + src_c
    return make_onnx_from_gather(gather_indices_final, "scale_net")


def detect_pixel_permutation(pairs):
    if not all(np.array(p["input"]).shape == np.array(p["output"]).shape for p in pairs):
        return None
    first = pairs[0]
    ig = np.array(first["input"])
    og = np.array(first["output"])
    ih, iw = ig.shape
    if ih != H or iw != W:
        return None
    src_flat = ig.flatten()
    dst_flat = og.flatten()
    assigned = {}
    for dst_idx in range(H * W):
        dst_val = dst_flat[dst_idx]
        matches = np.where(src_flat == dst_val)[0]
        if len(matches) == 1:
            assigned[dst_idx] = matches[0]
        else:
            return None
    gi = np.array([assigned.get(i, i) for i in range(H * W)], dtype=np.int64)
    for p in pairs[1:]:
        ig2 = np.array(p["input"]).flatten()
        og2 = np.array(p["output"]).flatten()
        if not np.array_equal(ig2[gi], og2):
            return None
    return gi


def detect_gravity(pairs, direction="down"):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.shape != og.shape:
            return False
        ih, iw = ig.shape
        expected = np.zeros_like(ig)
        if direction == "down":
            for c in range(iw):
                col = ig[:ih, c]
                nonzero = col[col != 0]
                expected[ih - len(nonzero):ih, c] = nonzero
        elif direction == "up":
            for c in range(iw):
                col = ig[:ih, c]
                nonzero = col[col != 0]
                expected[:len(nonzero), c] = nonzero
        elif direction == "right":
            for r in range(ih):
                row = ig[r, :iw]
                nonzero = row[row != 0]
                expected[r, iw - len(nonzero):iw] = nonzero
        elif direction == "left":
            for r in range(ih):
                row = ig[r, :iw]
                nonzero = row[row != 0]
                expected[r, :len(nonzero)] = nonzero
        if not np.array_equal(expected[:ih, :iw], og[:ih, :iw]):
            return False
    return True


def make_gravity_onnx(direction, pairs):
    sample = np.array(pairs[0]["input"])
    ih, iw = sample.shape
    const_outputs = []
    for p in pairs:
        ig = np.array(p["input"])
        expected = np.zeros((ih, iw), dtype=np.int32)
        if direction == "down":
            for c in range(iw):
                col = ig[:ih, c]
                nonzero = col[col != 0]
                expected[ih - len(nonzero):ih, c] = nonzero
        elif direction == "up":
            for c in range(iw):
                col = ig[:ih, c]
                nonzero = col[col != 0]
                expected[:len(nonzero), c] = nonzero
        elif direction == "right":
            for r in range(ih):
                row = ig[r, :iw]
                nonzero = row[row != 0]
                expected[r, iw - len(nonzero):iw] = nonzero
        elif direction == "left":
            for r in range(ih):
                row = ig[r, :iw]
                nonzero = row[row != 0]
                expected[r, :len(nonzero)] = nonzero
    return None


def detect_border_fill(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.shape != og.shape:
            return None, None
        ih, iw = ig.shape
        border_colors = set()
        interior = ig[1:-1, 1:-1] if ih > 2 and iw > 2 else ig
        for r in range(ih):
            for c in range(iw):
                if r == 0 or r == ih - 1 or c == 0 or c == iw - 1:
                    if ig[r, c] != 0:
                        border_colors.add(ig[r, c])
        if len(border_colors) != 1:
            return None, None
        fill_color = list(border_colors)[0]
        expected = ig.copy()
        for r in range(1, ih - 1):
            for c in range(1, iw - 1):
                if ig[r, c] == 0:
                    expected[r, c] = fill_color
        if np.array_equal(expected, og):
            return fill_color, "interior"
    return None, None


def detect_outline(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.shape != og.shape:
            return None
        ih, iw = ig.shape
        expected = np.zeros_like(ig)
        unique_colors = set(ig.flatten()) - {0}
        for color in unique_colors:
            mask = (ig == color)
            labeled, num = scipy_label(mask)
            for lbl in range(1, num + 1):
                comp = labeled == lbl
                for r in range(ih):
                    for c in range(iw):
                        if comp[r, c]:
                            is_border = (r == 0 or r == ih - 1 or c == 0 or c == iw - 1 or
                                         not comp[r - 1, c] or not comp[r + 1, c] or
                                         not comp[r, c - 1] or not comp[r, c + 1])
                            if is_border:
                                expected[r, c] = color
        if np.array_equal(expected, og):
            return "outline"
    return None


def detect_connected_components_color(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.shape != og.shape:
            return None
        ih, iw = ig.shape
        colored = set(ig.flatten()) - {0}
        if len(colored) < 2:
            return None
        for bg_color in colored:
            expected = ig.copy()
            for color in colored:
                if color == bg_color:
                    continue
                mask = (ig == color)
                labeled, num = scipy_label(mask)
                for lbl in range(1, num + 1):
                    comp_size = np.sum(labeled == lbl)
            if np.array_equal(expected, og):
                return bg_color
    return None


def detect_mirror_completion(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.shape != og.shape:
            return None
        ih, iw = ig.shape
        mid_h = ih // 2
        mid_w = iw // 2
        for axis in ["h", "v", "both"]:
            expected = ig.copy()
            if axis == "h":
                for r in range(mid_h):
                    mirror_r = ih - 1 - r
                    for c in range(iw):
                        if ig[r, c] == 0 and ig[mirror_r, c] != 0:
                            expected[r, c] = ig[mirror_r, c]
                        elif ig[mirror_r, c] == 0 and ig[r, c] != 0:
                            expected[mirror_r, c] = ig[r, c]
            elif axis == "v":
                for c in range(mid_w):
                    mirror_c = iw - 1 - c
                    for r in range(ih):
                        if ig[r, c] == 0 and ig[r, mirror_c] != 0:
                            expected[r, c] = ig[r, mirror_c]
                        elif ig[r, mirror_c] == 0 and ig[r, c] != 0:
                            expected[r, mirror_c] = ig[r, c]
            if np.array_equal(expected, og):
                return axis
    return None


def detect_diagonal_flip(pairs):
    for axis in ["main", "anti"]:
        valid = True
        for p in pairs:
            ig, og = np.array(p["input"]), np.array(p["output"])
            if axis == "main":
                expected = ig.T
            else:
                expected = np.fliplr(np.flipud(ig.T))
            if expected.shape != og.shape or not np.array_equal(expected, og):
                valid = False
                break
        if valid:
            return axis
    return None


def detect_invert_colors(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.shape != og.shape:
            return False
        colors_in = set(ig.flatten())
        colors_out = set(og.flatten())
        if colors_in != colors_out:
            return False
        for r in range(ig.shape[0]):
            for c in range(ig.shape[1]):
                if ig[r, c] == 0 and og[r, c] != 0:
                    pass
                elif ig[r, c] != 0 and og[r, c] == 0:
                    pass
                elif ig[r, c] != og[r, c]:
                    return False
    return False


def detect_color_swap_two(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.shape != og.shape:
            return None
    all_colors = set()
    for p in pairs:
        all_colors |= set(np.array(p["input"]).flatten())
        all_colors |= set(np.array(p["output"]).flatten())
    all_colors.discard(0)
    colors = list(all_colors)
    for c1, c2 in itertools.combinations(colors, 2):
        valid = True
        for p in pairs:
            ig, og = np.array(p["input"]), np.array(p["output"])
            exp = ig.copy()
            exp[ig == c1] = c2
            exp[ig == c2] = c1
            if not np.array_equal(exp, og):
                valid = False
                break
        if valid:
            return {c1: c2, c2: c1}
    return None


def detect_rotation_and_color(pairs):
    for angle in [90, 180, 270]:
        k = angle // 90
        color_maps = []
        valid = True
        for p in pairs:
            ig, og = np.array(p["input"]), np.array(p["output"])
            rotated = np.rot90(ig, k)
            if rotated.shape != og.shape:
                valid = False
                break
            cmap = {}
            for a, b in zip(rotated.flatten(), og.flatten()):
                if a in cmap and cmap[a] != b:
                    valid = False
                    break
                cmap[a] = b
            if not valid:
                break
            color_maps.append(cmap)
        if valid and color_maps:
            common = color_maps[0]
            for cm in color_maps[1:]:
                if cm != common:
                    common = None
                    break
            if common is not None and any(k != v for k, v in common.items()):
                return angle, common
    return None, None


def detect_flip_and_color(pairs):
    for direction in ["vertical", "horizontal", "both"]:
        color_maps = []
        valid = True
        for p in pairs:
            ig, og = np.array(p["input"]), np.array(p["output"])
            if direction == "vertical":
                flipped = np.flipud(ig)
            elif direction == "horizontal":
                flipped = np.fliplr(ig)
            else:
                flipped = np.flipud(np.fliplr(ig))
            if flipped.shape != og.shape:
                valid = False
                break
            cmap = {}
            for a, b in zip(flipped.flatten(), og.flatten()):
                if a in cmap and cmap[a] != b:
                    valid = False
                    break
                cmap[a] = b
            if not valid:
                break
            color_maps.append(cmap)
        if valid and color_maps:
            common = color_maps[0]
            for cm in color_maps[1:]:
                if cm != common:
                    common = None
                    break
            if common is not None and any(k != v for k, v in common.items()):
                return direction, common
    return None, None


def make_color_remap_onnx_from_map(color_map):
    weight = np.zeros((C, C, 1, 1), dtype=np.float32)
    for src in range(C):
        dst = color_map.get(src, src)
        if 0 <= dst < C:
            weight[dst, src, 0, 0] = 1.0
    return weight


def make_rotation_color_onnx(angle, color_map):
    k = angle // 90
    if k == 1:
        gi_fn = lambda r, c: (c, H - 1 - r)
    elif k == 2:
        gi_fn = lambda r, c: (H - 1 - r, W - 1 - c)
    elif k == 3:
        gi_fn = lambda r, c: (W - 1 - c, r)
    else:
        gi_fn = lambda r, c: (r, c)

    gather_indices = gather_indices_for_transform(gi_fn)
    color_weight = make_color_remap_onnx_from_map(color_map)

    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])

    shape_chw = onh.from_array(np.array([1, C, H * W], dtype=np.int64), name="shape_chw")
    shape_chw_node = oh.make_node("Constant", [], ["shape_chw"], value=shape_chw)
    inp_reshape = oh.make_node("Reshape", ["input", "shape_chw"], ["inp_chw"])
    gi_tensor = onh.from_array(gather_indices.astype(np.int64), name="gather_idx")
    gi_node = oh.make_node("Constant", [], ["gather_idx"], value=gi_tensor)
    gather_node = oh.make_node("Gather", ["inp_chw", "gather_idx"], ["gathered"], axis=2)
    out_shape = onh.from_array(np.array([1, C, H, W], dtype=np.int64), name="out_shape")
    out_shape_node = oh.make_node("Constant", [], ["out_shape"], value=out_shape)
    reshape_back = oh.make_node("Reshape", ["gathered", "out_shape"], ["rotated"])

    w_tensor = onh.from_array(color_weight, name="conv_weight")
    w_node = oh.make_node("Constant", [], ["conv_weight"], value=w_tensor)
    conv_node = oh.make_node("Conv", ["rotated", "conv_weight"], ["output"],
                             kernel_shape=[1, 1], pads=[0, 0, 0, 0])

    nodes = [shape_chw_node, inp_reshape, gi_node, gather_node,
             out_shape_node, reshape_back, w_node, conv_node]
    graph = oh.make_graph(nodes, "rot_color_net", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model


def make_flip_color_onnx(direction, color_map):
    if direction == "vertical":
        fn = lambda r, c: (H - 1 - r, c)
    elif direction == "horizontal":
        fn = lambda r, c: (r, W - 1 - c)
    else:
        fn = lambda r, c: (H - 1 - r, W - 1 - c)

    gather_indices = gather_indices_for_transform(fn)
    color_weight = make_color_remap_onnx_from_map(color_map)

    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])

    shape_chw = onh.from_array(np.array([1, C, H * W], dtype=np.int64), name="shape_chw")
    shape_chw_node = oh.make_node("Constant", [], ["shape_chw"], value=shape_chw)
    inp_reshape = oh.make_node("Reshape", ["input", "shape_chw"], ["inp_chw"])
    gi_tensor = onh.from_array(gather_indices.astype(np.int64), name="gather_idx")
    gi_node = oh.make_node("Constant", [], ["gather_idx"], value=gi_tensor)
    gather_node = oh.make_node("Gather", ["inp_chw", "gather_idx"], ["gathered"], axis=2)
    out_shape = onh.from_array(np.array([1, C, H, W], dtype=np.int64), name="out_shape")
    out_shape_node = oh.make_node("Constant", [], ["out_shape"], value=out_shape)
    reshape_back = oh.make_node("Reshape", ["gathered", "out_shape"], ["flipped"])

    w_tensor = onh.from_array(color_weight, name="conv_weight")
    w_node = oh.make_node("Constant", [], ["conv_weight"], value=w_tensor)
    conv_node = oh.make_node("Conv", ["flipped", "conv_weight"], ["output"],
                             kernel_shape=[1, 1], pads=[0, 0, 0, 0])

    nodes = [shape_chw_node, inp_reshape, gi_node, gather_node,
             out_shape_node, reshape_back, w_node, conv_node]
    graph = oh.make_graph(nodes, "flip_color_net", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model


def detect_checkerboard_pattern(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.shape != og.shape:
            return None
        ih, iw = ig.shape
        colors = list(set(og.flatten()) - {0})
        if len(colors) != 2:
            return None
        c1, c2 = colors[0], colors[1]
        for offset in [0, 1]:
            valid = True
            for r in range(ih):
                for c in range(iw):
                    expected_color = c1 if (r + c + offset) % 2 == 0 else c2
                    if og[r, c] != expected_color:
                        valid = False
                        break
                if not valid:
                    break
            if valid:
                return c1, c2, offset
    return None


def detect_translation(pairs):
    results = []
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.shape != og.shape:
            return None
        ih, iw = ig.shape
        found = False
        for dr in range(-ih + 1, ih):
            for dc in range(-iw + 1, iw):
                if dr == 0 and dc == 0:
                    continue
                shifted = np.zeros_like(ig)
                for r in range(ih):
                    for c in range(iw):
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < ih and 0 <= nc < iw:
                            shifted[nr, nc] = ig[r, c]
                if np.array_equal(shifted, og):
                    results.append((dr, dc))
                    found = True
                    break
            if found:
                break
        if not found:
            return None
    if len(set(results)) == 1:
        return results[0]
    return None


def make_translation_onnx(dr, dc):
    fn = lambda r, c: (r - dr, c - dc)
    gi = np.zeros(H * W, dtype=np.int64)
    for r in range(H):
        for c in range(W):
            nr, nc = r - dr, c - dc
            if 0 <= nr < H and 0 <= nc < W:
                gi[r * W + c] = nr * W + nc
            else:
                gi[r * W + c] = 0
    return make_onnx_from_gather(gi, "translation_net")


def detect_quarter_tile(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        ih, iw = ig.shape
        oh_, ow_ = og.shape
        if oh_ != 2 * ih or ow_ != 2 * iw:
            return None
        top_left = og[:ih, :iw]
        top_right = og[:ih, iw:]
        bot_left = og[ih:, :iw]
        bot_right = og[ih:, iw:]
        variants = {
            "tl": ig,
            "tr": np.fliplr(ig),
            "bl": np.flipud(ig),
            "br": np.rot90(ig, 2),
        }
        if not (np.array_equal(top_left, ig) and np.array_equal(top_right, np.fliplr(ig)) and
                np.array_equal(bot_left, np.flipud(ig)) and np.array_equal(bot_right, np.rot90(ig, 2))):
            return None
    return "mirror_quad"


def detect_object_count_to_size(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        pass
    return None


def detect_selective_color_preserve(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.shape != og.shape:
            return None
        ih, iw = ig.shape
        colors_in = set(ig.flatten()) - {0}
        colors_out = set(og.flatten()) - {0}
        if not colors_out.issubset(colors_in):
            return None
        removed = colors_in - colors_out
        if not removed:
            return None
        expected = ig.copy()
        for color in removed:
            expected[expected == color] = 0
        if np.array_equal(expected, og):
            return removed
    return None


def detect_fill_holes(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.shape != og.shape:
            return None
        ih, iw = ig.shape
        nz_in = np.sum(ig != 0)
        nz_out = np.sum(og != 0)
        if nz_out < nz_in:
            return None
        colored_in = set(ig.flatten()) - {0}
        for color in colored_in:
            mask = (ig == color).astype(np.uint8)
            labeled, num = scipy_label(mask)
            for lbl in range(1, num + 1):
                comp = labeled == lbl
                r_min, r_max = np.where(comp.any(axis=1))[0][[0, -1]]
                c_min, c_max = np.where(comp.any(axis=0))[0][[0, -1]]
                region_in = ig[r_min:r_max + 1, c_min:c_max + 1]
                region_out = og[r_min:r_max + 1, c_min:c_max + 1]
                interior = np.zeros_like(region_in)
                for r in range(1, region_in.shape[0] - 1):
                    for c in range(1, region_in.shape[1] - 1):
                        if region_in[r, c] == 0:
                            interior[r, c] = color
    return None


def detect_majority_color(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.shape != og.shape:
            return None


def detect_frame_extraction(pairs):
    results = []
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        ih, iw = ig.shape
        oh_, ow_ = og.shape
        if oh_ >= ih or ow_ >= iw:
            return None
        colors = set(ig.flatten()) - {0}
        for color in colors:
            for r0 in range(ih - oh_ + 1):
                for c0 in range(iw - ow_ + 1):
                    region = ig[r0:r0 + oh_, c0:c0 + ow_]
                    border_matches = True
                    for r in range(oh_):
                        for c in range(ow_):
                            is_border = (r == 0 or r == oh_ - 1 or c == 0 or c == ow_ - 1)
                            if is_border and region[r, c] != color:
                                border_matches = False
                    if border_matches and np.array_equal(region, og):
                        results.append((r0, c0, oh_, ow_))
    if results:
        r0, c0, oh_, ow_ = results[0]
        consistent = all(r == results[0] for r in results)
        if consistent:
            return r0, c0, oh_, ow_
    return None


def try_learned_conv_torch(pairs, kernel_size=1, steps=1000):
    try:
        import torch
        import torch.nn as nn
    except ImportError:
        return None

    if not all(np.array(p["input"]).shape == np.array(p["output"]).shape for p in pairs):
        return None

    inp_t = torch.tensor(np.stack([grid_to_tensor(p["input"])[0] for p in pairs]), dtype=torch.float32)
    out_t = torch.tensor(np.stack([grid_to_tensor(p["output"])[0] for p in pairs]), dtype=torch.float32)

    pad = kernel_size // 2
    conv = nn.Conv2d(C, C, kernel_size=kernel_size, padding=pad, bias=False)
    nn.init.zeros_(conv.weight)

    optimizer = torch.optim.Adam(conv.parameters(), lr=0.05)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=50, factor=0.5)
    best_loss = float("inf")
    best_state = None

    for step in range(steps):
        optimizer.zero_grad()
        pred = conv(inp_t)
        loss = nn.functional.mse_loss(pred, out_t)
        loss.backward()
        optimizer.step()
        scheduler.step(loss.item())
        if loss.item() < best_loss:
            best_loss = loss.item()
            best_state = copy.deepcopy(conv.state_dict())

    if best_loss > 0.05:
        return None

    conv.load_state_dict(best_state)
    weight_np = conv.weight.detach().numpy()
    return make_conv_onnx(weight_np, kernel_size, f"learned_conv_{kernel_size}")


def try_multi_layer_conv(pairs):
    try:
        import torch
        import torch.nn as nn
    except ImportError:
        return None

    if not all(np.array(p["input"]).shape == np.array(p["output"]).shape for p in pairs):
        return None

    inp_t = torch.tensor(np.stack([grid_to_tensor(p["input"])[0] for p in pairs]), dtype=torch.float32)
    out_t = torch.tensor(np.stack([grid_to_tensor(p["output"])[0] for p in pairs]), dtype=torch.float32)

    class TwoLayerNet(nn.Module):
        def __init__(self):
            super().__init__()
            self.conv1 = nn.Conv2d(C, 32, kernel_size=3, padding=1, bias=True)
            self.conv2 = nn.Conv2d(32, C, kernel_size=1, bias=True)
            self.relu = nn.ReLU()

        def forward(self, x):
            return self.conv2(self.relu(self.conv1(x)))

    net = TwoLayerNet()
    optimizer = torch.optim.Adam(net.parameters(), lr=0.01)
    best_loss = float("inf")
    best_state = None

    for step in range(2000):
        optimizer.zero_grad()
        pred = net(inp_t)
        loss = nn.functional.mse_loss(pred, out_t)
        loss.backward()
        optimizer.step()
        if loss.item() < best_loss:
            best_loss = loss.item()
            best_state = copy.deepcopy(net.state_dict())
        if best_loss < 0.01:
            break

    if best_loss > 0.05:
        return None

    net.load_state_dict(best_state)

    w1 = net.conv1.weight.detach().numpy().astype(np.float32)
    b1 = net.conv1.bias.detach().numpy().astype(np.float32)
    w2 = net.conv2.weight.detach().numpy().astype(np.float32)
    b2 = net.conv2.bias.detach().numpy().astype(np.float32)

    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])

    w1t = onh.from_array(w1, name="w1")
    b1t = onh.from_array(b1, name="b1")
    w2t = onh.from_array(w2, name="w2")
    b2t = onh.from_array(b2, name="b2")

    nodes = [
        oh.make_node("Constant", [], ["w1"], value=w1t),
        oh.make_node("Constant", [], ["b1"], value=b1t),
        oh.make_node("Conv", ["input", "w1", "b1"], ["conv1_out"],
                     kernel_shape=[3, 3], pads=[1, 1, 1, 1]),
        oh.make_node("Relu", ["conv1_out"], ["relu_out"]),
        oh.make_node("Constant", [], ["w2"], value=w2t),
        oh.make_node("Constant", [], ["b2"], value=b2t),
        oh.make_node("Conv", ["relu_out", "w2", "b2"], ["output"],
                     kernel_shape=[1, 1], pads=[0, 0, 0, 0]),
    ]
    graph = oh.make_graph(nodes, "two_layer_net", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8
    return model


def try_general_linear(train_pairs, all_pairs):
    if not all(np.array(p["input"]).shape == (H, W) and
               np.array(p["output"]).shape == (H, W) for p in train_pairs):
        return None

    inp_tensors = np.stack([grid_to_tensor(p["input"])[0] for p in train_pairs])
    out_tensors = np.stack([grid_to_tensor(p["output"])[0] for p in train_pairs])

    n, c, h, w = inp_tensors.shape
    X_mat = inp_tensors.reshape(n, -1)
    Y_mat = out_tensors.reshape(n, -1)

    try:
        W_sol, _, _, _ = np.linalg.lstsq(X_mat, Y_mat, rcond=None)
        Y_pred = X_mat @ W_sol
        err = np.max(np.abs(Y_pred.round() - Y_mat))
        if err > 0.1:
            return None
    except Exception:
        return None

    W_np = W_sol.T.astype(np.float32)

    X = oh.make_tensor_value_info("input", TensorProto.FLOAT, [1, C, H, W])
    Y = oh.make_tensor_value_info("output", TensorProto.FLOAT, [1, C, H, W])

    flat_shape = onh.from_array(np.array([1, C * H * W], dtype=np.int64), name="flat_shape")
    flat_shape_node = oh.make_node("Constant", [], ["flat_shape"], value=flat_shape)
    reshape_in = oh.make_node("Reshape", ["input", "flat_shape"], ["inp_flat"])
    w_tensor = onh.from_array(W_np, name="gemm_weight")
    w_node = oh.make_node("Constant", [], ["gemm_weight"], value=w_tensor)
    gemm_node = oh.make_node("Gemm", ["inp_flat", "gemm_weight"], ["out_flat"],
                             transB=0, alpha=1.0, beta=0.0)
    out_shape = onh.from_array(np.array([1, C, H, W], dtype=np.int64), name="out_shape")
    out_shape_node = oh.make_node("Constant", [], ["out_shape"], value=out_shape)
    reshape_out = oh.make_node("Reshape", ["out_flat", "out_shape"], ["output"])

    nodes = [flat_shape_node, reshape_in, w_node, gemm_node, out_shape_node, reshape_out]
    graph = oh.make_graph(nodes, "linear_net", [X], [Y])
    model = oh.make_model(graph, opset_imports=[oh.make_opsetid("", 17)])
    model.ir_version = 8

    if check_model_correct(model, all_pairs):
        return model
    return None


def detect_same_size(pairs):
    return all(np.array(p["input"]).shape == np.array(p["output"]).shape for p in pairs)


def detect_identity(pairs):
    return all(np.array_equal(np.array(p["input"]), np.array(p["output"])) for p in pairs)


def detect_const_output(pairs):
    outputs = [str(p["output"]) for p in pairs]
    return len(set(outputs)) == 1


def make_output_from_input_reorder(pairs, reorder_fn):
    gather_indices = np.zeros(H * W, dtype=np.int64)
    for r in range(H):
        for c in range(W):
            nr, nc = reorder_fn(r, c)
            nr = max(0, min(H - 1, nr))
            nc = max(0, min(W - 1, nc))
            gather_indices[r * W + c] = nr * W + nc
    return gather_indices


def detect_anti_diagonal_flip(pairs):
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        n = min(ig.shape[0], ig.shape[1])
        if ig.shape != og.shape:
            return False
        for r in range(ig.shape[0]):
            for c in range(ig.shape[1]):
                nr, nc = ig.shape[1] - 1 - c, ig.shape[0] - 1 - r
                if nr < og.shape[0] and nc < og.shape[1]:
                    if ig[r, c] != og[nr, nc]:
                        return False
    return True


def detect_scale_down(pairs):
    for factor in [2, 3, 4]:
        valid = True
        for p in pairs:
            ig, og = np.array(p["input"]), np.array(p["output"])
            ih, iw = ig.shape
            oh_, ow_ = og.shape
            if ih != oh_ * factor or iw != ow_ * factor:
                valid = False
                break
            downscaled = ig[::factor, ::factor]
            if downscaled.shape != og.shape or not np.array_equal(downscaled, og):
                valid = False
                break
        if valid:
            return factor
    return None


def make_scale_down_onnx(factor):
    gi = np.zeros(H * W, dtype=np.int64)
    mask = np.zeros((1, C, H, W), dtype=np.float32)
    oh_ = H // factor
    ow_ = W // factor
    for r in range(H):
        for c in range(W):
            if r < oh_ and c < ow_:
                src_r = r * factor
                src_c = c * factor
                gi[r * W + c] = src_r * W + src_c
                mask[0, :, r, c] = 1.0
    if oh_ < H or ow_ < W:
        return make_masked_gather_onnx(gi, mask, "scale_down_net")
    return make_onnx_from_gather(gi, "scale_down_net")


def detect_border_removal(pairs):
    results = []
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        ih, iw = ig.shape
        oh_, ow_ = og.shape
        if oh_ == ih - 2 and ow_ == iw - 2:
            if np.array_equal(ig[1:-1, 1:-1], og):
                results.append(True)
            else:
                return None
        else:
            return None
    return True if results else None


def make_border_removal_onnx():
    return make_crop_onnx(1, 1, H - 2, W - 2)


def detect_upscale_with_pattern(pairs):
    for factor in [2, 3]:
        valid = True
        for p in pairs:
            ig, og = np.array(p["input"]), np.array(p["output"])
            ih, iw = ig.shape
            oh_, ow_ = og.shape
            if oh_ != ih * factor or ow_ != iw * factor:
                valid = False
                break
        if valid:
            return factor
    return None


def detect_row_col_swap(pairs):
    for axis in ["rows", "cols"]:
        for p in pairs:
            ig, og = np.array(p["input"]), np.array(p["output"])
            if ig.shape != og.shape:
                return None
            ih, iw = ig.shape
            if axis == "rows":
                perm = None
                for i in range(ih):
                    for j in range(ih):
                        if np.array_equal(ig[i, :], og[j, :]):
                            if perm is None:
                                perm = {}
                            perm[j] = i
                            break
                if perm and len(perm) == ih:
                    return axis, perm
    return None


def detect_color_to_shape(pairs):
    color_maps = []
    for p in pairs:
        ig, og = np.array(p["input"]), np.array(p["output"])
        if ig.shape != og.shape:
            return None
        cmap = {}
        for a, b in zip(ig.flatten(), og.flatten()):
            if a in cmap and cmap[a] != b:
                return None
            cmap[a] = b
        color_maps.append(cmap)
    if not color_maps:
        return None
    common = color_maps[0]
    for cm in color_maps[1:]:
        if cm != common:
            return None
    return common


def detect_90deg_variants_with_crop(pairs):
    all_in = [np.array(p["input"]) for p in pairs]
    all_out = [np.array(p["output"]) for p in pairs]
    ih, iw = all_in[0].shape
    oh_, ow_ = all_out[0].shape

    if oh_ > ih and ow_ > iw:
        return None

    for angle in [90, 180, 270]:
        k = angle // 90
        crop_results = []
        valid = True
        for ig, og in zip(all_in, all_out):
            rotated = np.rot90(ig, k)
            rh, rw = rotated.shape
            toh, tow = og.shape
            found = False
            for r0 in range(rh - toh + 1):
                for c0 in range(rw - tow + 1):
                    if np.array_equal(rotated[r0:r0 + toh, c0:c0 + tow], og):
                        crop_results.append((angle, r0, c0))
                        found = True
                        break
                if found:
                    break
            if not found:
                valid = False
                break
        if valid and len(set(crop_results)) == 1:
            return crop_results[0]
    return None


def solve_task(task_data, task_name=""):
    train_pairs = task_data.get("train", [])
    test_pairs = task_data.get("test", [])
    arc_gen = task_data.get("arc-gen", [])
    if not train_pairs:
        return make_identity_onnx()

    arc_gen_sample = arc_gen[:min(10, len(arc_gen))]
    all_pairs = train_pairs + test_pairs + arc_gen_sample

    if detect_identity(train_pairs):
        model = make_identity_onnx()
        if check_model_correct(model, all_pairs):
            return model

    color_map = detect_color_to_shape(train_pairs)
    if color_map:
        model = make_color_remap_onnx(color_map)
        if check_model_correct(model, all_pairs):
            return model

    color_swap = detect_color_swap_two(train_pairs)
    if color_swap:
        model = make_color_remap_onnx(color_swap)
        if check_model_correct(model, all_pairs):
            return model

    rot = detect_rotation(train_pairs)
    if rot is not None:
        model = make_rotation_onnx(rot)
        if check_model_correct(model, all_pairs):
            return model

    flip = detect_flip(train_pairs)
    if flip is not None:
        model = make_flip_onnx(flip)
        if check_model_correct(model, all_pairs):
            return model

    if detect_transpose(train_pairs):
        model = make_transpose_onnx()
        if check_model_correct(model, all_pairs):
            return model

    if detect_anti_diagonal_flip(train_pairs):
        fn = lambda r, c: (W - 1 - c, H - 1 - r)
        gi = gather_indices_for_transform(fn)
        model = make_onnx_from_gather(gi, "anti_diag_net")
        if check_model_correct(model, all_pairs):
            return model

    rot_angle, rot_color = detect_rotation_and_color(train_pairs)
    if rot_angle is not None and rot_color is not None:
        model = make_rotation_color_onnx(rot_angle, rot_color)
        if check_model_correct(model, all_pairs):
            return model

    flip_dir, flip_color = detect_flip_and_color(train_pairs)
    if flip_dir is not None and flip_color is not None:
        model = make_flip_color_onnx(flip_dir, flip_color)
        if check_model_correct(model, all_pairs):
            return model

    scale = detect_scale(train_pairs)
    if scale is not None:
        model = make_scale_onnx(scale)
        if check_model_correct(model, all_pairs):
            return model

    scale_down = detect_scale_down(train_pairs)
    if scale_down is not None:
        model = make_scale_down_onnx(scale_down)
        if check_model_correct(model, all_pairs):
            return model

    tile = detect_tile(train_pairs)
    if tile is not None:
        model = make_tile_onnx(*tile)
        if check_model_correct(model, all_pairs):
            return model

    crop = detect_crop(train_pairs)
    if crop is not None:
        r0, c0, oh_, ow_ = crop
        model = make_crop_onnx(r0, c0, oh_, ow_)
        if check_model_correct(model, all_pairs):
            return model

    if detect_border_removal(train_pairs):
        model = make_border_removal_onnx()
        if check_model_correct(model, all_pairs):
            return model

    for dr in range(-5, 6):
        for dc in range(-5, 6):
            if dr == 0 and dc == 0:
                continue
            valid = True
            for p in train_pairs:
                ig, og = np.array(p["input"]), np.array(p["output"])
                if ig.shape != og.shape:
                    valid = False
                    break
                ih, iw = ig.shape
                shifted = np.zeros_like(ig)
                for r in range(ih):
                    for c in range(iw):
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < ih and 0 <= nc < iw:
                            shifted[nr, nc] = ig[r, c]
                if not np.array_equal(shifted, og):
                    valid = False
                    break
            if valid:
                model = make_translation_onnx(dr, dc)
                if check_model_correct(model, all_pairs):
                    return model

    perm = detect_pixel_permutation(train_pairs)
    if perm is not None:
        model = make_onnx_from_gather(perm, "pixel_perm")
        if check_model_correct(model, all_pairs):
            return model

    for ks in [1, 3, 5]:
        model = try_learned_conv_torch(train_pairs, kernel_size=ks, steps=800)
        if model is not None and check_model_correct(model, all_pairs):
            return model

    model = try_multi_layer_conv(train_pairs)
    if model is not None and check_model_correct(model, all_pairs):
        return model

    model = try_general_linear(train_pairs, all_pairs)
    if model is not None:
        return model

    removed = detect_selective_color_preserve(train_pairs)
    if removed is not None:
        preserved_colors = set(range(C)) - removed
        cmap = {c: c for c in preserved_colors}
        for c in removed:
            cmap[c] = 0
        model = make_color_remap_onnx(cmap)
        if check_model_correct(model, all_pairs):
            return model

    for d in ["up", "down", "left", "right"]:
        if detect_gravity(train_pairs, d):
            pass

    if detect_const_output(train_pairs):
        const_out = grid_to_tensor(train_pairs[0]["output"])
        model = make_const_onnx(const_out)
        if check_model_correct(model, all_pairs):
            return model

    return None


def save_model(model, path):
    try:
        onnx.checker.check_model(model)
    except Exception:
        pass
    with open(path, "wb") as f:
        f.write(model.SerializeToString())
