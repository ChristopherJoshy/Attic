import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";
import type { ExecomMember } from "@shared/schema";

interface MemberCardProps {
  member: ExecomMember;
  className?: string;
  style?: React.CSSProperties;
}

export function MemberCard({ member, className = "", style }: MemberCardProps) {
  const isEmail = member.contact.includes("@");

  return (
    <Card className={`glass-morphism transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${className}`} style={style} data-testid={`member-card-${member.id}`}>
      <CardContent className="p-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center">
            {member.avatar ? (
              <img src={member.avatar} alt={member.name} className="w-full h-full object-cover bw-image" />
            ) : (
              <span className="text-lg font-semibold">{member.initials}</span>
            )}
          </div>
          <div>
            <h3 className="text-xl font-poppins font-semibold text-foreground" data-testid={`member-name-${member.id}`}>
              {member.name}
            </h3>
            <p className="text-primary font-medium" data-testid={`member-position-${member.id}`}>
              {member.position}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-muted-foreground">
          {isEmail ? (
            <Mail className="w-4 h-4" />
          ) : (
            <Phone className="w-4 h-4" />
          )}
          <span data-testid={`member-contact-${member.id}`}>{member.contact}</span>
        </div>
      </CardContent>
    </Card>
  );
}
