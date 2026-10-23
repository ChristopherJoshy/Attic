# Backend Edit Request 3: Add Relative Relationship Field

## Description
This request adds a `relative_relationship` field to the `Patient` model to allow doctors to specify the relationship of the primary relative (e.g., Son, Daughter, Spouse).

## Changes
### 1. Update `Patient` in `sahayi/backend/db/models.py`
- Add `relative_relationship: Mapped[str] = mapped_column(String(64), default="")`

### 2. Update `PatientCreateRequest` and `PatientUpdateRequest` in `sahayi/backend/contracts/patients.py`
- Add `relative_relationship: str | None = None` to both models.

### 3. Update `PatientResponse` in `sahayi/backend/contracts/patients.py`
- Add `relative_relationship: str`

### 4. Update `create_patient` in `sahayi/backend/api/routes_patients.py`
- Include `relative_relationship: payload.relative_relationship` in the database record creation.

### 5. Update `_patient_response` in `sahayi/backend/api/routes_patients.py`
- Map `relative_relationship=patient.relative_relationship` in the response model.
