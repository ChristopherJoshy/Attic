import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Plus, Minus, Send, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { usePatientSetup } from "../hooks/usePatientSetup";

const emptyMedicine = { name: "", dose: "", frequency: "", timing: "" };

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
 * Patient onboarding page for doctor-entered setup information.
 * @returns {JSX.Element} Rendered patient setup page.
 */
export default function Setup() {
  const [form, setForm] = useState({
    name: "",
    language: "ml-IN",
    phone_number: "",
    registration_number: "",
    conditions: [""],
    medicines: [{ ...emptyMedicine }],
    emergency_contact: { name: "", phone: "", relationship: "emergency" },
    doctor_contact: { name: "", phone: "", relationship: "doctor" },
    relatives: [{ name: "", relationship: "", phone: "", whatsapp_number: "" }],
  });
  const navigate = useNavigate();
  const { submit, loading, error } = usePatientSetup();

  const conditionInputRef = useRef(null);
  const medicineInputRef = useRef(null);

  function updateMedicine(index, field, value) {
    setForm((current) => ({
      ...current,
      medicines: current.medicines.map((medicine, medicineIndex) =>
        medicineIndex === index ? { ...medicine, [field]: value } : medicine
      ),
    }));
  }

  function addMedicine() {
    setForm({ ...form, medicines: [...form.medicines, { ...emptyMedicine }] });
    setTimeout(() => medicineInputRef.current?.focus(), 0);
  }

  function removeMedicine(index) {
    if (form.medicines.length > 1) {
      setForm({
        ...form,
        medicines: form.medicines.filter((_, i) => i !== index),
      });
    }
  }

  function updateCondition(index, value) {
    const newConditions = [...form.conditions];
    newConditions[index] = value;
    setForm({ ...form, conditions: newConditions });
  }

  function addCondition() {
    setForm({ ...form, conditions: [...form.conditions, ""] });
    setTimeout(() => conditionInputRef.current?.focus(), 0);
  }

  function removeCondition(index) {
    if (form.conditions.length > 1) {
      setForm({
        ...form,
        conditions: form.conditions.filter((_, i) => i !== index),
      });
    }
  }

  function updateRelative(index, field, value) {
    setForm((current) => ({
      ...current,
      relatives: current.relatives.map((relative, relativeIndex) =>
        relativeIndex === index ? { ...relative, [field]: value } : relative
      ),
    }));
  }

  function addRelative() {
    setForm({ ...form, relatives: [...form.relatives, { name: "", relationship: "", phone: "", whatsapp_number: "" }] });
  }

  function removeRelative(index) {
    if (form.relatives.length > 1) {
      setForm({
        ...form,
        relatives: form.relatives.filter((_, i) => i !== index),
      });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      ...form,
      conditions: form.conditions.filter(Boolean),
    };
    const res = await submit(payload);
    if (res) {
      navigate("/patients", { state: { success: res } });
    }
  }

  return (
    <div className="mx-auto max-w-7xl pb-12 animate-slideIn">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sahayi-primary font-bold text-xs uppercase tracking-widest mb-3">
          <UserPlus size={14} />
          Onboarding Process
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Register New Patient
        </h1>
        <p className="mt-2 text-slate-500 font-medium">
          Enter the patient's medical details and contact information to create their Sahayi profile.
        </p>
      </div>

      <div className="medical-card overflow-hidden">
        <div className="border-b border-sahayi-border bg-slate-50/50 px-8 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Comprehensive Patient Record
          </p>
        </div>

        <form className="p-8 space-y-10" onSubmit={handleSubmit}>
          {/* Basic Information */}
          <section>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
              <div className="h-4 w-1 bg-sahayi-primary rounded-full" />
              Basic Information
            </h3>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Patient Full Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Preferred Language" value={form.language} onChange={(v) => setForm({ ...form, language: v })} />
              <Field label="Phone Number" value={stripPhone(form.phone_number)} onChange={(v) => setForm({ ...form, phone_number: v })} />
              <Field label="Registration Number" value={form.registration_number} onChange={(v) => setForm({ ...form, registration_number: v })} placeholder="Optional medical ID" />
            </div>
          </section>

          {/* Medical Conditions */}
          <section>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
              <div className="h-4 w-1 bg-sahayi-primary rounded-full" />
              Medical Conditions
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {form.conditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100 focus-within:border-sahayi-primary/30 transition-all">
                  <input
                    type="text"
                    ref={index === form.conditions.length - 1 ? conditionInputRef : null}
                    value={condition}
                    onChange={(e) => updateCondition(index, e.target.value)}
                    className="flex-1 bg-transparent px-3 py-2 text-sm font-bold text-slate-700 outline-none placeholder:text-slate-300"
                    placeholder="Condition Name"
                  />
                  {form.conditions.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => removeCondition(index)} 
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button 
                type="button" 
                onClick={addCondition}
                className="mt-4 flex items-center gap-1.5 text-[10px] font-black text-sahayi-primary hover:text-blue-700 transition-colors uppercase tracking-widest"
              >
                <Plus size={14} strokeWidth={3} />
                Add Condition
              </button>
          </section>

          {/* Medications */}
          <section>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <div className="h-4 w-1 bg-sahayi-primary rounded-full" />
                  Prescribed Medications
                </h3>
             
             <div className="space-y-4">
                {form.medicines.map((medicine, index) => (
                  <div key={index} className="relative rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
                    {form.medicines.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => removeMedicine(index)}
                        className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Field 
                        label="Medicine Name" 
                        value={medicine.name} 
                        inputRef={index === form.medicines.length - 1 ? medicineInputRef : null}
                        onChange={(v) => updateMedicine(index, "name", v)} 
                      />
                      <Field label="Dosage" value={medicine.dose} onChange={(v) => updateMedicine(index, "dose", v)} />
                      <Field label="Frequency" value={medicine.frequency} onChange={(v) => updateMedicine(index, "frequency", v)} />
                      <Field label="Timing" value={medicine.timing} onChange={(v) => updateMedicine(index, "timing", v)} />
                    </div>
                  </div>
                ))}
             </div>
             <button 
                  type="button" 
                  onClick={addMedicine}
                  className="mt-4 flex items-center gap-1.5 text-[10px] font-black text-sahayi-primary hover:text-blue-700 transition-colors uppercase tracking-widest"
                >
                  <Plus size={14} strokeWidth={3} />
                  Add Medicine
                </button>
          </section>

          {/* Contact Information */}
          <section>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
              <div className="h-4 w-1 bg-sahayi-primary rounded-full" />
              Emergency & Support Contacts
            </h3>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Emergency Contact Name" value={form.emergency_contact.name} onChange={(v) => setForm({ ...form, emergency_contact: { ...form.emergency_contact, name: v } })} />
              <Field label="Emergency Contact Phone" value={stripPhone(form.emergency_contact.phone)} onChange={(v) => setForm({ ...form, emergency_contact: { ...form.emergency_contact, phone: v } })} />
              <div className="md:col-span-2 h-[1px] bg-slate-100 my-2" />
              <Field label="Treating Doctor Name" value={form.doctor_contact.name} onChange={(v) => setForm({ ...form, doctor_contact: { ...form.doctor_contact, name: v } })} />
              <Field label="Doctor Contact Phone" value={stripPhone(form.doctor_contact.phone)} onChange={(v) => setForm({ ...form, doctor_contact: { ...form.doctor_contact, phone: v } })} />
              <div className="md:col-span-2 h-[1px] bg-slate-100 my-2" />
              <div className="md:col-span-2">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider mb-4">Relatives</h4>
                <div className="space-y-4">
                  {form.relatives.map((relative, index) => (
                    <div key={index} className="relative rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
                      {form.relatives.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => removeRelative(index)}
                          className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                      <div className="grid gap-6 md:grid-cols-2">
                        <Field label="Relative Name" value={relative.name} onChange={(v) => updateRelative(index, "name", v)} />
                        <Field label="Relative Relationship" value={relative.relationship} onChange={(v) => updateRelative(index, "relationship", v)} placeholder="e.g. Son, Daughter, Spouse" />
                        <Field label="Relative Phone" value={stripPhone(relative.phone)} onChange={(v) => updateRelative(index, "phone", v)} />
                        <Field label="Relative WhatsApp Number" value={stripPhone(relative.whatsapp_number)} onChange={(v) => updateRelative(index, "whatsapp_number", v)} />
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  type="button" 
                  onClick={addRelative}
                  className="mt-4 flex items-center gap-1.5 text-[10px] font-black text-sahayi-primary hover:text-blue-700 transition-colors uppercase tracking-widest"
                >
                  <Plus size={14} strokeWidth={3} />
                  Add Relative
                </button>
              </div>
            </div>
          </section>

          <div className="pt-6">
            <button 
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-black dark:bg-white py-4 font-medium text-white dark:text-black shadow-sm transition hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50" 
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <Send size={18} />
                  Create Patient Profile
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600 animate-slideIn">
          <AlertCircle size={20} />
          {error}
        </div>
      )}
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
