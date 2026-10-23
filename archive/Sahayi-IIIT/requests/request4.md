# Backend Edit Request 4: Patient-Aware Call Agent (Registration Number + Malayalam Greeting)

## Description
Add `registration_number` field to Patient model, enable patient lookup by registration number, and make the AI initiate calls with a personalised Malayalam greeting ("ഹലോ {name}, ഞാൻ സഹായി ആണ്"). Outbound follow-up calls now carry patient context via a URL query parameter.

## Changes
### 1. Update `sahayi/backend/db/models.py`
- Add `registration_number` column (String, nullable, unique, indexed) to `Patient`.

### 2. Update `sahayi/backend/db/patient_gateway.py`
- Add `get_patient_by_registration(reg_number)` method.
- Add `get_patient_by_id(patient_id)` method for internal lookups without doctor scope.

### 3. Update `sahayi/backend/contracts/patients.py`
- Add `registration_number` to `PatientCreateRequest`, `PatientUpdateRequest`, and `PatientResponse`.

### 4. Update `sahayi/backend/api/routes_patients.py`
- Pass `registration_number` through `create_patient` and include in `_patient_response`.

### 5. Update `sahayi/backend/voice/twilio_handler.py`
- `create_incoming_response`: accept optional `outbound_patient_id`, include `registration_number` in patient payload.
- `_on_start`: synthesize and return a Malayalam greeting as the first audio frame.
- `initiate_follow_up_call`: accept optional `patient_id`, append as query param to webhook URL.

### 6. Update `sahayi/backend/api/routes_voice.py`
- Parse `patient_id` from query string and pass to `create_incoming_response`.

### 7. Update `sahayi/backend/seed.py`
- Add `registration_number="REG001"` to demo patient.
