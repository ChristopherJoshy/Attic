import React, { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { StatusPill } from "../components/StatusPill";
import { toneForStatus } from "../lib/status";
import { Modal } from "../components/Modal";
import { EmptyState } from "../components/EmptyState";
import { grievances as seed } from "../lib/mockData";
import { IconHeadset, IconCircleCheck, IconSend } from "@tabler/icons-react";
import { Spinner } from "../components/AsciiLoader";

export const Grievance: React.FC = () => {
  const [list, setList] = useState(seed);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "Academic", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setTimeout(() => {
      const ticket = `KTU-GRV-${Math.floor(1000 + Math.random() * 9000)}`;
      setList((prev) => [
        { id: ticket, subject: form.subject, category: form.category as never, description: form.description, status: "Open", raisedOn: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), expectedBy: "—", ticket },
        ...prev,
      ]);
      setSubmitting(false);
      setDone(true);
    }, 900);
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <PageHeader
              title="Grievance Redressal"
              subtitle="Raise and track support tickets with the university."
              actions={<button onClick={() => { setOpen(true); setDone(false); }} className="btn-primary"><IconHeadset size={16} /> Raise Ticket</button>}
            />

            <div className="rounded-pop border border-info/20 bg-info/5 px-4 py-3 text-sm text-ink mb-6 flex gap-2">
              <IconSend size={16} className="text-info shrink-0 mt-0.5" />
              Every request gets a ticket number. Quote it in all future communication with the university as per KTU guidelines.
            </div>

            <div className="space-y-3">
              {list.map((g) => (
                <Card key={g.id} interactive className="!p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-ink text-sm">{g.subject}</h3>
                        <StatusPill status={g.status} tone={toneForStatus(g.status)} />
                        <span className="text-[10px] uppercase tracking-wider text-muted bg-black/[0.04] px-1.5 py-0.5 rounded">{g.category}</span>
                      </div>
                      <p className="text-xs text-muted mt-1.5 line-clamp-2">{g.description}</p>
                      <div className="flex gap-4 mt-2 text-[11px] text-muted">
                        <span>Ticket: <span className="font-mono text-ink">{g.ticket}</span></span>
                         <span>Raised: <span className="nums">{g.raisedOn}</span></span>
                         <span>Expected: <span className="nums">{g.expectedBy}</span></span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              {list.length === 0 && <Card><EmptyState title="No grievances raised" /></Card>}
            </div>
          </div>
        </main>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Raise a Grievance" size="md">
        {!done ? (
          <form onSubmit={submit} className="p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field">
                <option>Academic</option><option>Exam</option><option>Fee</option><option>Technical</option><option>General</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Subject</label>
              <input required placeholder="Short summary of your issue" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input-field" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Description</label>
              <textarea required rows={4} placeholder="Describe your request or issue in detail…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field resize-none" />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full justify-center disabled:opacity-70">{submitting ? <Spinner label="Raising ticket" /> : "Submit Ticket"}</button>
          </form>
        ) : (
          <div className="p-6 text-center">
            <IconCircleCheck className="text-success mx-auto mb-3" size={48} stroke={1.5} />
            <h3 className="text-lg font-serif font-semibold text-ink">Ticket Raised</h3>
            <p className="text-sm text-muted mt-1">Your ticket has been logged. First reply within 3 working days.</p>
            <button onClick={() => setOpen(false)} className="btn-primary w-full mt-4 justify-center">Close</button>
          </div>
        )}
      </Modal>
    </div>
  );
};
