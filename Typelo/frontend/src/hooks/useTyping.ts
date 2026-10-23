/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * useTyping Hook - Handles core typing logic, stats (WPM/Accuracy), and input management.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * useTyping: Main hook function.
 * handleKeyDown: Main input handler for desktop.
 * handleMobileInput: Input handler for mobile.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * UseTypingOptions: Config interface.
 * state: Various state variables (chars, words, time).
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 * stores/gameStore: Game state management.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'

interface UseTypingOptions {
  onKeystroke?: (char: string, charIndex: number, correct: boolean) => void
  onWordComplete?: (word: string, wordIndex: number) => void
}

export function useTyping(options: UseTypingOptions = {}) {
  const { onKeystroke, onWordComplete } = options

  const {
    status,
    words,
    currentWordIndex,
    currentCharIndex,
    typedChars,
    typeChar,
    deleteChar,
    completeWord,
    updateWpm,
    updateAccuracy,
    recordKeyStats,
    timeRemaining,
  } = useGameStore()

  const [startTime, setStartTime] = useState<number | null>(null)
  const [totalChars, setTotalChars] = useState(0)
  const [correctChars, setCorrectChars] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Use refs to track values for interval callback
  const correctCharsRef = useRef(0)
  const totalCharsRef = useRef(0)

  // Ref to store pending first keystroke that triggered game start
  const pendingFirstKeyRef = useRef<{ char: string; isCorrect: boolean } | null>(null)

  // Track if first keystroke has been made (to set startTime correctly)
  const hasStartedTypingRef = useRef(false)

  // Update refs when state changes
  useEffect(() => {
    correctCharsRef.current = correctChars
    totalCharsRef.current = totalChars
  }, [correctChars, totalChars])

  // Current word being typed
  const currentWord = words[currentWordIndex] || ''

  // Expected character
  const expectedChar = currentWord[currentCharIndex] || ''

  // Focus input when game starts or is waiting
  useEffect(() => {
    if (status === 'playing' || status === 'waiting') {
      inputRef.current?.focus()
      if (status === 'playing') {
        // Reset stats when game starts
        if (!hasStartedTypingRef.current) {
          setTotalChars(0)
          setCorrectChars(0)
          setStartTime(null)
        }

        // Process pending first keystroke if any
        if (pendingFirstKeyRef.current) {
          const { char, isCorrect } = pendingFirstKeyRef.current
          pendingFirstKeyRef.current = null

          // Set startTime on first keystroke
          setStartTime(Date.now())
          hasStartedTypingRef.current = true

          // Process the pending keystroke
          setTotalChars(1)
          if (isCorrect) {
            setCorrectChars(1)
          }
          typeChar(char, isCorrect)
        }
      } else if (status === 'waiting') {
        // Reset for new game
        setTotalChars(0)
        setCorrectChars(0)
        setStartTime(null)
        hasStartedTypingRef.current = false
      }
    }
  }, [status, typeChar])

  // Calculate WPM periodically
  useEffect(() => {
    if (status !== 'playing' || !startTime) return

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000 / 60 // in minutes
      if (elapsed > 0) {
        const wpm = Math.round((correctCharsRef.current / 5) / elapsed)
        updateWpm(wpm)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [status, startTime, updateWpm])

  // Update accuracy
  useEffect(() => {
    if (status === 'playing') {
      if (totalCharsRef.current > 0) {
        const accuracy = Math.round((correctCharsRef.current / totalCharsRef.current) * 100)
        updateAccuracy(accuracy)
      } else {
        updateAccuracy(100) // Reset to 100% when no chars typed
      }
    }
  }, [status, totalChars, correctChars, updateAccuracy])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (status !== 'playing' && status !== 'waiting') return
    // Strict Timer Check: Block input if time is up, even if status hasn't transitioned yet
    if (status === 'playing' && timeRemaining <= 0) return

    // Prevent default for most keys (except Tab for accessibility)
    if (e.key !== 'Tab') {
      e.preventDefault()
    }

    // Ignore modifier keys and function keys
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return
    }

    // Handle backspace - allow deleting characters
    if (e.key === 'Backspace') {
      if (status === 'playing' && currentCharIndex > 0) {
        // Calculate the new char index after deletion
        const newCharIndex = currentCharIndex - 1
        const globalCharIndex = words
          .slice(0, currentWordIndex)
          .reduce((acc, w) => acc + w.length + 1, 0) + newCharIndex

        // Check if the character we're deleting was correct
        const deletedChar = typedChars[typedChars.length - 1]
        const wasCorrect = deletedChar === currentWord[newCharIndex]

        deleteChar()
        // Adjust stats when deleting
        setTotalChars(prev => Math.max(0, prev - 1))
        if (wasCorrect) {
          setCorrectChars(prev => Math.max(0, prev - 1))
        }

        // Notify backend of position change (send current position after backspace)
        onKeystroke?.('\b', globalCharIndex, true)
      }
      return
    }

    // Ignore other special keys (arrows, function keys, etc.)
    if (e.key.length > 1 && e.key !== ' ') {
      return
    }

    const char = e.key
    const isSpace = char === ' '

    // If in waiting state, send keystroke to backend to trigger game start
    // The keystroke will be processed locally once the game transitions to 'playing'
    // via the GAME_START message handler. Store the pending char to replay.
    if (status === 'waiting') {
      const globalCharIndex = 0
      const isCorrect = char === expectedChar
      onKeystroke?.(char, globalCharIndex, isCorrect)

      // Store the first keystroke to be replayed when game starts
      // The game store will handle this transition
      if (!isSpace) {
        // For non-space characters, we'll process them after GAME_START
        // The WebSocket context will trigger startGame which sets status to 'playing'
        // We need to queue this keystroke to be processed
        pendingFirstKeyRef.current = { char, isCorrect }
      }
      return
    }

    // Handle space - move to next word
    if (isSpace) {
      // Only move to next word if we've typed at least some characters
      if (typedChars.length > 0) {
        onWordComplete?.(typedChars, currentWordIndex)
        completeWord()
      }
      return
    }

    // Regular character input - allow typing even past word length (will show as error)
    const isCorrect = currentCharIndex < currentWord.length && char === expectedChar

    // Set startTime on first keystroke (if not already set)
    if (!hasStartedTypingRef.current) {
      setStartTime(Date.now())
      hasStartedTypingRef.current = true
    }

    setTotalChars(prev => prev + 1)
    if (isCorrect) {
      setCorrectChars(prev => prev + 1)
    }

    // Calculate global char index (across all words)
    const globalCharIndex = words
      .slice(0, currentWordIndex)
      .reduce((acc, w) => acc + w.length + 1, 0) + currentCharIndex

    typeChar(char, isCorrect)
    recordKeyStats(char, isCorrect)
    onKeystroke?.(char, globalCharIndex, isCorrect)
  }, [
    status,
    currentWord,
    currentWordIndex,
    currentCharIndex,
    typedChars,
    expectedChar,
    words,
    typeChar,
    deleteChar,
    completeWord,
    onKeystroke,
    onWordComplete,
  ])

  // Handle mobile input (character by character from onChange)
  const handleMobileInput = useCallback((char: string) => {
    if (status !== 'playing' && status !== 'waiting') return
    // Strict Timer Check
    if (status === 'playing' && timeRemaining <= 0) return

    // Handle backspace
    if (char === '\b') {
      if (status === 'playing' && currentCharIndex > 0) {
        const newCharIndex = currentCharIndex - 1
        const globalCharIndex = words
          .slice(0, currentWordIndex)
          .reduce((acc, w) => acc + w.length + 1, 0) + newCharIndex

        // Check if the character we're deleting was correct
        const deletedChar = typedChars[typedChars.length - 1]
        const wasCorrect = deletedChar === currentWord[newCharIndex]

        deleteChar()
        setTotalChars(prev => Math.max(0, prev - 1))
        if (wasCorrect) {
          setCorrectChars(prev => Math.max(0, prev - 1))
        }
        onKeystroke?.('\b', globalCharIndex, true)
      }
      return
    }

    const isSpace = char === ' '

    // If in waiting state, send keystroke to backend to trigger game start
    if (status === 'waiting') {
      const globalCharIndex = 0
      const isCorrect = char === expectedChar
      onKeystroke?.(char, globalCharIndex, isCorrect)

      if (!isSpace) {
        pendingFirstKeyRef.current = { char, isCorrect }
      }
      return
    }

    // Handle space - move to next word
    if (isSpace) {
      if (typedChars.length > 0) {
        onWordComplete?.(typedChars, currentWordIndex)
        completeWord()
      }
      return
    }

    // Regular character input
    const isCorrect = currentCharIndex < currentWord.length && char === expectedChar

    // Set startTime on first keystroke (if not already set)
    if (!hasStartedTypingRef.current) {
      setStartTime(Date.now())
      hasStartedTypingRef.current = true
    }

    setTotalChars(prev => prev + 1)
    if (isCorrect) {
      setCorrectChars(prev => prev + 1)
    }

    const globalCharIndex = words
      .slice(0, currentWordIndex)
      .reduce((acc, w) => acc + w.length + 1, 0) + currentCharIndex

    typeChar(char, isCorrect)
    recordKeyStats(char, isCorrect)
    onKeystroke?.(char, globalCharIndex, isCorrect)
  }, [
    status,
    currentWord,
    currentWordIndex,
    currentCharIndex,
    typedChars,
    expectedChar,
    words,
    typeChar,
    deleteChar,
    completeWord,
    recordKeyStats,
    onKeystroke,
    onWordComplete,
  ])

  return {
    inputRef,
    handleKeyDown,
    handleMobileInput,
    currentWord,
    expectedChar,
  }
}
