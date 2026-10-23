import React, { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { StatusPill } from "../components/StatusPill";
import { toneForStatus } from "../lib/status";
import { Modal } from "../components/Modal";
import { EmptyState } from "../components/EmptyState";
import { Stat } from "../components/Stat";
import { examRegistrations, examTimetable, revaluationRequests, studentData } from "../lib/mockData";
import { downloadMockPdf } from "../lib/download";
import { cn } from "../lib/cn";
import { IconDownload, IconFileText, IconClock, IconMapPin, IconRefresh, IconCheck } from "@tabler/icons-react";

type Tab = "timetable" | "register" | "revaluation";

export const Exams: React.FC = () => {
  const [tab, setTab] = useState<Tab>("timetable");
  const [admitOpen, setAdmitOpen] = useState(false);
  const [registered, setRegistered] = useState<Record<string, boolean>>({});
  const [revStatus, setRevStatus] = useState<Record<string, string>>({});

  const toggleRegister = (id: string) => setRegistered((p) => ({ ...p, [id]: !p[id] }));
  const requestRev = (id: string) => setRevStatus((p) => ({ ...p, [id]: "Requested" }));

  const downloadAdmitCard = () => {
    downloadMockPdf(
      "admit-card.pdf",
      "Admit Card — S6 Regular",
      [
        `Candidate: ${studentData.name}`,
        `Register No.: ${studentData.rollNumber}`,
        `College: ${studentData.college}`,
        `Centre: SJCET, Palai`,
        `Programme: B.Tech S6 (R,S) Regular`,
      ]
    );
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <PageHeader title="Exam Centre" subtitle="Register for exams, view your timetable and apply for revaluation." />

            <div className="flex gap-1 p-1 bg-ink/10 rounded-lg mb-6 w-fit">
              {([{ id: "timetable", label: "Timetable" }, { id: "register", label: "Registration" }, { id: "revaluation", label: "Revaluation" }] as const).map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} className={cn("px-4 py-2 rounded-md text-sm font-medium transition-[background-color,color,box-shadow]", tab === t.id ? "bg-surface text-ink shadow-pop" : "text-muted hover:text-ink")}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "timetable" && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                   <Card className="!p-3"><Stat label="Exams" value={<span className="nums">{examTimetable.length}</span>} sub="scheduled" /></Card>
                   <Card className="!p-3"><Stat label="Starts" value={<span className="nums">{examTimetable[0]?.date.split(" ")[0]}</span>} sub={<span className="nums">{examTimetable[0]?.date}</span>} /></Card>
                   <Card className="!p-3"><Stat label="FN Sessions" value={<span className="nums">{examTimetable.filter((e) => e.session === "FN").length}</span>} sub="morning" /></Card>
                   <Card className="!p-3"><Stat label="AN Sessions" value={<span className="nums">{examTimetable.filter((e) => e.session === "AN").length}</span>} sub="afternoon" /></Card>
                </div>

                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif font-semibold text-ink">S6 Regular — Detailed Timetable</h3>
                    <button onClick={() => setAdmitOpen(true)} className="btn-outline !py-2 !px-3 text-xs"><IconDownload size={15} /> Admit Card</button>
                  </div>
                  <div className="space-y-3">
                    {examTimetable.map((e) => (
                      <div key={e.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-pop border border-line hover:border-accent/30 transition-colors">
                        <div className="w-14 h-14 rounded-pop bg-accent/10 text-accent flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase font-medium">{e.session}</span>
                           <span className="text-sm font-bold leading-tight nums">{e.date.split(" ")[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-ink">{e.subject}</span>
                            <StatusPill status={e.type} tone="accent" />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mt-1">
                            <span className="flex items-center gap-1"><IconClock size={13} /> {e.time}</span>
                            <span className="flex items-center gap-1"><IconMapPin size={13} /> {e.venue}</span>
                            <span>{e.duration}</span>
                          </div>
                        </div>
                        <span className="font-mono text-xs text-muted shrink-0">{e.subjectCode}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}

            {tab === "register" && (
              <div className="space-y-3">
                {examRegistrations.map((r) => {
                  const isReg = registered[r.id] || r.status === "Registered";
                  return (
                    <Card key={r.id} interactive className="!p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-serif font-semibold text-ink">{r.name}</h3>
                            <StatusPill status={isReg ? "Registered" : r.status} tone={toneForStatus(isReg ? "Registered" : r.status)} />
                          </div>
                           <div className="text-sm text-muted mt-1 nums">Exam date: {r.date} · Fee: ₹{r.fee} · Last date: {r.lastDate}</div>
                        </div>
                        <div>
                          {isReg ? (
                            <span className="text-sm text-success font-medium flex items-center gap-1.5"><IconCheck size={16} /> Registration complete</span>
                          ) : r.status === "Closed" ? (
                            <span className="text-sm text-muted">Window closed</span>
                          ) : (
                            <button onClick={() => toggleRegister(r.id)} className="btn-primary !py-2 !px-4 text-sm">Register</button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {tab === "revaluation" && (
              <div className="space-y-3">
                {revaluationRequests.map((r) => {
                  const status = revStatus[r.id] || r.status;
                  return (
                    <Card key={r.id} interactive className="!p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-serif font-semibold text-ink">{r.subject}</h3>
                            <StatusPill status={status} tone={toneForStatus(status)} />
                          </div>
                           <div className="text-sm text-muted mt-1 nums">Current grade: <span className="font-medium text-ink">{r.currentGrade}</span> · Fee: ₹{r.fee} · Requested: {r.requestedOn}</div>
                        </div>
                        <div>
                          {status === "Requested" || status === "Under Review" ? (
                            <span className="text-sm text-accent font-medium">In progress</span>
                          ) : (
                            <button onClick={() => requestRev(r.id)} className="btn-outline !py-2 !px-4 text-sm flex items-center gap-1.5"><IconRefresh size={15} /> Apply</button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
                {revaluationRequests.length === 0 && <Card><EmptyState icon={<IconFileText size={28} />} title="No revaluation history" description="Apply for revaluation once results are published." /></Card>}
              </div>
            )}
          </div>
        </main>
      </div>

      <Modal open={admitOpen} onClose={() => setAdmitOpen(false)} title="Admit Card — S6 Regular" size="md">
        <div className="p-5">
          <div className="rounded-pop border border-line p-4 bg-canvas">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-3">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="KTU" className="w-8 h-8 object-contain" />
                <div>
                  <div className="font-serif font-bold text-ink text-sm">APJ Abdul Kalam Technological University</div>
                  <div className="text-[10px] text-muted">B.Tech S6 (R,S) Regular — Hall Ticket</div>
                </div>
              </div>
              <StatusPill status="Downloaded" tone="success" />
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-muted">Candidate</div><div className="font-medium text-ink text-right">{studentData.name}</div>
              <div className="text-muted">Register No.</div><div className="font-medium text-ink text-right font-mono">{studentData.rollNumber}</div>
              <div className="text-muted">College</div><div className="font-medium text-ink text-right text-xs">{studentData.college}</div>
              <div className="text-muted">Centre</div><div className="font-medium text-ink text-right">SJCET, Palai</div>
            </div>
          </div>
          <button onClick={downloadAdmitCard} className="btn-primary w-full mt-4 justify-center"><IconDownload size={16} /> Download PDF</button>
          <p className="text-xs text-muted text-center mt-2">This is a mock document generated for demonstration.</p>
        </div>
      </Modal>
    </div>
  );
};
