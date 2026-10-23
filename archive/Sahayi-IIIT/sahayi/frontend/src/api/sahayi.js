/**
 * SAHAYI frontend API client.
 * @returns {object} Request helpers for all backend calls.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
let authToken = "";

function shouldBypassNgrokWarning() {
  /**
   * Detect ngrok-hosted API targets that need the browser warning bypass header.
   * @returns {boolean} True when the configured API URL targets ngrok.
   */
  try {
    if (!API_BASE_URL) return false;
    const url = new URL(API_BASE_URL);
    return /ngrok(-free)?\.app$/i.test(url.hostname);
  } catch (e) {
    console.warn("Invalid API_BASE_URL configured:", API_BASE_URL);
    return false;
  }
}

export function setAuthToken(token) {
  /**
   * Update the shared doctor auth token used by all API requests.
   * @param {string} token Firebase ID token.
   * @returns {void}
   */
  authToken = token;
}

async function request(path, options = {}) {
  /**
   * Send one authenticated API request with global error handling.
   * @param {string} path Backend path.
   * @param {object} options Fetch options.
   * @returns {Promise<any>} Parsed JSON or null.
   */
  const headers = {
    "Content-Type": "application/json",
    ...(shouldBypassNgrokWarning() ? { "ngrok-skip-browser-warning": "69420" } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const rawBody = response.status === 204 ? "" : await response.text();

  if (!response.ok) {
    throw new Error(rawBody || `Request failed: ${response.status}`);
  }

  if (!rawBody) {
    return null;
  }

  if (contentType.includes("application/json")) {
    return JSON.parse(rawBody);
  }

  throw new Error(`Expected JSON response but received ${contentType || "unknown content type"}`);
}

export const sahayiApi = {
  createPatient: (payload) => request("/patients", { method: "POST", body: JSON.stringify(payload) }),
  listDashboardPatients: () => request("/dashboard/patients"),
  getPopulation: () => request("/dashboard/population"),
  acknowledgeSummary: (summaryId) => request(`/dashboard/acknowledge/${summaryId}`, { method: "POST" }),
  escalatePatient: (patientId) => request(`/dashboard/escalate/${patientId}`, { method: "POST" }),
  getPatient: (patientId) => request(`/patients/${patientId}`),
  updatePatient: (patientId, payload) => request(`/patients/${patientId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deletePatient: (patientId) => request(`/patients/${patientId}`, { method: "DELETE" }),
  getSignals: (patientId) => request(`/patients/${patientId}/signals`),
  getRisk: (patientId) => request(`/patients/${patientId}/risk`),
};
