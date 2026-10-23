# Request 8: Fix Patient Deletion "Method Not Allowed" Error

## Problem
The doctor is receiving a "Method Not Allowed" (HTTP 405) error when attempting to delete a patient. This suggests the `DELETE` endpoint is not being correctly matched or accepted by the backend router.

## Backend Changes Needed
1.  Verify the `DELETE /patients/{patient_id}` route in `sahayi/backend/api/routes_patients.py`.
2.  Ensure the route is positioned correctly to avoid potential conflicts.
3.  Add additional logging to confirm if the request is reaching the server.

## Frontend Changes Needed
1.  Ensure the `sahayiApi.deletePatient` call is sending the correct URL and method.
2.  Add error handling to capture the exact status code.

## Strategy
I will move the delete route to the top of the patient-specific routes and ensure the path parameters are correctly typed.
