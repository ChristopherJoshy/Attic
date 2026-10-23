# Backend Edit Request 1: Enable Patient Details Editing

## Description
This request updates the patient update contract and route to allow editing of the patient's name and phone number.

## Changes
### 1. Update `PatientUpdateRequest` in `sahayi/backend/contracts/patients.py`
- Add `name: str | None = None`
- Add `phone_number: str | None = None`

### 2. Update `update_patient` in `sahayi/backend/api/routes_patients.py`
- Normalize `phone_number` if it is present in the updates.
