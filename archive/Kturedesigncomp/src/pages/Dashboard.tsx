import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  IconArrowRight, IconAlertTriangle, IconShieldCheck, IconMessageCircle,
  IconCalendarCheck, IconFileText, IconBooks, IconTrendingUp, IconArrowUpRight, IconX,
} from "@tabler/icons-react";
import { Card } from "../components/Card";
import { StatusPill } from "../components/StatusPill";
import { toneForStatus } from "../lib/status";
import { ProgressBar } from "../components/ProgressBar";
import { Stat } from "../components/Stat";
import { PriorityBanner, type Priority } from "../components/PriorityBanner";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { studentData, getProgramStats, semesterRecords, examTimetable, attendance, notifications, feeLedger } from "../lib/mockData";
import { cn } from "../lib/cn";
import { staggerContainer, fadeItem } from "../lib/motion";

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [semModal, setSemModal] = useState(false);
  const stats = getProgramStats();

  const lowAttendance = attendance.filter((a) => (a.present / a.total) * 100 < a.requiredPct);
  const upcoming = examTimetable.slice(0, 3);
  const unreadAlerts = notifications.filter((n) => !n.read).slice(0, 3);

  const avgAttendance = Math.round(
    (attendance.reduce((s, a) => s + a.present, 0) / attendance.reduce((s, a) => s + a.total, 0)) * 100
  );

  const cleared = semesterRecords.filter((s) => s.status === "Passed");
  const lastSgpa = cleared.at(-1)?.sgpa ?? 0;
  const prevSgpa = cleared.at(-2)?.sgpa ?? 0;
  const cgpaTrend = prevSgpa
    ? { dir: lastSgpa > prevSgpa ? ("up" as const) : lastSgpa < prevSgpa ? ("down" as const) : ("flat" as const), delta: Math.abs(Number((lastSgpa - prevSgpa).toFixed(2))), tone: lastSgpa >= prevSgpa ? ("good" as const) : ("bad" as const) }
    : null;

  const pendingFees = feeLedger.filter((f) => f.status === "Unpaid");
  const priorities: Priority[] = [];
  if (lowAttendance.length > 0) {
    const worst = lowAttendance.reduce((a, b) => ((a.present / a.total) < (b.present / b.total) ? a : b));
    const pct = Math.round((worst.present / worst.total) * 100);
    priorities.push({
      id: "att",
      title: `Attendance below minimum in ${lowAttendance.length} course${lowAttendance.length > 1 ? "s" : ""}`,
      detail: `${worst.code} at ${pct}% (need 75%). Condonation may be required.`,
      tone: "danger",
      to: "/attendance",
      cta: "View",
    });
  }
  if (pendingFees.length > 0) {
    priorities.push({
      id: "fee",
      title: `${pendingFees.length} fee${pendingFees.length > 1 ? "s" : ""} unpaid`,
      detail: `Clear dues to download your hall ticket.`,
      tone: "warning",
      to: "/fees",
      cta: "Pay",
    });
  }
  const closingSoon = notifications.find((n) => n.category === "exam" && !n.read);
  if (closingSoon) {
    priorities.push({
      id: "reg",
      title: closingSoon.title,
      detail: closingSoon.body,
      tone: "info",
      to: "/exams",
      cta: "Register",
    });
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted">Semester {studentData.semester} · {studentData.scheme}</p>
                <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-ink mt-0.5">Welcome back, {studentData.name.split(" ")[0]}</h1>
              </div>
              <button onClick={() => navigate("/exams")} className="btn-outline self-start sm:self-auto"><IconFileText size={16} /> Exam Centre</button>
            </header>

            <PriorityBanner items={priorities} />

            <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" variants={staggerContainer} initial="hidden" animate="show">
              <motion.div variants={fadeItem}><Card className="h-full"><Stat label="CGPA" value={stats.cgpa} sub="Across cleared semesters" accent trend={cgpaTrend ? { dir: cgpaTrend.dir, label: `${cgpaTrend.delta} vs S${cleared.at(-2)?.semester}` } : undefined} /></Card></motion.div>
              <motion.div variants={fadeItem}><Card className="h-full"><Stat label="Credits" value={`${stats.creditsEarned}`} sub={`of ${stats.creditsRequired} required`} /></Card></motion.div>
              <motion.div variants={fadeItem}>
                <Card className="h-full">
                  <Stat
                    label="Avg. Attendance"
                    value={`${avgAttendance}%`}
                    sub={lowAttendance.length ? `${lowAttendance.length} course(s) low` : "All clear"}
                    trend={lowAttendance.length ? { dir: "down", label: "below 75%", tone: "bad" } : { dir: "up", label: "on track", tone: "good" }}
                  />
                </Card>
              </motion.div>
              <motion.div variants={fadeItem}><Card className="h-full"><Stat label="Upcoming Exams" value={examTimetable.length} sub={`First: ${examTimetable[0]?.date}`} /></Card></motion.div>
            </motion.div>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <IconTrendingUp size={18} className="text-accent" />
                  <h3 className="font-semibold text-ink">Credit Progress</h3>
                </div>
                <button onClick={() => setSemModal(true)} className="text-xs text-accent hover:underline flex items-center gap-1">View breakdown <IconArrowRight size={13} /></button>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold text-ink nums">{stats.creditsEarned}<span className="text-base text-muted font-normal">/{stats.creditsRequired}</span></div>
                <div className="flex-1">
                  <ProgressBar value={stats.creditsEarned} max={stats.creditsRequired} barClassName="bg-gradient-to-r from-accent to-accent-soft" />
                  <div className="flex justify-between text-[11px] text-muted mt-1.5">
                    <span>{stats.semestersCleared} semesters cleared</span>
                    <span>{stats.creditsPending} credits to go</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {semesterRecords.map((s) => {
                  const pct = (s.creditsEarned / s.creditsTotal) * 100;
                  return (
                    <div key={s.id} className="rounded-lg border border-line p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-ink">S{s.semester}</span>
                        <span className={cn("w-1.5 h-1.5 rounded-full", s.status === "Passed" ? "bg-success" : s.status === "Pending" ? "bg-warning" : "bg-danger")} />
                      </div>
                      <div className="text-[11px] text-muted mt-1 nums">{s.creditsEarned}/{s.creditsTotal} cr</div>
                      <ProgressBar value={pct} className="mt-1.5 h-1.5" />
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="h-full lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-ink">Upcoming Examinations</h3>
                    <button onClick={() => navigate("/exams")} className="text-xs text-accent hover:underline">View all</button>
                  </div>
                  <div className="space-y-2.5">
                    {upcoming.map((e) => (
                      <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border border-line hover:border-accent/30 transition-colors">
                        <div className="w-11 h-11 rounded-lg bg-accent/10 text-accent flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase font-medium">{e.session}</span>
                          <span className="text-xs font-bold">{e.date.split(" ")[0]}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-ink text-sm truncate">{e.subject}</div>
                          <div className="text-xs text-muted">{e.date} · {e.time} · {e.venue}</div>
                        </div>
                        <IconArrowUpRight size={16} className="text-muted" />
                      </div>
                    ))}
                  </div>
                </Card>

              <div className="space-y-6">
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-ink">Recent Notifications</h3>
                    <button onClick={() => navigate("/notifications")} className="text-xs text-accent hover:underline">View all</button>
                  </div>
                  <div className="space-y-3">
                    {unreadAlerts.map((n) => (
                      <div key={n.id} className="flex gap-2.5">
                        <IconAlertTriangle size={16} className="text-gold shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-ink leading-snug truncate">{n.title}</p>
                          <p className="text-[11px] text-muted mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <h3 className="font-semibold text-ink mb-3">Quick Actions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Records", icon: IconBooks, to: "/academics" },
                      { label: "Attendance", icon: IconCalendarCheck, to: "/attendance" },
                      { label: "Feedback", icon: IconMessageCircle, to: "/feedback" },
                      { label: "Suraksha", icon: IconShieldCheck, to: "/suraksha" },
                    ].map((q) => (
                      <button key={q.label} onClick={() => navigate(q.to)} className="flex flex-col items-center gap-2 p-3 rounded-lg border border-line hover:border-accent/40 hover:bg-accent/[0.03] transition-[background-color,border-color,color] text-ink focus-ring">
                        <q.icon size={20} className="text-accent" />
                        <span className="text-xs font-medium">{q.label}</span>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>

      {semModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-ink/25 backdrop-blur-sm" onClick={() => setSemModal(false)} />
          <div className="relative bg-surface rounded-pop border border-line shadow-pop w-full max-w-lg p-6 z-10">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-ink">Semester-wise Credits</h3>
              <button onClick={() => setSemModal(false)} className="text-muted hover:text-ink focus-ring rounded-md p-1" aria-label="Close"><IconX size={18} /></button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {semesterRecords.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="w-10 text-sm font-semibold text-ink">S{s.semester}</span>
                  <div className="flex-1"><ProgressBar value={s.creditsEarned} max={s.creditsTotal} className="h-2.5" /></div>
                  <span className="text-sm text-muted w-16 text-right">{s.creditsEarned}/{s.creditsTotal}</span>
                  <StatusPill status={s.status} tone={toneForStatus(s.status)} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-4">KTU requires a minimum number of earned credits to register for later semesters. Track yours here to avoid year-back surprises.</p>
          </div>
        </div>
      )}
    </div>
  );
};
