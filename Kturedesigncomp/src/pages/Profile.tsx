import React from "react";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { StatusPill } from "../components/StatusPill";
import { studentData, getProgramStats } from "../lib/mockData";

const personalOrder = [
  "gender", "dob", "bloodGroup", "religion", "community", "category", "nationality", "motherTongue",
] as const;

export const Profile: React.FC = () => {
  const stats = getProgramStats();
  const { personal } = studentData;

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <PageHeader title="My Profile" subtitle="Your personal and academic information on record." />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Identity card */}
              <Card className="lg:col-span-1 flex flex-col">
                <div className="flex flex-col items-center text-center pt-2">
                  <div className="w-24 h-24 rounded-pop bg-ink text-white flex items-center justify-center font-serif text-4xl font-bold">
                    {studentData.name.charAt(0)}
                  </div>
                  <h2 className="text-xl font-bold text-ink mt-4">{studentData.name}</h2>
                  <p className="text-muted text-sm font-mono">{studentData.rollNumber}</p>
                  <StatusPill status="Active Student" tone="success" className="mt-3" />
                </div>
                <div className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
                  <div className="flex justify-between"><span className="text-muted">Program</span><span className="font-medium text-ink text-right">{studentData.program}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Branch</span><span className="font-medium text-ink text-right max-w-[60%]">{studentData.branch}</span></div>
                  <div className="flex justify-between"><span className="text-muted">College</span><span className="font-medium text-ink text-right max-w-[60%]">{studentData.college}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Scheme</span><span className="font-medium text-ink">{studentData.scheme}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Admission</span><span className="font-medium text-ink">{studentData.admissionYear}</span></div>
                </div>
              </Card>

              {/* Details */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <h3 className="font-semibold text-ink mb-4">Personal Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                    {personalOrder.map((key) => (
                      <div key={key}>
                        <dt className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
                          {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                        </dt>
                        <dd className="text-sm font-medium text-ink">{personal[key]}</dd>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Card>
                    <h3 className="font-semibold text-ink mb-4">Contact</h3>
                    <div className="space-y-4 text-sm">
                      <div><dt className="text-xs text-muted uppercase tracking-wider">Email</dt><dd className="font-medium text-ink mt-1">{studentData.email}</dd></div>
                      <div><dt className="text-xs text-muted uppercase tracking-wider">Phone</dt><dd className="font-medium text-ink mt-1">{studentData.phone}</dd></div>
                      <div><dt className="text-xs text-muted uppercase tracking-wider">Address</dt><dd className="font-medium text-ink mt-1 leading-relaxed">{studentData.address}</dd></div>
                    </div>
                  </Card>
                  <Card>
                    <h3 className="font-semibold text-ink mb-4">Guardian</h3>
                    <div className="space-y-4 text-sm">
                      <div><dt className="text-xs text-muted uppercase tracking-wider">Name</dt><dd className="font-medium text-ink mt-1">{personal.guardian}</dd></div>
                      <div><dt className="text-xs text-muted uppercase tracking-wider">Phone</dt><dd className="font-medium text-ink mt-1">{personal.guardianPhone}</dd></div>
                    </div>
                    <div className="mt-5 pt-4 border-t border-line">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">Admission No.</span>
                        <span className="font-mono font-medium text-ink">{studentData.admissionNumber}</span>
                      </div>
                    </div>
                  </Card>
                </div>

                <Card>
                  <h3 className="font-semibold text-ink mb-4">Academic Standing</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div><div className="text-2xl font-bold text-accent nums">{stats.cgpa}</div><div className="text-xs text-muted mt-1">CGPA</div></div>
                    <div><div className="text-2xl font-bold text-ink nums">{stats.creditsEarned}</div><div className="text-xs text-muted mt-1">Credits earned</div></div>
                    <div><div className="text-2xl font-bold text-ink nums">{stats.semestersCleared}</div><div className="text-xs text-muted mt-1">Semesters cleared</div></div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
