import React, { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { StatusPill } from "../components/StatusPill";
import { toneForStatus } from "../lib/status";
import { EmptyState } from "../components/EmptyState";
import { certificates, studentData } from "../lib/mockData";
import { downloadMockPdf } from "../lib/download";
import { IconCertificate, IconDownload, IconClock } from "@tabler/icons-react";

export const Certificates: React.FC = () => {
  const [list, setList] = useState(certificates);

  const request = (id: string) =>
    setList((prev) => prev.map((c) => (c.id === id ? { ...c, status: "Processing", requestedOn: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) } : c)));

  const ready = list.filter((c) => c.status === "Ready").length;

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <PageHeader title="Certificates" subtitle="Request and download academic certificates." actions={<StatusPill status={`${ready} ready`} tone="success" />} />

            <div className="space-y-3">
              {list.map((c) => (
                <Card key={c.id} interactive className="!p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-pop bg-accent/10 text-accent flex items-center justify-center shrink-0"><IconCertificate size={20} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-ink text-sm">{c.name}</h3>
                        <span className="text-[10px] uppercase tracking-wider text-muted bg-black/[0.04] px-1.5 py-0.5 rounded">{c.type}</span>
                      </div>
                      <div className="text-xs text-muted mt-1">
                        {c.status === "Ready" && c.issuedOn ? `Issued ${c.issuedOn}` : c.status === "Processing" && c.requestedOn ? `Requested ${c.requestedOn}` : "Not yet requested"}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <StatusPill status={c.status} tone={toneForStatus(c.status)} />
                      {c.status === "Ready" ? (
                        <button onClick={() => downloadMockPdf(`${c.name}.pdf`, c.name, [studentData.name, `Register No: ${studentData.rollNumber}`, `Issued: ${c.issuedOn}`, `Status: ${c.status}`])} className="btn-outline !py-1.5 !px-3 text-xs"><IconDownload size={14} /> Download</button>
                      ) : c.status === "Processing" ? (
                        <span className="text-xs text-warning flex items-center gap-1"><IconClock size={14} /> Processing</span>
                      ) : (
                        <button onClick={() => request(c.id)} className="btn-primary !py-1.5 !px-3 text-xs">Request</button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              {list.length === 0 && <Card><EmptyState title="No certificates" /></Card>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
