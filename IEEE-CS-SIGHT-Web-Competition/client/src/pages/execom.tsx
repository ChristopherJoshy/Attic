import { SectionHeading } from "@/components/ui/section-heading";
import { MemberCard } from "@/components/ui/member-card";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import execomRaw from "@/data/execom.json?raw";
import { z } from "zod";
import { execomMemberSchema, type ExecomMember } from "@shared/schema";

let parsedExecom: unknown = [];
try {
  parsedExecom = JSON.parse(execomRaw);
} catch (e) {
  console.error("execom.json is not valid JSON:", e);
}
const execomParse = z.array(execomMemberSchema).safeParse(parsedExecom);
const execomMembers: ExecomMember[] = execomParse.success ? execomParse.data : [];
if (!execomParse.success) {
  console.error("Invalid execom.json data:", execomParse.error?.message);
}

export default function Execom() {
  const { ref: tableRef, isIntersecting: tableVisible } = useIntersectionObserver();
  const { ref: cardsRef, isIntersecting: cardsVisible } = useIntersectionObserver();

  return (
    <div className="py-20 px-4 pt-32" data-testid="execom-page">
      <div className="container mx-auto">
        <SectionHeading
          title="Executive Committee"
          subtitle="Meet the dedicated leaders driving our humanitarian technology initiatives"
        />

        {/* Desktop: Table Layout */}
        <div 
          ref={tableRef}
          className={`hidden md:block transition-all duration-1000 ${
            tableVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          data-testid="execom-table"
        >
          <Card className="glass-morphism overflow-hidden">
            <table className="w-full">
              <thead className="cosmic-gradient">
                <tr>
                  <th className="px-6 py-4 text-left text-white font-semibold">Name</th>
                  <th className="px-6 py-4 text-left text-white font-semibold">Position</th>
                  <th className="px-6 py-4 text-left text-white font-semibold">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {execomMembers.map((member, index) => {
                  const isEmail = member.contact.includes("@");
                  return (
                    <tr 
                      key={member.id} 
                      className="hover:bg-muted/30 transition-colors"
                      data-testid={`execom-row-${member.id}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 cosmic-gradient rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-white">{member.initials}</span>
                          </div>
                          <span className="font-medium text-foreground" data-testid={`table-name-${member.id}`}>
                            {member.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-primary font-medium" data-testid={`table-position-${member.id}`}>
                        {member.position}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground" data-testid={`table-contact-${member.id}`}>
                        <div className="flex items-center space-x-2">
                          {isEmail ? (
                            <Mail className="w-4 h-4" />
                          ) : (
                            <Phone className="w-4 h-4" />
                          )}
                          <span>{member.contact}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Mobile: Card Layout */}
        <div 
          ref={cardsRef}
          className={`md:hidden space-y-6 transition-all duration-1000 ${
            cardsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          data-testid="execom-cards"
        >
          {execomMembers.map((member, index) => (
            <MemberCard 
              key={member.id} 
              member={member}
              className={`transition-all duration-500`}
              style={{ animationDelay: `${index * 100}ms` }}
            />
          ))}
        </div>

        {/* Additional Information */}
        <div className="mt-16 text-center">
          <Card className="glass-morphism card-cosmic max-w-2xl mx-auto">
            <CardContent className="p-8">
              <h3 className="text-2xl font-poppins font-semibold mb-4 text-primary">Join Our Team</h3>
              <p className="text-muted-foreground mb-6">
                Interested in becoming part of our executive committee? We're always looking for passionate individuals 
                who want to make a difference through technology.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a 
                  href="mailto:sight@ieee.sbcek.org?subject=Executive Committee Interest"
                  className="btn-cosmic inline-flex items-center justify-center ink-link"
                  data-testid="join-team-email"
                >
                  Contact Us
                </a>
                <a 
                  href="/contact"
                  className="btn-glass inline-flex items-center justify-center ink-link"
                  data-testid="join-team-contact"
                >
                  Learn More
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
