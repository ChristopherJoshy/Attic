/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * ResultCard Component - Detailed post-match result display.
 * Shows stats comparison, rank updates, and next actions.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * ResultCard: Main component.
 * PlayerDisplay: Sub-component for player profile in result view.
 * StatBar: Sub-component for comparing specific stats.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * ResultCardProps: Props interface.
 * MatchResultType: 'win' | 'loss' | 'tie'.
 * resultColors: Color configs for result types.
 * rankColors: Rank color definitions.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React core.
 */

import React from 'react';

// ============================================================================
// ResultCard Component
// ============================================================================

export type MatchResultType = 'win' | 'loss' | 'tie';

export interface ResultCardPlayer {
    name: string;
    avatarUrl?: string | null;
    rank: string;
    wpm: number;
    accuracy: number;
    score: number;
    eloChange?: number;
    isBot?: boolean;
}

export interface ResultCardProps {
    /** Match result from user's perspective */
    result: MatchResultType;
    /** Game mode */
    gameMode?: 'ranked' | 'training';
    /** User's stats */
    player: ResultCardPlayer;
    /** Opponent's stats */
    opponent: ResultCardPlayer;
    /** New ELO after match */
    newElo?: number;
    /** Whether user ranked up */
    rankUp?: boolean;
    /** New rank if ranked up */
    newRank?: string;
    /** Click handler for play again */
    onPlayAgain?: () => void;
    /** Click handler for return to dashboard */
    onReturnHome?: () => void;
    /** Additional className */
    className?: string;
}

const rankColors: Record<string, string> = {
    Unranked: '#71717A',
    Bronze: '#CD7F32',
    Silver: '#C0C0C0',
    Gold: '#FFD700',
    Platinum: '#E5E4E2',
    Diamond: '#B9F2FF',
    Ranker: '#A855F7',
};

export function ResultCard({
    result,
    gameMode = 'ranked',
    player,
    opponent,
    newElo,
    rankUp = false,
    newRank,
    onPlayAgain,
    onReturnHome,
    className = '',
}: ResultCardProps) {
    const isWin = result === 'win';
    const isTie = result === 'tie';
    const isTraining = gameMode === 'training';

    const resultColors = {
        win: { text: 'text-success', bg: 'bg-success', glow: '#22C55E' },
        loss: { text: 'text-danger', bg: 'bg-danger', glow: '#EF4444' },
        tie: { text: 'text-text-secondary', bg: 'bg-text-muted', glow: '#525252' },
    };

    const colors = resultColors[result];

    return (
        <div
            className={`
        w-full max-w-4xl mx-auto px-4 py-6
        ${className}
      `}
            role="region"
            aria-label={`Match result: ${result}`}
        >
            {/* Result Header */}
            <div className="text-center mb-8">
                <span className="text-xs font-bold tracking-[0.2em] text-text-muted uppercase mb-2 block">
                    {isTraining ? 'Training Complete' : 'Match Complete'}
                </span>
                <h2 className={`text-6xl sm:text-7xl md:text-8xl font-black italic tracking-tighter ${colors.text}`}>
                    {isWin ? 'VICTORY' : isTie ? 'DRAW' : 'DEFEAT'}
                </h2>
                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mt-4" />
            </div>

            {/* Main Stats Card */}
            <div className="bg-bg-secondary border border-surface-border rounded-2xl overflow-hidden">
                <div className="flex flex-col md:flex-row">
                    {/* Player Side */}
                    <div className="flex-1 p-6 md:p-10 flex flex-col items-center">
                        <PlayerDisplay
                            {...player}
                            isWinner={isWin}
                            eloChange={isTraining ? 0 : player.eloChange}
                        />
                        <div className="w-full max-w-xs mt-6 space-y-3">
                            <StatBar label="WPM" value={player.wpm} compareValue={opponent.wpm} />
                            <StatBar label="ACC" value={player.accuracy} compareValue={opponent.accuracy} suffix="%" />
                            <StatBar label="SCORE" value={player.score} compareValue={opponent.score} />
                        </div>
                    </div>

                    {/* VS Divider */}
                    <div className="hidden md:flex relative items-center justify-center w-0">
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-surface-border to-transparent" />
                        <div className="relative bg-bg-tertiary border border-surface-border rounded-full w-12 h-12 flex items-center justify-center transform -translate-x-1/2">
                            <span className="text-xs font-black text-text-muted italic">VS</span>
                        </div>
                    </div>

                    {/* Opponent Side */}
                    <div className="flex-1 p-6 md:p-10 flex flex-col items-center opacity-75">
                        <PlayerDisplay
                            {...opponent}
                            isWinner={result === 'loss'}
                        />
                        <div className="w-full max-w-xs mt-6 space-y-3 opacity-60">
                            <StatBar label="WPM" value={opponent.wpm} compareValue={player.wpm} />
                            <StatBar label="ACC" value={opponent.accuracy} compareValue={player.accuracy} suffix="%" />
                            <StatBar label="SCORE" value={opponent.score} compareValue={player.score} />
                        </div>
                    </div>
                </div>

                {/* Footer - New Rating */}
                {!isTraining && newElo !== undefined && (
                    <div className="border-t border-surface-border bg-black/20 p-4 md:p-6 flex flex-col items-center justify-center gap-2">
                        {rankUp && newRank && (
                            <span className="px-3 py-1 rounded-full bg-success text-black text-[10px] font-black uppercase tracking-widest">
                                Rank Up!
                            </span>
                        )}
                        <p className="text-text-muted text-xs font-medium uppercase tracking-wider flex items-center gap-3">
                            <span>New Rating</span>
                            <span className="text-white font-mono font-bold text-base bg-surface px-3 py-1 rounded border border-surface-border">
                                {newElo}
                            </span>
                            {newRank && (
                                <span className="font-bold flex items-center gap-1.5" style={{ color: rankColors[newRank] }}>
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rankColors[newRank] }} />
                                    {newRank}
                                </span>
                            )}
                        </p>
                    </div>
                )}

                {/* Training Mode Badge */}
                {isTraining && (
                    <div className="border-t border-success/10 bg-success/5 p-4 md:p-6 flex items-center justify-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-success/50" />
                        <span className="text-success/80 text-xs font-medium uppercase tracking-widest">
                            Training Mode • No Rating Changes
                        </span>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
                {onReturnHome && (
                    <button
                        onClick={onReturnHome}
                        className="px-8 py-4 rounded-xl font-bold text-xs tracking-wider uppercase bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-all border border-surface-border focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                    >
                        Return to Dashboard
                    </button>
                )}
                {onPlayAgain && (
                    <button
                        onClick={onPlayAgain}
                        className={`px-8 py-4 rounded-xl font-bold text-xs tracking-wider uppercase transition-all focus:outline-none focus-visible:ring-2 ${isTraining
                            ? 'bg-success text-black hover:bg-success/90 focus-visible:ring-success/50'
                            : 'bg-white text-black hover:bg-white/90 focus-visible:ring-white/50'
                            }`}
                    >
                        {isTraining ? 'Train Again' : 'Play Again'}
                    </button>
                )}
            </div>
        </div>
    );
}

// Sub-components

interface PlayerDisplayProps {
    name: string;
    avatarUrl?: string | null;
    rank: string;
    isWinner?: boolean;
    eloChange?: number;
    isBot?: boolean;
}

function PlayerDisplay({ name, avatarUrl, rank, isWinner, eloChange, isBot }: PlayerDisplayProps) {
    return (
        <div className="flex flex-col items-center gap-4">
            <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full border-2 ${isWinner ? 'border-success/50' : 'border-surface-border'} bg-bg-tertiary overflow-hidden relative`}>
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-text-muted">
                        {name.charAt(0).toUpperCase()}
                    </div>
                )}
                {isWinner && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-success text-black text-[9px] px-2 py-0.5 rounded-full font-black uppercase">
                        Win
                    </div>
                )}
            </div>
            <div className="text-center">
                <h3 className="text-lg md:text-xl font-bold text-text-primary truncate max-w-[150px] md:max-w-[200px]">
                    {name}
                </h3>
                <div className="flex items-center justify-center gap-2">
                    <span className="text-xs font-medium" style={{ color: rankColors[rank] || '#A1A1A1' }}>
                        {rank}
                    </span>
                    {eloChange !== undefined && eloChange !== 0 && (
                        <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded-md ${eloChange > 0 ? 'text-success bg-success-muted' : 'text-danger bg-danger-muted'
                            }`}>
                            {eloChange > 0 ? '+' : ''}{eloChange}
                        </span>
                    )}
                </div>
                {isBot && (
                    <span className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Bot</span>
                )}
            </div>
        </div>
    );
}

interface StatBarProps {
    label: string;
    value: number;
    compareValue: number;
    suffix?: string;
}

function StatBar({ label, value, compareValue, suffix = '' }: StatBarProps) {
    const isHigher = value >= compareValue;

    return (
        <div className="flex flex-col gap-1 w-full">
            <div className="flex justify-between items-end px-1">
                <span className="text-[10px] font-bold text-text-muted tracking-wider">{label}</span>
                <span className={`text-lg font-mono font-bold ${isHigher ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {Math.round(value)}{suffix}
                </span>
            </div>
            <div className="h-1 w-full bg-surface-active rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${isHigher ? 'bg-text-secondary' : 'bg-surface'}`}
                    style={{ width: '100%' }}
                />
            </div>
        </div>
    );
}

export default ResultCard;
