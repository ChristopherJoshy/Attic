import React from "react";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { notifications } from "../lib/mockData";
import { cn } from "../lib/cn";
import { IconAlertTriangle, IconFileText, IconCreditCard, IconChartBar, IconInfoCircle } from "@tabler/icons-react";

const catIcon: Record<string, React.FC<any>> = {
  alert: IconAlertTriangle,
  exam: IconFileText,
  fee: IconCreditCard,
  result: IconChartBar,
  info: IconInfoCircle,
};

export const Notifications: React.FC = () => {
  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-3xl mx-auto">
            <PageHeader title="Notifications" subtitle="Alerts, exam updates and university circulars." />

            {notifications.length === 0 ? (
              <Card><EmptyState title="You're all caught up" description="No new notifications." /></Card>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => {
                  const Icon = catIcon[n.category];
                  return (
                    <Card key={n.id} interactive className={cn("!p-4", !n.read && "border-accent/30 bg-accent/[0.02]")}>
                      <div className="flex gap-3">
                        <span className="text-muted leading-none mt-0.5"><Icon size={18} /></span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={cn("text-sm font-medium", n.read ? "text-muted" : "text-ink")}>{n.title}</h3>
                            {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                          </div>
                          <p className="text-sm text-muted mt-1">{n.body}</p>
                          <span className="text-[11px] text-faint mt-1.5 block">{n.time}</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
