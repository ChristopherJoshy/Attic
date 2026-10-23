/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * LeaderboardRow Component - Renders a single row in the leaderboard.
 * Displays rank, avatar, name, stats, and badges.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * LeaderboardRow: Main component.
 * positionBadge: Helper to render top 3 rank badges.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * rankColors: Mapping of rank names to text color classes.
 * LeaderboardRowProps: Props interface.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React core.
 */

import React from 'react';

// ============================================================================
// LeaderboardRow Component
// ============================================================================

export interface LeaderboardRowProps {
    /** Position in leaderboard (1-indexed) */
    position: number;
    /** Player name */
    name: string;
    /** Player avatar URL */
    avatarUrl?: string | null;
    /** Player's current ELO */
    elo: number;
    /** Player's best WPM */
    bestWpm?: number;
    /** Player's rank tier */
    rank: string;
    /** Whether this is the current user */
    isCurrentUser?: boolean;
    /** Whether player is online */
    isOnline?: boolean;
    /** Click handler */
    onClick?: () => void;
    /** Additional className */
    className?: string;
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

export function LeaderboardRow({
    position,
    name,
    avatarUrl,
    elo,
    bestWpm,
    rank,
    isCurrentUser = false,
    isOnline = false,
    onClick,
    className = '',
}: LeaderboardRowProps) {
    const rankColor = rankColors[rank] || 'text-text-secondary';
    const isTop3 = position <= 3;
    const isClickable = !!onClick;

    const positionBadge = () => {
        if (!isTop3) {
            return (
                <span className="text-text-muted font-mono text-sm">
                    {position}
                </span>
            );
        }

        const colors = [
            'border-yellow-400 text-yellow-400 bg-yellow-400/10',
            'border-gray-400 text-gray-400 bg-gray-400/10',
            'border-amber-600 text-amber-600 bg-amber-600/10',
        ];

        return (
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border text-[10px] font-bold ${colors[position - 1]}`}>
                {position}
            </span>
        );
    };

    return (
        <div
            className={`
        group relative flex items-center gap-4 p-3 rounded-lg
        h-14 min-h-[56px]
        transition-colors
        ${isCurrentUser ? 'bg-primary-500/10 border border-primary-500/20' : 'hover:bg-surface-hover'}
        ${isClickable ? 'cursor-pointer' : ''}
        ${className}
      `}
            onClick={onClick}
            role={isClickable ? 'button' : 'listitem'}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
            aria-label={`Rank ${position}: ${name}, ${elo} ELO, ${rank}`}
        >
            {/* Current user indicator */}
            {isCurrentUser && (
                <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-primary-500 rounded-r" />
            )}

            {/* Position */}
            <div className="w-6 text-center flex-shrink-0">
                {positionBadge()}
            </div>

            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-tertiary ring-2 ring-transparent group-hover:ring-white/10 transition-all">
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-transparent">
                            <span className="text-xs font-bold text-white/50">
                                {name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}
                </div>

                {/* Online status */}
                {isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-bg-primary rounded-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center justify-between">
                    <span className={`text-sm truncate font-medium ${isCurrentUser ? 'text-white' : 'text-text-secondary group-hover:text-white transition-colors'}`}>
                        {name}
                    </span>
                    <span className="text-xs font-mono font-bold text-white/80">
                        {elo}
                    </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                    <span className={`text-[10px] uppercase tracking-wider ${rankColor}`}>
                        {rank}
                    </span>
                    {bestWpm && (
                        <span className="text-[10px] text-text-muted font-mono">
                            {bestWpm} WPM
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default LeaderboardRow;
