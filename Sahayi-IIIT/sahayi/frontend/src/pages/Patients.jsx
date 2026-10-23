import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Users, UserPlus, ArrowRight, Activity, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { usePatientData } from "../hooks/usePatientData";
import { useSearch } from "../context/SearchContext";

/**
 * Helper to ensure phone numbers have +91 prefix with a space for display.
 */
function formatPhone(phone) {
  if (!phone) return "";
  let clean = String(phone).replace(/whatsapp:/i, "").replace(/\s+/g, "");
  if (clean.startsWith("+91")) {
    return `+91 ${clean.slice(3)}`;
  }
  if (clean.startsWith("+")) {
    return clean.replace("+", "+ ");
  }
  if (clean.length === 10) return `+91 ${clean}`;
  return clean;
}

export default function Patients() {
  const { patients, loading, error, deletePatient } = usePatientData();
  const { searchQuery } = useSearch();
  const location = useLocation();
  const successResult = location.state?.success;
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const filteredPatients = patients?.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.patient_name?.toLowerCase().includes(query) ||
      String(p.patient_id).toLowerCase().includes(query)
    );
  });

  const handleDelete = async (e, patientId, name) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      return;
    }
    
    setDeletingId(patientId);
    setDeleteError("");
    try {
      await deletePatient(patientId);
    } catch (err) {
      console.error("Failed to delete patient", err);
      setDeleteError(`Failed to delete ${name}: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-400">
        <Activity className="mr-2 h-5 w-5 animate-spin" />
        <span className="ml-3 font-bold uppercase tracking-widest text-xs">Synchronizing Patient Registry...</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 pb-12 animate-slideIn">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-sahayi-primary font-bold text-xs uppercase tracking-widest mb-3">
             <div className="h-1.5 w-1.5 rounded-full bg-sahayi-primary" />
             Registry Overview
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Patients Directory
          </h1>
          <p className="mt-2 text-slate-500 font-medium">
            Currently monitoring <span className="text-sahayi-primary font-bold">{patients?.length || 0} patients</span> across all sectors.
          </p>
        </div>
        
        <Link 
          to="/setup" 
          className="flex items-center gap-2 rounded-lg bg-black dark:bg-white px-6 py-3 font-medium text-white dark:text-black shadow-sm transition hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-95"
        >
          <UserPlus size={20} strokeWidth={3} />
          Register New Patient
        </Link>
      </div>

      {(successResult || successResult?.message) && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-6 text-emerald-900 dark:text-emerald-100 animate-slideIn">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="text-emerald-500" size={24} />
            <h3 className="text-lg font-bold">{successResult?.message || "Patient Created Successfully"}</h3>
          </div>
          {successResult.voice_number && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-white dark:bg-black p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Voice Interaction Number</p>
                <p className="mt-1 text-xl font-bold">{formatPhone(successResult.voice_number)}</p>
              </div>
              <div className="bg-white dark:bg-black p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">WhatsApp Alert Number</p>
                <p className="mt-1 text-xl font-black">{formatPhone(successResult.whatsapp_number)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {deleteError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600 animate-slideIn">
          <AlertCircle size={20} />
          {deleteError}
        </div>
      )}

      {(!filteredPatients || !Array.isArray(filteredPatients) || filteredPatients.length === 0) ? (
        <div className="medical-card flex flex-col items-center justify-center py-32 text-center">
          <div className="rounded-full bg-slate-50 p-10 text-slate-200 border border-slate-100">
            <Users size={80} strokeWidth={1} />
          </div>
          <h3 className="mt-8 text-2xl font-black text-slate-900">
            {searchQuery ? "No Matching Patients" : "No Patients Found"}
          </h3>
          <p className="mt-3 max-w-sm text-slate-500 font-medium leading-relaxed">
            {searchQuery 
              ? `We couldn't find any results for "${searchQuery}". Try a different name or patient ID.`
              : "The patient registry is currently empty. Begin by adding a new patient record to enable AI-powered health tracking."}
          </p>
          {!searchQuery && (
            <Link 
              to="/setup" 
              className="mt-10 flex items-center gap-2 rounded-2xl bg-sahayi-primary px-8 py-4 font-bold text-white shadow-lg shadow-sahayi-primary/20 transition hover:bg-blue-700"
            >
              Start Registration
              <ArrowRight size={20} />
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredPatients.map((patient) => {
            if (!patient || !patient.patient_id) return null;
            
            const statusColor = patient.latest_status === 'red' ? 'bg-red-500' : 
                               patient.latest_status === 'yellow' ? 'bg-amber-500' : 
                               'bg-emerald-500';

            return (
              <Link 
                key={patient.patient_id} 
                to={`/patient/${patient.patient_id}`}
                className="medical-card group p-6 transition-all hover:border-neutral-400 dark:hover:border-neutral-500"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-500 group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-all font-bold text-xl uppercase">
                      {patient.patient_name ? patient.patient_name[0] : "?"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold text-neutral-900 dark:text-white transition-colors">
                        {patient.patient_name || "Unknown Patient"}
                      </h3>
                      <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mt-0.5">
                        ID: {String(patient.patient_id).slice(-8)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`h-3 w-3 rounded-full ${statusColor} shadow-lg shadow-current/20 ring-4 ring-white`} />
                    <button 
                      onClick={(e) => handleDelete(e, patient.patient_id, patient.patient_name)}
                      disabled={deletingId === patient.patient_id}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors bg-white rounded-xl border border-slate-100 shadow-sm"
                    >
                      {deletingId === patient.patient_id ? <Activity size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 p-3">
                    <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1">Status</p>
                    <p className={`text-xs font-bold uppercase tracking-widest ${patient.latest_status === 'red' ? 'text-red-600 dark:text-red-400' : 'text-neutral-700 dark:text-neutral-300'}`}>
                      {patient.latest_status || "Stable"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 p-3">
                    <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1">Risk Index</p>
                    <p className="text-sm font-bold text-neutral-900 dark:text-white">
                      {Number(patient.risk_score || 0).toFixed(1)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 p-3">
                     <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1">Primary Conditions</p>
                     <p className="text-xs text-neutral-700 dark:text-neutral-300 truncate">
                        {Array.isArray(patient.conditions) && patient.conditions.length > 0 
                          ? patient.conditions.join(", ") 
                          : "No documented conditions"}
                     </p>
                  </div>
                  {patient.latest_symptom && !patient.latest_symptom.toLowerCase().startsWith('no symptom') && (
                    <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 p-3">
                       <div className="flex justify-between items-center mb-1">
                         <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Latest Symptom</p>
                         {patient.severity && (
                           <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${patient.severity > 2 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                             Lvl {patient.severity}
                           </span>
                         )}
                       </div>
                       <p className="text-xs text-neutral-700 dark:text-neutral-300 line-clamp-2">
                          {patient.latest_symptom}
                       </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800 pt-4">
                  <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                    Access Medical Profile
                  </span>
                  <div className="text-neutral-300 dark:text-neutral-700 group-hover:text-neutral-900 dark:group-hover:text-white transition-all">
                    <ArrowRight size={16} strokeWidth={2} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
