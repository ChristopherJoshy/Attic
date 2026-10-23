/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * PlayerCard Component - Displays summary of a player's profile.
 * Used in lists, sidebars, and matchmaking screens.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * PlayerCard: Main component.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * PlayerCardProps: Props interface.
 * rankColors: Mapping of rank names to text color classes.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React core.
 */

import React from 'react';

// ============================================================================
// PlayerCard Component
// ============================================================================

export interface PlayerCardProps {
    /** Player display name */
    name: string;
    /** Player avatar URL */
    avatarUrl?: string | null;
    /** Current rank tier */
    rank: string;
    /** Current ELO rating */
    elo: number;
    /** ELO change from last match (optional) */
    eloChange?: number;
    /** Progress to next rank (0-100) */
    rankProgress?: number;
    /** Whether this is the current user */
    isCurrentUser?: boolean;
    /** Whether player is online */
    isOnline?: boolean;
    /** Additional className */
    className?: string;
    /** Click handler */
    onClick?: () => void;
}

const rankColors: Record<string, string> = {
    Unranked: 'text-rank-unranked',
    Bronze: 'text-rank-bronze',
    Silver: 'text-rank-silver',
    Gold: 'text-rank-gold',
    Platinum: 'text-rank-platinum',
    Diamond: 'text-rank-diamond',
    Ranker: 'text-rank-ranker',
};

export function PlayerCard({
    name,
    avatarUrl,
    rank,
    elo,
    eloChange,
    rankProgress,
    isCurrentUser = false,
    isOnline = false,
    className = '',
    onClick,
}: PlayerCardProps) {
    const rankColor = rankColors[rank] || 'text-text-secondary';
    const isClickable = !!onClick;

    return (
        <div
            className={`
        relative p-4 rounded-2xl 
        bg-surface border border-surface-border
        ${isClickable ? 'cursor-pointer hover:bg-surface-hover transition-colors' : ''}
        ${isCurrentUser ? 'ring-1 ring-primary-500/30' : ''}
        ${className}
      `}
            onClick={onClick}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
            aria-label={`${name}, ${rank} rank, ${elo} ELO`}
        >
            <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-bg-tertiary border-2 border-surface-border">
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                crossOrigin="anonymous"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-text-muted">
                                {name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* Online indicator */}
                    {isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-bg-primary rounded-full flex items-center justify-center">
                            <div className="w-2.5 h-2.5 bg-success rounded-full animate-pulse" />
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-text-primary truncate">
                            {name}
                        </h3>
                        {isCurrentUser && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary-500/10 text-primary-400 rounded">
                                You
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm font-medium ${rankColor}`}>
                            {rank}
                        </span>
                        <span className="text-text-muted">•</span>
                        <span className="text-sm font-mono text-text-secondary">
                            {elo} ELO
                        </span>

                        {eloChange !== undefined && eloChange !== 0 && (
                            <span
                                className={`
                  text-xs font-mono font-bold px-1.5 py-0.5 rounded
                  ${eloChange > 0 ? 'text-success-text bg-success-muted' : 'text-danger-text bg-danger-muted'}
                `}
                            >
                                {eloChange > 0 ? '+' : ''}{eloChange}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Rank Progress Bar */}
            {rankProgress !== undefined && (
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-text-muted mb-1">
                        <span>{rank}</span>
                        <span>{rankProgress}%</span>
                    </div>
                    <div className="h-1 bg-surface-active rounded-full overflow-hidden">
                        <div
                            className={`h-full ${rankColor.replace('text-', 'bg-')} rounded-full transition-all duration-500`}
                            style={{ width: `${rankProgress}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default PlayerCard;
