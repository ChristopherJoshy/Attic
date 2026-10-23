import { useEffect, useState, startTransition } from "react";

import { sahayiApi } from "../api/sahayi";

/**
 * Manage dashboard patient and population data loading.
 * @param {object|null} trigger Live event that should refresh dashboard state.
 * @returns {object} Patients, population, loading state, error, and reload function.
 */
export function usePatientData(trigger) {
  const [patients, setPatients] = useState([]);
  const [population, setPopulation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [patientRows, populationRows] = await Promise.all([sahayiApi.listDashboardPatients(), sahayiApi.getPopulation()]);
      startTransition(() => {
        setPatients(patientRows);
        setPopulation(populationRows);
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (trigger?.event) {
      refresh();
    }
  }, [trigger]);

  async function deletePatient(patientId) {
    try {
      await sahayiApi.deletePatient(patientId);
      setPatients((current) => current.filter((p) => p.patient_id !== patientId));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  return { patients, population, loading, error, refresh, deletePatient };
}
