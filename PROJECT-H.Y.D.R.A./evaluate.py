#!/usr/bin/env python3
"""
Evaluation Pipeline for PROJECT H.Y.D.R.A.
Compute accuracy metrics for algal bloom detection against truth labels.

Usage:
    python evaluate.py --pred output/ndci_20250701.tif --truth data/bloom_mask_20250701.tif
    python evaluate.py --pred output/ndci_20250701.tif --truth data/bloom_mask_20250701.tif --threshold 0.25
    python evaluate.py --sanity-check output/ndci_20250701.tif
"""

import argparse
import sys
from pathlib import Path
from typing import Tuple, Dict, Optional
import numpy as np
import rasterio
import json
from datetime import datetime


def load_raster(path: Path) -> Tuple[np.ndarray, Dict]:
    """Load raster file and return array + metadata"""
    try:
        with rasterio.open(path) as src:
            data = src.read(1).astype(np.float32)
            profile = src.profile.copy()
        return data, profile
    except Exception as e:
        raise IOError(f"Failed to load {path}: {e}")


def compute_confusion_matrix(pred: np.ndarray, truth: np.ndarray, threshold: float = 0.25) -> Dict[str, int]:
    """
    Compute confusion matrix for binary classification.
    
    Args:
        pred: Predicted index values (e.g., NDCI)
        truth: Ground truth binary mask (0=no bloom, 1=bloom, NaN=ignore)
        threshold: Threshold to convert pred to binary (values >= threshold = bloom)
    
    Returns:
        Dictionary with TP, TN, FP, FN counts
    """
    # Binarize prediction
    pred_binary = (pred >= threshold).astype(int)
    
    # Create valid mask (ignore NaN in either array)
    valid_mask = ~np.isnan(pred) & ~np.isnan(truth)
    
    pred_valid = pred_binary[valid_mask]
    truth_valid = truth[valid_mask].astype(int)
    
    # Compute confusion matrix components
    tp = np.sum((pred_valid == 1) & (truth_valid == 1))
    tn = np.sum((pred_valid == 0) & (truth_valid == 0))
    fp = np.sum((pred_valid == 1) & (truth_valid == 0))
    fn = np.sum((pred_valid == 0) & (truth_valid == 1))
    
    return {
        'true_positive': int(tp),
        'true_negative': int(tn),
        'false_positive': int(fp),
        'false_negative': int(fn),
        'total_valid_pixels': int(valid_mask.sum())
    }


def compute_metrics(confusion: Dict[str, int]) -> Dict[str, float]:
    """Compute precision, recall, F1, IoU from confusion matrix"""
    tp = confusion['true_positive']
    tn = confusion['true_negative']
    fp = confusion['false_positive']
    fn = confusion['false_negative']
    
    # Precision: TP / (TP + FP)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    
    # Recall: TP / (TP + FN)
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    
    # F1 Score: 2 * (Precision * Recall) / (Precision + Recall)
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    
    # IoU (Intersection over Union): TP / (TP + FP + FN)
    iou = tp / (tp + fp + fn) if (tp + fp + fn) > 0 else 0.0
    
    # Accuracy: (TP + TN) / Total
    accuracy = (tp + tn) / confusion['total_valid_pixels'] if confusion['total_valid_pixels'] > 0 else 0.0
    
    return {
        'precision': round(precision, 4),
        'recall': round(recall, 4),
        'f1_score': round(f1, 4),
        'iou': round(iou, 4),
        'accuracy': round(accuracy, 4)
    }


def sanity_check(pred_array: np.ndarray, pred_path: Path) -> Dict:
    """
    Perform sanity checks on prediction array when no truth labels available.
    
    Checks:
    - Data range and validity
    - Distribution statistics
    - Spatial coverage
    """
    valid_mask = ~np.isnan(pred_array) & ~np.isinf(pred_array)
    valid_data = pred_array[valid_mask]
    
    if len(valid_data) == 0:
        return {
            'status': 'FAIL',
            'error': 'No valid data in prediction array'
        }
    
    checks = {
        'status': 'PASS',
        'file': str(pred_path),
        'timestamp': datetime.now().isoformat(),
        'shape': pred_array.shape,
        'total_pixels': pred_array.size,
        'valid_pixels': int(valid_mask.sum()),
        'valid_percent': round(100 * valid_mask.sum() / pred_array.size, 2),
        'statistics': {
            'min': round(float(np.min(valid_data)), 4),
            'max': round(float(np.max(valid_data)), 4),
            'mean': round(float(np.mean(valid_data)), 4),
            'median': round(float(np.median(valid_data)), 4),
            'std': round(float(np.std(valid_data)), 4)
        },
        'percentiles': {
            'p10': round(float(np.percentile(valid_data, 10)), 4),
            'p25': round(float(np.percentile(valid_data, 25)), 4),
            'p50': round(float(np.percentile(valid_data, 50)), 4),
            'p75': round(float(np.percentile(valid_data, 75)), 4),
            'p90': round(float(np.percentile(valid_data, 90)), 4),
            'p95': round(float(np.percentile(valid_data, 95)), 4),
            'p99': round(float(np.percentile(valid_data, 99)), 4)
        }
    }
    
    # Thresholds for NDCI (expected range: -1 to 1)
    thresholds = {'low': 0.05, 'medium': 0.15, 'high': 0.25}
    checks['threshold_analysis'] = {}
    
    for level, threshold in thresholds.items():
        above_count = np.sum(valid_data >= threshold)
        above_percent = 100 * above_count / len(valid_data)
        checks['threshold_analysis'][level] = {
            'threshold': threshold,
            'pixels_above': int(above_count),
            'percent_above': round(above_percent, 2)
        }
    
    # Range validity check
    if checks['statistics']['min'] < -1.5 or checks['statistics']['max'] > 1.5:
        checks['warnings'] = checks.get('warnings', [])
        checks['warnings'].append(f"Index values outside expected range [-1, 1]: [{checks['statistics']['min']}, {checks['statistics']['max']}]")
    
    # Data coverage check
    if checks['valid_percent'] < 50:
        checks['warnings'] = checks.get('warnings', [])
        checks['warnings'].append(f"Low data coverage: {checks['valid_percent']}% valid pixels")
    
    return checks


def main():
    parser = argparse.ArgumentParser(
        description='Evaluate algal bloom detection accuracy',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full evaluation with truth labels
  python evaluate.py --pred output/ndci.tif --truth data/bloom_mask.tif
  
  # Sanity check without truth labels
  python evaluate.py --sanity-check output/ndci.tif
  
  # Custom threshold
  python evaluate.py --pred output/ndci.tif --truth data/mask.tif --threshold 0.3
        """
    )
    
    parser.add_argument('--pred', type=Path, help='Path to predicted index raster (e.g., NDCI GeoTIFF)')
    parser.add_argument('--truth', type=Path, help='Path to ground truth binary mask raster')
    parser.add_argument('--threshold', type=float, default=0.25, 
                       help='Threshold for bloom classification (default: 0.25)')
    parser.add_argument('--sanity-check', type=Path, 
                       help='Run sanity checks only (no truth labels required)')
    parser.add_argument('--output', type=Path, 
                       help='Output JSON file for results (optional)')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Print detailed output')
    
    args = parser.parse_args()
    
    # Mode: Sanity check
    if args.sanity_check:
        print(f"Running sanity checks on {args.sanity_check}...")
        
        try:
            pred_array, _ = load_raster(args.sanity_check)
            results = sanity_check(pred_array, args.sanity_check)
            
            print("\n" + "="*60)
            print("SANITY CHECK RESULTS")
            print("="*60)
            print(json.dumps(results, indent=2))
            
            if 'warnings' in results:
                print("\n⚠️  WARNINGS:")
                for warning in results['warnings']:
                    print(f"  - {warning}")
            else:
                print("\n✅ All sanity checks passed")
            
            if args.output:
                with open(args.output, 'w') as f:
                    json.dump(results, f, indent=2)
                print(f"\n✅ Results saved to {args.output}")
            
            return 0
            
        except Exception as e:
            print(f"❌ Sanity check failed: {e}", file=sys.stderr)
            return 1
    
    # Mode: Full evaluation
    if not args.pred or not args.truth:
        parser.print_help()
        print("\n❌ Error: Either --sanity-check OR both --pred and --truth are required", file=sys.stderr)
        return 1
    
    print(f"Loading prediction: {args.pred}")
    print(f"Loading truth: {args.truth}")
    print(f"Threshold: {args.threshold}")
    
    try:
        # Load data
        pred_array, pred_profile = load_raster(args.pred)
        truth_array, truth_profile = load_raster(args.truth)
        
        # Verify shapes match
        if pred_array.shape != truth_array.shape:
            print(f"❌ Shape mismatch: pred {pred_array.shape} vs truth {truth_array.shape}", file=sys.stderr)
            return 1
        
        # Compute confusion matrix
        confusion = compute_confusion_matrix(pred_array, truth_array, args.threshold)
        
        # Compute metrics
        metrics = compute_metrics(confusion)
        
        # Prepare results
        results = {
            'timestamp': datetime.now().isoformat(),
            'prediction_file': str(args.pred),
            'truth_file': str(args.truth),
            'threshold': args.threshold,
            'confusion_matrix': confusion,
            'metrics': metrics
        }
        
        # Print results
        print("\n" + "="*60)
        print("EVALUATION RESULTS")
        print("="*60)
        
        print("\nConfusion Matrix:")
        print(f"  True Positives:  {confusion['true_positive']:,}")
        print(f"  True Negatives:  {confusion['true_negative']:,}")
        print(f"  False Positives: {confusion['false_positive']:,}")
        print(f"  False Negatives: {confusion['false_negative']:,}")
        print(f"  Total Valid:     {confusion['total_valid_pixels']:,}")
        
        print("\nMetrics:")
        print(f"  Precision: {metrics['precision']:.4f}")
        print(f"  Recall:    {metrics['recall']:.4f}")
        print(f"  F1 Score:  {metrics['f1_score']:.4f}")
        print(f"  IoU:       {metrics['iou']:.4f}")
        print(f"  Accuracy:  {metrics['accuracy']:.4f}")
        
        # Interpretation
        print("\nInterpretation:")
        if metrics['f1_score'] >= 0.8:
            print("  ✅ Excellent detection performance")
        elif metrics['f1_score'] >= 0.6:
            print("  ✓ Good detection performance")
        elif metrics['f1_score'] >= 0.4:
            print("  ⚠️  Moderate detection performance - consider threshold tuning")
        else:
            print("  ❌ Poor detection performance - model or threshold needs adjustment")
        
        # Save results
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2)
            print(f"\n✅ Results saved to {args.output}")
        
        if args.verbose:
            print("\nFull Results JSON:")
            print(json.dumps(results, indent=2))
        
        return 0
        
    except Exception as e:
        print(f"❌ Evaluation failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
