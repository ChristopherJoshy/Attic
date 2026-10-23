import React, { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { StatusPill } from "../components/StatusPill";
import { Modal } from "../components/Modal";
import { Stat } from "../components/Stat";
import { suraksha, studentData } from "../lib/mockData";
import { downloadMockPdf } from "../lib/download";
import { IconShieldCheck, IconDownload, IconFileText, IconCircleCheck } from "@tabler/icons-react";

export const Suraksha: React.FC = () => {
  const [claimOpen, setClaimOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ date: "", hospital: "", expense: "", details: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTimeout(() => setSuccess(true), 900);
  };

  const downloadPolicy = () => {
    downloadMockPdf(
      "policy.pdf",
      "KTU Student Suraksha Policy",
      [
        `Policy Name: ${suraksha.policyName}`,
        `Insurance Partner: ${suraksha.partner}`,
        `Policy Number: ${suraksha.policyNumber}`,
        `Coverage Period: ${suraksha.coverageFrom} to ${suraksha.coverageTo}`,
        `Premium Status: ${suraksha.premiumStatus}`,
        `Nominee: ${suraksha.nominee}`,
        `Insured Person: ${studentData.name} (${studentData.rollNumber})`,
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
            <PageHeader
              title="KTU Student Suraksha"
              subtitle="Group Personal Accident Insurance Scheme for university students."
              actions={<StatusPill status="Active Policy" tone="success" />}
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
               <Card className="!p-3"><Stat label="Coverage" value={<span className="nums">₹10L</span>} sub="accidental" accent /></Card>
               <Card className="!p-3"><Stat label="Premium" value={<span className="nums">{`₹${suraksha.premium}`}</span>} sub={suraksha.premiumStatus} /></Card>
               <Card className="!p-3"><Stat label="Valid Till" value={<span className="nums">{suraksha.coverageTo.split(" ").slice(-1)[0]}</span>} sub={<span className="nums">{suraksha.coverageTo}</span>} /></Card>
               <Card className="!p-3"><Stat label="Insurer" value="NICL" sub="National Insurance" /></Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <h3 className="font-serif font-semibold text-ink mb-4 flex items-center gap-2"><IconShieldCheck size={18} className="text-accent" /> Policy Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                  {[
                    ["Policy Name", suraksha.policyName],
                    ["Insurance Partner", suraksha.partner],
                    ["Policy Number", suraksha.policyNumber],
                    ["Coverage Period", `${suraksha.coverageFrom} to ${suraksha.coverageTo}`],
                    ["Premium Status", suraksha.premiumStatus],
                    ["Nominee", suraksha.nominee],
                    ["Insured Person", `${studentData.name} (${studentData.rollNumber})`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-xs font-medium text-muted uppercase tracking-wider">{k}</div>
                      <div className="text-ink font-medium mt-0.5">{v}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="flex flex-col justify-between gap-4">
                <div>
                  <h3 className="font-medium text-ink mb-2">Policy Documents</h3>
                  <p className="text-xs text-muted">Download official terms, MoUs and claim guidelines.</p>
                </div>
                <div className="space-y-2">
                  <button onClick={downloadPolicy} className="btn-outline w-full !py-2 text-sm"><IconDownload size={15} /> Policy PDF</button>
                  <button onClick={() => { setClaimOpen(true); setSuccess(false); }} className="btn-primary w-full !py-2 text-sm"><IconFileText size={15} /> Submit Claim</button>
                </div>
              </Card>
            </div>

            <Card className="mt-6">
              <h3 className="font-serif font-semibold text-ink mb-4">Benefit Schedule</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-muted border-b border-line">
                      <th className="pb-3 font-medium">Insured Event</th>
                      <th className="pb-3 font-medium">Compensation</th>
                      <th className="pb-3 font-medium text-right">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {suraksha.benefits.map((b) => (
                      <tr key={b.event} className="hover:bg-ink/[0.02]">
                        <td className="py-3 font-medium text-ink">{b.event}</td>
                         <td className="py-3 font-semibold text-accent nums">{b.amount}</td>
                        <td className="py-3 text-muted text-right text-xs">{b.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </main>
      </div>

      <Modal open={claimOpen} onClose={() => setClaimOpen(false)} title="Submit Suraksha Claim" size="md">
        {!success ? (
          <form onSubmit={submit} className="p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Claimant</label>
              <input disabled value={studentData.name} className="input-field bg-ink/[0.03] text-muted cursor-not-allowed" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">Date of Incident</label>
                <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">Est. Expense (₹)</label>
                <input type="number" required placeholder="15000" value={form.expense} onChange={(e) => setForm({ ...form, expense: e.target.value })} className="input-field" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Hospital / Centre</label>
              <input required placeholder="Taluk Hospital, Palai" value={form.hospital} onChange={(e) => setForm({ ...form, hospital: e.target.value })} className="input-field" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Details</label>
              <textarea rows={3} required placeholder="Brief description of the incident…" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className="input-field resize-none" />
            </div>
            <button type="submit" className="btn-primary w-full justify-center">Submit Claim Request</button>
          </form>
        ) : (
          <div className="p-6 text-center">
            <IconCircleCheck className="text-success mx-auto mb-3" size={48} stroke={1.5} />
            <h3 className="text-lg font-serif font-semibold text-ink">Claim Received</h3>
            <p className="text-sm text-muted mt-1">Submitted to college office. Ref: CLM{Math.floor(100000 + Math.random() * 900000)}</p>
            <button onClick={() => setClaimOpen(false)} className="btn-primary w-full mt-4 justify-center">Close</button>
          </div>
        )}
      </Modal>
    </div>
  );
};
