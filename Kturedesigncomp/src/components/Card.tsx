import React from "react";
import { cn } from "../lib/cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
  as?: React.ElementType;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  interactive = false,
  as: Tag = "div",
  ...props
}) => {
  const hasBg = className.split(" ").some((c) => c.startsWith("bg-"));
  return (
    <Tag
      className={cn(
        !hasBg && "card",
        "p-4 sm:p-5",
        interactive && "transition-[box-shadow,border-color] duration-300 hover:shadow-card-hover hover:border-line-strong",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
};
