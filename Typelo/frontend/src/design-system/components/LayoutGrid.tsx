/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * LayoutGrid Component - Standard 3-column responsive grid system.
 * Handles layout for fixed sidebars and fluid main content.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * LayoutGrid: Main component.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * LayoutGridProps: Props interface.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React core.
 */

import React from 'react';

// ============================================================================
// LayoutGrid Component
// ============================================================================

export interface LayoutGridProps {
    /** Left sidebar content (fixed width on desktop) */
    left?: React.ReactNode;
    /** Center main content (fluid) */
    center: React.ReactNode;
    /** Right sidebar content (fixed width on desktop) */
    right?: React.ReactNode;
    /** Additional className for the container */
    className?: string;
    /** Whether center column is full-width (no sidebars) */
    fullWidth?: boolean;
}

export function LayoutGrid({
    left,
    center,
    right,
    className = '',
    fullWidth = false,
}: LayoutGridProps) {
    if (fullWidth) {
        return (
            <div
                className={`h-full w-full flex flex-col ${className}`}
                role="main"
            >
                {center}
            </div>
        );
    }

    return (
        <div
            className={`
        h-full w-full flex flex-col lg:flex-row 
        px-4 sm:px-6 lg:px-12 pb-6 lg:pb-12 
        gap-6 lg:gap-12 
        overflow-y-auto lg:overflow-hidden
        ${className}
      `}
            role="main"
        >
            {/* Left Sidebar */}
            {left && (
                <aside
                    className="w-full lg:w-80 flex-shrink-0 flex flex-col justify-center order-2 lg:order-1"
                    aria-label="User statistics"
                >
                    {left}
                </aside>
            )}

            {/* Center Content */}
            <main
                className={`
          flex-1 flex items-center justify-center 
          min-h-[400px] lg:min-h-0
          order-1 lg:order-2
        `}
            >
                {center}
            </main>

            {/* Right Sidebar */}
            {right && (
                <aside
                    className="w-full lg:w-80 flex-shrink-0 flex flex-col justify-center order-3"
                    aria-label="Leaderboard"
                >
                    {right}
                </aside>
            )}
        </div>
    );
}

export default LayoutGrid;
