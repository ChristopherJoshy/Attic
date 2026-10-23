"""
Test suite for PROJECT H.Y.D.R.A.
Tests require live NASA Earthdata credentials - no mock data used
"""

import pytest
import os
import numpy as np
from datetime import datetime, timedelta
from main import (
    get_authenticated_session,
    validate_bbox,
    geocode_place_name,
    search_cmr,
    compute_ndci,
    compute_fai,
    annotate_severity,
    apply_cloud_mask,
    NDCI_THRESHOLDS
)

@pytest.fixture
def sample_bbox():
    """Sample bounding box for Lake Okeechobee"""
    return (26.7, -80.9, 27.0, -80.5)  # lat_min, lon_min, lat_max, lon_max

@pytest.fixture
def sample_date_range():
    """Recent date range for testing"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    return (start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))

class TestAuthentication:
    """Test NASA Earthdata authentication"""
    
    def test_credentials_present(self):
        """Test if credentials are available in environment"""
        username = os.getenv("NASA_EARTHDATA_USERNAME")
        password = os.getenv("NASA_EARTHDATA_PASSWORD")
        
        if not username or not password:
            pytest.skip("NASA Earthdata credentials not available - skipping live tests")
        
        assert username is not None
        assert password is not None
        assert len(username) > 0
        assert len(password) > 0
    
    def test_session_creation(self):
        """Test authenticated session creation"""
        username = os.getenv("NASA_EARTHDATA_USERNAME")
        password = os.getenv("NASA_EARTHDATA_PASSWORD")
        
        if not username or not password:
            pytest.skip("NASA Earthdata credentials not available")
        
        session = get_authenticated_session()
        assert session is not None
        assert session.auth == (username, password)
        assert 'User-Agent' in session.headers

class TestValidation:
    """Test input validation functions"""
    
    def test_valid_bbox(self, sample_bbox):
        """Test valid bounding box"""
        lat_min, lon_min, lat_max, lon_max = sample_bbox
        assert validate_bbox(lat_min, lon_min, lat_max, lon_max) is True
    
    def test_invalid_bbox_coordinates(self):
        """Test invalid coordinate ranges"""
        # Invalid latitude
        assert validate_bbox(-100, -80, 80, -70) is False
        # Invalid longitude  
        assert validate_bbox(20, -200, 30, -70) is False
        # Inverted coordinates
        assert validate_bbox(30, -80, 20, -70) is False
        assert validate_bbox(20, -70, 30, -80) is False
    
    def test_geocoding(self):
        """Test place name geocoding"""
        # Test known location
        result = geocode_place_name("Lake Okeechobee, Florida")
        
        if result is None:
            pytest.skip("Geocoding service unavailable")
        
        lat_min, lon_min, lat_max, lon_max = result
        assert validate_bbox(lat_min, lon_min, lat_max, lon_max)
        # Verify roughly correct location for Lake Okeechobee
        assert 25 < lat_min < 28
        assert -82 < lon_min < -79
    
    def test_geocoding_invalid(self):
        """Test geocoding with invalid location"""
        result = geocode_place_name("ThisPlaceDoesNotExist12345")
        assert result is None

class TestCMRIntegration:
    """Test NASA CMR API integration - requires live credentials"""
    
    def test_cmr_search_live(self, sample_bbox, sample_date_range):
        """Test live CMR granule search"""
        username = os.getenv("NASA_EARTHDATA_USERNAME")
        password = os.getenv("NASA_EARTHDATA_PASSWORD")
        
        if not username or not password:
            pytest.skip("NASA Earthdata credentials required for live CMR test")
        
        granules = search_cmr(sample_bbox, sample_date_range, "HLS", page_size=5)
        
        # May be empty if no data for time period, but should not error
        assert isinstance(granules, list)
        
        if granules:
            granule = granules[0]
            assert hasattr(granule, 'id')
            assert hasattr(granule, 'download_url')
            assert len(granule.id) > 0

class TestIndexComputation:
    """Test algal index computation algorithms"""
    
    def test_ndci_computation(self):
        """Test NDCI computation with sample data"""
        # Create sample arrays
        red = np.array([[0.1, 0.2], [0.3, 0.4]], dtype=np.float32)
        nir = np.array([[0.5, 0.6], [0.7, 0.8]], dtype=np.float32)
        
        ndci = compute_ndci(red, nir)
        
        assert ndci.shape == red.shape
        assert ndci.dtype == np.float32
        
        # Check NDCI formula: (NIR - Red) / (NIR + Red)
        expected_0_0 = (0.5 - 0.1) / (0.5 + 0.1)  # 0.667
        assert abs(ndci[0, 0] - expected_0_0) < 0.001
        
        # Check clipping to [-1, 1]
        assert np.all(ndci >= -1.0)
        assert np.all(ndci <= 1.0)
    
    def test_ndci_zero_division(self):
        """Test NDCI with zero denominator"""
        red = np.array([[0.0, 0.1]], dtype=np.float32)
        nir = np.array([[0.0, 0.2]], dtype=np.float32)  # First pixel sum = 0
        
        ndci = compute_ndci(red, nir)
        
        assert ndci[0, 0] == 0.0  # Should handle zero division
        assert not np.isnan(ndci[0, 0])
        assert not np.isinf(ndci[0, 0])
    
    def test_fai_computation(self):
        """Test FAI computation"""
        # Create sample 4-band array (NIR, Red, Green, Blue)
        bands = np.random.rand(4, 10, 10).astype(np.float32)
        
        fai = compute_fai(bands)
        
        assert fai.shape == (10, 10)
        assert fai.dtype == np.float32
        assert not np.any(np.isnan(fai))
    
    def test_fai_insufficient_bands(self):
        """Test FAI with insufficient bands"""
        bands = np.random.rand(1, 10, 10).astype(np.float32)
        
        fai = compute_fai(bands)
        
        # Should return zeros for insufficient bands
        assert fai.shape == (10, 10)
        assert np.all(fai == 0.0)
    
    def test_ndci_with_cloud_mask(self):
        """Test NDCI computation with cloud masking"""
        red = np.array([[0.1, 0.2], [0.3, 0.4]], dtype=np.float32)
        nir = np.array([[0.5, 0.6], [0.7, 0.8]], dtype=np.float32)
        cloud_mask = np.array([[True, False], [True, True]], dtype=bool)  # Mask out pixel [0,1]
        
        ndci = compute_ndci(red, nir, cloud_mask=cloud_mask)
        
        assert ndci.shape == red.shape
        assert np.isnan(ndci[0, 1])  # Masked pixel should be NaN
        assert not np.isnan(ndci[0, 0])  # Valid pixel
        assert not np.isnan(ndci[1, 0])

class TestCloudMasking:
    """Test cloud masking functionality"""
    
    def test_qa_band_masking(self):
        """Test cloud masking using QA band"""
        # Create sample bands
        bands = np.random.rand(3, 10, 10).astype(np.float32) * 0.5
        
        # Create QA band with cloud values (initialize to 1 = clear)
        qa_band = np.ones((10, 10), dtype=np.uint8)  # All clear by default
        qa_band[0:3, 0:3] = 5  # Cloud medium confidence
        qa_band[7:10, 7:10] = 6  # Cloud high confidence
        qa_band[5, 5] = 0  # No data
        
        mask = apply_cloud_mask(bands, qa_band=qa_band)
        
        assert mask.shape == (10, 10)
        assert mask.dtype == bool
        
        # Check that clouds are masked out
        assert not mask[0, 0]  # Cloud (medium confidence)
        assert not mask[8, 8]  # Cloud (high confidence)
        assert not mask[5, 5]  # No data
        # Pixel at [4,4] should be True (clear) since QA=1
        assert mask[4, 4]  # Clear pixel away from clouds
    
    def test_brightness_threshold_masking(self):
        """Test cloud masking using brightness threshold"""
        # Create bright pixels (simulate clouds)
        bands = np.ones((3, 10, 10), dtype=np.float32) * 0.3
        bands[:, 0:3, 0:3] = 0.8  # Bright region (cloud)
        
        mask = apply_cloud_mask(bands, qa_band=None, brightness_threshold=0.6)
        
        assert mask.shape == (10, 10)
        
        # Bright pixels should be masked out
        assert not mask[1, 1]  # Bright/cloudy
        assert mask[5, 5]  # Normal brightness
    
    def test_no_masking_fallback(self):
        """Test fallback when no QA band and insufficient bands"""
        bands = np.random.rand(1, 10, 10).astype(np.float32)
        
        mask = apply_cloud_mask(bands, qa_band=None)
        
        # Should return all valid when masking not possible
        assert np.all(mask == True)

class TestSeverityAnnotation:
    """Test severity classification and metrics"""
    
    def test_severity_high(self):
        """Test high severity classification"""
        # Create array with high NDCI values
        index_array = np.full((100, 100), 0.3, dtype=np.float32)  # Above high threshold
        
        severity, metrics = annotate_severity(index_array, NDCI_THRESHOLDS)
        
        assert severity == "HIGH"
        assert metrics["percent_above_threshold"] == 100.0
        assert abs(metrics["mean_index"] - 0.3) < 0.001
        assert metrics["valid_pixels"] == 10000
    
    def test_severity_medium(self):
        """Test medium severity classification"""
        # Create mixed array - need 20%+ above medium threshold (0.15)
        # Use 0.18 so all pixels above medium but not enough above high (0.25)
        index_array = np.ones((100, 100), dtype=np.float32) * 0.18  # Medium range
        
        severity, metrics = annotate_severity(index_array, NDCI_THRESHOLDS)
        
        assert severity == "MEDIUM"
        # percent_above_threshold tracks HIGH threshold (0.25), which is 0% for this test
        # That's correct - we want MEDIUM severity with zero HIGH-level pixels
        assert metrics["percent_above_threshold"] == 0.0
        assert abs(metrics["mean_index"] - 0.18) < 0.001
    
    def test_severity_low(self):
        """Test low severity classification"""
        index_array = np.ones((100, 100), dtype=np.float32) * 0.01  # Below thresholds
        
        severity, metrics = annotate_severity(index_array, NDCI_THRESHOLDS)
        
        assert severity == "LOW"
        assert metrics["percent_above_threshold"] == 0.0
    
    def test_severity_no_data(self):
        """Test no data case"""
        index_array = np.full((10, 10), np.nan, dtype=np.float32)
        
        severity, metrics = annotate_severity(index_array, NDCI_THRESHOLDS)
        
        assert severity == "NO_DATA"
        assert metrics["percent_above_threshold"] == 0.0
        assert metrics["valid_pixels"] == 0

class TestIntegration:
    """Integration tests requiring full credentials"""
    
    def test_end_to_end_pipeline(self, sample_bbox, sample_date_range):
        """Test complete pipeline with live data"""
        username = os.getenv("NASA_EARTHDATA_USERNAME")
        password = os.getenv("NASA_EARTHDATA_PASSWORD")
        
        if not username or not password:
            pytest.skip("Integration test requires NASA Earthdata credentials")
        
        # Search for granules
        granules = search_cmr(sample_bbox, sample_date_range, "HLS", page_size=1)
        
        if not granules:
            pytest.skip("No granules found for test period")
        
        # Test granule metadata
        granule = granules[0]
        assert len(granule.id) > 0
        assert len(granule.time_start) > 0
        
        # Note: Full download test skipped to avoid large file transfers
        # In production, would test download_granule and read_bands_windowed

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
