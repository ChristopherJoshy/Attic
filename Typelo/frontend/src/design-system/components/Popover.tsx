/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Popover Component - Dropdown menu or popup content.
 * Supports positioning, click outside detection, and keyboard navigation.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * Popover: Main component.
 * PopoverItem: Component for individual menu items.
 * PopoverDivider: Visual separator.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * PopoverProps: Popover props interface.
 * PopoverItemProps: Item props interface.
 * placementStyles: CSS classes for positioning.
 * animationOrigins: Transform origins for animations.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React core hooks.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============================================================================
// Popover Component
// ============================================================================

export type PopoverPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface PopoverProps {
    /** Whether the popover is open */
    isOpen: boolean;
    /** Handler called when popover should close */
    onClose: () => void;
    /** Trigger element */
    trigger: React.ReactNode;
    /** Popover content */
    children: React.ReactNode;
    /** Placement relative to trigger */
    placement?: PopoverPlacement;
    /** Whether clicking outside closes popover */
    closeOnClickOutside?: boolean;
    /** Whether pressing Escape closes popover */
    closeOnEscape?: boolean;
    /** Additional className for the popover */
    className?: string;
    /** Offset from trigger (in pixels) */
    offset?: number;
}

const placementStyles: Record<PopoverPlacement, string> = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
};

const animationOrigins: Record<PopoverPlacement, string> = {
    top: 'origin-bottom',
    bottom: 'origin-top',
    left: 'origin-right',
    right: 'origin-left',
};

export function Popover({
    isOpen,
    onClose,
    trigger,
    children,
    placement = 'bottom',
    closeOnClickOutside = true,
    closeOnEscape = true,
    className = '',
    offset = 8,
}: PopoverProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Handle escape key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (closeOnEscape && e.key === 'Escape') {
            onClose();
        }
    }, [closeOnEscape, onClose]);

    // Handle click outside
    const handleClickOutside = useCallback((e: MouseEvent) => {
        if (
            closeOnClickOutside &&
            containerRef.current &&
            !containerRef.current.contains(e.target as Node)
        ) {
            onClose();
        }
    }, [closeOnClickOutside, onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('mousedown', handleClickOutside);
            popoverRef.current?.focus();
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, handleKeyDown, handleClickOutside]);

    return (
        <div ref={containerRef} className="relative inline-block">
            {/* Trigger */}
            {trigger}

            {/* Popover */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    role="menu"
                    aria-orientation="vertical"
                    tabIndex={-1}
                    className={`
            absolute z-popover
            ${placementStyles[placement]}
            min-w-48
            bg-bg-elevated border border-surface-border
            rounded-xl shadow-2xl
            overflow-hidden
            animate-scale-in ${animationOrigins[placement]}
            focus:outline-none
            ${className}
          `}
                    style={{ marginTop: placement === 'bottom' ? offset : undefined }}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// PopoverItem Component (for menu items)
// ============================================================================

export interface PopoverItemProps {
    /** Click handler */
    onClick?: () => void;
    /** Icon to display */
    icon?: React.ReactNode;
    /** Label text */
    children: React.ReactNode;
    /** Description text */
    description?: string;
    /** Whether this item is selected/active */
    isActive?: boolean;
    /** Accent color */
    accentColor?: string;
    /** Whether item is disabled */
    disabled?: boolean;
}

export function PopoverItem({
    onClick,
    icon,
    children,
    description,
    isActive = false,
    accentColor,
    disabled = false,
}: PopoverItemProps) {
    return (
        <button
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            role="menuitem"
            className={`
        w-full px-4 py-3 flex items-center gap-3 text-left
        transition-colors
        ${isActive ? 'bg-surface-active' : 'hover:bg-surface-hover'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        focus:outline-none focus-visible:bg-surface-hover
      `}
            style={accentColor && isActive ? { backgroundColor: `${accentColor}10` } : undefined}
        >
            {/* Indicator dot */}
            <div
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-20'}`}
                style={{ backgroundColor: accentColor || 'currentColor' }}
            />

            {/* Icon */}
            {icon && (
                <span className="text-text-muted flex-shrink-0">
                    {icon}
                </span>
            )}

            {/* Text */}
            <div className="flex flex-col flex-1 min-w-0">
                <span className={`text-xs font-bold tracking-wider uppercase ${isActive ? 'text-white' : 'text-text-muted'}`}>
                    {children}
                </span>
                {description && (
                    <span className="text-[9px] text-text-muted opacity-60">
                        {description}
                    </span>
                )}
            </div>
        </button>
    );
}

// ============================================================================
// PopoverDivider Component
// ============================================================================

export function PopoverDivider() {
    return <div className="h-px w-full bg-surface-border" role="separator" />;
}

export default Popover;
