import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ItemCardProps {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

const ItemCard = ({ className, children, onClick }: ItemCardProps) => {
  return (
    <div 
      className={cn("item-card bg-background p-3 md:p-4 rounded", className)}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default ItemCard;
