import React, { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { StatusPill } from "../components/StatusPill";
import { toneForStatus } from "../lib/status";
import { EmptyState } from "../components/EmptyState";
import { feedbackCourses } from "../lib/mockData";
import { IconBook, IconStarFilled, IconCircleCheck } from "@tabler/icons-react";
import { Spinner } from "../components/AsciiLoader";
import { cn } from "../lib/cn";

interface Course { code: string; name: string; faculty: string; status: "Completed" | "Pending"; date?: string; }

const questions = [
  { id: 1, label: "Delivery & pacing of course content" },
  { id: 2, label: "Fairness and regularity of internal evaluation" },
  { id: 3, label: "Interaction, doubt clearance and support" },
];

export const Feedback: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>(feedbackCourses);
  const [active, setActive] = useState<Course | null>(null);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const evaluate = (c: Course) => { setActive(c); setRatings({}); setComment(""); setDone(false); setSubmitting(false); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || submitting) return;
    setSubmitting(true);
    setTimeout(() => {
      setCourses((prev) => prev.map((c) => c.code === active.code ? { ...c, status: "Completed", date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) } : c));
      setSubmitting(false);
      setDone(true);
    }, 800);
  };

  const pending = courses.filter((c) => c.status === "Pending").length;

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <PageHeader title="Course Feedback" subtitle="Submit internal feedback to improve teaching quality." actions={<StatusPill status={`${pending} pending`} tone={pending ? "warning" : "success"} />} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-3">
                {courses.map((c) => (
                  <Card key={c.code} interactive className="!p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5"><IconBook size={17} /></div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-ink text-sm">{c.code}: {c.name}</h3>
                            <StatusPill status={c.status} tone={toneForStatus(c.status)} />
                          </div>
                          <p className="text-xs text-muted mt-1">Faculty: {c.faculty}{c.date ? ` · ${c.date}` : ""}</p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {c.status === "Pending" ? (
                          <button onClick={() => evaluate(c)} className="btn-primary !py-1.5 !px-3 text-xs">Evaluate</button>
                        ) : (
                          <span className="text-xs text-success font-medium flex items-center gap-1"><IconCircleCheck size={15} /> Submitted</span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
                {courses.length === 0 && <Card><EmptyState title="Nothing to evaluate" /></Card>}
              </div>

              <div className="lg:col-span-1">
                {active ? (
                  <Card className="h-full">
                    {!done ? (
                      <form onSubmit={submit} className="space-y-5">
                        <div>
                          <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">Evaluate</span>
                          <h2 className="text-base font-serif font-bold text-ink leading-tight mt-1">{active.name}</h2>
                          <p className="text-xs text-muted mt-1">Instructor: {active.faculty}</p>
                        </div>
                        <div className="space-y-4 border-t border-line pt-4">
                          {questions.map((q) => (
                            <div key={q.id} className="space-y-2">
                              <span className="text-xs text-ink font-medium block">{q.id}. {q.label}</span>
                              <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button type="button" key={star} onClick={() => setRatings({ ...ratings, [q.id]: star })} className="focus-ring rounded">
                                    <IconStarFilled size={20} className={cn("transition-colors", star <= (ratings[q.id] || 0) ? "text-warning" : "text-line hover:text-warning/40")} />
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted uppercase tracking-wider">Comments</label>
                          <textarea rows={3} placeholder="Optional suggestions…" value={comment} onChange={(e) => setComment(e.target.value)} className="input-field resize-none" />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setActive(null)} disabled={submitting} className="btn-outline flex-1 !py-2 text-xs">Cancel</button>
                          <button type="submit" disabled={submitting || Object.values(ratings).length < 3 || Object.values(ratings).some((r) => r === 0)} className="btn-primary flex-1 !py-2 text-xs disabled:opacity-50 justify-center">
                            {submitting ? <Spinner label="Submitting feedback" /> : "Submit"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="text-center py-8">
                        <IconCircleCheck className="text-success mx-auto mb-3" size={44} stroke={1.5} />
                         <h3 className="font-serif font-semibold text-ink">Submitted</h3>
                        <p className="text-xs text-muted mt-1">Thanks for evaluating {active.code}.</p>
                        <button onClick={() => setActive(null)} className="btn-primary w-full mt-4 !py-2 text-xs justify-center">Close</button>
                      </div>
                    )}
                  </Card>
                ) : (
                  <Card className="h-full flex flex-col justify-center items-center text-center p-6 border-dashed border-2 border-line">
                    <p className="text-sm text-muted">Select a pending course to start the evaluation survey.</p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
