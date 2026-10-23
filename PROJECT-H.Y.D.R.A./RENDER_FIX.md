# Render Deployment Fix - Authentication Issue

## Problem
Authentication was failing on Render when trying to download NASA satellite data, resulting in "AUTHENTICATION FAILED" errors.

## Solution Implemented

### 1. Created `.netrc` Auto-Setup
- Modified `main.py` to automatically create a `.netrc` file on startup
- The `.netrc` file is the preferred authentication method for NASA Earthdata
- File is created from environment variables if it doesn't exist

### 2. Created Manual Setup Script
- Added `setup_netrc.py` for manual .netrc configuration if needed
- Can be run with: `python setup_netrc.py`

### 3. Updated README
- Added clear instructions for setting environment variables on Render
- Instructions now cover Render, Replit, and local development

## Required Action on Render Dashboard

You MUST set these environment variables in your Render service:

1. Go to: https://dashboard.render.com
2. Select your service: **project-h-y-d-r-a**
3. Click **"Environment"** in the left sidebar
4. Add these environment variables:
   - **Key:** `NASA_EARTHDATA_USERNAME`
   - **Value:** Your NASA Earthdata username (e.g., `chr***`)
   
   - **Key:** `NASA_EARTHDATA_PASSWORD`
   - **Value:** Your NASA Earthdata password

5. Click **"Save Changes"**
6. Wait for automatic redeploy (about 2-3 minutes)

## Verification

After setting the environment variables, you should see in the Render logs:
```
✅ .netrc file created for NASA Earthdata authentication
✅ Credentials loaded for user: chr***
✅ Using credentials from environment variables
```

And downloads should work:
```
INFO - Downloading: https://data.lpdaac.earthdatacloud.nasa.gov/...
INFO - Downloaded G3789285051-LPCLOUD (123.45 MB)
```

## Files Modified

1. **main.py** - Added automatic .netrc setup on startup
2. **setup_netrc.py** - Created standalone setup script
3. **README.md** - Added Render deployment instructions
4. **requirements.txt** - Already has all necessary dependencies

## Next Steps

1. ✅ Push these changes to GitHub (already done with `git push`)
2. ⏳ Set environment variables on Render (YOU NEED TO DO THIS)
3. ⏳ Wait for automatic redeploy
4. ✅ Test the application at: https://project-h-y-d-r-a.onrender.com

## Important Notes

- The `.netrc` file is created automatically - you don't need to upload it
- Environment variables are more secure than committing credentials to code
- The app will work immediately after you set the environment variables
- Make sure your NASA Earthdata account has "LP DAAC Data Pool" authorized

## If Still Having Issues

1. Verify your NASA Earthdata credentials work by logging in at: https://urs.earthdata.nasa.gov
2. Check that "LP DAAC Data Pool" is authorized in your Earthdata profile
3. Check Render logs for any error messages
4. Try manual setup: Run `python setup_netrc.py` in Render shell (if available)
