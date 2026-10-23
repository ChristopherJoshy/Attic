# Backend Edit Request 2: Fix Missing Imports and Enhance Dashboard Patient Card

## Description
1. The `get_risk` route in `sahayi/backend/api/routes_patients.py` uses `datetime` and `timedelta` but lacks the imports, causing a 500 error.
2. The `DashboardPatientCard` contract and the `/dashboard/patients` route in `sahayi/backend/api/routes_dashboard.py` are missing the `conditions` field required by the frontend `Patients.jsx` view.

## Changes
### 1. Update `sahayi/backend/api/routes_patients.py`
- Add `from datetime import datetime, timedelta` to the top of the file.

### 2. Update `DashboardPatientCard` in `sahayi/backend/contracts/system.py`
- Add `conditions: list[str]` to the `DashboardPatientCard` model.

### 3. Update `dashboard_patients` in `sahayi/backend/api/routes_dashboard.py`
- Include `conditions=patient.conditions` when creating `DashboardPatientCard` instances.
