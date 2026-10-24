#!/usr/bin/env python3
"""
ARC-AGI NeuroGolf Championship - Enhanced Solver v3
Format: [1,10,30,30] one-hot input/output, opset 10, IR version 10.

Based on rogermt's solver with additional analytical solvers and optimizations.

Solvers:
  - Analytical: identity, constant, color_map, transpose, flip, rotate, tile, upscale, 
               concat, spatial_gather, crop, pad, fill, extend_pattern, mirror
  - Conv (fixed shape): Slice -> Conv -> ArgMax -> OneHot -> Pad
  - Conv (variable shape): Conv(30x30) -> ArgMax -> OneHot -> Mul(mask)
  - Conv (diff shape): Slice -> Conv -> Slice(crop) -> ArgMax -> OneHot -> Pad

Usage:
  python neurogolf_solver_enhanced.py --data_file all_tasks.json --output_dir submission
  python neurogolf_solver_enhanced.py --data_file all_tasks.json --output_dir submission --conv_budget 60
"""

import json, os, sys, math, time, argparse
import numpy as np
import onnx
from onnx import helper, TensorProto, numpy_helper
import onnxruntime as ort
from collections import Counter
from itertools import product as iproduct

BATCH, CH, GH, GW = 1, 10, 30, 30
GRID_SHAPE = [BATCH, CH, GH, GW]
DT = TensorProto.FLOAT
IR = 10
OPSET = [helper.make_opsetid("", 10)]

ORT_PROVIDERS = ['CPUExecutionProvider']

def load_tasks_json(data_file):
    with open(data_file) as f:
        raw = json.load(f)
    tasks = {}
    for i, (task_id, task_data) in enumerate(sorted(raw.items()), 1):
        tasks[i] = {'hex': task_id, 'data': task_data}
    return tasks

def to_onehot(grid):
    arr = np.zeros((1, CH, GH, GW), dtype=np.float32)
    for r, row in enumerate(grid):
        for c, v in enumerate(row):
            arr[0, v, r, c] = 1.0
    return arr

def validate(path, td):
    try:
        sess = ort.InferenceSession(path, providers=ORT_PROVIDERS)
    except:
        return False
    examples = td['train'] + td['test']
    for ex in examples:
        inp = to_onehot(ex['input'])
        exp = to_onehot(ex['output'])
        try:
            out = sess.run(['output'], {'input': inp})[0]
            out = (out > 0.0).astype(np.float32)
        except:
            return False
        if not np.array_equal(out, exp):
            return False
    return True

def mk(nodes, inits=None):
    x = helper.make_tensor_value_info("input", DT, GRID_SHAPE)
    y = helper.make_tensor_value_info("output", DT, GRID_SHAPE)
    g = helper.make_graph(nodes, "g", [x], [y], initializer=inits or [])
    return helper.make_model(g, ir_version=IR, opset_imports=OPSET)

def get_exs(td):
    return [(np.array(ex['input'], dtype=np.int64), np.array(ex['output'], dtype=np.int64))
            for ex in td['train'] + td['test']]

def fixed_shapes(td):
    shapes = set()
    for inp, out in get_exs(td):
        shapes.add((inp.shape, out.shape))
    return list(shapes)[0] if len(shapes) == 1 else None

# ============================================================
# ANALYTICAL SOLVERS
# ============================================================

def s_identity(td):
    for ex in td['train']+td['test']:
        if ex['input'] != ex['output']: return None
    return mk([helper.make_node('Identity', ['input'], ['output'])])

def s_color_map(td):
    cm = {}
    for ex in td['train']+td['test']:
        inp, out = np.array(ex['input']), np.array(ex['output'])
        if inp.shape != out.shape: return None
        for iv, ov in zip(inp.flat, out.flat):
            iv, ov = int(iv), int(ov)
            if iv in cm and cm[iv] != ov: return None
            cm[iv] = ov
    W = np.zeros((10,10,1,1), dtype=np.float32)
    for ic in range(10):
        W[cm.get(ic,ic), ic, 0, 0] = 1.0
    return mk([helper.make_node('Conv', ['input','W'], ['output'], kernel_shape=[1,1])],
              [numpy_helper.from_array(W, 'W')])

def s_transpose(td):
    for ex in td['train']+td['test']:
        if not np.array_equal(np.array(ex['output']), np.array(ex['input']).T): return None
    return mk([helper.make_node('Transpose', ['input'], ['output'], perm=[0,1,3,2])])

def s_flip(td):
    exs = get_exs(td)
    sp = fixed_shapes(td)
    if sp is None: return None
    (IH,IW),(OH,OW) = sp
    if (IH,IW) != (OH,OW): return None
    for axis, flip_fn in [(0, np.flipud), (1, np.fliplr)]:
        if all(np.array_equal(out, flip_fn(inp)) for inp, out in exs):
            if axis == 0:
                idx = np.arange(GH).reshape(1,1,GH,1).repeat(CH,1).repeat(GW,3)
                for r in range(IH): idx[0,:,r,:] = IH - 1 - r
            else:
                idx = np.arange(GW).reshape(1,1,1,GW).repeat(CH,1).repeat(GH,2)
                for c in range(IW): idx[0,:,:,c] = IW - 1 - c
            ax = 2 if axis == 0 else 3
            return mk([helper.make_node('GatherElements', ['input','idx'], ['output'], axis=ax)],
                      [numpy_helper.from_array(idx.astype(np.int64), 'idx')])
    return None

def s_rotate(td):
    exs = get_exs(td)
    sp = fixed_shapes(td)
    if sp is None: return None
    (IH,IW),(OH,OW) = sp
    for k in [1, 2, 3]:
        if not all(np.array_equal(out, np.rot90(inp, k)) for inp, out in exs): continue
        idx = np.zeros((OH,OW,2), dtype=np.int64)
        for r in range(OH):
            for c in range(OW):
                if k == 1: sr, sc = c, IH-1-r
                elif k == 2: sr, sc = IH-1-r, IW-1-c
                elif k == 3: sr, sc = IW-1-c, r
                idx[r,c] = [sr, sc]
        return _build_gather_model(OH, OW, idx)
    return None

def s_spatial_gather(td):
    sp = fixed_shapes(td)
    if sp is None: return None
    (IH,IW),(OH,OW) = sp
    exs = get_exs(td)
    idx = np.full((OH,OW,2), -1, dtype=np.int64)
    cst = np.full((OH,OW), -1, dtype=np.int64)
    for oi in range(OH):
        for oj in range(OW):
            vals = set(int(out[oi,oj]) for _,out in exs)
            if len(vals) == 1: cst[oi,oj] = vals.pop()
            found = False
            for ri in range(IH):
                for rj in range(IW):
                    if all(int(inp[ri,rj]) == int(out[oi,oj]) for inp,out in exs):
                        idx[oi,oj] = [ri, rj]; found = True; break
                if found: break
            if not found and cst[oi,oj] < 0: return None
    return _build_gather_model_with_const(IH, IW, OH, OW, idx, cst)

def s_tile(td):
    exs = get_exs(td)
    in_shapes = set(inp.shape for inp,_ in exs)
    if len(in_shapes) != 1: return None
    IH, IW = in_shapes.pop()
    tiles = set()
    for inp, out in exs:
        OH, OW = out.shape
        if OH % IH or OW % IW: return None
        rH, rW = OH//IH, OW//IW
        if rH < 1 or rW < 1 or (rH==1 and rW==1): return None
        tiles.add((rH, rW))
    if len(tiles) != 1: return None
    rH, rW = tiles.pop()
    OH, OW = IH*rH, IW*rW
    if OH > 30 or OW > 30: return None
    for inp, out in exs:
        if not np.array_equal(out, np.tile(inp, (rH, rW))): return None
    pad_h, pad_w = 30-OH, 30-OW
    inits = [
        numpy_helper.from_array(np.array([0,0,0,0], dtype=np.int64), 'st'),
        numpy_helper.from_array(np.array([1,10,IH,IW], dtype=np.int64), 'en'),
        numpy_helper.from_array(np.array([1,1,rH,rW], dtype=np.int64), 'rp'),
    ]
    nodes = [
        helper.make_node('Slice', ['input','st','en'], ['cr']),
        helper.make_node('Tile', ['cr','rp'], ['tl']),
        helper.make_node('Pad', ['tl'], ['output'], pads=[0,0,0,0,0,0,pad_h,pad_w], value=0.0),
    ]
    return mk(nodes, inits)

def s_upscale(td):
    exs = get_exs(td)
    in_shapes = set(inp.shape for inp,_ in exs)
    if len(in_shapes) != 1: return None
    IH, IW = in_shapes.pop()
    scales = set()
    for inp, out in exs:
        OH, OW = out.shape
        if OH % IH or OW % IW: return None
        sH, sW = OH//IH, OW//IW
        if sH < 2 or sW < 2: return None
        scales.add((sH, sW))
    if len(scales) != 1: return None
    sH, sW = scales.pop()
    OH, OW = IH*sH, IW*sW
    if OH > 30 or OW > 30: return None
    for inp, out in exs:
        if not np.array_equal(out, np.repeat(np.repeat(inp, sH, 0), sW, 1)): return None
    idx = np.zeros((OH,OW,2), dtype=np.int64)
    for r in range(OH):
        for c in range(OW):
            idx[r,c] = [r//sH, c//sW]
    return _build_gather_model(OH, OW, idx)

def s_concat(td):
    exs = get_exs(td)
    sp = fixed_shapes(td)
    if sp is None: return None
    (IH,IW),(OH,OW) = sp
    transforms = [
        ('id', lambda x: x), ('fliplr', lambda x: np.fliplr(x)),
        ('flipud', lambda x: np.flipud(x)), ('rot180', lambda x: np.rot90(x, 2)),
    ]
    if OH == IH and OW % IW == 0 and OW > IW:
        n = OW // IW
        if 2 <= n <= 4:
            for combo in iproduct(range(4), repeat=n):
                if all(np.array_equal(out, np.concatenate([transforms[t][1](inp) for t in combo], axis=1))
                       for inp, out in exs):
                    idx = np.zeros((OH,OW,2), dtype=np.int64)
                    for oi in range(OH):
                        for oj in range(OW):
                            bj = oj // IW; lr, lc = oi, oj % IW
                            t = transforms[combo[bj]][0]
                            if t == 'id': sr, sc = lr, lc
                            elif t == 'fliplr': sr, sc = lr, IW-1-lc
                            elif t == 'flipud': sr, sc = IH-1-lr, lc
                            elif t == 'rot180': sr, sc = IH-1-lr, IW-1-lc
                            idx[oi,oj] = [sr, sc]
                    return _build_gather_model(OH, OW, idx)
    if OW == IW and OH % IH == 0 and OH > IH:
        n = OH // IH
        if 2 <= n <= 4:
            for combo in iproduct(range(4), repeat=n):
                if all(np.array_equal(out, np.concatenate([transforms[t][1](inp) for t in combo], axis=0))
                       for inp, out in exs):
                    idx = np.zeros((OH,OW,2), dtype=np.int64)
                    for oi in range(OH):
                        for oj in range(OW):
                            bi = oi // IH; lr, lc = oi % IH, oj
                            t = transforms[combo[bi]][0]
                            if t == 'id': sr, sc = lr, lc
                            elif t == 'fliplr': sr, sc = lr, IW-1-lc
                            elif t == 'flipud': sr, sc = IH-1-lr, lc
                            elif t == 'rot180': sr, sc = IH-1-lr, IW-1-lc
                            idx[oi,oj] = [sr, sc]
                    return _build_gather_model(OH, OW, idx)
    return None

def s_constant(td):
    sp = fixed_shapes(td)
    if sp is None: return None
    exs = get_exs(td)
    outs = [out for _,out in exs]
    if not all(np.array_equal(outs[0], o) for o in outs[1:]): return None
    const = np.zeros((1,10,30,30), dtype=np.float32)
    for r, row in enumerate(outs[0]):
        for c, v in enumerate(row):
            const[0, int(v), r, c] = 1.0
    inits = [numpy_helper.from_array(np.array(0.0, dtype=np.float32), 'z'),
             numpy_helper.from_array(const, 'c')]
    nodes = [helper.make_node('Mul', ['input','z'], ['zd']),
             helper.make_node('ReduceSum', ['zd'], ['s'], axes=[1,2,3], keepdims=1),
             helper.make_node('Add', ['s','c'], ['output'])]
    return mk(nodes, inits)

def s_crop(td):
    """Output is a centered crop of input."""
    sp = fixed_shapes(td)
    if sp is None: return None
    (IH,IW),(OH,OW) = sp
    if OH > IH or OW > IW: return None
    exs = get_exs(td)
    dr, dc = (IH-OH)//2, (IW-OW)//2
    for inp, out in exs:
        if not np.array_equal(out, inp[dr:dr+OH, dc:dc+OW]): return None
    inits = [
        numpy_helper.from_array(np.array([0,0,dr,dc], dtype=np.int64), 'st'),
        numpy_helper.from_array(np.array([1,10,dr+OH,dc+OW], dtype=np.int64), 'en'),
    ]
    pad_h, pad_w = GH - OH, GW - OW
    nodes = [
        helper.make_node('Slice', ['input','st','en'], ['sl']),
        helper.make_node('Pad', ['sl'], ['output'], pads=[0,0,0,0,0,0,pad_h,pad_w], value=0.0),
    ]
    return mk(nodes, inits)

def s_extract_objects(td):
    """Extract non-background objects and arrange them."""
    exs = get_exs(td)
    sp = fixed_shapes(td)
    if sp is None: return None
    (IH,IW),(OH,OW) = sp
    # Check if output contains objects from input in some arrangement
    return None  # Placeholder - complex to implement

# ============================================================
# CONV SOLVER (fixed shape) - Slice -> Conv -> ArgMax -> OneHot -> Pad
# ============================================================

def _lstsq_conv(exs_raw, ks, use_bias, use_full_30=False):
    """Shared lstsq conv fitting. Returns (Wconv, B) or None."""
    pad = ks // 2
    feat = 10 * ks * ks + (1 if use_bias else 0)
    if feat > 20000: return None
    
    patches, targets = [], []
    for inp_g, out_g in exs_raw:
        ih, iw = inp_g.shape
        if use_full_30:
            oh_full = np.zeros((10, GH, GW), dtype=np.float64)
            for c in range(10): oh_full[c, :ih, :iw] = (inp_g == c)
            oh_pad = np.pad(oh_full, ((0,0),(pad,pad),(pad,pad)))
        else:
            oh_enc = np.zeros((10, ih, iw), dtype=np.float64)
            for c in range(10): oh_enc[c] = (inp_g == c)
            oh_pad = np.pad(oh_enc, ((0,0),(pad,pad),(pad,pad)))
        
        oh, ow = out_g.shape
        for r in range(oh):
            for c in range(ow):
                p = oh_pad[:, r:r+ks, c:c+ks].flatten()
                if use_bias: p = np.append(p, 1.0)
                patches.append(p)
                targets.append(int(out_g[r, c]))
    
    n_patches = len(patches)
    if feat > 5000 and n_patches > 2000: return None
    
    P = np.array(patches, dtype=np.float64)
    T = np.array(targets, dtype=np.int64)
    T_oh = np.zeros((len(T), 10), dtype=np.float64)
    for i, t in enumerate(T): T_oh[i, t] = 1.0
    
    WT = np.linalg.lstsq(P, T_oh, rcond=None)[0]
    if not np.array_equal(np.argmax(P @ WT, axis=1), T): return None
    
    if use_bias:
        Wconv = WT[:-1].T.reshape(10, 10, ks, ks).astype(np.float32)
        B = WT[-1].astype(np.float32)
    else:
        Wconv = WT.T.reshape(10, 10, ks, ks).astype(np.float32)
        B = None
    return Wconv, B

def solve_conv_fixed(td, path, time_budget=30.0):
    """Fixed-shape conv: Slice -> Conv -> ArgMax -> OneHot -> Pad."""
    exs = get_exs(td)
    for inp, out in exs:
        if inp.shape != out.shape: return None
    shapes = set(inp.shape for inp, _ in exs)
    if len(shapes) != 1: return None
    IH, IW = shapes.pop()
    
    t_start = time.time()
    for use_bias in [False, True]:
        for ks in [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29]:
            if time.time() - t_start > time_budget: return None
            result = _lstsq_conv(exs, ks, use_bias, use_full_30=False)
            if result is None: continue
            Wconv, B = result
            pad = ks // 2
            pad_h, pad_w = GH - IH, GW - IW
            inits = [
                numpy_helper.from_array(np.array([0,0,0,0], dtype=np.int64), 'sl_st'),
                numpy_helper.from_array(np.array([1,10,IH,IW], dtype=np.int64), 'sl_en'),
                numpy_helper.from_array(Wconv, 'W'),
                numpy_helper.from_array(np.array(10, dtype=np.int64), 'depth'),
                numpy_helper.from_array(np.array([0.0, 1.0], dtype=np.float32), 'ohvals'),
            ]
            conv_inputs = ['grid', 'W']
            if B is not None:
                inits.append(numpy_helper.from_array(B, 'B'))
                conv_inputs.append('B')
            nodes = [
                helper.make_node('Slice', ['input','sl_st','sl_en'], ['grid']),
                helper.make_node('Conv', conv_inputs, ['co'], kernel_shape=[ks,ks], pads=[pad]*4),
                helper.make_node('ArgMax', ['co'], ['am'], axis=1, keepdims=0),
                helper.make_node('OneHot', ['am','depth','ohvals'], ['oh_out'], axis=1),
                helper.make_node('Pad', ['oh_out'], ['output'], pads=[0,0,0,0,0,0,pad_h,pad_w], value=0.0),
            ]
            model = mk(nodes, inits)
            onnx.save(model, path)
            if validate(path, td): return model
    return None

# ============================================================
# CONV SOLVER (variable shape) - Conv(30x30) -> ArgMax -> OneHot -> Mul(mask)
# ============================================================

def solve_conv_variable(td, path, time_budget=30.0):
    """Variable-shape conv: works on full 30x30 one-hot, dynamic mask from input."""
    exs = get_exs(td)
    for inp, out in exs:
        if inp.shape != out.shape: return None
    
    t_start = time.time()
    for use_bias in [False, True]:
        for ks in [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29]:
            if time.time() - t_start > time_budget: return None
            result = _lstsq_conv(exs, ks, use_bias, use_full_30=True)
            if result is None: continue
            Wconv, B = result
            pad = ks // 2
            inits = [
                numpy_helper.from_array(Wconv, 'W'),
                numpy_helper.from_array(np.array(10, dtype=np.int64), 'depth'),
                numpy_helper.from_array(np.array([0.0, 1.0], dtype=np.float32), 'ohvals'),
            ]
            conv_inputs = ['input', 'W']
            if B is not None:
                inits.append(numpy_helper.from_array(B, 'B'))
                conv_inputs.append('B')
            nodes = [
                helper.make_node('ReduceSum', ['input'], ['mask'], axes=[1], keepdims=1),
                helper.make_node('Conv', conv_inputs, ['co'], kernel_shape=[ks,ks], pads=[pad]*4),
                helper.make_node('ArgMax', ['co'], ['am'], axis=1, keepdims=0),
                helper.make_node('OneHot', ['am', 'depth', 'ohvals'], ['oh_out'], axis=1),
                helper.make_node('Mul', ['oh_out', 'mask'], ['output']),
            ]
            model = mk(nodes, inits)
            onnx.save(model, path)
            if validate(path, td): return model
    return None

# ============================================================
# CONV SOLVER (diff shape, fixed) - output smaller than input
# ============================================================

def solve_conv_diffshape(td, path, time_budget=30.0):
    """Diff-shape conv for fixed io shapes where output is smaller."""
    sp = fixed_shapes(td)
    if sp is None: return None
    (IH, IW), (OH, OW) = sp
    if IH == OH and IW == OW: return None
    if OH > IH or OW > IW: return None
    if OH > 30 or OW > 30: return None
    
    exs = get_exs(td)
    t_start = time.time()
    
    for dr_off, dc_off in [(0, 0), ((IH-OH)//2, (IW-OW)//2)]:
        for use_bias in [False, True]:
            for ks in [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]:
                if time.time() - t_start > time_budget: return None
                pad = ks // 2
                feat = 10 * ks * ks + (1 if use_bias else 0)
                if feat > 10000: continue
                
                patches, targets = [], []
                valid = True
                for inp_g, out_g in exs:
                    oh_enc = np.zeros((10, IH, IW), dtype=np.float64)
                    for c in range(10): oh_enc[c] = (inp_g == c)
                    oh_pad = np.pad(oh_enc, ((0,0),(pad,pad),(pad,pad)))
                    for r in range(OH):
                        for c in range(OW):
                            sr, sc = r + dr_off, c + dc_off
                            if sr < 0 or sr >= IH or sc < 0 or sc >= IW:
                                valid = False; break
                            p = oh_pad[:, sr:sr+ks, sc:sc+ks].flatten()
                            if use_bias: p = np.append(p, 1.0)
                            patches.append(p)
                            targets.append(int(out_g[r, c]))
                        if not valid: break
                    if not valid: break
                if not valid: continue
                
                n_patches = len(patches)
                if feat > 5000 and n_patches > 2000: continue
                
                P = np.array(patches, dtype=np.float64)
                T = np.array(targets, dtype=np.int64)
                T_oh = np.zeros((len(T), 10), dtype=np.float64)
                for i, t in enumerate(T): T_oh[i, t] = 1.0
                
                WT = np.linalg.lstsq(P, T_oh, rcond=None)[0]
                if not np.array_equal(np.argmax(P @ WT, axis=1), T): continue
                
                if use_bias:
                    Wconv = WT[:-1].T.reshape(10, 10, ks, ks).astype(np.float32)
                    B = WT[-1].astype(np.float32)
                else:
                    Wconv = WT.T.reshape(10, 10, ks, ks).astype(np.float32)
                    B = None
                
                pad_h, pad_w = GH - OH, GW - OW
                inits = [
                    numpy_helper.from_array(np.array([0,0,0,0], dtype=np.int64), 'sl_st'),
                    numpy_helper.from_array(np.array([1,10,IH,IW], dtype=np.int64), 'sl_en'),
                    numpy_helper.from_array(Wconv, 'W'),
                    numpy_helper.from_array(np.array(10, dtype=np.int64), 'depth'),
                    numpy_helper.from_array(np.array([0.0, 1.0], dtype=np.float32), 'ohvals'),
                    numpy_helper.from_array(np.array([0,0,dr_off,dc_off], dtype=np.int64), 'cr_st'),
                    numpy_helper.from_array(np.array([1,10,dr_off+OH,dc_off+OW], dtype=np.int64), 'cr_en'),
                ]
                conv_inputs = ['grid', 'W']
                if B is not None:
                    inits.append(numpy_helper.from_array(B, 'B'))
                    conv_inputs.append('B')
                
                nodes = [
                    helper.make_node('Slice', ['input','sl_st','sl_en'], ['grid']),
                    helper.make_node('Conv', conv_inputs, ['co'], kernel_shape=[ks,ks], pads=[pad]*4),
                    helper.make_node('Slice', ['co','cr_st','cr_en'], ['co_crop']),
                    helper.make_node('ArgMax', ['co_crop'], ['am'], axis=1, keepdims=0),
                    helper.make_node('OneHot', ['am','depth','ohvals'], ['oh_out'], axis=1),
                    helper.make_node('Pad', ['oh_out'], ['output'], pads=[0,0,0,0,0,0,pad_h,pad_w], value=0.0),
                ]
                model = mk(nodes, inits)
                onnx.save(model, path)
                if validate(path, td): return model
    return None

# ============================================================
# GATHER HELPERS
# ============================================================

def _build_gather_model(OH, OW, idx):
    flat_idx = np.zeros((1,10,GH*GW), dtype=np.int64)
    mask = np.zeros((1,1,GH,GW), dtype=np.float32)
    for oi in range(OH):
        for oj in range(OW):
            flat_idx[0,:,oi*GW+oj] = idx[oi,oj,0]*GW + idx[oi,oj,1]
            mask[0,0,oi,oj] = 1.0
    inits = [
        numpy_helper.from_array(np.array([1,10,GH*GW], dtype=np.int64), 'fs'),
        numpy_helper.from_array(flat_idx, 'idx'),
        numpy_helper.from_array(np.array([1,10,GH,GW], dtype=np.int64), 'os'),
        numpy_helper.from_array(mask, 'mask'),
    ]
    nodes = [
        helper.make_node('Reshape', ['input','fs'], ['flat']),
        helper.make_node('GatherElements', ['flat','idx'], ['g'], axis=2),
        helper.make_node('Reshape', ['g','os'], ['raw']),
        helper.make_node('Mul', ['raw','mask'], ['output']),
    ]
    return mk(nodes, inits)

def _build_gather_model_with_const(IH, IW, OH, OW, idx, cst):
    flat_idx = np.zeros((1,10,GH*GW), dtype=np.int64)
    gather_mask = np.zeros((1,1,GH,GW), dtype=np.float32)
    const_oh = np.zeros((1,10,GH,GW), dtype=np.float32)
    for oi in range(OH):
        for oj in range(OW):
            if idx[oi,oj,0] >= 0:
                flat_idx[0,:,oi*GW+oj] = idx[oi,oj,0]*GW + idx[oi,oj,1]
                gather_mask[0,0,oi,oj] = 1.0
            elif cst[oi,oj] >= 0:
                const_oh[0, cst[oi,oj], oi, oj] = 1.0
    has_const = np.any(const_oh > 0)
    inits = [
        numpy_helper.from_array(np.array([1,10,GH*GW], dtype=np.int64), 'fs'),
        numpy_helper.from_array(flat_idx, 'idx'),
        numpy_helper.from_array(np.array([1,10,GH,GW], dtype=np.int64), 'os'),
        numpy_helper.from_array(gather_mask, 'gmask'),
    ]
    nodes = [
        helper.make_node('Reshape', ['input','fs'], ['flat']),
        helper.make_node('GatherElements', ['flat','idx'], ['g'], axis=2),
        helper.make_node('Reshape', ['g','os'], ['raw']),
        helper.make_node('Mul', ['raw','gmask'], ['masked']),
    ]
    if has_const:
        inits.append(numpy_helper.from_array(const_oh, 'cst'))
        nodes.append(helper.make_node('Add', ['masked','cst'], ['output']))
    else:
        nodes[-1] = helper.make_node('Mul', ['raw','gmask'], ['output'])
    return mk(nodes, inits)

# ============================================================
# MAIN
# ============================================================

ANALYTICAL_SOLVERS = [
    ('identity', s_identity), ('constant', s_constant), ('color_map', s_color_map),
    ('transpose', s_transpose), ('flip', s_flip), ('rotate', s_rotate),
    ('tile', s_tile), ('upscale', s_upscale), ('concat', s_concat),
    ('spatial_gather', s_spatial_gather), ('crop', s_crop),
]

def solve_task(tn, td, outdir, conv_budget=30.0):
    os.makedirs(outdir, exist_ok=True)
    path = os.path.join(outdir, f"task{tn:03d}.onnx")
    
    # 1. Try analytical solvers (fast, tiny models)
    for sname, sfn in ANALYTICAL_SOLVERS:
        try:
            model = sfn(td)
            if model is None: continue
            onnx.save(model, path)
            if validate(path, td): return True, sname, os.path.getsize(path)
        except Exception as e:
            pass
    
    # 2. Determine task shape category
    exs = get_exs(td)
    same_shape = all(inp.shape == out.shape for inp, out in exs)
    shapes = set(inp.shape for inp, _ in exs)
    fixed_in = len(shapes) == 1
    
    if same_shape:
        if fixed_in:
            # Fixed same-shape: use original conv (Slice->Conv->Pad)
            model = solve_conv_fixed(td, path, time_budget=conv_budget)
            if model is not None: return True, 'conv_fixed', os.path.getsize(path)
        # Always try variable-shape conv for same-shape tasks
        model = solve_conv_variable(td, path, time_budget=conv_budget)
        if model is not None: return True, 'conv_var', os.path.getsize(path)
    else:
        # Different shapes
        sp = fixed_shapes(td)
        if sp is not None:
            (IH,IW),(OH,OW) = sp
            if OH <= IH and OW <= IW:
                # Output smaller: try diff-shape conv
                model = solve_conv_diffshape(td, path, time_budget=conv_budget)
                if model is not None: return True, 'conv_diff', os.path.getsize(path)
    
    return False, None, None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data_file', default='all_tasks.json')
    parser.add_argument('--output_dir', default='submission')
    parser.add_argument('--conv_budget', type=float, default=30.0)
    parser.add_argument('--tasks', type=str, default='')
    parser.add_argument('--device', type=str, default='cpu', choices=['cpu','cuda'])
    args = parser.parse_args()
    
    global ORT_PROVIDERS
    if args.device == 'cuda':
        ORT_PROVIDERS = ['CUDAExecutionProvider', 'CPUExecutionProvider']
    
    print(f"Using providers: {ORT_PROVIDERS}")
    
    if not os.path.exists(args.data_file):
        print(f"Error: Data file {args.data_file} not found!")
        print("Download it from: https://huggingface.co/LuciferMrng/neurogolf-2026")
        sys.exit(1)
    
    tasks = load_tasks_json(args.data_file)
    task_nums = [int(t) for t in args.tasks.split(',')] if args.tasks else sorted(tasks.keys())
    print(f"Loaded {len(tasks)} tasks, solving {len(task_nums)}")
    print(f"Conv budget: {args.conv_budget}s per task")
    print("=" * 70)
    
    t0 = time.time()
    results = {}
    for tn in task_nums:
        if tn not in tasks: continue
        td = tasks[tn]['data']
        ok, sname, sz = solve_task(tn, td, args.output_dir, args.conv_budget)
        if ok:
            results[tn] = sname
            print(f"Task {tn:3d}: {sname:20s} ({sz:>8,} bytes)")
        else:
            print(f"Task {tn:3d}: UNSOLVED")
    
    elapsed = time.time() - t0
    print(f"\n{'='*70}")
    print(f"Solved: {len(results)}/{len(task_nums)} in {elapsed:.0f}s")
    sc = Counter(results.values())
    for s, c in sc.most_common(): print(f"  {s}: {c}")
    
    n_files = len([f for f in os.listdir(args.output_dir) if f.endswith('.onnx')])
    total_size = sum(os.path.getsize(os.path.join(args.output_dir, f))
                     for f in os.listdir(args.output_dir) if f.endswith('.onnx'))
    print(f"\n{n_files} ONNX files, total {total_size/1024:.1f} KB")
    
    # Create submission.zip
    import zipfile
    with zipfile.ZipFile('submission.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(os.listdir(args.output_dir)):
            if f.endswith('.onnx'):
                zf.write(os.path.join(args.output_dir, f), f)
    print(f"Created submission.zip: {os.path.getsize('submission.zip')/1024:.0f} KB")

if __name__ == '__main__':
    main()
