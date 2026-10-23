#!/usr/bin/env python3
"""
Setup .netrc file for NASA Earthdata authentication
Run this script on Render to configure authentication properly
"""

import os
from pathlib import Path

def setup_netrc():
    """Create .netrc file with NASA Earthdata credentials from environment variables"""
    username = os.getenv("NASA_EARTHDATA_USERNAME")
    password = os.getenv("NASA_EARTHDATA_PASSWORD")
    
    if not username or not password:
        print("❌ ERROR: NASA_EARTHDATA_USERNAME and NASA_EARTHDATA_PASSWORD must be set in environment")
        print("   Go to Render Dashboard > Environment > Add Secret")
        return False
    
    # Create .netrc file in home directory
    netrc_path = Path.home() / ".netrc"
    
    netrc_content = f"""machine urs.earthdata.nasa.gov
    login {username}
    password {password}
"""
    
    # Write .netrc file
    netrc_path.write_text(netrc_content)
    
    # Set proper permissions (read/write for owner only)
    netrc_path.chmod(0o600)
    
    print(f"✅ .netrc file created successfully at {netrc_path}")
    print(f"✅ Credentials configured for user: {username[:3]}***")
    
    return True

if __name__ == "__main__":
    success = setup_netrc()
    exit(0 if success else 1)
