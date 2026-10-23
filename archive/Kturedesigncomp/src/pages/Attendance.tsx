import React from "react";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { Stat } from "../components/Stat";
import { ProgressBar } from "../components/ProgressBar";
import { attendance } from "../lib/mockData";
import { cn } from "../lib/cn";
import { IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";

export const Attendance: React.FC = () => {
  const totalPresent = attendance.reduce((s, a) => s + a.present, 0);
  const totalClasses = attendance.reduce((s, a) => s + a.total, 0);
  const overall = Math.round((totalPresent / totalClasses) * 100);
  const deficient = attendance.filter((a) => (a.present / a.total) * 100 < a.requiredPct);

  // classes needed to reach 75%
  const toReach = (a: (typeof attendance)[number]) => {
    const needed = Math.ceil((a.requiredPct / 100) * a.total) - a.present;
    return Math.max(0, needed);
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <PageHeader
              title="Attendance"
              subtitle="Track course-wise attendance and shortage before it becomes a problem."
            />

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
               <Card><Stat label="Overall" value={<span className="nums">{`${overall}%`}</span>} sub={<span className="nums">{`${totalPresent}/${totalClasses} classes`}</span>} accent /></Card>
               <Card><Stat label="Required" value={<span className="nums">75%</span>} sub="minimum per KTU norms" /></Card>
               <Card>
                 <Stat
                   label="Shortage"
                   value={<span className="nums">{deficient.length}</span>}
                   sub={deficient.length ? "course(s) below 75%" : "all courses clear"}
                 />
              </Card>
            </div>

            {deficient.length > 0 && (
              <div className="mb-6 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 flex items-start gap-3">
                <IconAlertTriangle size={20} className="text-warning shrink-0 mt-0.5" />
                <div className="text-sm text-ink">
                  <span className="font-medium">Attendance deficiency detected.</span> You are below the 75% minimum in {deficient.length} course(s). Apply for condonation or improve attendance to be eligible for end-semester exams.
                </div>
              </div>
            )}

            <div className="space-y-3">
              {attendance.map((a) => {
                const pct = Math.round((a.present / a.total) * 100);
                const low = pct < a.requiredPct;
                const need = toReach(a);
                return (
                  <Card key={a.code} interactive className="!p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="sm:w-64 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted">{a.code}</span>
                          {low ? (
                            <IconAlertTriangle size={15} className="text-warning" />
                          ) : (
                            <IconCircleCheck size={15} className="text-success" />
                          )}
                        </div>
                        <div className="font-medium text-ink text-sm truncate">{a.name}</div>
                        <div className="text-xs text-muted">{a.faculty}</div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                           <span className="text-xs text-muted nums">{a.present}/{a.total} classes</span>
                           <span className={cn("text-sm font-semibold nums", low ? "text-warning" : "text-success")}>{pct}%</span>
                        </div>
                        <div className="relative">
                          <ProgressBar
                            value={pct}
                            max={100}
                            tone={low ? "warning" : "success"}
                          />
                          <div className="absolute top-0 bottom-0 w-0.5 bg-ink/40" style={{ left: `${a.requiredPct}%` }} />
                        </div>
                      </div>

                      <div className="sm:w-40 shrink-0 text-right">
                        {low ? (
                           <span className="text-xs text-warning font-medium nums">Need {need} more class{need !== 1 ? "es" : ""}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
                            <IconCircleCheck size={14} /> Eligible
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
