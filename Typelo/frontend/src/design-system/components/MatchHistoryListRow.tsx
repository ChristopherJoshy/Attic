/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * MatchHistoryListRow Component - Displays a single match history entry.
 * Shows output, stats, and opponent details.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * MatchHistoryListRow: Main component.
 * formatDate: Helper to format relative or absolute date.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * MatchHistoryListRowProps: Props interface.
 * resultColors: Colors for result bar.
 * resultBadgeColors: Colors for result badge.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React core.
 */

import React from 'react';

// ============================================================================
// MatchHistoryListRow Component
// ============================================================================

export interface MatchHistoryListRowProps {
    /** Match ID */
    matchId: string;
    /** Opponent name */
    opponentName: string;
    /** Opponent avatar URL */
    opponentAvatarUrl?: string | null;
    /** Whether opponent was a bot */
    opponentIsBot?: boolean;
    /** Match result */
    result: 'win' | 'loss' | 'tie';
    /** Your WPM */
    wpm: number;
    /** Your accuracy */
    accuracy: number;
    /** ELO change */
    eloChange: number;
    /** When the match was played (ISO string or Date) */
    playedAt: string | Date;
    /** Click handler */
    onClick?: () => void;
    /** Additional className */
    className?: string;
}

export function MatchHistoryListRow({
    matchId,
    opponentName,
    opponentAvatarUrl,
    opponentIsBot = false,
    result,
    wpm,
    accuracy,
    eloChange,
    playedAt,
    onClick,
    className = '',
}: MatchHistoryListRowProps) {
    const isClickable = !!onClick;

    const resultColors = {
        win: 'bg-success',
        loss: 'bg-danger',
        tie: 'bg-text-muted',
    };

    const resultBadgeColors = {
        win: 'bg-success-muted text-success',
        loss: 'bg-danger-muted text-danger',
        tie: 'bg-surface-active text-text-muted',
    };

    const formatDate = (date: string | Date) => {
        const d = typeof date === 'string' ? new Date(date.endsWith('Z') ? date : date + 'Z') : date;
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString();
    };

    return (
        <div
            className={`
        relative flex items-center gap-4 p-4 rounded-xl
        h-14 min-h-[56px]
        bg-surface hover:bg-surface-hover
        transition-colors
        ${isClickable ? 'cursor-pointer' : ''}
        ${className}
      `}
            onClick={onClick}
            role={isClickable ? 'button' : 'listitem'}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
            aria-label={`${result === 'win' ? 'Victory' : result === 'loss' ? 'Defeat' : 'Draw'} against ${opponentName}, ${wpm} WPM, ${eloChange > 0 ? '+' : ''}${eloChange} ELO`}
        >
            {/* Result color bar */}
            <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${resultColors[result]}`} />

            {/* Result badge */}
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${resultBadgeColors[result]}`}>
                {result === 'win' ? 'W' : result === 'loss' ? 'L' : 'T'}
            </div>

            {/* Opponent avatar */}
            <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-tertiary flex-shrink-0">
                {opponentAvatarUrl && !opponentIsBot ? (
                    <img
                        src={opponentAvatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted text-sm font-medium">
                        {opponentIsBot ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                            </svg>
                        ) : (
                            opponentName.charAt(0).toUpperCase()
                        )}
                    </div>
                )}
            </div>

            {/* Opponent info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm truncate text-text-primary">
                        {opponentName}
                    </span>
                    {opponentIsBot && (
                        <span className="text-[8px] uppercase tracking-wider bg-surface-active px-1.5 py-0.5 rounded-full text-text-muted flex-shrink-0">
                            Bot
                        </span>
                    )}
                </div>
                <p className="text-[10px] text-text-muted mt-0.5">
                    {formatDate(playedAt)}
                </p>
            </div>

            {/* Stats - Desktop */}
            <div className="hidden sm:flex items-center gap-6 text-right flex-shrink-0">
                <div>
                    <p className="text-lg font-mono font-bold text-text-primary">{Math.round(wpm)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">WPM</p>
                </div>
                <div>
                    <p className="text-lg font-mono font-bold text-text-primary">{Math.round(accuracy)}%</p>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">ACC</p>
                </div>
                <div className="w-16">
                    <p className={`text-lg font-mono font-bold ${eloChange > 0 ? 'text-success' : eloChange < 0 ? 'text-danger' : 'text-text-muted'}`}>
                        {eloChange > 0 ? '+' : ''}{eloChange}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">ELO</p>
                </div>
            </div>

            {/* Stats - Mobile (compact) */}
            <div className="sm:hidden flex-shrink-0 text-right">
                <p className={`text-base font-mono font-bold ${eloChange > 0 ? 'text-success' : eloChange < 0 ? 'text-danger' : 'text-text-muted'}`}>
                    {eloChange > 0 ? '+' : ''}{eloChange}
                </p>
                <p className="text-[8px] uppercase tracking-wider text-text-muted">ELO</p>
            </div>
        </div>
    );
}

export default MatchHistoryListRow;
