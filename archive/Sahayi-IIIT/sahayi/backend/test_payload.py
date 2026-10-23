from pydantic import ValidationError
from contracts.patients import PatientCreateRequest

payload = {
    "name": "Test",
    "language": "ml-IN",
    "phone_number": "1234567890",
    "registration_number": "REG123",
    "conditions": ["Condition 1"],
    "medicines": [{"name": "M1", "dose": "D1", "frequency": "F1", "timing": "T1"}],
    "emergency_contact": {"name": "E1", "phone": "123", "relationship": "emergency"},
    "doctor_contact": {"name": "D1", "phone": "123", "relationship": "doctor"},
    "relatives": [{"name": "R1", "relationship": "son", "phone": "123", "whatsapp_number": ""}]
}

try:
    req = PatientCreateRequest(**payload)
    print("Success")
except ValidationError as e:
    print(e)
