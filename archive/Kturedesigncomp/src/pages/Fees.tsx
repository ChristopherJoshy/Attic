import React, { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { StatusPill } from "../components/StatusPill";
import { toneForStatus } from "../lib/status";
import { Modal } from "../components/Modal";
import { Stat } from "../components/Stat";
import { feeLedger } from "../lib/mockData";
import { downloadMockPdf } from "../lib/download";
import { IconCreditCard, IconCircleCheck, IconDownload } from "@tabler/icons-react";
import { Spinner } from "../components/AsciiLoader";

interface FeeItem {
  id: string; name: string; category: string; semester: string; amount: number;
  status: "Paid" | "Unpaid" | "Partial"; txnId?: string; date?: string; dueDate?: string;
}

export const Fees: React.FC = () => {
  const [fees, setFees] = useState<FeeItem[]>(feeLedger);
  const [paying, setPaying] = useState<FeeItem | null>(null);
  const [success, setSuccess] = useState(false);
  const [processing, setProcessing] = useState(false);

  const pending = fees.filter((f) => f.status !== "Paid");
  const pendingAmount = pending.reduce((s, f) => s + f.amount, 0);
  const paidAmount = fees.filter((f) => f.status === "Paid").reduce((s, f) => s + f.amount, 0);

  const paidItem = paying ? fees.find((f) => f.id === paying.id) : null;

  const downloadReceipt = () => {
    if (!paidItem) return;
    downloadMockPdf(
      "receipt.pdf",
      "Payment Receipt",
      [
        `Fee: ${paidItem.name}`,
        `Semester: ${paidItem.semester}`,
        `Amount: ₹${paidItem.amount.toLocaleString()}`,
        `Txn ID: ${paidItem.txnId ?? ""}`,
        `Date: ${paidItem.date ?? ""}`,
      ]
    );
  };

  const process = () => {
    if (!paying) return;
    setProcessing(true);
    setTimeout(() => {
      setFees((prev) => prev.map((f) => (f.id === paying.id ? { ...f, status: "Paid", txnId: `TXN${Math.floor(10000000 + Math.random() * 90000000)}`, date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) } : f)));
      setProcessing(false);
      setSuccess(true);
    }, 1200);
  };

  const overdue = pending.filter((f) => f.dueDate && new Date(f.dueDate).getTime() < Date.now()).length;

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <PageHeader title="My Fees" subtitle="Review fee demands, pay online and download receipts." />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
               <Card><Stat label="Pending Dues" value={<span className="nums">{`₹${pendingAmount.toLocaleString()}`}</span>} sub={pending.length ? `${pending.length} item(s) unpaid` : "All clear"} accent /></Card>
               <Card><Stat label="Total Paid" value={<span className="nums">{`₹${paidAmount.toLocaleString()}`}</span>} sub="all semesters" /></Card>
               <Card><Stat label="Overdue" value={<span className="nums">{overdue}</span>} sub={overdue ? "pay to avoid penalty" : "nothing overdue"} /></Card>
            </div>

            <Card>
              <h3 className="font-serif font-semibold text-ink mb-4">Fee Statement</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-muted border-b border-line">
                      <th className="pb-3 font-medium">Description</th>
                      <th className="pb-3 font-medium">Semester</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {fees.map((f) => (
                      <tr key={f.id} className="hover:bg-ink/[0.02] transition-colors">
                        <td className="py-3.5 font-medium text-ink">{f.name}</td>
                        <td className="py-3.5 text-muted">{f.semester}</td>
                         <td className="py-3.5 font-medium text-ink nums">₹{f.amount.toLocaleString()}</td>
                        <td className="py-3.5"><StatusPill status={f.status} tone={toneForStatus(f.status)} /></td>
                        <td className="py-3.5 text-right">
                          {f.status === "Unpaid" ? (
                            <button onClick={() => { setPaying(f); setSuccess(false); }} className="btn-primary !py-1.5 !px-3 text-xs">Pay</button>
                          ) : (
                            <div className="flex items-center justify-end gap-3">
                              <div className="text-right text-xs">
                                <div className="font-mono text-ink">{f.txnId}</div>
                                <div className="text-muted">{f.date}</div>
                              </div>
                              <button onClick={() => { downloadMockPdf("receipt.pdf", "Payment Receipt", [`Fee: ${f.name}`, `Semester: ${f.semester}`, `Amount: ₹${f.amount.toLocaleString()}`, `Txn ID: ${f.txnId ?? ""}`, `Date: ${f.date ?? ""}`]); }} className="text-muted hover:text-accent p-1.5 rounded-md hover:bg-accent/[0.05] transition-colors" title="Download receipt" aria-label="Download receipt"><IconDownload size={16} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </main>
      </div>

      <Modal open={!!paying} onClose={() => setPaying(null)} title="Mock Payment Gateway" size="sm">
        {paying && !success && (
          <div className="p-5">
            <div className="flex items-center gap-2 text-accent mb-4"><IconCreditCard size={20} /><span className="font-medium text-ink">KTU e-Gov Secure Pay</span></div>
            <div className="border-y border-line py-4 mb-5 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted">Fee</span><span className="font-medium text-ink">{paying.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted">Semester</span><span className="font-medium text-ink">{paying.semester}</span></div>
              <div className="flex justify-between text-base"><span className="font-semibold text-ink">Payable</span><span className="font-bold text-accent nums">₹{paying.amount.toLocaleString()}</span></div>
            </div>
            <div className="p-3 border border-accent/20 bg-accent/[0.04] rounded-pop flex items-center justify-between text-sm mb-5">
              <span className="font-mono text-ink">•••• •••• •••• 4512</span>
              <span className="text-xs text-accent font-medium">Sandbox Card</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPaying(null)} className="btn-outline flex-1">Cancel</button>
              <button onClick={process} disabled={processing} className="btn-primary flex-1 disabled:opacity-70 justify-center">{processing ? <Spinner label="Processing payment" /> : "Pay Now"}</button>
            </div>
          </div>
        )}
        {paying && success && (
          <div className="p-6 text-center">
            <IconCircleCheck className="text-success mx-auto mb-3" size={48} stroke={1.5} />
            <h3 className="text-lg font-serif font-semibold text-ink">Payment Successful</h3>
            <p className="text-sm text-muted mt-1">Receipt generated and statement updated.</p>
            <div className="mt-4 rounded-pop bg-canvas p-3 text-sm flex justify-between">
              <span className="text-muted">Txn ID</span>
              <span className="font-mono text-ink">{fees.find((f) => f.id === paying.id)?.txnId}</span>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={downloadReceipt} className="btn-outline flex-1 justify-center"><IconDownload size={16} /> Download Receipt</button>
              <button onClick={() => setPaying(null)} className="btn-primary flex-1 justify-center">Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
