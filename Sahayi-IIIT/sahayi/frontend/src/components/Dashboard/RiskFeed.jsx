import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ArrowRight } from "lucide-react";

const trendIcon = { 
  WORSENING: <TrendingUp size={16} className="text-red-500" />, 
  STABLE: <Minus size={16} className="text-slate-400" />, 
  IMPROVING: <TrendingDown size={16} className="text-emerald-500" /> 
};

const statusColors = { 
  green: "bg-emerald-500", 
  yellow: "bg-amber-500", 
  red: "bg-red-500" 
};

export default function RiskFeed({ patients, riskEvents }) {
  // Defensive checks to prevent app crash if data is missing or malformed
  if (!Array.isArray(patients) || !Array.isArray(riskEvents)) {
    return (
      <section className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
        Synchronizing Risk Metrics...
      </section>
    );
  }

  const liveMap = new Map(riskEvents.map((event) => [event?.patient_id, event]));
  const cards = patients.map((patient) => ({ ...patient, ...(liveMap.get(patient?.patient_id) || {}) }));
  
  return (
    <section className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
           Patient Risk Surface
        </h3>
        <span className="text-xs font-medium text-neutral-600 bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-800 px-3 py-1 rounded-full">
          {cards.length} Monitored
        </span>
      </div>

      <div className="space-y-4">
        {cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 py-12 text-center">
            <p className="text-sm text-neutral-500">No active patient data available.</p>
          </div>
        ) : cards.map((card) => (
          <Link 
            key={card.patient_id} 
            to={`/patient/${card.patient_id}`} 
            className="group block rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black p-4 transition-all hover:border-neutral-400 dark:hover:border-neutral-600"
          >
            <div className="flex items-center gap-4">
              <div className={`h-10 w-1 rounded-full ${statusColors[card.status || card.latest_status || "green"]}`} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-bold text-neutral-900 dark:text-white transition-colors">
                    {card.patient_name}
                  </h3>
                  {(card.is_anomaly || card.status === 'red' || card.latest_status === 'red') && (
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                   {trendIcon[card.trend || "STABLE"]}
                   <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                     {card.trend || "STABLE"}
                   </span>
                </div>
              </div>

              <div className="text-right flex items-center gap-4">
                <div>
                   <p className="text-lg font-bold text-neutral-900 dark:text-white leading-none text-right">
                     {Number(card.score ?? card.risk_score ?? 0).toFixed(1)}
                   </p>
                   <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mt-1">
                     SCORE
                   </p>
                </div>
                <div className="text-neutral-300 dark:text-neutral-700 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                  <ArrowRight size={18} strokeWidth={2} />
                </div>
              </div>
            </div>

            {/* Hidden Stats on Hover */}
            <div className="h-0 overflow-hidden opacity-0 group-hover:h-auto group-hover:opacity-100 group-hover:mt-4 transition-all duration-300">
               <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-neutral-800 pt-3">
                  {card.latest_symptom && !card.latest_symptom.toLowerCase().startsWith('no symptom') && (
                    <div className="rounded-md bg-neutral-50 dark:bg-neutral-900/50 p-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Latest Symptom</p>
                      <p className="text-xs text-neutral-700 dark:text-neutral-300 line-clamp-2">
                        {card.latest_symptom}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-4">
                     <div className="flex-1">
                       <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Severity</p>
                       <p className="mt-1 text-xs font-black text-slate-700 dark:text-neutral-300">{card.breakdown?.severity_component ?? card.severity ?? 0}</p>
                     </div>
                     <div className="flex-1">
                       <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Duration</p>
                       <p className="mt-1 text-xs font-black text-slate-700 dark:text-neutral-300">{card.breakdown?.duration_component ?? 0}</p>
                     </div>
                     <div className="flex-1">
                       <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Z-Score</p>
                       <p className="mt-1 text-xs font-black text-slate-700 dark:text-neutral-300">{card.z_score || "N/A"}</p>
                     </div>
                  </div>
               </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
