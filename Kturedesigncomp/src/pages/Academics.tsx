import React, { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { StatusPill } from "../components/StatusPill";
import { toneForStatus } from "../lib/status";
import { Stat } from "../components/Stat";
import { Sparkline } from "../components/Sparkline";
import { ProgressBar } from "../components/ProgressBar";
import { semesterRecords, getProgramStats, getSemesterById } from "../lib/mockData";
import { cn } from "../lib/cn";
import { IconClock, IconFileText } from "@tabler/icons-react";
import { downloadMockPdf } from "../lib/download";

const gradeColor: Record<string, string> = {
  S: "text-accent", "S+": "text-accent", "A+": "text-success", A: "text-success",
  "B+": "text-gold", B: "text-gold", C: "text-warning", "C+": "text-warning",
  D: "text-warning", E: "text-danger", F: "text-danger", "—": "text-muted",
};

export const Academics: React.FC = () => {
  const stats = getProgramStats();
  const [active, setActive] = useState("S5");
  const sem = getSemesterById(active);
  const trend = semesterRecords.filter((s) => s.status === "Passed").map((s) => s.sgpa);

  const handleDownloadGradeSheet = () => {
    if (!sem || sem.status === "Pending") return;
    downloadMockPdf(
      `grade-sheet-${sem.semester}.pdf`,
      `Semester ${sem.semester} Grade Sheet`,
      [
        `Scheme: ${sem.scheme}`,
        `Result Date: ${sem.resultDate}`,
        `SGPA: ${sem.sgpa}`,
        `Status: ${sem.status}`,
        ...sem.subjects.map((s) => `${s.code} — ${s.name}: ${s.grade} (${s.marks || "—"} marks, ${s.credits} credits)`),
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
            <PageHeader title="Academic Records" subtitle="Results, grade sheets and credit accumulation across semesters." />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
               <Card><Stat label="CGPA" value={<span className="nums">{stats.cgpa}</span>} accent /></Card>
               <Card><Stat label="Credits" value={<span className="nums">{`${stats.creditsEarned}/${stats.creditsRequired}`}</span>} sub="earned / required" /></Card>
               <Card>
                 <Stat
                   label="SGPA Trend"
                   value={<span className="flex items-center gap-2 nums">{sem?.sgpa || "—"} <Sparkline data={trend} width={48} height={18} color="#0F766E" /></span>}
                   sub={`S${sem?.semester} semester`}
                 />
               </Card>
               <Card><Stat label="Best SGPA" value={<span className="nums">{Math.max(...trend).toFixed(2)}</span>} sub="highest semester" /></Card>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-5">
              {semesterRecords.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium border transition-[background-color,color,border-color] whitespace-nowrap focus-ring",
                    active === s.id ? "bg-accent text-white border-accent" : "bg-surface text-muted border-line hover:border-accent/40 hover:text-ink"
                  )}
                >
                  Semester {s.semester}
                  {s.status === "Pending" && <span className="ml-1.5 text-[10px] opacity-80">· upcoming</span>}
                </button>
              ))}
            </div>

            <Card>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="font-semibold text-ink">
                    {sem?.status === "Pending" ? `Semester ${sem.semester} — Results Awaited` : `Semester ${sem?.semester} Result`}
                  </h3>
                  <p className="text-xs text-muted mt-0.5">{sem?.scheme} Scheme · Published {sem?.resultDate}</p>
                </div>
                {sem && sem.status !== "Pending" && (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-muted">SGPA</div>
                      <div className="text-2xl font-bold text-accent">{sem.sgpa}</div>
                    </div>
                    <StatusPill status={sem.status} tone={toneForStatus(sem.status)} />
                    <button
                      onClick={handleDownloadGradeSheet}
                      className="btn btn-outline inline-flex items-center gap-1.5 focus-ring"
                    >
                      <IconFileText size={16} />
                      Download
                    </button>
                  </div>
                )}
              </div>

              {sem?.status === "Pending" ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-black/[0.04] text-muted flex items-center justify-center mb-3">
                    <IconClock size={26} />
                  </div>
                  <p className="font-medium text-ink">Results not yet published</p>
                  <p className="text-sm text-muted mt-1 max-w-sm">Your Semester {sem.semester} examinations are complete. Results will appear here once the university publishes them.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="text-muted border-b border-line">
                        <th className="pb-3 font-medium">Code</th>
                        <th className="pb-3 font-medium">Subject</th>
                        <th className="pb-3 font-medium text-center">Type</th>
                        <th className="pb-3 font-medium text-center">Credits</th>
                        <th className="pb-3 font-medium text-center">Marks</th>
                        <th className="pb-3 font-medium text-center">Grade</th>
                        <th className="pb-3 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {sem?.subjects.map((sub) => (
                        <tr key={sub.code} className="hover:bg-black/[0.02] transition-colors">
                          <td className="py-3 font-mono text-xs text-muted">{sub.code}</td>
                          <td className="py-3 font-medium text-ink max-w-[220px] truncate" title={sub.name}>{sub.name}</td>
                          <td className="py-3 text-center"><span className="text-xs text-muted">{sub.type}</span></td>
                           <td className="py-3 text-center text-ink nums">{sub.credits}</td>
                           <td className="py-3 text-center text-ink font-medium nums">{sub.marks || "—"}</td>
                           <td className={cn("py-3 text-center font-bold", gradeColor[sub.grade])}>{sub.grade}</td>
                          <td className="py-3 text-right"><StatusPill status={sub.status} tone={toneForStatus(sub.status)} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-line">
                        <td colSpan={3} className="py-3 text-sm font-medium text-ink">Total</td>
                         <td className="py-3 text-center font-semibold text-ink nums">{sem?.subjects.reduce((s, x) => s + x.credits, 0)}</td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>

            <Card className="mt-6">
              <h3 className="font-semibold text-ink mb-4">Credit Accumulation</h3>
              <div className="space-y-3">
                {semesterRecords.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                     <span className="w-16 text-sm font-medium text-ink shrink-0 nums">S{s.semester}</span>
                    <div className="flex-1">
                      <ProgressBar
                        value={s.creditsEarned}
                        max={s.creditsTotal}
                        tone={s.status === "Passed" ? "accent" : "warning"}
                      />
                    </div>
                     <span className="text-xs text-muted w-20 text-right nums">{s.creditsEarned}/{s.creditsTotal} cr</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};
