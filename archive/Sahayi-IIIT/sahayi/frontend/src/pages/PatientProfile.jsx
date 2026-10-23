import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { 
  User, 
  Phone, 
  Globe, 
  Stethoscope, 
  Pill, 
  AlertCircle, 
  Activity, 
  PhoneCall, 
  History, 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Edit3,
  ChevronRight,
  ShieldAlert,
  BrainCircuit
} from "lucide-react";

import EscalationButton from "../components/Alerts/EscalationButton";
import KnowledgeGraph from "../components/Dashboard/KnowledgeGraph";
import HypothesisPanel from "../components/Dashboard/HypothesisPanel";
import { usePatientRecord } from "../hooks/usePatientRecord";
import { usePatientData } from "../hooks/usePatientData";
import { useWebSocket } from "../hooks/useWebSocket";

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

/**
 * Helper to strip all prefixes for textboxes.
 */
function stripPhone(val) {
  if (!val) return "";
  return String(val)
    .replace(/whatsapp:/i, "")
    .replace(/^\+91\s*/, "")
    .trim();
}

/**
 * Helper to clean WhatsApp display.
 */
function formatWhatsApp(val) {
  return formatPhone(val);
}

/**
 * Patient profile page with current risk and signal history.
 * Now includes full view and edit functionality for patient details.
 * @returns {JSX.Element} Rendered patient profile page.
 */
export default function PatientProfile({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, risk, signals, loading, error, updatePatient, deletePatient } = usePatientRecord(id);
  const { events, latestEvent } = useWebSocket(user);
  const { population } = usePatientData(latestEvent);
  
  const summary = events.find((event) => event.event === "doctor_summary" && String(event.payload.patient_id) === String(id))?.payload || null;
  const hypothesis = events.find((event) => event.event === "hypothesis_generated" && String(event.payload.patient_id) === String(id))?.payload || null;
  const graph = summary?.knowledge_graph || null;
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const conditionInputRef = useRef(null);
  const medicineInputRef = useRef(null);

  useEffect(() => {
    if (profile?.patient) {
      setEditForm(JSON.parse(JSON.stringify(profile.patient)));
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-400">
        <Activity className="mr-2 h-5 w-5 animate-spin" />
        <span className="font-bold uppercase tracking-widest text-xs">Loading Medical Record...</span>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-6 text-sm font-bold text-red-600">
        <AlertCircle size={24} />
        {error}
      </div>
    );
  }

  // Safety fallback if profile or patient data is missing
  if (!profile || !profile.patient) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-slate-400 text-center p-8">
        <AlertCircle className="mb-4 h-12 w-12 text-slate-200" />
        <h3 className="text-lg font-black text-slate-900">Patient Record Incomplete</h3>
        <p className="mt-2 text-sm font-medium">This patient's medical record could not be fully synchronized.</p>
        <Link to="/patients" className="mt-6 text-sahayi-primary font-bold hover:underline">Return to Registry</Link>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePatient(editForm);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save patient details", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${profile.patient.name}? All medical records, signals, and call history will be permanently removed.`)) {
      return;
    }
    
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deletePatient();
      navigate("/patients", { state: { success: { message: `Patient ${profile.patient.name} deleted successfully.` } } });
    } catch (err) {
      console.error("Failed to delete patient", err);
      setDeleteError(`Failed to delete patient: ${err.message}`);
      setIsDeleting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (parent, field, value) => {
    setEditForm((prev) => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value },
    }));
  };

  const handleMedicineChange = (index, field, value) => {
    const newMedicines = [...editForm.medicines];
    newMedicines[index] = { ...newMedicines[index], [field]: value };
    setEditForm((prev) => ({ ...prev, medicines: newMedicines }));
  };

  const addMedicine = () => {
    setEditForm((prev) => ({
      ...prev,
      medicines: [...prev.medicines, { name: "", dose: "", frequency: "", timing: "" }],
    }));
    setTimeout(() => medicineInputRef.current?.focus(), 0);
  };

  const removeMedicine = (index) => {
    const newMedicines = editForm.medicines.filter((_, i) => i !== index);
    setEditForm((prev) => ({ ...prev, medicines: newMedicines }));
  };

  const addCondition = () => {
    setEditForm((prev) => ({
      ...prev,
      conditions: [...prev.conditions, ""],
    }));
    setTimeout(() => conditionInputRef.current?.focus(), 0);
  };

  const handleConditionChange = (index, value) => {
    const newConditions = [...editForm.conditions];
    newConditions[index] = value;
    setEditForm((prev) => ({ ...prev, conditions: newConditions }));
  };

  const removeCondition = (index) => {
    const newConditions = editForm.conditions.filter((_, i) => i !== index);
    setEditForm((prev) => ({ ...prev, conditions: newConditions }));
  };

  const handleRelativeChange = (index, field, value) => {
    const newRelatives = [...(editForm.relatives || [])];
    if (!newRelatives[index]) newRelatives[index] = {};
    newRelatives[index] = { ...newRelatives[index], [field]: value };
    setEditForm((prev) => ({ ...prev, relatives: newRelatives }));
  };

  const addRelative = () => {
    setEditForm((prev) => ({
      ...prev,
      relatives: [...(prev.relatives || []), { name: "", relationship: "", phone: "", whatsapp_number: "" }],
    }));
  };

  const removeRelative = (index) => {
    const newRelatives = (editForm.relatives || []).filter((_, i) => i !== index);
    setEditForm((prev) => ({ ...prev, relatives: newRelatives }));
  };

  return (
    <div className="w-full space-y-8 pb-12 animate-slideIn">
      {/* Header Section */}
      <div className="medical-card p-8 flex flex-wrap items-center justify-between gap-6 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-sahayi-primary" />
        
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-500 font-bold text-3xl">
            {profile.patient.name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2 text-neutral-500 font-medium text-xs uppercase tracking-wider mb-1">
              <ShieldAlert size={14} />
              Active Medical Profile
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {profile.patient.name}
            </h1>
            <div className="mt-2 flex items-center gap-4 text-sm font-bold text-slate-400">
              <span className="flex items-center gap-1.5"><Globe size={14} /> {profile.patient.language}</span>
              <span className="h-1 w-1 rounded-full bg-slate-200" />
              <span className="flex items-center gap-1.5"><Phone size={14} /> {formatPhone(profile.patient.phone_number)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium transition-all shadow-sm hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50"
              >
                {isSaving ? <Activity className="animate-spin" size={18} /> : <Save size={18} />}
                Save Changes
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditForm(JSON.parse(JSON.stringify(profile.patient)));
                }}
                className="flex items-center gap-2 px-6 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium transition-all"
              >
                <X size={18} />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-lg font-medium transition-all shadow-sm"
              >
                <Edit3 size={18} />
                Edit Record
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-6 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg font-medium transition-all"
              >
                {isDeleting ? <Activity className="animate-spin" size={18} /> : <Trash2 size={18} />}
                Delete
              </button>
              <EscalationButton patientId={Number(id)} />
            </>
          )}
        </div>
      </div>

      {deleteError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-6 text-sm font-bold text-red-600 animate-slideIn">
          <AlertCircle size={24} />
          {deleteError}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-8">
          {/* Main Details Section */}
          <section className="medical-card overflow-hidden">
            <div className="border-b border-sahayi-border bg-slate-50/50 px-8 py-4 flex items-center gap-2">
              <Stethoscope size={18} className="text-sahayi-primary" />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Clinical Overview</h2>
            </div>
            
            <div className="p-8 space-y-8">
              {isEditing ? (
                <div className="space-y-8">
                  {/* Edit Basic Info */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <Field label="Full Name" value={editForm.name} onChange={(v) => handleInputChange("name", v)} />
                    <Field label="Phone" value={stripPhone(editForm.phone_number)} onChange={(v) => handleInputChange("phone_number", v)} />
                    <Field label="Language" value={editForm.language} onChange={(v) => handleInputChange("language", v)} />
                  </div>

                  {/* Edit Conditions */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Medical Conditions</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {editForm.conditions.map((condition, index) => (
                        <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <input
                            type="text"
                            ref={index === editForm.conditions.length - 1 ? conditionInputRef : null}
                            value={condition}
                            onChange={(e) => handleConditionChange(index, e.target.value)}
                            className="flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none"
                            placeholder="Condition Name"
                          />
                          <button onClick={() => removeCondition(index)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={addCondition} className="mt-4 text-[10px] font-black uppercase tracking-widest text-sahayi-primary hover:underline flex items-center gap-1">
                      <Plus size={12} strokeWidth={3} /> Add Condition
                    </button>
                  </div>

                  {/* Edit Medicines */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Prescribed Medication</p>
                    <div className="space-y-4">
                      {editForm.medicines.map((med, index) => (
                        <div key={index} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 relative group">
                          <button onClick={() => removeMedicine(index)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                          </button>
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Field 
                              label="Name" 
                              value={med.name} 
                              inputRef={index === editForm.medicines.length - 1 ? medicineInputRef : null}
                              onChange={(v) => handleMedicineChange(index, "name", v)} 
                            />
                            <Field label="Dose" value={med.dose} onChange={(v) => handleMedicineChange(index, "dose", v)} />
                            <Field label="Freq" value={med.frequency} onChange={(v) => handleMedicineChange(index, "frequency", v)} />
                            <Field label="Timing" value={med.timing} onChange={(v) => handleMedicineChange(index, "timing", v)} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={addMedicine} className="mt-4 text-[10px] font-black uppercase tracking-widest text-sahayi-primary hover:underline flex items-center gap-1">
                      <Plus size={12} strokeWidth={3} /> Add Medicine
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Show Conditions */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Documented Conditions</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.patient.conditions.map((condition, i) => (
                        <span key={i} className="px-4 py-2 bg-slate-50 text-slate-700 rounded-xl text-sm font-black border border-slate-100">
                          {condition}
                        </span>
                      ))}
                      {profile.patient.conditions.length === 0 && <span className="text-sm font-bold text-slate-400 italic">No conditions documented.</span>}
                    </div>
                  </div>

                  {/* Show Medicines */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Active Medications</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {profile.patient.medicines.map((med, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
                          <div className="h-10 w-10 rounded-xl bg-blue-50 text-sahayi-primary flex items-center justify-center">
                            <Pill size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{med.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                              {med.dose} • {med.frequency} • {med.timing}
                            </p>
                          </div>
                        </div>
                      ))}
                      {profile.patient.medicines.length === 0 && <div className="text-sm font-bold text-slate-400 italic col-span-2">No active medications.</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Contact Information */}
          <section className="medical-card overflow-hidden">
             <div className="border-b border-sahayi-border bg-slate-50/50 px-8 py-4 flex items-center gap-2">
                <Phone size={18} className="text-sahayi-primary" />
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Support Network</h2>
             </div>
             <div className="p-8">
               {isEditing ? (
                 <div className="grid gap-8 md:grid-cols-2">
                   <div className="space-y-4">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Emergency Contact</p>
                     <Field label="Contact Name" value={editForm.emergency_contact.name} onChange={(v) => handleNestedChange("emergency_contact", "name", v)} />
                     <Field label="Phone" value={stripPhone(editForm.emergency_contact.phone)} onChange={(v) => handleNestedChange("emergency_contact", "phone", v)} />
                   </div>
                   <div className="space-y-4">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Relatives</p>
                     <div className="space-y-4">
                       {(editForm.relatives || []).map((relative, index) => (
                         <div key={index} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 relative group">
                           <button onClick={() => removeRelative(index)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors">
                             <Trash2 size={16} />
                           </button>
                           <div className="space-y-4">
                             <Field label="Relative Name" value={relative.name} onChange={(v) => handleRelativeChange(index, "name", v)} />
                             <Field label="Relationship" value={relative.relationship} onChange={(v) => handleRelativeChange(index, "relationship", v)} />
                             <Field label="Relative Phone" value={stripPhone(relative.phone)} onChange={(v) => handleRelativeChange(index, "phone", v)} />
                             <Field label="WhatsApp" value={stripPhone(relative.whatsapp_number)} onChange={(v) => handleRelativeChange(index, "whatsapp_number", v)} />
                           </div>
                         </div>
                       ))}
                     </div>
                     <button onClick={addRelative} className="text-[10px] font-black uppercase tracking-widest text-sahayi-primary hover:underline flex items-center gap-1">
                       <Plus size={12} strokeWidth={3} /> Add Relative
                     </button>
                   </div>
                 </div>
               ) : (
                 <div className="grid gap-8 md:grid-cols-2">
                    <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Emergency Contact</p>
                       <h4 className="text-lg font-black text-slate-900">{profile.patient.emergency_contact.name}</h4>
                       <p className="text-sm font-bold text-slate-500 mt-1">{formatPhone(profile.patient.emergency_contact.phone)}</p>
                    </div>
                    <div className="space-y-4">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Relatives</p>
                       {(!profile.patient.relatives || profile.patient.relatives.length === 0) && (
                         <div className="text-sm font-bold text-slate-400 italic">No relatives documented.</div>
                       )}
                       {(profile.patient.relatives || []).map((relative, index) => (
                         <div key={index} className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{relative.relationship || "Relative"}</p>
                           <h4 className="text-lg font-black text-slate-900">{relative.name || "Unknown"}</h4>
                           <p className="text-sm font-bold text-slate-500 mt-1">{formatPhone(relative.phone)}</p>
                           {relative.whatsapp_number && (
                             <div className="mt-4 flex items-center gap-2 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                               <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                               WHATSAPP: {formatWhatsApp(relative.whatsapp_number)}
                             </div>
                           )}
                         </div>
                       ))}
                    </div>
                 </div>
               )}
             </div>
          </section>

          {/* Knowledge Graph / Medical Context */}
          <div className="medical-card overflow-hidden">
            <div className="border-b border-sahayi-border bg-slate-50/50 px-6 py-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              <BrainCircuit size={16} className="text-sahayi-primary" />
              Medical Knowledge Mapping
            </div>
            <div className="p-2">
              <KnowledgeGraph graph={graph} />
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Risk Card */}
          <section className="medical-card p-8 bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sahayi-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Risk Assessment</h2>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${risk?.status === 'red' ? 'bg-red-500/20 text-red-400' : risk?.status === 'yellow' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {risk?.status || "Stable"}
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-black">{risk?.score?.toFixed(2) || "0.00"}</span>
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Indices</span>
            </div>

            <p className="mt-4 text-sm font-bold text-slate-300 flex items-center gap-2">
              <Activity size={16} className="text-sahayi-primary" />
              Current Trend: <span className="text-white uppercase">{risk?.trend || "Constant"}</span>
            </p>

            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Severity</p>
                <p className="text-lg font-black">{risk?.breakdown?.severity_component || 0}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Duration</p>
                <p className="text-lg font-black">{risk?.breakdown?.duration_component || 0}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Change</p>
                <p className="text-lg font-black">{risk?.breakdown?.change_component || 0}</p>
              </div>
            </div>
          </section>
          
          {/* Call History */}
          <section className="medical-card overflow-hidden">
            <div className="border-b border-sahayi-border bg-slate-50/50 px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                <PhoneCall size={16} className="text-sahayi-primary" />
                Call Logs
              </div>
              <span className="text-[10px] font-bold text-sahayi-primary bg-sahayi-primary/5 px-2 py-0.5 rounded-full">
                {profile.calls.length} Total
              </span>
            </div>
            
            <div className="p-4 space-y-3">
              {profile.calls.map((call) => (
                <div key={call.session_id} className="group p-4 rounded-2xl border border-slate-100 bg-white transition-all hover:border-sahayi-primary/20 hover:shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-wider">{call.status}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {new Date(call.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {call.risk_score > 0 && (
                      <div className="text-right">
                        <p className="text-sm font-black text-rose-600">{call.risk_score.toFixed(1)}</p>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">Score</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {profile.calls.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm font-bold text-slate-400 italic">No communication history recorded.</p>
                </div>
              )}
            </div>
          </section>

          {/* Active Hypotheses */}
          <div className="medical-card overflow-hidden">
            <div className="border-b border-sahayi-border bg-slate-50/50 px-6 py-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              <BrainCircuit size={16} className="text-sahayi-primary" />
              Active Hypotheses
            </div>
            <HypothesisPanel hypothesis={hypothesis} population={population} />
          </div>
        </div>
      </div>

      {/* Signals Timeline */}
      <section className="medical-card overflow-hidden">
        <div className="border-b border-sahayi-border bg-slate-50/50 px-8 py-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
          <History size={18} className="text-sahayi-primary" />
          Clinical Signal Timeline
        </div>
        
        <div className="p-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {signals.map((signal) => (
              <div key={signal.id} className="relative p-5 rounded-3xl border border-slate-100 bg-slate-50/50 transition-all hover:bg-white hover:shadow-md group">
                {signal.red_flag && (
                  <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/40 animate-pulse">
                    <AlertCircle size={14} strokeWidth={3} />
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-sahayi-primary/10 text-sahayi-primary flex items-center justify-center">
                      <Activity size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Signal Log</p>
                      <p className="text-[10px] font-bold text-slate-300 mt-1">
                        {new Date(signal.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${signal.severity > 3 ? 'bg-rose-500/10 text-rose-600' : 'bg-blue-500/10 text-blue-600'}`}>
                    LVL {signal.severity}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(signal).filter(([key, val]) => !['session_id', 'patient_id', 'patient_name', 'red_flag', 'confidence', 'created_at', 'id', 'source_text'].includes(key) && val !== null && val !== undefined && val !== "").map(([key, val]) => (
                    <div key={key} className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{key.replace('_', ' ')}</p>
                      <p className="text-sm font-black text-slate-700">{String(val)}</p>
                    </div>
                  ))}
                </div>

                {signal.red_flag && (
                  <div className="mt-4 pt-3 border-t border-rose-100 flex items-center gap-2 text-rose-600 text-[10px] font-black uppercase tracking-widest">
                    <ShieldAlert size={12} />
                    Critical Red Flag Alert
                  </div>
                )}
              </div>
            ))}
            {signals.length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                <p className="text-sm font-bold text-slate-400 italic">No health signals synchronized for this patient.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, inputRef }) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider ml-1">{label}</span>
      <input 
        ref={inputRef}
        className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black px-4 py-3 text-neutral-900 dark:text-white outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white font-medium" 
        value={value} 
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)} 
      />
    </label>
  );
}
