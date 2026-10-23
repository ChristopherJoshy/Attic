/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * CTAButton Component - Primary Call-to-Action button for the design system.
 * Supports variants, sizes, icons, and loading states.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * CTAButton: Main component.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * variantStyles: Tailwind classes for visual variants.
 * sizeStyles: Tailwind classes for size presets.
 * CTAButtonVariant: Type definition for variants.
 * CTAButtonSize: Type definition for sizes.
 * CTAButtonProps: Props interface.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React core.
 */

import React from 'react';

// ============================================================================
// CTAButton Component
// ============================================================================

export type CTAButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type CTAButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface CTAButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: CTAButtonVariant;
  /** Size preset */
  size?: CTAButtonSize;
  /** Full width button */
  fullWidth?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Icon to display before text */
  leftIcon?: React.ReactNode;
  /** Icon to display after text */
  rightIcon?: React.ReactNode;
  /** Children content */
  children: React.ReactNode;
}

const variantStyles: Record<CTAButtonVariant, string> = {
  primary: `
    bg-primary-500 text-black 
    hover:bg-primary-400 
    focus-visible:ring-primary-500/50
    disabled:bg-primary-500/50
  `,
  secondary: `
    bg-surface hover:bg-surface-hover
    text-text-primary border border-surface-border
    hover:border-white/20
    focus-visible:ring-white/20
  `,
  ghost: `
    bg-transparent text-text-secondary
    hover:bg-surface-hover hover:text-text-primary
    focus-visible:ring-white/20
  `,
  danger: `
    bg-danger text-white
    hover:bg-danger/90
    focus-visible:ring-danger/50
  `,
  success: `
    bg-success text-black
    hover:bg-success/90
    focus-visible:ring-success/50
  `,
};

const sizeStyles: Record<CTAButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-sm gap-2',
  xl: 'px-8 py-4 text-base gap-3',
};

export function CTAButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}: CTAButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      className={`
        inline-flex items-center justify-center
        font-semibold tracking-wide uppercase
        rounded-xl
        transition-all duration-fast
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary
        disabled:cursor-not-allowed disabled:opacity-50
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={isDisabled}
      aria-busy={isLoading}
      aria-disabled={isDisabled}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
}

export default CTAButton;
