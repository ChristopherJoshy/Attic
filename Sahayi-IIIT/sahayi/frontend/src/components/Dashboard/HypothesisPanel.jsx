import { BrainCircuit, AlertCircle, TrendingUp, FlaskConical } from "lucide-react";

export default function HypothesisPanel({ hypothesis, population }) {
  const gaps = population.filter((item) => item.research_gap);
  
  return (
    <section className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
          <FlaskConical size={14} className="text-sahayi-primary" />
          Active Hypothesis Engine
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-5 relative overflow-hidden">
        {/* Subtle decorative background icon */}
        <BrainCircuit size={60} className="absolute -right-4 -bottom-4 text-neutral-200 dark:text-neutral-800 opacity-50" />
        
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-blue-900 uppercase">Active Hypothesis</h3>
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-black text-sahayi-primary shadow-sm">
            <TrendingUp size={12} />
            CONFIDENCE: {hypothesis?.confidence || "PENDING"}
          </div>
        </div>
        
        <p className="text-sm font-bold text-blue-800/80 leading-relaxed italic relative z-10">
          "{hypothesis?.statement || "Insufficient evidence to generate a testable clinical hypothesis."}"
        </p>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Research Gaps</h3>
          <div className="h-[1px] flex-1 bg-slate-100 mx-4" />
        </div>
        
        <div className="space-y-3">
          {gaps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 py-6 text-center">
              <p className="text-xs text-neutral-500 italic">No population gaps identified.</p>
            </div>
          ) : (
            gaps.map((gap) => (
              <div 
                key={`${gap.id}-${gap.created_at}`} 
                className="flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-3 text-sm font-bold text-red-700 dark:text-red-400 animate-slideIn"
              >
                <AlertCircle size={14} className="shrink-0" />
                <p className="truncate">{gap.pattern_json.cluster?.join(" + ")}</p>
                <span className="ml-auto text-[10px] font-black uppercase tracking-tighter shrink-0 bg-red-100 px-2 py-1 rounded-lg">
                  HIGH SEVERITY
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
