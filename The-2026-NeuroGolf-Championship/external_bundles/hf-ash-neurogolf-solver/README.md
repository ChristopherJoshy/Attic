# NeuroGolf 2026 - ARC-AGI Tiny Network Solver

Enhanced solver for the [NeuroGolf 2026 competition](https://www.kaggle.com/competitions/neurogolf-2026), building minimal ONNX networks for ARC-AGI tasks.

## Overview

This repository contains an enhanced solver based on [rogermt/neurogolf-solver](https://huggingface.co/rogermt/neurogolf-solver) with additional analytical solvers and optimizations.

**Target:** Solve ARC-AGI tasks with the smallest possible ONNX networks.
**Score:** `max(1, 25 - ln(cost))` where cost = params + memory_bytes + MACs

## Data Source

The ARC-AGI training data with all 400 tasks (including test outputs) is available at:
- `https://huggingface.co/LuciferMrng/neurogolf-2026/blob/main/all_tasks.json`

## Usage

### 1. Install dependencies
```bash
pip install numpy onnx onnxruntime
```

### 2. Download the data
```bash
# Option 1: Direct download from HF
curl -L https://huggingface.co/LuciferMrng/neurogolf-2026/resolve/main/all_tasks.json -o all_tasks.json

# Option 2: Via huggingface-cli
pip install huggingface-hub
huggingface-cli download LuciferMrng/neurogolf-2026 all_tasks.json --local-dir .
```

### 3. Run the solver
```bash
# Solve all 400 tasks with 30s budget per task
python neurogolf_solver_enhanced.py --data_file all_tasks.json --output_dir submission --conv_budget 30

# Solve with more time (better coverage)
python neurogolf_solver_enhanced.py --data_file all_tasks.json --output_dir submission --conv_budget 60

# Solve specific tasks
python neurogolf_solver_enhanced.py --data_file all_tasks.json --output_dir submission --tasks 1,2,3
```

### 4. Create submission.zip
The solver automatically creates `submission.zip` with all generated ONNX files.

## Architecture

### Input/Output Format
- All networks use `[1, 10, 30, 30]` one-hot float32 tensors
- ONNX opset 10, IR version 10

### Solver Pipeline

**Analytical Solvers** (fast, tiny models - tried first):
1. `identity` - Input equals output
2. `color_map` - 1x1 conv color transformation
3. `transpose` - Matrix transpose
4. `flip` - Horizontal/vertical flip
5. `rotate` - 90/180/270 degree rotation
6. `tile` - Repeat input pattern
7. `upscale` - Nearest-neighbor upscaling
8. `concat` - Concatenate transformed inputs
9. `spatial_gather` - Pixel remapping
10. `crop` - Centered crop
11. `constant` - Fixed output regardless of input

**Convolution Solvers** (for learned transformations):
- **Fixed shape**: `Slice -> Conv -> ArgMax -> OneHot -> Pad`
- **Variable shape**: `Conv(30x30) -> ArgMax -> OneHot -> Mul(mask)`
- **Diff shape**: `Slice -> Conv -> Slice(crop) -> ArgMax -> OneHot -> Pad`

The conv solver learns optimal weights via least-squares fitting on one-hot patches, trying kernel sizes from 1 to 29.

## Key Optimizations

1. **Smallest kernel first** - Tries kernel size 1, then 3, 5, etc. (smaller = fewer params)
2. **Analytical before learned** - Analytical solvers have near-zero cost
3. **One-hot ArgMax trick** - Eliminates numerical precision issues
4. **No bias preferred** - Slightly fewer parameters

## Expected Results

With the base solver:
- **~127-293/400 tasks** solved depending on time budget
- Analytical solvers cover the simplest transformations
- Conv solver handles local spatial transformations

## References

- [ARC-AGI](https://github.com/fchollet/ARC-AGI) - Original benchmark
- [NeuroGolf 2026 Competition](https://www.kaggle.com/competitions/neurogolf-2026)
- [Rogermt's Base Solver](https://huggingface.co/rogermt/neurogolf-solver)

## License

MIT - Based on the ARC-AGI benchmark and community contributions.
