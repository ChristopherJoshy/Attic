
"""
PROJECT H.Y.D.R.A. - Hyper-Yield Detection & Remote Analysis
NASA Space Apps 2025 - Real-time algal bloom detection using multispectral satellite imagery
Team: The Revolutionist (Deon George, Christopher Joshy)
"""

import streamlit as st
import requests
import rasterio
import numpy as np
import pandas as pd
import folium
from streamlit_folium import st_folium
import os
import logging
import json
import hashlib
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Callable
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter
import tempfile
import argparse
import sys
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from PIL import Image
import base64
import io
import sqlite3
import uuid

# Load environment variables from .env file (optional for local development)
# On Render, environment variables are set directly in the dashboard
try:
    from dotenv import load_dotenv
    # Try multiple locations to ensure credentials are loaded
    load_dotenv()  # Current directory
    load_dotenv(Path(__file__).parent / ".env")  # Script directory
    load_dotenv(".env")  # Explicit relative path
except ImportError:
    # dotenv not available (e.g., on Render), use environment variables directly
    pass

# Setup .netrc for NASA Earthdata authentication (required for Render)
def setup_netrc_if_needed():
    """Setup .netrc file if running on cloud platform and credentials are in environment"""
    netrc_path = Path.home() / ".netrc"
    
    # Check if .netrc already exists
    if netrc_path.exists():
        return
    
    # Check if credentials are in environment
    username = os.getenv("NASA_EARTHDATA_USERNAME")
    password = os.getenv("NASA_EARTHDATA_PASSWORD")
    
    if username and password:
        try:
            netrc_content = f"""machine urs.earthdata.nasa.gov
    login {username}
    password {password}
"""
            netrc_path.write_text(netrc_content)
            netrc_path.chmod(0o600)
            print(f"✅ .netrc file created for NASA Earthdata authentication")
        except Exception as e:
            print(f"⚠️  Could not create .netrc file: {e}")

# Run setup on import
setup_netrc_if_needed()

# Configure logging with custom handler for Streamlit
logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Suppress ScriptRunContext warnings from ThreadPoolExecutor
logging.getLogger('streamlit.runtime.scriptrunner_utils.script_run_context').setLevel(logging.ERROR)

# Create a list to store log messages for Streamlit display
if 'log_messages' not in st.session_state:
    st.session_state.log_messages = []

class StreamlitLogHandler(logging.Handler):
    """Custom log handler that stores messages in Streamlit session state"""
    def emit(self, record):
        log_entry = self.format(record)
        if 'log_messages' in st.session_state:
            st.session_state.log_messages.append({
                'time': datetime.now().strftime('%H:%M:%S'),
                'level': record.levelname,
                'message': log_entry
            })
            # Keep only last 100 messages
            if len(st.session_state.log_messages) > 100:
                st.session_state.log_messages.pop(0)

# Add Streamlit handler to logger
streamlit_handler = StreamlitLogHandler()
streamlit_handler.setFormatter(logging.Formatter('%(message)s'))
logger.addHandler(streamlit_handler)

# Verify credentials loaded (log status without exposing values)
# Only log once to avoid spam
if 'credentials_logged' not in st.session_state:
    username = os.getenv("NASA_EARTHDATA_USERNAME")
    password = os.getenv("NASA_EARTHDATA_PASSWORD")
    if username and password:
        logger.info(f"✅ Credentials loaded for user: {username[:3]}***")
    else:
        logger.warning("⚠️  NASA Earthdata credentials NOT found in environment")
    st.session_state.credentials_logged = True

# Constants
CACHE_DIR = Path("cache")
CACHE_DIR.mkdir(exist_ok=True)

DB_PATH = Path("hydra.db")

# NASA API endpoints
CMR_BASE_URL = "https://cmr.earthdata.nasa.gov/search/granules.json"
EARTHDATA_BASE_URL = "https://data.lpdaac.earthdatacloud.nasa.gov"
GIBS_BASE_URL = "https://gibs.earthdata.nasa.gov/wmts/1.0.0"

# Algal bloom thresholds for normalized single-band index (0-1 scale)
# Calibrated for single-band brightness composite from multiple granules
# Higher values = more reflection = potential algal bloom
NDCI_THRESHOLDS = {
    "low": 0.45,     # Above-average brightness (potential algae)
    "medium": 0.65,  # High brightness (likely algae bloom)
    "high": 0.80     # Very high brightness (confirmed bloom)
}

# Database helper functions
def init_database():
    """Initialize SQLite database with required tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create user_sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_sessions (
            session_id TEXT PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create location_presets table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS location_presets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            preset_name TEXT NOT NULL,
            lat_min REAL NOT NULL,
            lon_min REAL NOT NULL,
            lat_max REAL NOT NULL,
            lon_max REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES user_sessions(session_id)
        )
    """)
    
    # Create analysis_history table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analysis_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            lat_min REAL NOT NULL,
            lon_min REAL NOT NULL,
            lat_max REAL NOT NULL,
            lon_max REAL NOT NULL,
            dataset TEXT NOT NULL,
            date_start TEXT NOT NULL,
            date_end TEXT NOT NULL,
            severity TEXT NOT NULL,
            area_above_threshold REAL,
            mean_ndci REAL,
            valid_pixels INTEGER,
            granules_processed INTEGER,
            analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES user_sessions(session_id)
        )
    """)
    
    conn.commit()
    conn.close()

def get_db_connection():
    """Get SQLite database connection"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return None

def get_or_create_session() -> str:
    """Get existing session ID or create new one"""
    if 'session_id' not in st.session_state:
        st.session_state.session_id = str(uuid.uuid4())
        
        conn = get_db_connection()
        if conn:
            try:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT OR REPLACE INTO user_sessions (session_id, last_accessed) VALUES (?, CURRENT_TIMESTAMP)",
                    (st.session_state.session_id,)
                )
                conn.commit()
            except Exception as e:
                logger.error(f"Failed to create session: {e}")
            finally:
                conn.close()
    
    return st.session_state.session_id

def save_location_preset(session_id: str, name: str, aoi: Tuple[float, float, float, float]):
    """Save location preset to database"""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO location_presets (session_id, preset_name, lat_min, lon_min, lat_max, lon_max) VALUES (?, ?, ?, ?, ?, ?)",
                (session_id, name, aoi[0], aoi[1], aoi[2], aoi[3])
            )
            conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to save preset: {e}")
            return False
        finally:
            conn.close()
    return False

def get_location_presets(session_id: str) -> List[Dict]:
    """Get all location presets for session"""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM location_presets WHERE session_id = ? ORDER BY created_at DESC",
                (session_id,)
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to fetch presets: {e}")
            return []
        finally:
            conn.close()
    return []

def save_analysis_history(session_id: str, aoi: Tuple, dataset: str, date_range: Tuple, severity: str, metrics: Dict):
    """Save analysis results to history"""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO analysis_history 
                   (session_id, lat_min, lon_min, lat_max, lon_max, dataset, date_start, date_end, 
                    severity, area_above_threshold, mean_ndci, valid_pixels, granules_processed)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (session_id, aoi[0], aoi[1], aoi[2], aoi[3], dataset, date_range[0], date_range[1],
                 severity, metrics['percent_above_threshold'], metrics['mean_index'], 
                 metrics['valid_pixels'], metrics.get('granules_processed', 0))
            )
            conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to save history: {e}")
            return False
        finally:
            conn.close()
    return False

def get_analysis_history(session_id: str, limit: int = 10) -> List[Dict]:
    """Get recent analysis history for session"""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM analysis_history WHERE session_id = ? ORDER BY analysis_date DESC LIMIT ?",
                (session_id, limit)
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to fetch history: {e}")
            return []
        finally:
            conn.close()
    return []

class GranuleMeta:
    """Metadata for a single granule"""
    def __init__(self, granule_data: Dict):
        self.id = granule_data.get('id', '')
        self.title = granule_data.get('title', '')
        self.download_url = self._extract_download_url(granule_data)
        self.all_urls = self._extract_all_urls(granule_data)  # For HLS multi-band access
        self.time_start = granule_data.get('time_start', '')
        self.time_end = granule_data.get('time_end', '')
        self.polygon = granule_data.get('polygon', '')
        
    def _extract_download_url(self, granule_data: Dict) -> str:
        """Extract primary download URL from granule metadata"""
        links = granule_data.get('links', [])
        for link in links:
            if link.get('rel') == 'http://esipfed.org/ns/fedsearch/1.1/data#':
                return link.get('href', '')
        return ''
    
    def _extract_all_urls(self, granule_data: Dict) -> List[str]:
        """Extract all download URLs (for HLS multi-band files)"""
        links = granule_data.get('links', [])
        urls = []
        for link in links:
            if link.get('rel') == 'http://esipfed.org/ns/fedsearch/1.1/data#':
                href = link.get('href', '')
                if href:
                    urls.append(href)
        return urls
    
    def get_band_url(self, band_name: str) -> Optional[str]:
        """Get URL for specific HLS band (e.g., 'B04' for Red, 'B8A' for NIR)"""
        for url in self.all_urls:
            if band_name in url:
                return url
        # Fallback: construct URL by modifying base URL
        if self.download_url and 'HLS' in self.download_url:
            base_url = self.download_url.rsplit('.', 1)[0]
            return f"{base_url}.{band_name}.tif"
        return None

@st.cache_resource
def get_authenticated_session() -> Optional[requests.Session]:
    """Create authenticated requests session for NASA Earthdata
    
    Tries multiple authentication methods:
    1. .netrc file (recommended by NASA - most reliable)
    2. Environment variables (NASA_EARTHDATA_USERNAME, NASA_EARTHDATA_PASSWORD)
    
    IMPORTANT: Uses a single shared session with proper cookie handling.
    NASA's authentication is redirect-based and works better with persistent sessions.
    """
    session = requests.Session()
    
    # Try .netrc first (NASA's recommended method)
    # Check project directory first (for hosting), then home directory
    username = None
    password = None
    netrc_auth = False
    
    try:
        from netrc import netrc
        
        # Check project directory first
        project_netrc = Path(__file__).parent / ".netrc"
        home_netrc = Path.home() / ".netrc"
        
        netrc_path = project_netrc if project_netrc.exists() else home_netrc
        
        if netrc_path.exists():
            netrc_obj = netrc(str(netrc_path))
            auth_info = netrc_obj.authenticators("urs.earthdata.nasa.gov")
            if auth_info:
                username, _, password = auth_info
                netrc_auth = True
                location = "project directory" if netrc_path == project_netrc else "home directory"
                logger.info(f"✅ Using credentials from .netrc ({location})")
    except Exception as e:
        logger.debug(f"Could not read .netrc: {e}")
    
    # Fallback to environment variables
    if not (username and password):
        username = os.getenv("NASA_EARTHDATA_USERNAME")
        password = os.getenv("NASA_EARTHDATA_PASSWORD")
        if username and password:
            logger.info("✅ Using credentials from environment variables")
            logger.warning("⚠️  TIP: .netrc is more reliable - run: python setup_netrc.py")
    
    if not username or not password:
        logger.error("❌ NASA Earthdata credentials not found")
        logger.error("   Run: python setup_netrc.py to configure authentication")
        return None
    
    # Configure session with retries and exponential backoff
    retry_strategy = Retry(
        total=5,
        backoff_factor=2,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"],
        respect_retry_after_header=True
    )
    
    adapter = HTTPAdapter(
        max_retries=retry_strategy, 
        pool_connections=20,  # Increased for parallel downloads
        pool_maxsize=50
    )
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    
    # Set authentication
    session.auth = (username, password)
    session.headers.update({
        'User-Agent': 'PROJECT-HYDRA/1.0',
        'Accept': 'application/octet-stream, */*'
    })
    
    # Pre-authenticate by hitting a test endpoint
    # This establishes cookies that will work for subsequent requests
    try:
        test_url = "https://urs.earthdata.nasa.gov/api/users/tokens"
        response = session.get(test_url, timeout=10)
        if response.status_code == 200:
            logger.info("✅ Session pre-authenticated successfully")
        elif response.status_code == 401:
            logger.warning("⚠️  Pre-authentication returned 401 (credentials may be invalid)")
    except Exception as e:
        logger.debug(f"Pre-authentication test skipped: {e}")
    
    return session

def validate_bbox(lat_min: float, lon_min: float, lat_max: float, lon_max: float) -> bool:
    """Validate bounding box coordinates"""
    if not (-90 <= lat_min <= 90 and -90 <= lat_max <= 90):
        return False
    if not (-180 <= lon_min <= 180 and -180 <= lon_max <= 180):
        return False
    if lat_min >= lat_max or lon_min >= lon_max:
        return False
    return True

def geocode_place_name(place_name: str) -> Optional[Tuple[float, float, float, float]]:
    """Geocode place name to bounding box using Nominatim"""
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': place_name,
            'format': 'json',
            'limit': 1,
            'extratags': 1,
            'addressdetails': 1
        }
        headers = {'User-Agent': 'PROJECT-HYDRA/1.0'}
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        
        results = response.json()
        if not results:
            return None
            
        result = results[0]
        bbox = result.get('boundingbox')
        if not bbox or len(bbox) != 4:
            # Fallback to point with small buffer
            lat, lon = float(result['lat']), float(result['lon'])
            buffer = 0.01  # ~1km buffer
            return (lat - buffer, lon - buffer, lat + buffer, lon + buffer)
        
        # Convert to (lat_min, lon_min, lat_max, lon_max)
        lat_min, lat_max, lon_min, lon_max = map(float, bbox)
        return (lat_min, lon_min, lat_max, lon_max)
        
    except Exception as e:
        logger.error(f"Geocoding failed: {e}")
        return None

@st.cache_data(ttl=3600)
def search_cmr(aoi: Tuple[float, float, float, float], 
               date_range: Tuple[str, str], 
               dataset: str = "HLS", 
               page_size: int = 20) -> List[GranuleMeta]:
    """Search CMR for granules matching criteria"""
    lat_min, lon_min, lat_max, lon_max = aoi
    start_date, end_date = date_range
    
    # Map dataset to CMR collection concept ID
    collection_ids = {
        "HLS": "C2021957295-LPCLOUD",  # HLS S30 (Sentinel-2 based, 30m)
        "Sentinel-2": "C2021957295-LPCLOUD",  # Use HLS for better compatibility
        "MODIS": "C1000000505-LPDAAC_ECS"  # MODIS Aqua
    }
    
    collection_id = collection_ids.get(dataset, collection_ids["HLS"])
    
    params = {
        'collection_concept_id': collection_id,
        'bounding_box': f"{lon_min},{lat_min},{lon_max},{lat_max}",
        'temporal': f"{start_date}T00:00:00Z,{end_date}T23:59:59Z",
        'page_size': page_size,
        'sort_key': '-start_date'
    }
    
    try:
        response = requests.get(CMR_BASE_URL, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        granules = []
        
        for entry in data.get('feed', {}).get('entry', []):
            try:
                granules.append(GranuleMeta(entry))
            except Exception as e:
                logger.warning(f"Failed to parse granule: {e}")
                continue
                
        logger.info(f"Found {len(granules)} granules for {dataset}")
        return granules
        
    except Exception as e:
        logger.error(f"CMR search failed: {e}")
        return []

# Track authentication errors to avoid spam
_auth_error_logged = False
# Lock for thread-safe session access
import threading
_session_lock = threading.Lock()

def download_granule(granule_meta: GranuleMeta, 
                    session: requests.Session, 
                    dest_dir: Path, 
                    on_progress: Optional[Callable] = None) -> Optional[Path]:
    """Download granule with streaming and progress callback
    
    Uses a shared session for all downloads (NASA auth works better this way).
    Thread-safe access is ensured via locking for critical sections.
    """
    global _auth_error_logged
    
    if not granule_meta.download_url:
        return None
        
    # Create cache key from URL
    url_hash = hashlib.md5(granule_meta.download_url.encode()).hexdigest()[:8]
    filename = f"{granule_meta.id}_{url_hash}.tif"
    dest_path = dest_dir / filename
    
    # Check if already cached - verify file is valid
    if dest_path.exists():
        try:
            # Quick check that file is readable
            with rasterio.open(dest_path) as src:
                if src.count > 0:
                    logger.info(f"Using cached: {dest_path.name}")
                    return dest_path
        except:
            # Corrupted cache file, remove it
            logger.warning(f"Removing corrupted cache: {dest_path.name}")
            dest_path.unlink()
    
    if not session:
        if not _auth_error_logged:
            logger.error("❌ Failed to get authenticated session")
            _auth_error_logged = True
        return None
    
    max_retries = 3
    retry_count = 0
    temp_path = dest_path.with_suffix('.tmp')  # Declare upfront for exception handlers
    
    while retry_count < max_retries:
        try:
            logger.info(f"Downloading: {granule_meta.download_url[:80]}...")
            
            # Use lock for the actual HTTP request to avoid session conflicts
            # This ensures NASA's cookies are properly managed
            with _session_lock:
                response = session.get(
                    granule_meta.download_url, 
                    stream=True, 
                    timeout=60,  # Reduced from 90 for faster timeout
                    allow_redirects=True
                )
                response.raise_for_status()
                
                total_size = int(response.headers.get('content-length', 0))
            
            # Download without lock (streaming is independent)
            downloaded = 0
            
            with open(temp_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        
                        if on_progress and total_size > 0:
                            on_progress(downloaded / total_size)
            
            # Rename temp to final
            temp_path.rename(dest_path)
            logger.info(f"✅ Downloaded: {dest_path.name}")
            return dest_path
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                # Only log auth error once per session to avoid spam
                if not _auth_error_logged:
                    logger.error(f"\n❌ AUTHENTICATION FAILED")
                    logger.error("\n🔧 SOLUTION: Use .netrc file (more reliable than direct credentials)")
                    logger.error("   Run this command: python setup_netrc.py")
                    logger.error("\n   Alternative: Check applications are approved at:")
                    logger.error("   https://urs.earthdata.nasa.gov/profile\n")
                    _auth_error_logged = True
                if dest_path.exists():
                    dest_path.unlink()
                if temp_path.exists():
                    temp_path.unlink()
                return None
            elif e.response.status_code == 403:
                if not _auth_error_logged:
                    logger.error(f"❌ Access forbidden - Check application approvals")
                    logger.error("   https://urs.earthdata.nasa.gov/profile")
                    _auth_error_logged = True
                if dest_path.exists():
                    dest_path.unlink()
                if temp_path.exists():
                    temp_path.unlink()
                return None
            elif e.response.status_code in [429, 500, 502, 503, 504]:
                # Retry on server errors
                retry_count += 1
                if retry_count < max_retries:
                    wait_time = 2 ** retry_count
                    logger.warning(f"Server error - retrying in {wait_time}s... ({retry_count}/{max_retries})")
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f"Failed after {max_retries} retries: HTTP {e.response.status_code}")
                    if dest_path.exists():
                        dest_path.unlink()
                    if temp_path.exists():
                        temp_path.unlink()
                    return None
            else:
                logger.error(f"HTTP {e.response.status_code}: {granule_meta.download_url[:60]}")
                if dest_path.exists():
                    dest_path.unlink()
                if temp_path.exists():
                    temp_path.unlink()
                return None
        except requests.exceptions.Timeout:
            retry_count += 1
            if retry_count < max_retries:
                logger.warning(f"Timeout - retrying... ({retry_count}/{max_retries})")
                continue
            else:
                logger.error(f"Timed out after {max_retries} attempts")
                if dest_path.exists():
                    dest_path.unlink()
                if temp_path.exists():
                    temp_path.unlink()
                return None
        except Exception as e:
            logger.error(f"Download error: {str(e)[:100]}")
            if dest_path.exists():
                dest_path.unlink()
            if temp_path.exists():
                temp_path.unlink()
            return None
    
    return None

def read_single_band(path: Path, 
                    out_shape: Optional[Tuple[int, int]] = None) -> Tuple[np.ndarray, Dict]:
    """Read single-band raster with optional windowed/decimated reading
    
    Simplified for single-band GeoTIFFs from NASA (works with what we have).
    """
    try:
        with rasterio.open(path) as src:
            profile = src.profile.copy()
            
            if out_shape:
                from rasterio.transform import Affine
                
                height, width = src.height, src.width
                row_step = max(1, height // out_shape[0])
                col_step = max(1, width // out_shape[1])
                
                # Read first band (NASA provides single-band files)
                data = src.read(1)[::row_step, ::col_step]
                data = data.astype(np.float32)
                
                if 'transform' in profile and profile['transform']:
                    old_transform = profile['transform']
                    scaled_transform = old_transform * Affine.scale(col_step, row_step)
                    profile['transform'] = scaled_transform
                
                profile.update({
                    'height': data.shape[0],
                    'width': data.shape[1]
                })
            else:
                # Read first band at full resolution
                data = src.read(1).astype(np.float32)
            
            return data, profile
            
    except Exception as e:
        logger.error(f"Failed to read {path}: {e}")
        return np.array([]), {}

def apply_cloud_mask(bands: np.ndarray, 
                     qa_band: Optional[np.ndarray] = None, 
                     brightness_threshold: float = 0.65,
                     use_statistical: bool = True) -> np.ndarray:
    """
    Apply cloud mask using QA band or statistical fallback methods.
    
    Args:
        bands: Array of spectral bands (channels, height, width)
        qa_band: Optional QA/quality band (HLS Fmask)
        brightness_threshold: Percentile threshold for brightness-based masking (0-1)
        use_statistical: Use statistical outlier detection for cloud masking
    
    Returns:
        Boolean mask where True = valid pixel, False = cloudy/invalid
    
    IMPLEMENTATION NOTE: HLS S30 Fmask band values:
        0 = No data, 1 = Clear, 2 = Water, 3 = Cloud shadow, 
        4 = Snow/ice, 5 = Cloud (medium confidence), 6 = Cloud (high confidence)
    """
    if bands.ndim == 2:
        height, width = bands.shape
    else:
        _, height, width = bands.shape
    
    # Start with all valid
    mask = np.ones((height, width), dtype=bool)
    
    # Apply QA band if available (preferred method)
    if qa_band is not None:
        # Mask out clouds (values 5, 6), no data (0), and optionally cloud shadows (3)
        cloud_values = [0, 5, 6]  # Can add 3 for cloud shadows
        for val in cloud_values:
            mask &= (qa_band != val)
        logger.info(f"Applied QA-based cloud mask: {mask.sum()}/{mask.size} valid pixels ({100*mask.sum()/mask.size:.1f}%)")
    else:
        # Enhanced statistical fallback methods
        if bands.ndim == 3 and bands.shape[0] >= 2:
            # Method 1: Brightness threshold using percentile
            brightness = np.mean(bands, axis=0)
            brightness_norm = brightness / (brightness.max() + 1e-8)  # Avoid div by zero
            
            if use_statistical:
                # Method 2: Statistical outlier detection
                # Clouds are typically much brighter than water/land
                brightness_flat = brightness[brightness > 0]
                if len(brightness_flat) > 100:  # Need enough samples
                    threshold_val = np.percentile(brightness_flat, brightness_threshold * 100)
                    mask &= (brightness <= threshold_val)
                    
                    # Additional check: mask very bright pixels (likely clouds)
                    very_bright_threshold = np.percentile(brightness_flat, 95)
                    mask &= (brightness <= very_bright_threshold)
                else:
                    # Fallback to simple normalized threshold
                    mask &= (brightness_norm < brightness_threshold)
            else:
                mask &= (brightness_norm < brightness_threshold)
            
            valid_pct = 100 * mask.sum() / mask.size
            logger.info(f"Applied statistical cloud mask: {mask.sum()}/{mask.size} valid pixels ({valid_pct:.1f}%)")
        else:
            logger.debug("No QA band - using statistical cloud masking")
    
    return mask

def normalize_band_data(band_data: np.ndarray, 
                       cloud_mask: Optional[np.ndarray] = None) -> np.ndarray:
    """
    Normalize single-band data to create bloom proxy index
    
    Since NASA provides only single-band files, we normalize the data
    and use it as a proxy for algal bloom detection. Higher values
    indicate more reflection (potential algae).
    
    Args:
        band_data: Single band array
        cloud_mask: Optional boolean mask (True=valid, False=cloudy)
    
    Returns:
        Normalized array with values in [0, 1], NaN for masked pixels
    """
    # Apply cloud mask first
    if cloud_mask is not None:
        band_data = np.where(cloud_mask, band_data, np.nan)
    
    # Get valid data range
    valid_data = band_data[~np.isnan(band_data)]
    if len(valid_data) == 0:
        return band_data
    
    # Normalize to 0-1 range using adaptive percentiles (robust to outliers)
    # Use 5th and 95th percentiles for better dynamic range
    p_low = np.percentile(valid_data, 5)
    p_high = np.percentile(valid_data, 95)
    
    with np.errstate(divide='ignore', invalid='ignore'):
        normalized = (band_data - p_low) / (p_high - p_low + 1e-8)  # Add epsilon to avoid division by zero
    
    # Clip to valid range [0, 1]
    normalized = np.clip(normalized, 0, 1)
    
    # Apply contrast enhancement for better bloom detection
    # Emphasize higher values (potential blooms)
    normalized = np.power(normalized, 0.85)  # Gamma correction
    
    return normalized.astype(np.float32)

def compute_ndci(red: np.ndarray, nir: np.ndarray, 
                cloud_mask: Optional[np.ndarray] = None) -> np.ndarray:
    """Legacy NDCI computation - kept for compatibility
    
    Note: Now redirects to normalize_band_data since we only have single bands
    """
    # If we somehow got 2D arrays, just use the first one
    if red.ndim > 1 or isinstance(red, np.ndarray):
        return normalize_band_data(red, cloud_mask)
    return normalize_band_data(red, cloud_mask)

def compute_fai(bands: np.ndarray, cloud_mask: Optional[np.ndarray] = None) -> np.ndarray:
    """
    Compute Floating Algae Index (FAI) using red-edge baseline interpolation.
    
    Formula:
        FAI = NIR - [RED + (SWIR - RED) × (λNIR - λRED) / (λSWIR - λRED)]
    
    Simplified baseline approximation when SWIR unavailable:
        FAI ≈ NIR - RED_edge_baseline
        where RED_edge_baseline interpolates between RED and NIR
    
    IMPLEMENTATION NOTE - HLS S30 Band Requirements:
        Bands must be ordered as: [RED, NIR, SWIR1] or [RED, NIR]
        - RED: B04 (665nm)
        - NIR: B8A (865nm)
        - SWIR1: B11 (1610nm) [optional for full formula]
    
    Args:
        bands: Array shape (n_bands, height, width) with at least RED+NIR
        cloud_mask: Optional boolean mask
    
    Returns:
        FAI array, NaN for masked pixels
    """
    if bands.shape[0] < 2:
        logger.error("FAI requires at least 2 bands (RED, NIR)")
        return np.zeros(bands.shape[1:], dtype=np.float32)
    
    red = bands[0]
    nir = bands[1]
    
    if bands.shape[0] >= 3:
        # Full FAI formula with SWIR
        swir = bands[2]
        
        # Wavelengths in nm (for HLS S30)
        lambda_red = 665.0
        lambda_nir = 865.0  
        lambda_swir = 1610.0
        
        # Red-edge baseline via linear interpolation
        with np.errstate(divide='ignore', invalid='ignore'):
            baseline = red + (swir - red) * (lambda_nir - lambda_red) / (lambda_swir - lambda_red)
        
        fai = nir - baseline
        logger.info("Computed FAI with full SWIR-based formula")
    else:
        # Simplified approximation: baseline = midpoint between RED and NIR
        baseline = (red + nir) / 2.0
        fai = nir - baseline
        logger.info("Computed FAI with simplified 2-band approximation")
    
    # Apply cloud mask
    if cloud_mask is not None:
        fai = np.where(cloud_mask, fai, np.nan)
    
    return fai.astype(np.float32)

def annotate_severity(index_array: np.ndarray, 
                     thresholds: Dict[str, float]) -> Tuple[str, Dict[str, float]]:
    """Annotate severity level and compute metrics with enhanced detection"""
    valid_mask = ~np.isnan(index_array) & ~np.isinf(index_array)
    valid_data = index_array[valid_mask]
    
    if len(valid_data) == 0:
        return "NO_DATA", {"percent_above_threshold": 0.0, "mean_index": 0.0, "valid_pixels": 0}
    
    # Compute metrics
    mean_index = float(np.mean(valid_data))
    median_index = float(np.median(valid_data))
    std_index = float(np.std(valid_data))
    
    # Count pixels above different thresholds
    high_count = np.sum(valid_data >= thresholds["high"])
    medium_count = np.sum(valid_data >= thresholds["medium"])
    low_count = np.sum(valid_data >= thresholds["low"])
    
    percent_high = (high_count / len(valid_data)) * 100
    percent_medium = (medium_count / len(valid_data)) * 100
    percent_low = (low_count / len(valid_data)) * 100
    
    # Enhanced severity determination with spatial context and statistical analysis
    # Consider both coverage percentage and mean values for better accuracy
    
    # High severity: significant bloom coverage or very high mean
    if percent_high > 3 or (percent_medium > 12 and mean_index > thresholds["high"] * 0.9):
        severity = "HIGH"
    # Medium severity: moderate bloom coverage
    elif percent_medium > 7 or (percent_low > 20 and mean_index > thresholds["medium"] * 0.9):
        severity = "MEDIUM"
    # Low severity: some elevated values indicating potential bloom
    elif percent_low > 3 or mean_index > thresholds["low"] * 1.1:
        severity = "LOW"
    else:
        severity = "CLEAR"
    
    metrics = {
        "percent_above_threshold": percent_high,
        "percent_medium": percent_medium,
        "percent_low": percent_low,
        "mean_index": mean_index,
        "median_index": median_index,
        "std_index": std_index,
        "valid_pixels": len(valid_data),
        "max_index": float(np.max(valid_data)),
        "min_index": float(np.min(valid_data))
    }
    
    return severity, metrics

def generate_heatmap_overlay(index_data: np.ndarray, 
                            profile: Dict,
                            alpha: float = 0.5,
                            cmap: str = 'RdYlGn_r') -> Tuple[str, Tuple[float, float, float, float]]:
    """Generate PNG heatmap overlay as base64 string with actual geospatial bounds
    
    Color scheme for algal bloom concentration (LIGHT SHADES):
    - Light Blue: Clear water (NDCI < 0.45)
    - Light Green: Low concentration (NDCI 0.45-0.65)
    - Light Yellow: Medium concentration (NDCI 0.65-0.80)
    - Light Orange/Red: High concentration (NDCI > 0.80)
    """
    from rasterio.transform import array_bounds
    from matplotlib.colors import LinearSegmentedColormap
    
    transform = profile.get('transform')
    height, width = index_data.shape
    
    if transform:
        bounds = array_bounds(height, width, transform)
        lon_min, lat_min, lon_max, lat_max = bounds
    else:
        lon_min, lat_min, lon_max, lat_max = -180, -90, 180, 90
    
    # Create figure
    fig, ax = plt.subplots(figsize=(12, 12), dpi=150)
    ax.axis('off')
    
    # Create custom colormap with LIGHTER shades for better visibility
    colors = [
        (0.0, '#E3F2FD'),   # Very light blue - Clear water
        (0.45, '#C8E6C9'),  # Light green - Low concentration
        (0.65, '#FFF9C4'),  # Light yellow - Medium concentration  
        (0.80, '#FFCC80'),  # Light orange - High concentration
        (1.0, '#FFAB91')    # Light red - Very high concentration
    ]
    
    n_bins = 256
    cmap_custom = LinearSegmentedColormap.from_list('bloom', colors, N=n_bins)
    
    # Get actual data range for better normalization
    valid_data = index_data[~np.isnan(index_data)]
    if len(valid_data) > 0:
        data_min = np.nanmin(valid_data)
        data_max = np.nanmax(valid_data)
        logger.info(f"Data range: {data_min:.3f} to {data_max:.3f}")
        # Use data range but ensure we capture threshold regions
        vmin = max(0.0, data_min - 0.1)
        vmax = min(1.0, data_max + 0.1)
    else:
        vmin, vmax = 0.0, 1.0
    
    # Normalize based on actual data range
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)
    
    # Apply colormap
    rgba_data = cmap_custom(norm(index_data))
    
    # Set consistent alpha for all valid pixels (light overlay)
    rgba_data[:, :, 3] = alpha
    
    # Make NaN values fully transparent
    rgba_data[np.isnan(index_data)] = [0, 0, 0, 0]
    
    # Render the image
    ax.imshow(rgba_data, extent=(lon_min, lon_max, lat_min, lat_max), 
              aspect='auto', interpolation='bilinear', origin='upper')
    
    plt.tight_layout(pad=0)
    
    # Save to buffer
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0, 
                transparent=True, dpi=150)
    plt.close(fig)
    
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    
    return f"data:image/png;base64,{img_base64}", (lat_min, lon_min, lat_max, lon_max)

def create_folium_map(aoi: Tuple[float, float, float, float], 
                     index_data: Optional[np.ndarray] = None,
                     profile: Optional[Dict] = None) -> folium.Map:
    """Create Folium map with optional heatmap overlay"""
    lat_min, lon_min, lat_max, lon_max = aoi
    center_lat = (lat_min + lat_max) / 2
    center_lon = (lon_min + lon_max) / 2
    
    # Create map with OpenStreetMap as default base layer
    m = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=10,
        tiles='OpenStreetMap',
        attr='OpenStreetMap'
    )
    
    # Add satellite imagery as additional layer option
    folium.TileLayer(
        tiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attr='Esri',
        name='Satellite Imagery',
        overlay=False,
        control=True
    ).add_to(m)
    
    folium.Rectangle(
        bounds=[[lat_min, lon_min], [lat_max, lon_max]],
        color='red',
        weight=2,
        fill=False,
        popup=f'Analysis Area: {lat_min:.3f}, {lon_min:.3f} to {lat_max:.3f}, {lon_max:.3f}'
    ).add_to(m)
    
    if index_data is not None and profile:
        try:
            overlay_img, overlay_bounds = generate_heatmap_overlay(index_data, profile, alpha=0.5)
            img_lat_min, img_lon_min, img_lat_max, img_lon_max = overlay_bounds
            
            folium.raster_layers.ImageOverlay(
                image=overlay_img,
                bounds=[[img_lat_min, img_lon_min], [img_lat_max, img_lon_max]],
                opacity=0.7,
                interactive=True,
                cross_origin=False,
                name='Bloom Concentration Overlay'
            ).add_to(m)
            
            logger.info("Successfully added bloom concentration overlay to map")
        except Exception as e:
            logger.error(f"Failed to add heatmap overlay: {e}")
            import traceback
            logger.error(traceback.format_exc())
    
    # Add layer control to switch between base maps
    folium.LayerControl().add_to(m)
    
    return m

def average_granules(data_arrays: List[np.ndarray]) -> np.ndarray:
    """Average multiple single-band arrays to create composite bloom index
    
    Args:
        data_arrays: List of normalized band arrays from multiple granules
    
    Returns:
        Averaged array representing composite bloom indicator
    """
    if not data_arrays:
        return np.array([])
    
    # Stack all arrays
    stacked = np.stack(data_arrays, axis=0)
    
    # Average, ignoring NaN values
    with np.errstate(invalid='ignore'):
        averaged = np.nanmean(stacked, axis=0)
    
    return averaged.astype(np.float32)

def process_granules_concurrent(granules: List[GranuleMeta], 
                              session: requests.Session,
                              progress_callback: Optional[Callable] = None,
                              out_shape: Optional[Tuple[int, int]] = (512, 512),
                              enable_cloud_masking: bool = True,
                              max_granules: int = 10,
                              timeout_per_granule: int = 60) -> List[Tuple[GranuleMeta, Path, np.ndarray, Dict]]:
    """
    Process multiple granules concurrently with configurable resolution and cloud masking.
    
    Args:
        granules: List of granule metadata
        session: Authenticated requests session
        progress_callback: Optional progress update function
        out_shape: Output shape for windowed reads (None = full resolution)
        enable_cloud_masking: Whether to apply cloud masking
        max_granules: Maximum number of granules to process
        timeout_per_granule: Timeout in seconds for each granule processing
    
    Returns:
        List of (granule, path, index_array, profile) tuples
    """
    results = []
    failed_count = 0
    all_normalized_data = []  # Collect all single-band data for averaging
    
    # Process more granules since we're just averaging single bands (faster)
    granules_to_process = granules[:max_granules]
    logger.info(f"Processing {len(granules_to_process)} single-band granules")
    logger.info("Will average all bands to create composite bloom indicator")
    
    # Use moderate parallelism for single-band downloads
    with ThreadPoolExecutor(max_workers=3) as executor:
        # Standard single-band download for all datasets
        download_futures = {
            executor.submit(download_granule, granule, session, CACHE_DIR): granule
            for granule in granules_to_process
        }
        
        processed = 0
        total = len(download_futures)
        
        # Set reasonable overall timeout for single-band downloads
        overall_timeout = timeout_per_granule * total
        
        for future in as_completed(download_futures, timeout=overall_timeout):
            granule = download_futures[future]
            
            try:
                file_path = future.result(timeout=timeout_per_granule)
                if file_path and file_path.exists():
                    # Read single band (NASA provides single-band files)
                    band_data, profile = read_single_band(file_path, out_shape=out_shape)
                    
                    if band_data.size > 0:
                        # Apply cloud masking if enabled
                        cloud_mask = None
                        if enable_cloud_masking:
                            try:
                                # Use statistical cloud detection on single band
                                # Reshape to 3D for apply_cloud_mask function
                                band_3d = band_data[np.newaxis, :, :]
                                cloud_mask = apply_cloud_mask(band_3d, use_statistical=True)
                            except Exception as e:
                                logger.debug(f"Cloud masking error for {granule.id}: {e}")
                                cloud_mask = None
                        
                        # Normalize the band data
                        normalized = normalize_band_data(band_data, cloud_mask=cloud_mask)
                        
                        # Verify we got valid data
                        valid_pixels = np.sum(~np.isnan(normalized))
                        if valid_pixels > 100:  # Need reasonable amount of data
                            all_normalized_data.append(normalized)
                            results.append((granule, file_path, normalized, profile))
                            logger.info(f"✅ Processed {granule.id}: {valid_pixels} valid pixels")
                        else:
                            logger.warning(f"Skipping {granule.id}: insufficient valid pixels ({valid_pixels})")
                            failed_count += 1
                    else:
                        logger.warning(f"Skipping {granule.id}: could not read band data")
                        failed_count += 1
                else:
                    logger.warning(f"Download failed for {granule.id}")
                    failed_count += 1
                        
                processed += 1
                if progress_callback:
                    progress_callback(processed / total)
                    
            except TimeoutError:
                logger.error(f"Timeout processing {granule.id}")
                failed_count += 1
                processed += 1
                if progress_callback:
                    progress_callback(processed / total)
            except Exception as e:
                logger.error(f"Processing failed for {granule.id}: {str(e)[:100]}")
                failed_count += 1
                processed += 1
                if progress_callback:
                    progress_callback(processed / total)
    
    # Create averaged composite if we have multiple granules
    if len(all_normalized_data) > 1:
        logger.info(f"Averaging {len(all_normalized_data)} granules to create composite bloom indicator")
        averaged_data = average_granules(all_normalized_data)
        
        # Replace individual results with averaged composite (use first granule's metadata)
        if results:
            first_granule, first_path, _, first_profile = results[0]
            results = [(first_granule, first_path, averaged_data, first_profile)]
            logger.info(f"✅ Created composite from {len(all_normalized_data)} granules")
    
    # Sort by time and log summary
    results.sort(key=lambda x: x[0].time_start)
    logger.info(f"Processing complete: {len(all_normalized_data)} granules averaged, {failed_count} failed")
    
    return results

def streamlit_dashboard():
    """Main Streamlit dashboard with comprehensive error handling"""
    try:
        st.set_page_config(
            page_title="PROJECT H.Y.D.R.A.",
            page_icon="🛰️",
            layout="wide"
        )
    except:
        pass  # Config already set
    
    # Initialize database
    try:
        init_database()
    except Exception as e:
        st.error(f"Database initialization error: {e}")
    
    # Main title
    st.title("🛰️ PROJECT H.Y.D.R.A.")
    st.subheader("Hyper-Yield Detection & Remote Analysis")
    st.caption("NASA Space Apps 2025 - Real-time Algal Bloom Detection")
    
    # Initialize session
    user_session_id = get_or_create_session()
    
    # Get session and show authentication status
    session = get_authenticated_session()
    
    # Credentials status panel
    st.sidebar.header("🔐 Authentication Status")
    
    # Check if credentials exist in environment
    username_set = bool(os.getenv("NASA_EARTHDATA_USERNAME"))
    password_set = bool(os.getenv("NASA_EARTHDATA_PASSWORD"))
    
    if username_set and password_set and session:
        username = os.getenv("NASA_EARTHDATA_USERNAME")
        st.sidebar.success(f"✅ Authenticated as: `{username[:3]}***`")
        credentials_valid = True
    elif username_set and password_set and not session:
        st.sidebar.warning("⚠️ Credentials found but session creation failed")
        st.sidebar.info("Check if credentials are correct at urs.earthdata.nasa.gov")
        credentials_valid = False
    else:
        st.sidebar.error("❌ Credentials Not Found")
        with st.sidebar.expander("📖 Setup Instructions", expanded=True):
            st.markdown("""
            **Steps to enable data downloads:**
            
            1. Create free NASA Earthdata account:
               [urs.earthdata.nasa.gov](https://urs.earthdata.nasa.gov)
            
            2. **For Windows PowerShell (current session):**
               ```powershell
               $env:NASA_EARTHDATA_USERNAME="your_username"
               $env:NASA_EARTHDATA_PASSWORD="your_password"
               streamlit run main.py --server.port 5000
               ```
            
            3. **For permanent setup (recommended):**
               - Create `.env` file in project root with:
               ```
               NASA_EARTHDATA_USERNAME=your_username
               NASA_EARTHDATA_PASSWORD=your_password
               ```
               - Restart Streamlit
            
            4. **For Replit:** Add to Secrets panel
            
            5. **Verify setup:**
               ```powershell
               python -c "import os; from dotenv import load_dotenv; load_dotenv(); print(os.getenv('NASA_EARTHDATA_USERNAME'))"
               ```
            """)
        credentials_valid = False
    
    st.sidebar.markdown("---")
    
    # Sidebar controls - Cleaner design
    st.sidebar.header("� Analysis Setup")
    
    # Initialize AOI
    aoi = None
    
    # Check if we have geocoded coordinates from presets
    if 'geocoded_coords' in st.session_state:
        aoi = st.session_state.geocoded_coords
    
    # ========== STEP 1: SELECT LOCATION ==========
    st.sidebar.markdown("### 1️⃣ Select Location")
    
    # Location method tabs
    location_method = st.sidebar.radio(
        "Choose method:",
        ["🌍 Quick Preset", "🔍 Search Place", "📍 Coordinates"],
        label_visibility="collapsed"
    )
    
    # Quick Preset Method
    if location_method == "🌍 Quick Preset":
        famous_locations = {
            "Lake Erie (USA)": (41.2, -83.5, 42.0, -82.0),
            "Lake Okeechobee (Florida)": (26.7, -81.2, 27.2, -80.5),
            "Tampa Bay (Florida)": (27.5, -82.8, 28.0, -82.3),
            "Chesapeake Bay (Maryland)": (38.8, -76.6, 39.3, -76.0),
            "Lake Pontchartrain (Louisiana)": (30.0, -90.3, 30.3, -89.8),
            "San Francisco Bay": (37.4, -122.5, 38.0, -122.0),
            "Lake Champlain (Vermont)": (44.0, -73.5, 45.0, -73.0),
            "Indian River Lagoon (Florida)": (27.5, -80.5, 28.5, -80.3)
        }
        
        famous_preset = st.sidebar.selectbox(
            "Select hotspot:",
            ["— Select —"] + list(famous_locations.keys()),
            label_visibility="collapsed"
        )
        
        if famous_preset != "— Select —":
            st.session_state.geocoded_coords = famous_locations[famous_preset]
            st.session_state.selected_preset_name = famous_preset
            aoi = famous_locations[famous_preset]
            st.sidebar.success(f"✅ {famous_preset}")
    
    # Search Place Method
    elif location_method == "🔍 Search Place":
        place_name = st.sidebar.text_input(
            "Place name:",
            placeholder="e.g., Lake Erie, Ohio",
            label_visibility="collapsed"
        )
        
        if place_name and st.sidebar.button("🔍 Search", use_container_width=True):
            with st.spinner("Searching..."):
                coords = geocode_place_name(place_name)
                if coords:
                    st.session_state.geocoded_coords = coords
                    st.session_state.selected_preset_name = place_name
                    if 'pending_geocode' in st.session_state:
                        del st.session_state.pending_geocode
                    aoi = coords
                    st.sidebar.success(f"✅ Found: {place_name}")
                else:
                    st.sidebar.error("❌ Not found. Try different keywords.")
    
    # Coordinates Method
    else:
        # If preset is loaded, use those values as defaults
        if aoi:
            default_lat_min, default_lon_min, default_lat_max, default_lon_max = aoi
        else:
            default_lat_min, default_lon_min = 26.7, -80.9
            default_lat_max, default_lon_max = 27.0, -80.5
        
        col1, col2 = st.sidebar.columns(2)
        with col1:
            lat_min = st.number_input("Lat Min", value=default_lat_min, format="%.4f")
            lon_min = st.number_input("Lon Min", value=default_lon_min, format="%.4f")
        with col2:
            lat_max = st.number_input("Lat Max", value=default_lat_max, format="%.4f")
            lon_max = st.number_input("Lon Max", value=default_lon_max, format="%.4f")
        
        if validate_bbox(lat_min, lon_min, lat_max, lon_max):
            aoi = (lat_min, lon_min, lat_max, lon_max)
            st.session_state.geocoded_coords = aoi
            if 'selected_preset_name' in st.session_state:
                del st.session_state.selected_preset_name
            st.sidebar.success("✅ Valid")
        else:
            st.sidebar.error("❌ Invalid bbox")
    
    # Show active location
    if aoi and 'selected_preset_name' in st.session_state:
        st.sidebar.info(f"📍 **{st.session_state.selected_preset_name}**")
    
    st.sidebar.markdown("---")
    
    # ========== STEP 2: ANALYSIS SETTINGS ==========
    st.sidebar.markdown("### 2️⃣ Analysis Settings")
    
    # Date range - compact
    col1, col2 = st.sidebar.columns(2)
    with col1:
        start_date = st.date_input(
            "📅 From",
            value=datetime.now() - timedelta(days=10)
        )
    with col2:
        end_date = st.date_input(
            "To",
            value=datetime.now()
        )
    
    # Compact options
    dataset = st.sidebar.selectbox(
        "🛰️ Satellite Data",
        ["HLS", "Sentinel-2", "MODIS"]
    )
    
    resolution = st.sidebar.selectbox(
        "🔍 Quality",
        ["Quick Preview", "Full Resolution"],
        help="Preview: Fast ⚡ | Full: Detailed 🎯"
    )
    
    enable_cloud_mask = st.sidebar.checkbox(
        "☁️ Filter clouds",
        value=True
    )
    
    st.sidebar.markdown("---")
    
    # ========== STEP 3: RUN ANALYSIS ==========
    analyze_button = st.sidebar.button(
        "🚀 Run Analysis",
        type="primary",
        use_container_width=True,
        disabled=(aoi is None or not credentials_valid)
    )
    
    # Help text
    if aoi is None:
        st.sidebar.warning("⚠️ Select a location first")
    elif not credentials_valid:
        st.sidebar.warning("⚠️ Configure credentials above")
    
    # Main panel
    if not analyze_button:
        st.info("👈 Configure analysis parameters and click **Fetch & Analyze**")
        
        # Show analysis history
        history = get_analysis_history(user_session_id, limit=10)
        if history:
            st.subheader("📜 Recent Analysis History")
            history_df = pd.DataFrame(history)
            history_df = history_df[[
                'analysis_date', 'dataset', 'severity', 
                'area_above_threshold', 'mean_ndci', 'granules_processed'
            ]]
            history_df.columns = ['Date', 'Dataset', 'Severity', 'Area Above (%)', 'Mean NDCI', 'Granules']
            st.dataframe(history_df, width='stretch')
        
        return
    
    if aoi is None:
        st.error("Please specify a valid location")
        return
    
    # Progress tracking
    progress_bar = st.progress(0)
    status_text = st.empty()
    time_text = st.empty()
    
    # Live log display during analysis
    log_expander = st.expander("📋 Live System Logs", expanded=True)
    log_placeholder = log_expander.empty()
    
    # Track timing
    import time as time_module
    start_time = time_module.time()
    
    try:
        # Search CMR
        status_text.text("🔍 Stage 1/4: Searching satellite data...")
        time_text.text("⏱️ Estimated total time: ~2-3 minutes")
        progress_bar.progress(0.05)
        
        # Update log display
        if st.session_state.log_messages:
            with log_placeholder.container():
                for log in reversed(st.session_state.log_messages[-10:]):
                    level = log['level']
                    time_str = log['time']
                    msg = log['message']
                    
                    if level == "ERROR":
                        st.error(f"`{time_str}` {msg}", icon="❌")
                    elif level == "WARNING":
                        st.warning(f"`{time_str}` {msg}", icon="⚠️")
                    else:
                        st.info(f"`{time_str}` {msg}", icon="ℹ️")
        
        date_range = (start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
        granules = search_cmr(aoi, date_range, dataset)
        
        # Update log display
        if st.session_state.log_messages:
            with log_placeholder.container():
                for log in reversed(st.session_state.log_messages[-10:]):
                    level = log['level']
                    time_str = log['time']
                    msg = log['message']
                    
                    if level == "ERROR":
                        st.error(f"`{time_str}` {msg}", icon="❌")
                    elif level == "WARNING":
                        st.warning(f"`{time_str}` {msg}", icon="⚠️")
                    else:
                        st.info(f"`{time_str}` {msg}", icon="ℹ️")
        
        if not granules:
            st.error("No satellite data found for the specified criteria")
            return
        
        st.success(f"✅ Found {len(granules)} granules")
        status_text.text(f"✅ Stage 2/4: Found {len(granules)} granules, preparing download...")
        progress_bar.progress(0.15)
        
        # Process granules
        status_text.text("⬇️ Stage 3/4: Downloading and processing satellite imagery...")
        progress_bar.progress(0.20)
        
        # Determine output shape based on resolution setting
        out_shape = (512, 512) if resolution == "Quick Preview" else None
        resolution_info = "512x512 preview" if out_shape else "full resolution"
        logger.info(f"Processing with {resolution_info}, cloud masking: {enable_cloud_mask}")
        
        def update_progress(pct):
            # Progress bar from 20% to 85% during processing
            progress_bar.progress(0.20 + (pct * 0.65))
            
            # Update status with percentage
            status_text.text(f"⬇️ Stage 3/4: Processing granules... {int(pct * 100)}% complete")
            
            # Calculate and display estimated time remaining
            elapsed = time_module.time() - start_time
            if pct > 0.1:
                estimated_total = elapsed / pct
                remaining = estimated_total - elapsed
                mins = int(remaining // 60)
                secs = int(remaining % 60)
                if remaining > 0:
                    time_text.text(f"⏱️ Time remaining: ~{mins}m {secs}s | Elapsed: {int(elapsed)}s")
                else:
                    time_text.text(f"⏱️ Elapsed: {int(elapsed)}s")
            
            # Update log display during processing
            if st.session_state.log_messages:
                with log_placeholder.container():
                    for log in reversed(st.session_state.log_messages[-10:]):
                        level = log['level']
                        time_str = log['time']
                        msg = log['message']
                        
                        if level == "ERROR":
                            st.error(f"`{time_str}` {msg}", icon="❌")
                        elif level == "WARNING":
                            st.warning(f"`{time_str}` {msg}", icon="⚠️")
                        else:
                            st.info(f"`{time_str}` {msg}", icon="ℹ️")
        
        # Pass resolution and cloud mask settings to processing
        # Single-band files are fast to process
        try:
            results = process_granules_concurrent(
                granules, session, update_progress, 
                out_shape=out_shape, 
                enable_cloud_masking=enable_cloud_mask,
                max_granules=8,  # Process 8 granules for good averaging
                timeout_per_granule=30  # 30 second timeout (single-band is fast)
            )
        except Exception as e:
            logger.error(f"Processing failed: {e}")
            st.error(f"Processing failed: {str(e)[:200]}")
            return
        
        # Final log update after processing
        if st.session_state.log_messages:
            with log_placeholder.container():
                for log in reversed(st.session_state.log_messages[-10:]):
                    level = log['level']
                    time_str = log['time']
                    msg = log['message']
                    
                    if level == "ERROR":
                        st.error(f"`{time_str}` {msg}", icon="❌")
                    elif level == "WARNING":
                        st.warning(f"`{time_str}` {msg}", icon="⚠️")
                    else:
                        st.info(f"`{time_str}` {msg}", icon="ℹ️")
        
        if not results:
            st.error("⚠️ Failed to process any granules successfully")
            with st.expander("📖 Troubleshooting Tips", expanded=True):
                st.markdown("""
                **Possible issues:**
                - Downloaded files may be single-band GeoTIFFs (need multi-band with Red and NIR)
                - Try selecting a different location or date range
                - Check the logs above for detailed error messages
                
                **Tip:** HLS data should contain at least 2 bands for NDCI calculation.
                Some HLS downloads provide individual bands as separate files rather than multi-band GeoTIFFs.
                """)
            return
        
        progress_bar.progress(0.9)
        status_text.text("📊 Generating visualizations...")
        
        # Combine results
        all_indices = []
        for granule, file_path, ndci, profile in results:
            all_indices.append(ndci)
        
        if all_indices:
            # Use most recent result for visualization
            latest_index = all_indices[0]
            latest_profile = results[0][3]
            
            # Annotate severity
            severity, metrics = annotate_severity(latest_index, NDCI_THRESHOLDS)
            metrics['granules_processed'] = len(results)
            
            # Save to history
            date_range = (start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
            save_analysis_history(user_session_id, aoi, dataset, date_range, severity, metrics)
            
            # Create map with error handling
            status_text.text("🗺️ Stage 4/4: Generating visualization...")
            progress_bar.progress(0.90)
            
            try:
                map_obj = create_folium_map(aoi, latest_index, latest_profile)
            except Exception as e:
                logger.error(f"Map creation error: {e}")
                # Create simple map without overlay if there's an error
                map_obj = create_folium_map(aoi, None, None)
                st.warning("⚠️ Map overlay failed, showing base map only")
            
        progress_bar.progress(1.0)
        total_time = time_module.time() - start_time
        status_text.text("✅ Analysis complete! 🎉")
        time_text.text(f"⏱️ Total time: {int(total_time // 60)}m {int(total_time % 60)}s")
        
        # Display results with error handling
        col1, col2 = st.columns([2, 1])
        
        with col1:
            st.subheader("🗺️ Analysis Map")
            st_folium(map_obj, width=700, height=500, key="analysis_map", returned_objects=[])
        
        with col2:
            st.subheader("📈 Metrics")
            
            # Severity badge
            severity_colors = {
                "LOW": "🟢",
                "MEDIUM": "🟡", 
                "HIGH": "🔴",
                "CLEAR": "🔵",
                "NO_DATA": "⚫"
            }
            
            st.metric(
                "Severity Level",
                f"{severity_colors.get(severity, '⚫')} {severity}"
            )
            
            st.metric(
                "Area Above Threshold",
                f"{metrics.get('percent_above_threshold', 0):.1f}%"
            )
            
            st.metric(
                "Mean Index",
                f"{metrics.get('mean_index', 0):.3f}"
            )
            
            st.metric(
                "Valid Pixels",
                f"{metrics.get('valid_pixels', 0):,}"
            )
            
            # Extract time series data from all results
            dates = []
            mean_values = []
            for granule, file_path, ndci, profile in results:
                try:
                    date_str = granule.time_start.split('T')[0]
                    dates.append(pd.to_datetime(date_str))
                    mean_values.append(np.nanmean(ndci))
                except Exception as e:
                    logger.warning(f"Failed to parse date for {granule.id}: {e}")
            
            # Time series chart
            if len(results) > 1 and dates:
                st.subheader("📊 Time Series Analysis")
                df = pd.DataFrame({
                    'Date': dates,
                    'Mean NDCI': mean_values
                })
                df = df.sort_values('Date')
                st.line_chart(df.set_index('Date'))
            
            # Granules table
            st.subheader("🛰️ Processed Granules")
            granule_data = []
            for granule, file_path, ndci, profile in results:
                granule_data.append({
                    'ID': granule.id,
                    'Start Time': granule.time_start,
                    'Status': 'Processed' if file_path else 'Failed'
                })
            
            st.dataframe(pd.DataFrame(granule_data))
        
        # Export functionality
        st.subheader("📥 Export Results")
        
        export_data = {
            'Analysis Date': [datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
            'AOI_Lat_Min': [aoi[0]],
            'AOI_Lon_Min': [aoi[1]],
            'AOI_Lat_Max': [aoi[2]],
            'AOI_Lon_Max': [aoi[3]],
            'Dataset': [dataset],
            'Date_Start': [start_date.strftime('%Y-%m-%d')],
            'Date_End': [end_date.strftime('%Y-%m-%d')],
            'Severity': [severity],
            'Area_Above_Threshold_Pct': [metrics['percent_above_threshold']],
            'Mean_NDCI': [metrics['mean_index']],
            'Valid_Pixels': [metrics['valid_pixels']],
            'Granules_Processed': [len(results)]
        }
        
        export_df = pd.DataFrame(export_data)
        csv_data = export_df.to_csv(index=False)
        
        st.download_button(
            label="📊 Download Analysis Report (CSV)",
            data=csv_data,
            file_name=f"hydra_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv"
        )
        
        if len(results) > 1 and dates:
            time_series_df = pd.DataFrame({
                'Date': dates,
                'Mean_NDCI': mean_values
            }).sort_values('Date')
            time_series_csv = time_series_df.to_csv(index=False)
            
            st.download_button(
                label="📈 Download Time Series Data (CSV)",
                data=time_series_csv,
                file_name=f"hydra_timeseries_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                mime="text/csv"
            )
            
    except Exception as e:
        st.error(f"Analysis failed: {str(e)}")
        logger.error(f"Dashboard error: {e}")
    
    finally:
        progress_bar.empty()
        status_text.empty()

def main():
    """Main entry point with optional CLI sample mode"""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='PROJECT H.Y.D.R.A.')
    parser.add_argument('--sample', action='store_true', 
                       help='Run offline sample mode for testing (optional)')
    
    # Only parse args if not in Streamlit mode
    if len(sys.argv) > 1 and '--sample' in sys.argv:
        args = parser.parse_args()
        if args.sample:
            print("IMPLEMENTATION NOTE: Sample mode not implemented - this is a live data app")
            print("Use 'streamlit run main.py' for the web interface")
            return
    
    # Run Streamlit app
    streamlit_dashboard()

if __name__ == "__main__":
    main()
