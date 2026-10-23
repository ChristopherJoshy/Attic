import React from "react";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { calendarEvents } from "../lib/mockData";
import { cn } from "../lib/cn";
import { IconFileText, IconCalendarOff, IconFlag, IconBell, IconSchool } from "@tabler/icons-react";

const catStyle: Record<string, { dot: string; label: string; icon: React.ReactNode }> = {
  Exam: { dot: "bg-accent", label: "Exam", icon: <IconFileText size={15} /> },
  Holiday: { dot: "bg-success", label: "Holiday", icon: <IconCalendarOff size={15} /> },
  Deadline: { dot: "bg-danger", label: "Deadline", icon: <IconFlag size={15} /> },
  Result: { dot: "bg-gold", label: "Result", icon: <IconBell size={15} /> },
  Event: { dot: "bg-info", label: "Event", icon: <IconSchool size={15} /> },
};

export const Calendar: React.FC = () => {
  const sorted = [...calendarEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-3xl mx-auto">
            <PageHeader title="Academic Calendar" subtitle="Key dates, deadlines and university holidays." />

            <div className="relative pl-6">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-line" />
              <div className="space-y-5">
                {sorted.map((e) => {
                  const c = catStyle[e.category];
                  return (
                    <div key={e.id} className="relative">
                      <span className={cn("absolute -left-6 top-3 w-3.5 h-3.5 rounded-full ring-4 ring-surface", c.dot)} />
                      <Card className="!p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-ink font-semibold text-sm">{e.title}</span>
                            </div>
                            <p className="text-xs text-muted mt-1">{e.description}</p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                             <span className="text-xs font-medium text-ink whitespace-nowrap nums">{e.endDate ? `${e.date} – ${e.endDate}` : e.date}</span>
                            <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full text-white", c.dot)}>{c.label}</span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
