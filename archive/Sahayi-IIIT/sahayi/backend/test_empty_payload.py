from pydantic import ValidationError
from contracts.patients import PatientCreateRequest

payload = {
    "name": "",
    "language": "ml-IN",
    "phone_number": "",
    "registration_number": "",
    "conditions": [],
    "medicines": [{"name": "", "dose": "", "frequency": "", "timing": ""}],
    "emergency_contact": {"name": "", "phone": "", "relationship": "emergency"},
    "doctor_contact": {"name": "", "phone": "", "relationship": "doctor"},
    "relatives": [{"name": "", "relationship": "", "phone": "", "whatsapp_number": ""}]
}

try:
    req = PatientCreateRequest(**payload)
    print("Success")
except ValidationError as e:
    print(e)
