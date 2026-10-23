import { Link } from "react-router-dom";
import { User, Activity, ArrowRight } from "lucide-react";

export default function PatientCard({ activeCall, signals, connectionState }) {
  const latestSignals = signals.slice(0, 4);
  
  return (
    <section className="p-6">
      <div className="flex items-center gap-6">
        <div className="relative">
          <div className={`absolute inset-0 rounded-full ${activeCall ? "animate-pulseRing bg-emerald-400/20" : "bg-neutral-100 dark:bg-neutral-800"}`} />
          <div className={`relative flex h-16 w-16 items-center justify-center rounded-full border transition-colors ${
            activeCall ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30" : "border-neutral-200 bg-white text-neutral-400 dark:border-neutral-800 dark:bg-black"
          }`}>
            <User size={40} strokeWidth={1.5} />
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
              {activeCall?.patient_name || "Idle System"}
            </h2>
            {activeCall && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-700">
                <Activity size={12} />
                LIVE CALL
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-bold text-slate-500">
            {activeCall 
              ? `${activeCall.language} Session • ${activeCall.location || 'Remote'}`
              : `Awaiting incoming telemetry • Status: ${connectionState}`
            }
          </p>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Signal Extraction</h3>
          <div className="h-[1px] flex-1 bg-neutral-100 dark:bg-neutral-800 mx-4" />
        </div>
        
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {latestSignals.length === 0 ? (
            <div className="col-span-2 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 py-8 text-center">
              <p className="text-sm text-neutral-500">
                Real-time symptoms and clinical signals will appear here.
              </p>
            </div>
          ) : (
            latestSignals.map((signal, idx) => (
              <div 
                key={`${signal.session_id}-${idx}`} 
                className="group relative rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 transition hover:bg-white dark:hover:bg-neutral-900"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-sahayi-primary">
                    Symptom Detected
                  </span>
                   <span className={`h-2 w-2 rounded-full ${
                     signal.red_flag ? 'bg-red-500' : 'bg-amber-500'
                   }`} />
                 </div>
                 <p className="text-sm font-bold text-slate-800 dark:text-neutral-200">
                   {signal.patient_name || activeCall?.patient_name}
                 </p>
                 <div className="mt-2 flex flex-wrap gap-2">
                   {Object.entries(signal).filter(([key, val]) => !['session_id', 'patient_id', 'patient_name', 'red_flag', 'confidence', 'created_at', 'id', 'source_text'].includes(key) && val !== null && val !== undefined && val !== "").map(([key, val]) => (
                     <span key={key} className="rounded-lg bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-neutral-300 uppercase">
                       {key.replace('_', ' ')}: {String(val)}
                     </span>
                   ))}
                 </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
