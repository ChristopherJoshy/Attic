import { useEffect, useState } from "react";

import { sahayiApi } from "../api/sahayi";

/**
 * Manage one patient profile, risk, and signal history.
 * @param {string|number} patientId Patient identifier.
 * @returns {object} Patient record state and loading/error flags.
 */
export function usePatientRecord(patientId) {
  const [profile, setProfile] = useState(null);
  const [risk, setRisk] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [patientResponse, riskResponse, signalResponse] = await Promise.all([sahayiApi.getPatient(patientId), sahayiApi.getRisk(patientId), sahayiApi.getSignals(patientId)]);
        setProfile(patientResponse);
        setRisk(riskResponse);
        setSignals(signalResponse);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patientId]);

  const updatePatient = async (payload) => {
    try {
      const updated = await sahayiApi.updatePatient(patientId, payload);
      setProfile((prev) => ({ ...prev, patient: updated }));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deletePatient = async () => {
    try {
      await sahayiApi.deletePatient(patientId);
      setProfile(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return { profile, risk, signals, loading, error, updatePatient, deletePatient };
}
