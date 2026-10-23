/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * MatchRing Component - The main animated play button and status indicator.
 * Handles idle, searching, found, and countdown states.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * MatchRing: Main component.
 * formatTime: Helper to format seconds into mm:ss.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * MatchRingProps: Props interface.
 * MatchRingState: State types for the ring.
 * MatchRingMode: Game mode types.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React core.
 */

import React from 'react';

// ============================================================================
// MatchRing Component
// ============================================================================

export type MatchRingState = 'idle' | 'searching' | 'found' | 'countdown';
export type MatchRingMode = 'ranked' | 'training';

export interface MatchRingProps {
    /** Current state of the match ring */
    state: MatchRingState;
    /** Game mode */
    mode?: MatchRingMode;
    /** Queue elapsed time in seconds (for searching state) */
    queueTime?: number;
    /** Countdown number (for countdown state) */
    countdownNumber?: number;
    /** Click handler for play action */
    onPlay?: () => void;
    /** Click handler for cancel action */
    onCancel?: () => void;
    /** Whether button is disabled */
    disabled?: boolean;
    /** Additional className */
    className?: string;
}

export function MatchRing({
    state,
    mode = 'ranked',
    queueTime = 0,
    countdownNumber,
    onPlay,
    onCancel,
    disabled = false,
    className = '',
}: MatchRingProps) {
    const modeColor = mode === 'training' ? 'emerald' : 'rose';

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div
            className={`relative flex flex-col items-center gap-8 ${className}`}
            role="region"
            aria-label="Match controls"
            aria-live="polite"
        >
            {/* Main Ring Container */}
            <div className="relative w-64 h-64 flex items-center justify-center">
                {/* Outer rotating rings (for searching state) */}
                {state === 'searching' && (
                    <>
                        <div
                            className={`absolute inset-0 border rounded-full border-${modeColor}-500/30 animate-spin-slow`}
                            aria-hidden="true"
                        />
                        <div
                            className={`absolute inset-4 border rounded-full border-${modeColor}-500/10 animate-spin-reverse`}
                            aria-hidden="true"
                        />
                    </>
                )}

                {/* Static rings (for idle state) */}
                {state === 'idle' && (
                    <>
                        <div className={`absolute inset-4 rounded-full border border-${modeColor}-500/10`} />
                        <div className={`absolute inset-8 rounded-full border border-${modeColor}-500/5`} />
                    </>
                )}

                {/* Found state - success ring */}
                {state === 'found' && (
                    <div
                        className="absolute inset-0 border-2 border-success/30 rounded-full animate-pulse"
                        aria-hidden="true"
                    />
                )}

                {/* Main button/display */}
                {state === 'idle' && (
                    <button
                        onClick={onPlay}
                        disabled={disabled}
                        className={`
              relative w-64 h-64 rounded-full border-2 
              flex flex-col items-center justify-center gap-2 
              overflow-hidden transition-all duration-300 group
              bg-bg-secondary
              border-${modeColor}-500/20 hover:border-${modeColor}-500/40
              focus:outline-none focus-visible:ring-2 focus-visible:ring-${modeColor}-500/50
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
                        aria-label={`Play ${mode} match`}
                    >
                        {/* Hover fill effect */}
                        <div
                            className={`absolute inset-0 bg-${modeColor}-500/5 opacity-0 group-hover:opacity-100 transition-opacity`}
                            aria-hidden="true"
                        />

                        <span className={`text-5xl font-light tracking-tighter relative z-10 text-${modeColor}-400 group-hover:scale-105 transition-transform`}>
                            PLAY
                        </span>
                        <span className={`text-xs uppercase tracking-[0.4em] relative z-10 text-${modeColor}-500/50 group-hover:text-${modeColor}-400/80 transition-colors`}>
                            {mode}
                        </span>
                    </button>
                )}

                {state === 'searching' && (
                    <div className={`flex flex-col items-center z-10 bg-bg-secondary p-6 rounded-2xl border border-${modeColor}-500/20`}>
                        <span className={`text-4xl font-mono font-bold tabular-nums text-${modeColor}-400`}>
                            {formatTime(queueTime)}
                        </span>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse bg-${modeColor}-500/50`} />
                            <span className="text-xs uppercase tracking-widest text-text-muted">
                                {mode === 'training' ? 'Training' : 'Searching'}
                            </span>
                        </div>
                    </div>
                )}

                {state === 'found' && (
                    <div className="w-48 h-48 rounded-full border-2 border-success bg-bg-secondary flex items-center justify-center relative overflow-hidden">
                        <div className="flex flex-col items-center z-10">
                            <span className="text-5xl font-bold text-success tracking-tighter">
                                MATCH
                            </span>
                            <span className="text-xs uppercase tracking-[0.5em] text-white/70">
                                FOUND
                            </span>
                        </div>
                    </div>
                )}

                {state === 'countdown' && countdownNumber !== undefined && (
                    <div className="text-8xl font-black text-white animate-pulse">
                        {countdownNumber}
                    </div>
                )}
            </div>

            {/* Cancel Button (for searching state) */}
            {state === 'searching' && onCancel && (
                <button
                    onClick={onCancel}
                    className={`
            px-8 py-3 rounded-full border border-white/10 bg-bg-secondary 
            text-xs uppercase tracking-widest text-text-muted 
            hover:border-white/30 hover:text-white 
            transition-all duration-300
            focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20
          `}
                    aria-label="Cancel matchmaking"
                >
                    Cancel
                </button>
            )}
        </div>
    );
}

export default MatchRing;
