import { Speech, ShieldCheck, FileText, Send, Microscope } from "lucide-react";
import AgentTimelineGraph from "./AgentTimelineGraph";

const AGENT_CONFIG = [
  { id: "talker", name: "Voice Interface Agent", icon: Speech, description: "Voice Interface", color: "text-blue-500", bg: "bg-blue-50" },
  { id: "note_taker", name: "Clinical Signal Extractor", icon: FileText, description: "Signal Extractor", color: "text-amber-500", bg: "bg-amber-50" },
  { id: "safety", name: "Clinical Validator (Safety)", icon: ShieldCheck, description: "Clinical Validator", color: "text-emerald-500", bg: "bg-emerald-50" },
  { id: "messenger", name: "Context Summarizer", icon: Send, description: "Context Summarizer", color: "text-indigo-500", bg: "bg-indigo-50" },
  { id: "spotter", name: "Population Risk Analyzer", icon: Microscope, description: "Population Risk", color: "text-purple-500", bg: "bg-purple-50" },
];

export default function AgentDebugPanel({ events, patients = [] }) {
  // Determine which agents are currently active based on the very latest event
  const latestEvent = events[0]?.event;

  const getPatientName = (patientId) => {
    if (!patientId) return "System";
    const patient = patients.find(p => p.id === patientId || p.patient_id === patientId);
    return patient ? patient.name : `Patient ${patientId.substring(0, 8)}`;
  };
  
  const activeAgents = {
    talker: latestEvent === "call_started" || latestEvent === "call_ended",
    note_taker: latestEvent === "new_signal",
    safety: latestEvent === "safety_check" || latestEvent === "doctor_summary", 
    messenger: latestEvent === "doctor_summary",
    spotter: latestEvent === "risk_update" || latestEvent === "hypothesis_generated"
  };

  return (
    <div className="space-y-6 animate-slideIn">
      {/* 5 Superheroes Live Status */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {AGENT_CONFIG.map((agent) => {
          const isActive = activeAgents[agent.id];
          return (
            <div 
              key={agent.id} 
              className={`rounded-2xl border p-3 flex flex-col items-center text-center transition-all ${
                isActive ? `border-${agent.color.split('-')[1]}-200 bg-white shadow-md scale-105` : `border-slate-100 ${agent.bg} opacity-70`
              }`}
            >
              <div className={`relative mb-2 h-10 w-10 rounded-full flex items-center justify-center ${isActive ? agent.color + ' bg-' + agent.color.split('-')[1] + '-100' : 'text-slate-400 bg-slate-100'}`}>
                {isActive && (
                  <div className={`absolute inset-0 rounded-full animate-ping opacity-25 bg-${agent.color.split('-')[1]}-500`} />
                )}
                <agent.icon size={20} />
              </div>
              <p className={`text-[10px] font-black uppercase tracking-tighter ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                {agent.name}
              </p>
              <p className="text-[9px] font-bold text-slate-400 mt-0.5">{agent.description}</p>
              
              {isActive && (
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${agent.bg} ${agent.color}`}>
                  Processing...
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* D3 History Graph */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Agent Activity Graph</h3>
          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" /> Live Telemetry
          </span>
        </div>
        <AgentTimelineGraph events={events} patients={patients} />
      </div>
      
      {/* Structured Event Log */}
      <div className="rounded-2xl border border-slate-100 bg-slate-900 p-4 shadow-inner">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">System Event Telemetry</h3>
        <div className="overflow-x-auto max-h-60">
          <table className="w-full text-left text-xs font-mono text-slate-300">
            <thead className="border-b border-slate-800 text-[10px] uppercase text-slate-500 sticky top-0 bg-slate-900">
              <tr>
                <th className="py-2 px-3 font-semibold">Timestamp</th>
                <th className="py-2 px-3 font-semibold">Node</th>
                <th className="py-2 px-3 font-semibold">Action</th>
                <th className="py-2 px-3 font-semibold">Payload Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {events.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-4 text-center text-slate-600">Waiting for live agent activity...</td>
                </tr>
              ) : (
                events.slice(0, 15).map((e, i) => {
                  const patientId = e.payload?.patient_id || e.payload?.id;
                  const patientName = getPatientName(patientId);
                  
                  // Helper to cleanly format payload
                  const formatPayload = (event, payload) => {
                    if (!payload) return "No data";
                    switch(event) {
                      case "new_signal": return `Symptoms: ${payload.fatigue ? 'Fatigue ' : ''}${payload.chest_pain ? 'Chest-Pain ' : ''}`;
                      case "risk_update": return `Risk Score: ${(payload.score * 100).toFixed(1)}% - ${payload.level}`;
                      case "safety_check": return `Safe: ${payload.safe_response ? 'Yes' : 'No'}`;
                      case "doctor_summary": return "Summary Generated";
                      case "call_started": return "Session Initialized";
                      case "call_ended": return "Session Terminated";
                      default: return Object.keys(payload).slice(0, 3).join(", ") + "...";
                    }
                  };

                  return (
                    <tr key={i} className="group hover:bg-slate-800/50 transition-colors">
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                        [{new Date(e.occurred_at || Date.now()).toLocaleTimeString()}]
                      </td>
                      <td className="py-2 px-3 text-white font-bold whitespace-nowrap">
                        {patientName}
                      </td>
                      <td className="py-2 px-3 text-blue-400 whitespace-nowrap">
                        {e.event}
                      </td>
                      <td className="py-2 px-3 group-hover:text-emerald-300 transition-colors truncate max-w-xs cursor-help" title={JSON.stringify(e.payload)}>
                        {formatPayload(e.event, e.payload)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}