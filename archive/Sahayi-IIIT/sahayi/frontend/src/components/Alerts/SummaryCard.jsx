import { FileText, ClipboardList } from "lucide-react";

export default function SummaryCard({ summary }) {
  if (!summary) {
    return (
      <div className="medical-card p-6 flex items-center gap-4 border-dashed border-2">
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-400">
           <ClipboardList size={24} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-500 italic">No clinical summary has been generated yet.</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
            System will summarize once sufficient telemetry is available.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="medical-card overflow-hidden">
      <div className="border-b border-sahayi-border bg-slate-50/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
          <FileText size={14} className="text-sahayi-primary" />
          Clinical AI Summary
        </div>
        <div className="flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-[10px] font-black text-red-700">
          RISK SCORE: {summary.risk_score}
        </div>
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-black text-slate-900 mb-4">{summary.patient_name}</h3>
        <div className="max-h-60 overflow-y-auto scrollbar-thin pr-2">
           <p className="whitespace-pre-line text-sm font-bold text-slate-700 leading-relaxed text-justify">
             {summary.summary_text}
           </p>
        </div>
      </div>
    </div>
  );
}
