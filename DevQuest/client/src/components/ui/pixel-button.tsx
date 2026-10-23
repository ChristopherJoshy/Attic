import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "accent" | "highlight";
  size?: "sm" | "md" | "lg";
}

const PixelButton = forwardRef<HTMLButtonElement, PixelButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    const baseClasses = "pixel-btn font-pixel transition text-text";
    
    const variantClasses = {
      primary: "bg-primary",
      accent: "bg-accent",
      highlight: "bg-highlight"
    };
    
    const sizeClasses = {
      sm: "text-sm py-1 px-3",
      md: "text-sm md:text-base py-2 px-4",
      lg: "text-base md:text-lg py-3 px-6"
    };
    
    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

PixelButton.displayName = "PixelButton";

export default PixelButton;
