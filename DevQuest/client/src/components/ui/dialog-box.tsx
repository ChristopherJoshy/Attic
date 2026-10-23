import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DialogBoxProps {
  className?: string;
  children: ReactNode;
}

const DialogBox = ({ className, children }: DialogBoxProps) => {
  return (
    <div className={cn("dialog-box bg-background p-6 rounded", className)}>
      {children}
    </div>
  );
};

export default DialogBox;
