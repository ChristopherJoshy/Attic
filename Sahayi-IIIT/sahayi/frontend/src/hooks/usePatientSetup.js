import { useState } from "react";

import { sahayiApi } from "../api/sahayi";

/**
 * Manage patient setup form submission state.
 * @returns {object} Submit handler, loading state, result, and error.
 */
export function usePatientSetup() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(payload) {
    setLoading(true);
    setError("");
    try {
      const response = await sahayiApi.createPatient(payload);
      setResult(response);
      return response;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { submit, result, loading, error };
}
