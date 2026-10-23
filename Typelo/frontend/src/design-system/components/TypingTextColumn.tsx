/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * TypingTextColumn Component - Main typing interface for the game.
 * Renders the text to type with current progress, errors, and opponent cursor.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * TypingTextColumn: Main component.
 * handleContainerClick: Focus manager.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * Word: Type definition for word objects.
 * TypingTextColumnProps: Props interface.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React core hooks.
 */

import React, { useRef, useEffect } from 'react';

// ============================================================================
// TypingTextColumn Component
// ============================================================================

export interface Word {
    text: string;
    typed?: string;
    isComplete?: boolean;
    isCorrect?: boolean;
}

export interface TypingTextColumnProps {
    /** Array of words to type */
    words: Word[];
    /** Current word index */
    currentWordIndex: number;
    /** Current character index within the current word */
    currentCharIndex: number;
    /** Opponent's current word index */
    opponentWordIndex?: number;
    /** Opponent's current character index */
    opponentCharIndex?: number;
    /** Input ref for focus management */
    inputRef?: React.RefObject<HTMLInputElement>;
    /** Key down handler */
    onKeyDown?: (e: React.KeyboardEvent) => void;
    /** Mobile input handler */
    onMobileInput?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    /** Whether the typing area is active */
    isActive?: boolean;
    /** Additional className */
    className?: string;
}

export function TypingTextColumn({
    words,
    currentWordIndex,
    currentCharIndex,
    opponentWordIndex,
    opponentCharIndex,
    inputRef,
    onKeyDown,
    onMobileInput,
    isActive = true,
    className = '',
}: TypingTextColumnProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const currentWordRef = useRef<HTMLSpanElement>(null);

    // Scroll to current word
    useEffect(() => {
        if (currentWordRef.current && containerRef.current) {
            const container = containerRef.current;
            const word = currentWordRef.current;
            const containerRect = container.getBoundingClientRect();
            const wordRect = word.getBoundingClientRect();

            // Check if word is outside visible area
            if (wordRect.top < containerRect.top || wordRect.bottom > containerRect.bottom) {
                word.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentWordIndex]);

    // Focus input on container click
    const handleContainerClick = () => {
        inputRef?.current?.focus();
    };

    return (
        <div
            ref={containerRef}
            className={`
        w-full max-w-typing mx-auto
        px-4 sm:px-8 py-6
        cursor-text select-none
        ${className}
      `}
            onClick={handleContainerClick}
            role="textbox"
            aria-label="Typing area"
            aria-readonly="false"
        >
            {/* Hidden input for keyboard capture */}
            <input
                ref={inputRef}
                type="text"
                className="sr-only"
                onKeyDown={onKeyDown}
                onChange={onMobileInput}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                aria-label="Type here"
            />

            {/* Words display */}
            <div className="flex flex-wrap gap-x-3 gap-y-2 text-2xl sm:text-3xl font-mono leading-relaxed">
                {words.map((word, wordIndex) => {
                    const isCurrentWord = wordIndex === currentWordIndex;
                    const isOpponentWord = wordIndex === opponentWordIndex;
                    const isPastWord = wordIndex < currentWordIndex;

                    return (
                        <span
                            key={`word-${wordIndex}`}
                            ref={isCurrentWord ? currentWordRef : undefined}
                            className={`
                relative inline-block
                ${isPastWord ? (word.isCorrect !== false ? 'opacity-40' : '') : ''}
              `}
                        >
                            {word.text.split('').map((char, charIndex) => {
                                const typedChar = word.typed?.[charIndex];
                                const isTyped = typedChar !== undefined;
                                const isCorrect = typedChar === char;
                                const isCurrent = isCurrentWord && charIndex === currentCharIndex;
                                const isOpponentCursor = isOpponentWord && charIndex === opponentCharIndex;

                                let charClass = 'text-text-muted'; // Default: untyped

                                if (isPastWord) {
                                    if (word.isCorrect === false) {
                                        charClass = 'text-danger line-through';
                                    } else {
                                        charClass = 'text-text-secondary';
                                    }
                                } else if (isTyped) {
                                    charClass = isCorrect ? 'text-text-primary' : 'text-danger';
                                }

                                return (
                                    <span
                                        key={`char-${charIndex}`}
                                        className={`relative ${charClass}`}
                                    >
                                        {/* Player cursor */}
                                        {isCurrent && isActive && (
                                            <span
                                                className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary-500 animate-caret-blink"
                                                aria-hidden="true"
                                            />
                                        )}

                                        {/* Opponent cursor */}
                                        {isOpponentCursor && (
                                            <span
                                                className="absolute left-0 top-0 bottom-0 w-0.5 bg-opponent-cursor opacity-70"
                                                aria-hidden="true"
                                            />
                                        )}

                                        {char}
                                    </span>
                                );
                            })}

                            {/* Extra typed characters (overflow) */}
                            {word.typed && word.typed.length > word.text.length && (
                                <span className="text-danger opacity-70">
                                    {word.typed.slice(word.text.length)}
                                </span>
                            )}
                        </span>
                    );
                })}
            </div>

            {/* Opponent indicator legend */}
            {opponentWordIndex !== undefined && (
                <div className="flex items-center gap-2 mt-6 text-xs text-text-muted">
                    <span className="w-2 h-2 rounded-full bg-opponent-cursor animate-pulse" />
                    <span>Opponent</span>
                </div>
            )}
        </div>
    );
}

export default TypingTextColumn;
