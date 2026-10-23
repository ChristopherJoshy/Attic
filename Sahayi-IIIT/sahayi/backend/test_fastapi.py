import asyncio
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
payload = {
    "name": "Test",
    "language": "ml-IN",
    "phone_number": "1234567890",
    "registration_number": "",
    "conditions": [],
    "medicines": [{"name": "M1", "dose": "D1", "frequency": "F1", "timing": "T1"}],
    "emergency_contact": {"name": "E1", "phone": "123", "relationship": "emergency"},
    "doctor_contact": {"name": "D1", "phone": "123", "relationship": "doctor"},
    "relatives": [{"name": "R1", "relationship": "son", "phone": "123", "whatsapp_number": ""}]
}

# we only care about validation, so let's check if we get 422
try:
    response = client.post("/patients", json=payload)
    print(response.status_code, response.json())
except Exception as e:
    print(e)
