import React from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { usePatientData } from "../hooks/usePatientData";
import AgentDebugPanel from "../components/Dashboard/AgentDebug/AgentDebugPanel";
import { Bug } from "lucide-react";

export default function Debug({ user }) {
  const { events, connectionState } = useWebSocket(user);
  const { patients } = usePatientData(events[0]);

  return (
    <div className="w-full space-y-8 pb-12 animate-slideIn">
      {/* Header Section */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-sahayi-primary font-bold text-xs uppercase tracking-widest">
            <div className={`h-1.5 w-1.5 rounded-full ${connectionState === "connected" ? "bg-sahayi-primary animate-pulse" : "bg-red-500"}`} />
            Live System Status: {connectionState}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <Bug className="text-sahayi-primary" size={32} />
            Agent Debug View
          </h1>
          <p className="mt-2 text-slate-500 font-medium">
            Monitor the multi-agent system execution in real-time.
          </p>
        </div>
      </div>
      
      <div className="medical-card p-6">
        <AgentDebugPanel events={events} patients={patients} />
      </div>
    </div>
  );
}