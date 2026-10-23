/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * StatTiles Component - Grid of statistics tiles.
 * Used to display quick stats like WPM, Accuracy, etc.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * StatTiles: Main component (Container).
 * StatTileItem: Individual tile component.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * StatTile: Interface for data object.
 * StatTilesProps: Props interface.
 * colorStyles: Style mappings for colors.
 * layoutStyles: Style mappings for grid layouts.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React core.
 */

import React from 'react';

// ============================================================================
// StatTiles Component
// ============================================================================

export interface StatTile {
    /** Label for the stat */
    label: string;
    /** Value to display */
    value: string | number;
    /** Optional color accent */
    color?: 'default' | 'primary' | 'success' | 'danger' | 'warning';
    /** Optional icon */
    icon?: React.ReactNode;
    /** Optional sparkline data */
    sparklineData?: number[];
    /** Optional trend indicator */
    trend?: 'up' | 'down' | 'stable';
}

export interface StatTilesProps {
    /** Array of stat tiles (typically 4 for 2x2 grid) */
    tiles: StatTile[];
    /** Layout variant */
    layout?: '2x2' | '4x1' | '1x4';
    /** Additional className */
    className?: string;
}

const colorStyles: Record<string, string> = {
    default: 'text-text-primary',
    primary: 'text-primary-400',
    success: 'text-success-text',
    danger: 'text-danger-text',
    warning: 'text-warning-text',
};

const layoutStyles: Record<string, string> = {
    '2x2': 'grid-cols-2 grid-rows-2',
    '4x1': 'grid-cols-4 grid-rows-1',
    '1x4': 'grid-cols-1 grid-rows-4',
};

export function StatTiles({
    tiles,
    layout = '2x2',
    className = '',
}: StatTilesProps) {
    return (
        <div
            className={`grid gap-3 ${layoutStyles[layout]} ${className}`}
            role="list"
            aria-label="Statistics"
        >
            {tiles.map((tile, index) => (
                <StatTileItem key={`${tile.label}-${index}`} tile={tile} />
            ))}
        </div>
    );
}

function StatTileItem({ tile }: { tile: StatTile }) {
    const { label, value, color = 'default', icon, trend } = tile;
    const valueColor = colorStyles[color];

    return (
        <div
            className={`
        group relative p-4 rounded-xl 
        bg-surface border border-surface-border
        hover:bg-surface-hover transition-colors
        overflow-hidden
      `}
            role="listitem"
            aria-label={`${label}: ${value}`}
        >
            {/* Background decorative element */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10">
                {/* Label */}
                <p className="text-[10px] text-text-muted uppercase tracking-widest mb-2 font-medium group-hover:text-text-secondary transition-colors">
                    {label}
                </p>

                {/* Value row */}
                <div className="flex items-center gap-2">
                    {icon && (
                        <span className="text-text-muted group-hover:text-text-secondary transition-colors">
                            {icon}
                        </span>
                    )}

                    <p className={`text-2xl font-mono font-bold tracking-tighter ${valueColor} group-hover:text-white transition-colors`}>
                        {value}
                    </p>

                    {trend && (
                        <span className={`text-xs ${trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-text-muted'}`}>
                            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default StatTiles;
