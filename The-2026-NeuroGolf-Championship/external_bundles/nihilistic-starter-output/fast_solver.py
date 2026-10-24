
import os, json, math, zipfile, copy, itertools, sys
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any
import numpy as np

try:
    import onnx, onnx.helper as oh, onnx.numpy_helper as onh
    from onnx import TensorProto
except ImportError:
    os.system("pip install onnx -q")
    import onnx, onnx.helper as oh, onnx.numpy_helper as onh
    from onnx import TensorProto
try:
    import onnxruntime as ort
except ImportError:
    os.system("pip install onnxruntime -q")
    import onnxruntime as ort

C,H,W=10,30,30
MAX_BYTES=int(1.44*1024*1024)
BAD_OPS={"Loop","Scan","NonZero","Unique","Script","Function"}
OPSET=[oh.make_opsetid("",17)]

def grid_to_tensor(grid):
    g=np.asarray(grid,dtype=np.int32); h,w=g.shape
    t=np.zeros((1,C,H,W),dtype=np.float32)
    for r in range(h):
        for c in range(w):
            v=int(g[r,c])
            if 0<=v<C: t[0,v,r,c]=1.0
    return t

def tensor_to_grid(t,oh_,ow_):
    arr=t[0,:,:oh_,:ow_]; grid=[]
    for r in range(oh_):
        row=[]
        for c in range(ow_):
            cv=arr[:,r,c]
            row.append(0 if cv.max()<0.5 else int(np.argmax(cv)))
        grid.append(row)
    return grid

def _X(): return oh.make_tensor_value_info("input",TensorProto.FLOAT,[1,C,H,W])
def _Y(): return oh.make_tensor_value_info("output",TensorProto.FLOAT,[1,C,H,W])
def _c(name,arr): return oh.make_node("Constant",[],[name],value=onh.from_array(arr,name=name+"_v"))
def _m(nodes,gn="net"):
    m=oh.make_model(oh.make_graph(nodes,gn,[_X()],[_Y()]),opset_imports=OPSET); m.ir_version=8; return m

def model_bytes(m): return m.SerializeToString()
def check_fits(m): return len(model_bytes(m))<=MAX_BYTES
def check_ops(m): return all(n.op_type not in BAD_OPS for n in m.graph.node)

def count_params(m):
    t=0
    for i in m.graph.initializer: t+=int(np.prod(i.dims)) if i.dims else 0
    for n in m.graph.node:
        if n.op_type=="Constant":
            for a in n.attribute:
                if a.name=="value" and a.t.dims: t+=int(np.prod(a.t.dims))
    return t

def _smap(m):
    s={}
    for vi in list(m.graph.input)+list(m.graph.output):
        s[vi.name]=tuple(d.dim_value if d.dim_value>0 else 1 for d in vi.type.tensor_type.shape.dim)
    for i in m.graph.initializer: s[i.name]=tuple(i.dims)
    for n in m.graph.node:
        if n.op_type=="Constant":
            for a in n.attribute:
                if a.name=="value": s[n.output[0]]=tuple(a.t.dims) if a.t.dims else ()
    return s

def est_macs(m):
    mc=0; s=_smap(m)
    for n in m.graph.node:
        if n.op_type=="Conv":
            w=s.get(n.input[1]); x=s.get(n.input[0])
            if w and x and len(w)==4 and len(x)==4: mc+=int(w[0]*w[1]*w[2]*w[3]*x[2]*x[3])
        elif n.op_type=="Gemm":
            a=s.get(n.input[0]); w=s.get(n.input[1])
            if a and w and len(a)>=2 and len(w)>=2: mc+=int(a[0]*a[1]*(w[0] if w[0]!=a[1] else w[1]))
        elif n.op_type=="MatMul":
            a=s.get(n.input[0]); b=s.get(n.input[1])
            if a and b and len(a)>=2 and len(b)>=2: mc+=int(a[-2]*a[-1]*b[-1])
    return mc

def cost(m): return count_params(m)+len(model_bytes(m))+est_macs(m)

def check_correct(m,pairs):
    if not pairs or not check_fits(m) or not check_ops(m): return False
    try:
        so=ort.SessionOptions(); so.log_severity_level=3
        sess=ort.InferenceSession(model_bytes(m),sess_options=so,providers=["CPUExecutionProvider"])
    except: return False
    try:
        for p in pairs:
            inp=grid_to_tensor(p["input"]); og=np.asarray(p["output"]); oh_,ow_=og.shape
            pred=sess.run(None,{"input":inp})[0]
            if tensor_to_grid(pred,oh_,ow_)!=p["output"]: return False
        return True
    except: return False

# ═══════════════════════════════════════════════════════════
# Builders
# ═══════════════════════════════════════════════════════════

def mk_identity(): return _m([oh.make_node("Identity",["input"],["output"])],"id")

def mk_const(og):
    og=np.asarray(og,dtype=np.int32); oh_,ow_=og.shape
    p=np.zeros((1,C,H,W),dtype=np.float32)
    for r in range(oh_):
        for c in range(ow_):
            v=int(og[r,c])
            if 0<=v<C: p[0,v,r,c]=1.0
    return _m([_c("K",p),oh.make_node("Identity",["K"],["output"])],"const")

def mk_transpose(): return _m([oh.make_node("Transpose",["input"],["output"],perm=[0,1,3,2])],"tr")

def _sr(ax,dm,i,o,s=""):
    return [_c(f"s{s}",np.asarray([d-1 for d in dm],dtype=np.int64)),
            _c(f"e{s}",np.asarray([-d-1 for d in dm],dtype=np.int64)),
            _c(f"a{s}",np.asarray(ax,dtype=np.int64)),
            _c(f"p{s}",np.asarray([-1]*len(dm),dtype=np.int64)),
            oh.make_node("Slice",[i,f"s{s}",f"e{s}",f"a{s}",f"p{s}"],[o])]

def mk_flip_h(): return _m(_sr([2],[H],"input","output"),"fh")
def mk_flip_w(): return _m(_sr([3],[W],"input","output"),"fw")
def mk_flip_both(): return _m(_sr([2,3],[H,W],"input","output"),"fb")
def mk_rot180(): return mk_flip_both()
def mk_rot90cw():
    n=[oh.make_node("Transpose",["input"],["t"],perm=[0,1,3,2])]; n+=_sr([3],[W],"t","output","r"); return _m(n,"r90cw")
def mk_rot90ccw():
    n=[oh.make_node("Transpose",["input"],["t"],perm=[0,1,3,2])]; n+=_sr([2],[H],"t","output","r"); return _m(n,"r90ccw")
def mk_anti_tr():
    n=[oh.make_node("Transpose",["input"],["t"],perm=[0,1,3,2])]; n+=_sr([2,3],[H,W],"t","output","r"); return _m(n,"atr")

def _pad(i,o,oh_,ow_,s=""):
    return [_c(f"pd{s}",np.asarray([0,0,0,0,0,0,H-oh_,W-ow_],dtype=np.int64)),
            oh.make_node("Pad",[i,f"pd{s}"],[o],mode="constant")]

def _crop(i,o,h,w,s=""):
    return [_c(f"cs{s}",np.asarray([0,0],dtype=np.int64)),
            _c(f"ce{s}",np.asarray([h,w],dtype=np.int64)),
            _c(f"ca{s}",np.asarray([2,3],dtype=np.int64)),
            oh.make_node("Slice",[i,f"cs{s}",f"ce{s}",f"ca{s}"],[o])]

def mkf_rot180(h,w): n=_crop("input","ct",h,w,"0"); n+=_sr([2,3],[h,w],"ct","rt","r"); n+=_pad("rt","output",h,w,"p"); return _m(n,"fr180")
def mkf_fh(h,w): n=_crop("input","ct",h,w,"0"); n+=_sr([2],[h],"ct","fl","r"); n+=_pad("fl","output",h,w,"p"); return _m(n,"ffh")
def mkf_fw(h,w): n=_crop("input","ct",h,w,"0"); n+=_sr([3],[w],"ct","fl","r"); n+=_pad("fl","output",h,w,"p"); return _m(n,"ffw")
def mkf_tr(h,w): n=_crop("input","ct",h,w,"0"); n+=[oh.make_node("Transpose",["ct"],["tp"],perm=[0,1,3,2])]; n+=_pad("tp","output",w,h,"p"); return _m(n,"ftr")
def mkf_r90cw(h,w): n=_crop("input","ct",h,w,"0"); n+=[oh.make_node("Transpose",["ct"],["t"],perm=[0,1,3,2])]; n+=_sr([3],[h],"t","rt","r"); n+=_pad("rt","output",w,h,"p"); return _m(n,"fr90cw")
def mkf_r90ccw(h,w): n=_crop("input","ct",h,w,"0"); n+=[oh.make_node("Transpose",["ct"],["t"],perm=[0,1,3,2])]; n+=_sr([2],[w],"t","rt","r"); n+=_pad("rt","output",w,h,"p"); return _m(n,"fr90ccw")

def mk_color_remap(cm):
    inv={d:s for s,d in cm.items()}; idx=np.arange(C,dtype=np.int64); mask=np.ones(C,dtype=np.float32)
    sa={s for s,d in cm.items() if s!=d}
    for d in range(C):
        if d in inv: idx[d]=inv[d]
        elif d in sa: idx[d]=0; mask[d]=0.0
    gi=_c("gi",idx)
    if mask.min()==1.0: return _m([gi,oh.make_node("Gather",["input","gi"],["output"],axis=1)],"crm")
    return _m([gi,oh.make_node("Gather",["input","gi"],["g"],axis=1),_c("cm",mask.reshape(1,C,1,1)),oh.make_node("Mul",["g","cm"],["output"])],"crm_m")

def mk_crop_slice(r0,c0,oh_,ow_):
    n=[_c("cs",np.asarray([r0,c0],dtype=np.int64)),_c("ce",np.asarray([r0+oh_,c0+ow_],dtype=np.int64)),
       _c("ca",np.asarray([2,3],dtype=np.int64)),oh.make_node("Slice",["input","cs","ce","ca"],["cr"])]
    n+=_pad("cr","output",oh_,ow_,"p"); return _m(n,"crop")

def mk_ftranslate(gh,gw,dr,dc):
    sr0=max(0,-dr);sr1=min(gh,gh-dr);sc0=max(0,-dc);sc1=min(gw,gw-dc)
    dr0=max(0,dr);dc0=max(0,dc);rh=sr1-sr0;rw=sc1-sc0
    if rh<=0 or rw<=0: return mk_const(np.zeros((1,1),dtype=np.int32))
    n=[_c("fts",np.asarray([sr0,sc0],dtype=np.int64)),_c("fte",np.asarray([sr1,sc1],dtype=np.int64)),
       _c("fta",np.asarray([2,3],dtype=np.int64)),oh.make_node("Slice",["input","fts","fte","fta"],["fs"])]
    n+=[_c("fpp",np.asarray([0,0,dr0,dc0,0,0,H-dr0-rh,W-dc0-rw],dtype=np.int64)),
        oh.make_node("Pad",["fs","fpp"],["output"],mode="constant")]
    return _m(n,"ftr")

def mk_upscale(f,ih,iw):
    n=_crop("input","ct",ih,iw,"0")
    n+=[_c("rr",np.asarray([],dtype=np.float32)),_c("rs",np.asarray([],dtype=np.float32)),
        _c("rz",np.asarray([1,C,ih*f,iw*f],dtype=np.int64)),
        oh.make_node("Resize",["ct","rr","rs","rz"],["up"],mode="nearest",
                     coordinate_transformation_mode="asymmetric",nearest_mode="floor")]
    n+=_pad("up","output",ih*f,iw*f,"p"); return _m(n,"upscale")

def mk_downscale(f,ih,iw):
    oh_=ih//f;ow_=iw//f
    n=[_c("ds",np.asarray([0,0],dtype=np.int64)),_c("de",np.asarray([ih,iw],dtype=np.int64)),
       _c("da",np.asarray([2,3],dtype=np.int64)),_c("dp",np.asarray([f,f],dtype=np.int64)),
       oh.make_node("Slice",["input","ds","de","da","dp"],["dn"])]
    n+=_pad("dn","output",oh_,ow_,"p"); return _m(n,"downscale")

def mk_tile(tr,tc,ih,iw):
    n=_crop("input","ct",ih,iw,"0")
    n+=[_c("tr",np.asarray([1,1,tr,tc],dtype=np.int64)),oh.make_node("Tile",["ct","tr"],["tl"])]
    n+=_pad("tl","output",ih*tr,iw*tc,"p"); return _m(n,"tile")

def mk_cat_fw(ih,iw):
    n=_crop("input","ct",ih,iw,"0"); n+=_sr([3],[iw],"ct","fl","fw")
    n+=[oh.make_node("Concat",["ct","fl"],["cat"],axis=3)]; n+=_pad("cat","output",ih,iw*2,"p"); return _m(n,"catfw")

def mk_cat_fh(ih,iw):
    n=_crop("input","ct",ih,iw,"0"); n+=_sr([2],[ih],"ct","fl","fh")
    n+=[oh.make_node("Concat",["ct","fl"],["cat"],axis=2)]; n+=_pad("cat","output",ih*2,iw,"p"); return _m(n,"catfh")

def mk_quad(ih,iw):
    n=_crop("input","ct",ih,iw,"0")
    n+=_sr([3],[iw],"ct","fw","fw"); n+=[oh.make_node("Concat",["ct","fw"],["top"],axis=3)]
    n+=_sr([2],[ih],"ct","fh","fh"); n+=_sr([2,3],[ih,iw],"ct","fr","fr")
    n+=[oh.make_node("Concat",["fh","fr"],["bot"],axis=3),oh.make_node("Concat",["top","bot"],["full"],axis=2)]
    n+=_pad("full","output",ih*2,iw*2,"p"); return _m(n,"quad")

def mk_row_bc(ih,iw,ri):
    n=[_c("rs",np.asarray([ri],dtype=np.int64)),_c("re",np.asarray([ri+1],dtype=np.int64)),_c("ra",np.asarray([2],dtype=np.int64)),
       oh.make_node("Slice",["input","rs","re","ra"],["row"]),
       _c("rr",np.asarray([1,1,ih,1],dtype=np.int64)),oh.make_node("Tile",["row","rr"],["tl"]),
       _c("rcs",np.asarray([0,0],dtype=np.int64)),_c("rce",np.asarray([ih,iw],dtype=np.int64)),_c("rca",np.asarray([2,3],dtype=np.int64)),
       oh.make_node("Slice",["tl","rcs","rce","rca"],["cr"])]
    n+=_pad("cr","output",ih,iw,"p"); return _m(n,"rowbc")

def mk_col_bc(ih,iw,ci):
    n=[_c("cs2",np.asarray([ci],dtype=np.int64)),_c("ce2",np.asarray([ci+1],dtype=np.int64)),_c("ca2",np.asarray([3],dtype=np.int64)),
       oh.make_node("Slice",["input","cs2","ce2","ca2"],["col"]),
       _c("cr2",np.asarray([1,1,1,iw],dtype=np.int64)),oh.make_node("Tile",["col","cr2"],["tl"]),
       _c("rcs",np.asarray([0,0],dtype=np.int64)),_c("rce",np.asarray([ih,iw],dtype=np.int64)),_c("rca",np.asarray([2,3],dtype=np.int64)),
       oh.make_node("Slice",["tl","rcs","rce","rca"],["cr"])]
    n+=_pad("cr","output",ih,iw,"p"); return _m(n,"colbc")

def mk_crop_color(r0,c0,oh_,ow_,cm):
    n=[_c("cs",np.asarray([r0,c0],dtype=np.int64)),_c("ce",np.asarray([r0+oh_,c0+ow_],dtype=np.int64)),
       _c("ca",np.asarray([2,3],dtype=np.int64)),oh.make_node("Slice",["input","cs","ce","ca"],["cr"])]
    inv={d:s for s,d in cm.items()}; idx=np.arange(C,dtype=np.int64); mask=np.ones(C,dtype=np.float32)
    sa={s for s,d in cm.items() if s!=d}
    for d in range(C):
        if d in inv: idx[d]=inv[d]
        elif d in sa: idx[d]=0; mask[d]=0.0
    gi=_c("gi",idx)
    if mask.min()==1.0: n+=[gi,oh.make_node("Gather",["cr","gi"],["cl"],axis=1)]
    else: n+=[gi,oh.make_node("Gather",["cr","gi"],["g"],axis=1),_c("cm",mask.reshape(1,C,1,1)),oh.make_node("Mul",["g","cm"],["cl"])]
    n+=_pad("cl","output",oh_,ow_,"p"); return _m(n,"cropcol")

def mk_border(gh,gw,b,fill):
    oh_=gh+2*b; ow_=gw+2*b
    if oh_>H or ow_>W: return None
    n=_crop("input","ct",gh,gw,"pb")
    n+=[_c("pbp",np.asarray([0,0,b,b,0,0,b,b],dtype=np.int64)),oh.make_node("Pad",["ct","pbp"],["pd"],mode="constant")]
    mask=np.zeros((1,C,oh_,ow_),dtype=np.float32)
    if 0<=fill<C: mask[0,fill,:b,:]=1;mask[0,fill,-b:,:]=1;mask[0,fill,:,:b]=1;mask[0,fill,:,-b:]=1
    n+=[_c("pbm",mask),oh.make_node("Add",["pd","pbm"],["bd"])]
    n+=_pad("bd","output",oh_,ow_,"pf"); return _m(n,"border")

_ZM=np.ones((1,C,1,1),dtype=np.float32); _ZM[0,0,0,0]=0.0
def _z0(i,o,s="z"): return [_c(f"{s}m",_ZM.copy()),oh.make_node("Mul",[i,f"{s}m"],[o])]

def mk_sym_h(ih,iw):
    n=_crop("input","ct",ih,iw,"0"); n+=_z0("ct","nz","sh"); n+=_sr([2],[ih],"nz","fl","shr")
    n+=[oh.make_node("Max",["nz","fl"],["cb"])]; n+=_pad("cb","output",ih,iw,"p"); return _m(n,"symh")
def mk_sym_w(ih,iw):
    n=_crop("input","ct",ih,iw,"0"); n+=_z0("ct","nz","sw"); n+=_sr([3],[iw],"nz","fl","swr")
    n+=[oh.make_node("Max",["nz","fl"],["cb"])]; n+=_pad("cb","output",ih,iw,"p"); return _m(n,"symw")
def mk_sym_hw(ih,iw):
    n=_crop("input","ct",ih,iw,"0"); n+=_z0("ct","nz","sx")
    n+=_sr([2],[ih],"nz","fh","sxh"); n+=_sr([3],[iw],"nz","fw","sxw"); n+=_sr([2,3],[ih,iw],"nz","fb","sxb")
    n+=[oh.make_node("Max",["nz","fh"],["m1"]),oh.make_node("Max",["m1","fw"],["m2"]),oh.make_node("Max",["m2","fb"],["cb"])]
    n+=_pad("cb","output",ih,iw,"p"); return _m(n,"symhw")
def mk_sym_diag(ih,iw):
    if ih!=iw: return None
    n=_crop("input","ct",ih,iw,"0"); n+=_z0("ct","nz","sd")
    n+=[oh.make_node("Transpose",["nz"],["tr"],perm=[0,1,3,2]),oh.make_node("Max",["nz","tr"],["cb"])]
    n+=_pad("cb","output",ih,iw,"p"); return _m(n,"symd")

def mk_xform_color(base_fn,cm):
    base=base_fn(); bn=[copy.deepcopy(n) for n in base.graph.node]
    for n in bn:
        for i,o in enumerate(n.output):
            if o=="output": n.output[i]="mid"
    inv={d:s for s,d in cm.items()}; idx=np.arange(C,dtype=np.int64); mask=np.ones(C,dtype=np.float32)
    sa={s for s,d in cm.items() if s!=d}
    for d in range(C):
        if d in inv: idx[d]=inv[d]
        elif d in sa: idx[d]=0; mask[d]=0.0
    gi=_c("gi2",idx)
    if mask.min()==1.0: return _m(bn+[gi,oh.make_node("Gather",["mid","gi2"],["output"],axis=1)],"xc")
    return _m(bn+[gi,oh.make_node("Gather",["mid","gi2"],["g2"],axis=1),_c("cm2",mask.reshape(1,C,1,1)),oh.make_node("Mul",["g2","cm2"],["output"])],"xc_m")

def mk_conv(w_np,ks,gn="conv"):
    pad=ks//2
    return _m([oh.make_node("Constant",[],["cw"],value=onh.from_array(w_np.astype(np.float32),name="cw")),
               oh.make_node("Conv",["input","cw"],["output"],kernel_shape=[ks,ks],pads=[pad]*4)],gn)

def mk_2layer(w1,b1,w2,b2):
    return _m([oh.make_node("Constant",[],["w1"],value=onh.from_array(w1,name="w1")),
               oh.make_node("Constant",[],["b1"],value=onh.from_array(b1,name="b1")),
               oh.make_node("Conv",["input","w1","b1"],["c1"],kernel_shape=[3,3],pads=[1,1,1,1]),
               oh.make_node("Relu",["c1"],["r1"]),
               oh.make_node("Constant",[],["w2"],value=onh.from_array(w2,name="w2")),
               oh.make_node("Constant",[],["b2"],value=onh.from_array(b2,name="b2")),
               oh.make_node("Conv",["r1","w2","b2"],["output"],kernel_shape=[1,1],pads=[0,0,0,0])],"2l")

# ═══════════════════════════════════════════════════════════
# Spatial copy solver
# ═══════════════════════════════════════════════════════════

def mk_spatial(gi,mask):
    g=oh.make_graph(
        [oh.make_node("Reshape",["input","shc"],["flat"]),
         oh.make_node("Gather",["flat","gi"],["fg"],axis=2),
         oh.make_node("Reshape",["fg","sho"],["gd"]),
         oh.make_node("Mul",["gd","mk"],["output"])],
        "spatial",[oh.make_tensor_value_info("input",TensorProto.FLOAT,[1,10,30,30])],
        [oh.make_tensor_value_info("output",TensorProto.FLOAT,[1,10,30,30])],
        [onh.from_array(np.array([1,10,900],dtype=np.int64),name="shc"),
         onh.from_array(np.array([1,10,30,30],dtype=np.int64),name="sho"),
         onh.from_array(gi.astype(np.int64),name="gi"),
         onh.from_array(mask.astype(np.float32),name="mk")])
    m=oh.make_model(g,opset_imports=OPSET); m.ir_version=8; return m

def solve_spatial(task_data):
    pairs=task_data.get("train",[])+task_data.get("test",[])+task_data.get("arc-gen",[])
    for p in pairs:
        if len(p["input"])>30 or len(p["input"][0])>30 or len(p["output"])>30 or len(p["output"][0])>30: return None
    inputs=np.stack([grid_to_tensor(p["input"])[0].reshape(10,-1) for p in pairs])
    outputs=np.stack([grid_to_tensor(p["output"])[0].reshape(10,-1) for p in pairs])
    lookup={}
    for si in range(900):
        sig=inputs[:,:,si].tobytes()
        lookup.setdefault(sig,[]).append(si)
    gi=np.zeros(900,dtype=np.int64); mask=np.zeros((1,1,30,30),dtype=np.float32)
    for oi in range(900):
        sa=outputs[:,:,oi]
        if np.all(sa==0.0): continue
        cands=lookup.get(sa.tobytes())
        if not cands or len(cands)>1: return None
        gi[oi]=cands[0]; r,c=divmod(oi,30); mask[0,0,r,c]=1.0
    m=mk_spatial(gi,mask)
    if check_correct(m,pairs): return m
    return None

# ═══════════════════════════════════════════════════════════
# Learned conv
# ═══════════════════════════════════════════════════════════

def try_conv(pairs,ks=1,steps=800):
    try: import torch, torch.nn as nn
    except: return None
    if not all(np.asarray(p["input"]).shape==np.asarray(p["output"]).shape for p in pairs): return None
    it=torch.tensor(np.stack([grid_to_tensor(p["input"])[0] for p in pairs]),dtype=torch.float32)
    ot=torch.tensor(np.stack([grid_to_tensor(p["output"])[0] for p in pairs]),dtype=torch.float32)
    pad=ks//2; conv=nn.Conv2d(C,C,ks,padding=pad,bias=False); nn.init.zeros_(conv.weight)
    opt=torch.optim.Adam(conv.parameters(),lr=0.05)
    sch=torch.optim.lr_scheduler.ReduceLROnPlateau(opt,patience=50,factor=0.5)
    bl=float("inf"); bs=None
    for _ in range(steps):
        opt.zero_grad(); l=nn.functional.mse_loss(conv(it),ot); l.backward(); opt.step(); sch.step(l.item())
        if l.item()<bl: bl=l.item(); bs=copy.deepcopy(conv.state_dict())
    if bl>0.05: return None
    conv.load_state_dict(bs)
    return mk_conv(conv.weight.detach().numpy(),ks,f"lconv{ks}")

def try_2layer(pairs):
    try: import torch, torch.nn as nn
    except: return None
    if not all(np.asarray(p["input"]).shape==np.asarray(p["output"]).shape for p in pairs): return None
    it=torch.tensor(np.stack([grid_to_tensor(p["input"])[0] for p in pairs]),dtype=torch.float32)
    ot=torch.tensor(np.stack([grid_to_tensor(p["output"])[0] for p in pairs]),dtype=torch.float32)
    class Net(nn.Module):
        def __init__(self): super().__init__(); self.c1=nn.Conv2d(C,32,3,padding=1,bias=True); self.c2=nn.Conv2d(32,C,1,bias=True)
        def forward(self,x): return self.c2(torch.relu(self.c1(x)))
    net=Net(); opt=torch.optim.Adam(net.parameters(),lr=0.01); bl=float("inf"); bs=None
    for _ in range(2000):
        opt.zero_grad(); l=nn.functional.mse_loss(net(it),ot); l.backward(); opt.step()
        if l.item()<bl: bl=l.item(); bs=copy.deepcopy(net.state_dict())
        if bl<0.01: break
    if bl>0.05: return None
    net.load_state_dict(bs)
    return mk_2layer(net.c1.weight.detach().numpy().astype(np.float32),net.c1.bias.detach().numpy().astype(np.float32),
                     net.c2.weight.detach().numpy().astype(np.float32),net.c2.bias.detach().numpy().astype(np.float32))

# ═══════════════════════════════════════════════════════════
# Detectors
# ═══════════════════════════════════════════════════════════

def all_same(p): return all(np.asarray(x["input"]).shape==np.asarray(x["output"]).shape for x in p)
def fsize(p):
    if not p: return None
    f=np.asarray(p[0]["input"]).shape
    return f if all(np.asarray(x["input"]).shape==f for x in p[1:]) else None

def d_id(p): return all(np.array_equal(np.asarray(x["input"]),np.asarray(x["output"])) for x in p)
def d_const(p):
    if not p: return None
    f=np.asarray(p[0]["output"])
    for x in p[1:]:
        o=np.asarray(x["output"])
        if o.shape!=f.shape or not np.array_equal(o,f): return None
    if len({str(x["input"]) for x in p})<2 and d_id(p): return None
    return f

def d_rot(p):
    for l,k in [("180",2),("90cw",-1),("90ccw",1)]:
        if all(np.rot90(np.asarray(x["input"]),k).shape==np.asarray(x["output"]).shape and
               np.array_equal(np.rot90(np.asarray(x["input"]),k),np.asarray(x["output"])) for x in p): return l
    return None

def d_flip(p):
    for n,fn in [("h",np.flipud),("w",np.fliplr),("both",lambda a:np.flipud(np.fliplr(a)))]:
        if all(fn(np.asarray(x["input"])).shape==np.asarray(x["output"]).shape and
               np.array_equal(fn(np.asarray(x["input"])),np.asarray(x["output"])) for x in p): return n
    return None

def d_tr(p):
    return all(np.asarray(x["input"]).T.shape==np.asarray(x["output"]).shape and
               np.array_equal(np.asarray(x["input"]).T,np.asarray(x["output"])) for x in p)

def d_atr(p):
    return all(np.flipud(np.fliplr(np.asarray(x["input"]).T)).shape==np.asarray(x["output"]).shape and
               np.array_equal(np.flipud(np.fliplr(np.asarray(x["input"]).T)),np.asarray(x["output"])) for x in p)

def d_cm(p):
    if not all_same(p): return None
    m={}
    for x in p:
        for a,b in zip(np.asarray(x["input"]).flat,np.asarray(x["output"]).flat):
            a,b=int(a),int(b)
            if a in m and m[a]!=b: return None
            m[a]=b
    return m if any(k!=v for k,v in m.items()) else None

def d_xc(p,fn):
    m={}
    for x in p:
        ig=np.asarray(x["input"]); og=np.asarray(x["output"]); t=fn(ig)
        if t.shape!=og.shape: return None
        for a,b in zip(t.flat,og.flat):
            a,b=int(a),int(b)
            if a in m and m[a]!=b: return None
            m[a]=b
    return m if any(k!=v for k,v in m.items()) else None

def d_crop(p):
    if not p: return None
    fi=np.asarray(p[0]["input"]); fo=np.asarray(p[0]["output"]); oh_,ow_=fo.shape; ih,iw=fi.shape
    if oh_>ih or ow_>iw: return None
    for r0 in range(ih-oh_+1):
        for c0 in range(iw-ow_+1):
            if not np.array_equal(fi[r0:r0+oh_,c0:c0+ow_],fo): continue
            if all(np.asarray(x["output"]).shape==(oh_,ow_) and r0+oh_<=np.asarray(x["input"]).shape[0] and
                   c0+ow_<=np.asarray(x["input"]).shape[1] and
                   np.array_equal(np.asarray(x["input"])[r0:r0+oh_,c0:c0+ow_],np.asarray(x["output"])) for x in p[1:]):
                return (r0,c0,oh_,ow_)
    return None

def d_shift(p):
    if not all_same(p): return None
    ih,iw=np.asarray(p[0]["input"]).shape
    for dr in range(-min(ih,11)+1,min(ih,11)):
        for dc in range(-min(iw,11)+1,min(iw,11)):
            if dr==0 and dc==0: continue
            ok=True
            for x in p:
                ig=np.asarray(x["input"]); og=np.asarray(x["output"]); hh,ww=ig.shape
                s=np.zeros_like(ig)
                sr0=max(0,-dr);sr1=min(hh,hh-dr);sc0=max(0,-dc);sc1=min(ww,ww-dc)
                dr0=max(0,dr);dc0=max(0,dc);rh=sr1-sr0;rw=sc1-sc0
                if rh>0 and rw>0: s[dr0:dr0+rh,dc0:dc0+rw]=ig[sr0:sr1,sc0:sc1]
                if not np.array_equal(s,og): ok=False; break
            if ok: return (dr,dc)
    return None

def d_cf(p):
    if not all_same(p): return None
    cand=None
    for x in p:
        ig=np.asarray(x["input"]); og=np.asarray(x["output"]); diff=(ig!=og)
        if not np.any(diff): continue
        if not np.all(og[diff]==0): return None
        cand=(cand or set())|set(int(v) for v in ig[diff].flat)
    if not cand: return None
    for x in p:
        ig=np.asarray(x["input"]).copy()
        for c_ in cand: ig[ig==c_]=0
        if not np.array_equal(ig,np.asarray(x["output"])): return None
    return cand

def d_up(p):
    for f in [2,3,4,5]:
        if all(np.asarray(x["output"]).shape==(np.asarray(x["input"]).shape[0]*f,np.asarray(x["input"]).shape[1]*f) and
               np.asarray(x["input"]).shape[0]*f<=H and np.asarray(x["input"]).shape[1]*f<=W and
               np.array_equal(np.repeat(np.repeat(np.asarray(x["input"]),f,0),f,1),np.asarray(x["output"])) for x in p): return f
    return None

def d_dn(p):
    for f in [2,3,4,5]:
        if all(np.asarray(x["input"]).shape[0]==np.asarray(x["output"]).shape[0]*f and
               np.array_equal(np.asarray(x["input"])[::f,::f],np.asarray(x["output"])) for x in p): return f
    return None

def d_tile(p):
    if not p: return None
    ih,iw=np.asarray(p[0]["input"]).shape; oh_,ow_=np.asarray(p[0]["output"]).shape
    if ih==0 or iw==0 or oh_%ih or ow_%iw: return None
    tr,tc=oh_//ih,ow_//iw
    if tr*ih>H or tc*iw>W or (tr==1 and tc==1): return None
    for x in p:
        ig=np.asarray(x["input"]); og=np.asarray(x["output"])
        if og.shape!=(ig.shape[0]*tr,ig.shape[1]*tc) or not np.array_equal(np.tile(ig,(tr,tc)),og): return None
    return (tr,tc)

def d_catfw(p):
    return bool(p) and all(np.asarray(x["output"]).shape==(np.asarray(x["input"]).shape[0],np.asarray(x["input"]).shape[1]*2) and
               np.array_equal(np.concatenate([np.asarray(x["input"]),np.fliplr(np.asarray(x["input"]))],1),np.asarray(x["output"])) for x in p)

def d_catfh(p):
    return bool(p) and all(np.asarray(x["output"]).shape==(np.asarray(x["input"]).shape[0]*2,np.asarray(x["input"]).shape[1]) and
               np.array_equal(np.concatenate([np.asarray(x["input"]),np.flipud(np.asarray(x["input"]))],0),np.asarray(x["output"])) for x in p)

def d_quad(p):
    if not p: return False
    for x in p:
        ig=np.asarray(x["input"]); og=np.asarray(x["output"]); ih,iw=ig.shape
        if og.shape!=(ih*2,iw*2): return False
        top=np.concatenate([ig,np.fliplr(ig)],1); bot=np.concatenate([np.flipud(ig),np.rot90(ig,2)],1)
        if not np.array_equal(np.concatenate([top,bot],0),og): return False
    return True

def d_rowbc(p):
    if not all_same(p): return None
    ch=None
    for x in p:
        ig=np.asarray(x["input"]); og=np.asarray(x["output"]); mt=None
        for r in range(ig.shape[0]):
            if np.all(og==ig[r,:]): mt=r; break
        if mt is None: return None
        if ch is None: ch=mt
        elif ch!=mt: return None
    return ch

def d_colbc(p):
    if not all_same(p): return None
    ch=None
    for x in p:
        ig=np.asarray(x["input"]); og=np.asarray(x["output"]); mt=None
        for c in range(ig.shape[1]):
            if np.all(og==ig[:,c:c+1]): mt=c; break
        if mt is None: return None
        if ch is None: ch=mt
        elif ch!=mt: return None
    return ch

def d_cropcolor(p):
    if not p: return None
    fi=np.asarray(p[0]["input"]); fo=np.asarray(p[0]["output"]); oh_,ow_=fo.shape; ih,iw=fi.shape
    if oh_>ih or ow_>iw: return None
    for r0 in range(ih-oh_+1):
        for c0 in range(iw-ow_+1):
            cm={}; ok=True
            for x in p:
                ig=np.asarray(x["input"]); og=np.asarray(x["output"])
                if og.shape!=(oh_,ow_) or r0+oh_>ig.shape[0] or c0+ow_>ig.shape[1]: ok=False; break
                reg=ig[r0:r0+oh_,c0:c0+ow_]
                for a,b in zip(reg.flat,og.flat):
                    a,b=int(a),int(b)
                    if a in cm and cm[a]!=b: ok=False; break
                    cm[a]=b
                if not ok: break
            if not ok: continue
            if all(k==v for k,v in cm.items()): continue
            vf=True
            for x in p:
                reg=np.asarray(x["input"])[r0:r0+oh_,c0:c0+ow_]; mp=reg.copy()
                for k,v in cm.items(): mp[reg==k]=v
                if not np.array_equal(mp,np.asarray(x["output"])): vf=False; break
            if vf: return (r0,c0,oh_,ow_,cm)
    return None

def d_border(p):
    if not p: return None
    fi=np.asarray(p[0]["input"]); fo=np.asarray(p[0]["output"]); ih,iw=fi.shape; oh_,ow_=fo.shape
    if (oh_-ih)!=(ow_-iw) or (oh_-ih)<=0 or (oh_-ih)%2: return None
    b=(oh_-ih)//2
    if not np.array_equal(fo[b:b+ih,b:b+iw],fi): return None
    vals=set()
    for s in [fo[:b,:],fo[-b:,:],fo[:,:b],fo[:,-b:]]: vals|=set(int(v) for v in s.flat)
    if len(vals)!=1: return None
    fill=int(vals.pop())
    for x in p[1:]:
        ig=np.asarray(x["input"]); og=np.asarray(x["output"]); ih2,iw2=ig.shape
        if og.shape!=(ih2+2*b,iw2+2*b) or not np.array_equal(og[b:b+ih2,b:b+iw2],ig): return None
        m=np.zeros(og.shape,dtype=bool); m[:b,:]=True; m[-b:,:]=True; m[:,:b]=True; m[:,-b:]=True
        if not np.all(og[m]==fill): return None
    return (b,fill)

def d_sym(p):
    if not all_same(p): return None
    def fold(a,b):
        o=np.zeros_like(a); an=a!=0; bn=b!=0
        if np.any(an&bn&(a!=b)): return None
        o[an]=a[an]; o[bn&~an]=b[bn&~an]; return o
    for ax in ["h","w","hw","diag"]:
        ok=True
        for x in p:
            ig=np.asarray(x["input"]); og=np.asarray(x["output"])
            if ax=="h": f=fold(ig,np.flipud(ig))
            elif ax=="w": f=fold(ig,np.fliplr(ig))
            elif ax=="hw":
                f=fold(ig,np.flipud(ig))
                if f is not None: f=fold(f,np.fliplr(ig))
                if f is not None: f=fold(f,np.flipud(np.fliplr(ig)))
            elif ax=="diag":
                if ig.shape[0]!=ig.shape[1]: ok=False; break
                f=fold(ig,ig.T)
            if f is None or not np.array_equal(f,og): ok=False; break
        if ok: return ax
    return None

def d_perm(p):
    if not all(np.asarray(x["input"]).shape==(H,W) and np.asarray(x["output"]).shape==(H,W) for x in p): return None
    ig=np.asarray(p[0]["input"]).flatten(); og=np.asarray(p[0]["output"]).flatten()
    gi=np.zeros(H*W,dtype=np.int64)
    for d in range(H*W):
        w=np.where(ig==og[d])[0]
        if len(w)!=1: return None
        gi[d]=w[0]
    for x in p[1:]:
        if not np.array_equal(np.asarray(x["input"]).flatten()[gi],np.asarray(x["output"]).flatten()): return None
    return gi

# ═══════════════════════════════════════════════════════════
# Orchestrator
# ═══════════════════════════════════════════════════════════

def _cands(train,all_p):
    fs=fsize(all_p); full=(fs==(30,30)); same=all_same(train)

    if d_id(train): yield "id",mk_identity

    rot=d_rot(train)
    if rot:
        bmap={"180":(mk_rot180,mkf_rot180),"90cw":(mk_rot90cw,mkf_r90cw),"90ccw":(mk_rot90ccw,mkf_r90ccw)}
        bf,bff=bmap[rot]
        if full: yield rot,bf
        if fs: h,w=fs; yield rot+"_f",(lambda h=h,w=w,bff=bff:bff(h,w))

    flip=d_flip(train)
    if flip:
        bmap={"h":(mk_flip_h,mkf_fh),"w":(mk_flip_w,mkf_fw),"both":(mk_flip_both,mkf_rot180)}
        bf,bff=bmap[flip]
        if full: yield "fl_"+flip,bf
        if fs: h,w=fs; yield "fl_"+flip+"_f",(lambda h=h,w=w,bff=bff:bff(h,w))

    if d_tr(train):
        if full: yield "tr",mk_transpose
        if fs: h,w=fs; yield "tr_f",(lambda h=h,w=w:mkf_tr(h,w))

    if d_atr(train) and full: yield "atr",mk_anti_tr

    cm=d_cm(train)
    if cm and same: yield "crm",(lambda cm=cm:mk_color_remap(cm))

    for rl,k in [("180",2),("90cw",-1),("90ccw",1)]:
        xm=d_xc(train,lambda ig,k=k:np.rot90(ig,k))
        if xm and same:
            bmap={"180":(mk_rot180,mkf_rot180),"90cw":(mk_rot90cw,mkf_r90cw),"90ccw":(mk_rot90ccw,mkf_r90ccw)}
            bf,bff=bmap[rl]
            if full: yield rl+"_c",(lambda bf=bf,xm=xm:mk_xform_color(bf,xm))
            if fs: h,w=fs; yield rl+"_fc",(lambda bff=bff,h=h,w=w,xm=xm:mk_xform_color(lambda bff=bff,h=h,w=w:bff(h,w),xm))

    for fl,fn in [("h",np.flipud),("w",np.fliplr),("both",lambda a:np.flipud(np.fliplr(a)))]:
        xm=d_xc(train,fn)
        if xm and same:
            bmap={"h":(mk_flip_h,mkf_fh),"w":(mk_flip_w,mkf_fw),"both":(mk_flip_both,mkf_rot180)}
            bf,bff=bmap[fl]
            if full: yield "fl_"+fl+"_c",(lambda bf=bf,xm=xm:mk_xform_color(bf,xm))
            if fs: h,w=fs; yield "fl_"+fl+"_fc",(lambda bff=bff,h=h,w=w,xm=xm:mk_xform_color(lambda bff=bff,h=h,w=w:bff(h,w),xm))

    tc=d_xc(train,lambda ig:ig.T)
    if tc:
        if full: yield "tr_c",(lambda tc=tc:mk_xform_color(mk_transpose,tc))
        if fs: h,w=fs; yield "tr_fc",(lambda h=h,w=w,tc=tc:mk_xform_color(lambda h=h,w=w:mkf_tr(h,w),tc))

    cf=d_cf(train)
    if cf and same: yield "cf",(lambda cm={c_:0 for c_ in cf}:mk_color_remap(cm))

    crop=d_crop(train)
    if crop: r0,c0,oh_,ow_=crop; yield "crop",(lambda r0=r0,c0=c0,oh_=oh_,ow_=ow_:mk_crop_slice(r0,c0,oh_,ow_))

    sh=d_shift(train)
    if sh:
        dr,dc=sh
        if full: yield "sh",(lambda dr=dr,dc=dc:mk_ftranslate(H,W,dr,dc))
        if fs: h,w=fs; yield "sh_f",(lambda h=h,w=w,dr=dr,dc=dc:mk_ftranslate(h,w,dr,dc))

    if fs:
        h,w=fs
        up=d_up(train)
        if up: yield "up",(lambda f=up,h=h,w=w:mk_upscale(f,h,w))
        dn=d_dn(train)
        if dn: yield "dn",(lambda f=dn,h=h,w=w:mk_downscale(f,h,w))
        tl=d_tile(train)
        if tl: tr_,tc_=tl; yield "tile",(lambda tr_=tr_,tc_=tc_,h=h,w=w:mk_tile(tr_,tc_,h,w))
        if d_catfw(train) and w*2<=W: yield "catfw",(lambda h=h,w=w:mk_cat_fw(h,w))
        if d_catfh(train) and h*2<=H: yield "catfh",(lambda h=h,w=w:mk_cat_fh(h,w))
        if d_quad(train) and h*2<=H and w*2<=W: yield "quad",(lambda h=h,w=w:mk_quad(h,w))
        rb=d_rowbc(train)
        if rb is not None: yield "rb",(lambda h=h,w=w,rb=rb:mk_row_bc(h,w,rb))
        cb=d_colbc(train)
        if cb is not None: yield "cb",(lambda h=h,w=w,cb=cb:mk_col_bc(h,w,cb))
        sym=d_sym(train)
        if sym:
            sb={"h":mk_sym_h,"w":mk_sym_w,"hw":mk_sym_hw,"diag":mk_sym_diag}
            if not(sym=="diag" and h!=w): yield "sym_"+sym,(lambda h=h,w=w,sym=sym:sb[sym](h,w))
        ba=d_border(train)
        if ba:
            b,fill=ba
            if h+2*b<=H and w+2*b<=W: yield "brd",(lambda h=h,w=w,b=b,fill=fill:mk_border(h,w,b,fill))

    ccp=d_cropcolor(train)
    if ccp: r0,c0,oh_,ow_,cmap=ccp; yield "crpcol",(lambda r0=r0,c0=c0,oh_=oh_,ow_=ow_,cmap=cmap:mk_crop_color(r0,c0,oh_,ow_,cmap))

    perm=d_perm(train)
    if perm is not None:
        gi=perm
        def _mk_perm(gi=gi):
            g=oh.make_graph(
                [oh.make_node("Reshape",["input","sc"],["fl"]),oh.make_node("Gather",["fl","gi"],["gd"],axis=2),
                 oh.make_node("Reshape",["gd","so"],["output"])],
                "perm",[_X()],[_Y()],
                [onh.from_array(np.array([1,C,H*W],dtype=np.int64),name="sc"),
                 onh.from_array(gi.astype(np.int64),name="gi"),
                 onh.from_array(np.array([1,C,H,W],dtype=np.int64),name="so")])
            mm=oh.make_model(g,opset_imports=OPSET); mm.ir_version=8; return mm
        yield "perm",_mk_perm

    cst=d_const(train)
    if cst is not None: yield "const",(lambda k=cst:mk_const(k))


def solve_task(task_data,task_name=""):
    train=task_data.get("train",[]) or []; test=task_data.get("test",[]) or []
    ag=task_data.get("arc-gen",[]) or []; ags=ag[:10]
    all_p=train+test+ags
    if not all_p or not train: return None,None,None

    best=None; bc=float("inf"); bl=None

    for label,builder in _cands(train,all_p):
        try: m=builder()
        except: continue
        if m is None or not check_fits(m) or not check_ops(m): continue
        if not check_correct(m,all_p): continue
        c=cost(m)
        if c<bc: bc=c; best=m; bl=label

    sp=solve_spatial(task_data)
    if sp:
        c=cost(sp)
        if c<bc: bc=c; best=sp; bl="spatial"

    if best is None and all_same(train):
        for ks in [1,3,5]:
            m=try_conv(train,ks,800)
            if m and check_correct(m,all_p):
                c=cost(m)
                if c<bc: bc=c; best=m; bl=f"conv{ks}"; break
        if best is None:
            m=try_2layer(train)
            if m and check_correct(m,all_p):
                c=cost(m)
                if c<bc: bc=c; best=m; bl="conv2l"

    return best,bl,bc

def load_task(path):
    with open(path) as f: return json.load(f)

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
