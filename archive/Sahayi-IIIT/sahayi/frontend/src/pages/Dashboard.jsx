import { Link } from "react-router-dom";
import { 
  Users, 
  Activity, 
  AlertCircle, 
  Plus, 
  ArrowUpRight, 
  Calendar,
  Clock,
  PhoneCall,
  Database,
  BrainCircuit
} from "lucide-react";

import EscalationButton from "../components/Alerts/EscalationButton";
import PatientCard from "../components/Dashboard/PatientCard";
import ResearchPanel from "../components/Dashboard/ResearchPanel";
import RiskFeed from "../components/Dashboard/RiskFeed";
import KnowledgeGraph from "../components/Dashboard/KnowledgeGraph";
import HypothesisPanel from "../components/Dashboard/HypothesisPanel";
import { usePatientData } from "../hooks/usePatientData";
import { useWebSocket } from "../hooks/useWebSocket";

export default function Dashboard({ user }) {
  const { events, latestEvent, connectionState } = useWebSocket(user);
  const { patients, population, loading, error } = usePatientData(latestEvent);
  
  const activeCall = events.find((event) => event.event === "call_started")?.payload || null;
  const riskEvents = events.filter((event) => event.event === "risk_update").map((event) => event.payload);
  const signalEvents = events.filter((event) => event.event === "new_signal").map((event) => event.payload);
  const initialSummary = patients?.find(p => p.latest_summary)?.latest_summary || null;
  const summary = events.find((event) => event.event === "doctor_summary")?.payload || initialSummary;
  const hypothesis = events.find((event) => event.event === "hypothesis_generated")?.payload || summary?.hypothesis || null;
  const graph = summary?.knowledge_graph || null;

  const stats = [
    { label: "Total Patients", value: patients?.length || 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Signals", value: signalEvents.length, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "High Risk", value: patients?.filter(p => p.status === 'red').length || 0, icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50" },
  ];

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <div className="w-full space-y-8 pb-12 animate-slideIn">
      {/* Header Section */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-sahayi-primary font-bold text-xs uppercase tracking-widest">
            <div className="h-1.5 w-1.5 rounded-full bg-sahayi-primary animate-pulse" />
            Live System Status: {connectionState}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            Welcome back, {user.displayName?.split(' ')[0] || 'Doctor'}!
          </h1>
          <p className="mt-2 text-slate-500 dark:text-neutral-400 font-medium">
            You have <span className="text-sahayi-primary font-bold dark:text-white">{patients?.length || 0} patients</span> under monitoring today.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-white dark:bg-neutral-900 border border-sahayi-border dark:border-neutral-800 px-4 py-2.5 shadow-sm dark:shadow-none text-sm font-medium text-slate-600 dark:text-neutral-400">
            <Calendar size={18} className="text-sahayi-primary dark:text-white" />
            {today}
          </div>
          <Link 
            to="/setup" 
            className="flex items-center gap-2 rounded-lg bg-black dark:bg-white px-6 py-2.5 font-medium text-white dark:text-black shadow-sm transition hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-95"
          >
            <Plus size={20} strokeWidth={3} />
            Add Patient
          </Link>
          {summary?.patient_id && <EscalationButton patientId={summary.patient_id} />}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-100 dark:border-red-500 bg-red-50 dark:bg-red-500/10 p-4 text-sm font-bold text-red-600 dark:text-red-500 animate-slideIn">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="medical-card p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-wider">{stat.label}</p>
              <h3 className="mt-2 text-3xl font-black text-neutral-900 dark:text-white">{stat.value}</h3>
            </div>
            <div className={`rounded-xl ${stat.bg} dark:bg-neutral-900 ${stat.color} dark:text-white p-3`}>
              <stat.icon size={28} strokeWidth={2.5} />
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid Layout */}
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-8">
          {/* Active Call / Live Telemetry Section */}
          <div className="medical-card overflow-hidden">
            <div className="border-b border-sahayi-border dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                <PhoneCall size={14} className="text-sahayi-primary dark:text-white" />
                Live Patient Interaction
              </div>
              {activeCall && (
                 <Link to={`/patient/${activeCall.patient_id}`} className="flex items-center gap-1 text-xs font-extrabold text-sahayi-primary dark:text-white hover:underline">
                  PROFILE <ArrowUpRight size={14} />
                 </Link>
              )}
            </div>
            <PatientCard activeCall={activeCall} signals={signalEvents} connectionState={connectionState} />
          </div>

          {/* Knowledge Graph / Medical Context */}
          <div className="medical-card overflow-hidden">
            <div className="border-b border-sahayi-border dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900 px-6 py-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">
              <BrainCircuit size={16} className="text-sahayi-primary dark:text-white" />
              Medical Knowledge Mapping
            </div>
            <div className="p-2">
              <KnowledgeGraph graph={graph} />
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Risk Surface / Feed */}
          <div className="medical-card overflow-hidden">
             <div className="border-b border-sahayi-border dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                  <Activity size={16} className="text-sahayi-primary dark:text-white" />
                  Real-time Risk Surface
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 px-3 py-1 text-[10px] font-bold text-slate-500 dark:text-neutral-400">
                  <Clock size={10} />
                  LIVE
                </div>
            </div>
            <RiskFeed patients={patients} riskEvents={riskEvents} />
          </div>

          {/* Research & Hypothesis */}
          <div className="space-y-8">
             <div className="medical-card overflow-hidden">
                <div className="border-b border-sahayi-border dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900 px-6 py-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                  <Database size={16} className="text-sahayi-primary dark:text-white" />
                  Clinical Research Intelligence
                </div>
                <ResearchPanel summary={summary} population={population} />
             </div>

             <div className="medical-card overflow-hidden">
                <div className="border-b border-sahayi-border dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900 px-6 py-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">
                  <BrainCircuit size={16} className="text-sahayi-primary dark:text-white" />
                  Active Hypotheses
                </div>
                <HypothesisPanel hypothesis={hypothesis} population={population} />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
