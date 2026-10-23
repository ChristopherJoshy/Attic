import SummaryCard from "../Alerts/SummaryCard";
import { BookOpen, Globe, Quote } from "lucide-react";

export default function ResearchPanel({ summary, population }) {
  const citations = summary?.citations || [];
  
  return (
    <section className="space-y-6">
      <SummaryCard summary={summary} />
      
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
            <BookOpen size={14} className="text-sahayi-primary" />
            Clinical Evidence & Population
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {/* Clinical Synthesis */}
            {summary?.narrative && (
              <div className="space-y-3 mb-6">
                <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider ml-1">Clinical Synthesis</p>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black p-4 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed shadow-sm">
                  {summary.narrative}
                </div>
              </div>
            )}

            {/* Citations Column */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter ml-1">Latest Citations</p>
              {citations.length === 0 ? (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 text-center">
                  <p className="text-xs text-neutral-500 italic">No citations available.</p>
                </div>
              ) : (
                citations.map((cite) => (
                  <article key={cite.pmid} className="group rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black p-3 transition hover:border-neutral-400 dark:hover:border-neutral-600">
                    <div className="flex gap-3">
                      <Quote size={12} className="text-sahayi-primary shrink-0 mt-1" />
                      <div>
                        <p className="text-xs font-bold text-slate-800 leading-snug">{cite.title}</p>
                        <div className="mt-2 flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase">
                          <span>PMID: {cite.pmid}</span>
                          <span className="h-1 w-1 rounded-full bg-slate-200" />
                          <span>{cite.year}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider ml-1">Population Insights</p>
            {population.length === 0 ? (
               <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 text-center">
                <p className="text-xs text-neutral-500 italic">No population data yet.</p>
              </div>
            ) : population.map((item) => (
              <article 
                key={`${item.id}-${item.created_at}`} 
                className={`rounded-lg border p-3 ${
                  item.research_gap 
                    ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20" 
                    : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-black"
                }`}
              >
                <p className={`text-xs font-bold ${item.research_gap ? "text-red-700" : "text-slate-800"}`}>
                  {item.pattern_json.cluster?.join(" + ")}
                </p>
                <div className="mt-2 flex items-center justify-between">
                   <span className="text-[9px] font-bold text-slate-400 uppercase">Frequency: {item.frequency}</span>
                   <span className={`text-[9px] font-black uppercase ${item.week_delta > 0 ? "text-red-500" : "text-emerald-500"}`}>
                     {item.week_delta > 0 ? '↑' : '↓'} Delta {item.week_delta}
                   </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
