# Windows PowerShell setup for NeuroGolf 2026
# Run from a clean clone of https://github.com/ChristopherJoshy/The-2026-NeuroGolf-Championship

$ErrorActionPreference = 'Stop'

Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Cyan
foreach ($cmd in @('git', 'python')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "Missing required command: $cmd" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[2/4] Creating virtual environment..." -ForegroundColor Cyan
if (-not (Test-Path .venv)) {
    python -m venv .venv
}
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip

Write-Host "[3/4] Installing dependencies..." -ForegroundColor Cyan
pip install -e .

Write-Host "[4/4] Smoke test..." -ForegroundColor Cyan
python -c "import onnx, onnxruntime, numpy; print('imports ok'); print('onnx', onnx.__version__); print('onnxruntime', onnxruntime.__version__)"

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "  1. Read AGENTS.md, GOAL.md, MIGRATION_HANDOFF.md, reports/submissions/live_outcomes.md" -ForegroundColor White
Write-Host "  2. Confirm no pending Kaggle run: kaggle competitions submissions -c neurogolf-2026 --csv" -ForegroundColor White
Write-Host "  3. Verify current floor profile exists: reports/submissions/profile_current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_full.csv" -ForegroundColor White
Write-Host "  4. Do NOT submit anything immediately." -ForegroundColor White
