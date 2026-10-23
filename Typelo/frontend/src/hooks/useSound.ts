/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * useSound Hook - Manages audio playback for game events and keystrokes.
 * Uses Web Audio API for low-latency keystroke synthesis and HTMLAudioElement for game events.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * useSound: Main hook function.
 * initAudio: Initializes/resumes AudioContext.
 * updateVolume: Sets global volume.
 * toggleSound: Toggles sound enablement.
 * playGameSound: Plays pre-loaded audio files for events.
 * playKeystrokeSound: Synthesizes sound for typing feedback.
 * playSound: Unified entry point.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * GAME_SOUNDS: Map of event types to file paths.
 * KeystrokeSoundType: Enum for typing sound styles.
 * GameEventSoundType: Enum for event sound types.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// Keystroke sounds (synthesized via Web Audio API)
type KeystrokeSoundType = 'click' | 'thock' | 'bubble' | 'mechanical' | 'piano' | 'error'

// Game event sounds (preloaded audio files)
type GameEventSoundType = 'matchFound' | 'victory' | 'defeat'

type SoundType = KeystrokeSoundType | GameEventSoundType

// Paths to game event sound files
const GAME_SOUNDS: Record<GameEventSoundType, string> = {
    matchFound: '/sounds/match-found.mp3',
    victory: '/sounds/victory.wav',
    defeat: '/sounds/defeat.wav',
}

export function useSound() {
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem('sound-volume')
        return saved ? parseFloat(saved) : 0.5
    })

    const [enabled, setEnabled] = useState(() => {
        const saved = localStorage.getItem('sound-enabled')
        return saved ? saved === 'true' : true
    })

    const audioContextRef = useRef<AudioContext | null>(null)
    const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map())

    useEffect(() => {
        // Initialize AudioContext on user interaction if needed
        // Modern browsers require gesture to resume context
        const initAudio = () => {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
            }
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume()
            }
        }

        window.addEventListener('click', initAudio, { once: true })
        window.addEventListener('keydown', initAudio, { once: true })

        // Preload game event sounds
        Object.entries(GAME_SOUNDS).forEach(([name, path]) => {
            const audio = new Audio(path)
            audio.preload = 'auto'
            audioCache.current.set(name, audio)
        })

        return () => {
            window.removeEventListener('click', initAudio)
            window.removeEventListener('keydown', initAudio)
            // Cleanup audio cache
            audioCache.current.forEach(audio => {
                audio.pause()
                audio.src = ''
            })
            audioCache.current.clear()
        }
    }, [])

    const updateVolume = (val: number) => {
        setVolume(val)
        localStorage.setItem('sound-volume', val.toString())
        // Update cached audio elements
        audioCache.current.forEach(audio => {
            audio.volume = val
        })
    }

    const toggleSound = () => {
        setEnabled(prev => {
            const next = !prev
            localStorage.setItem('sound-enabled', next.toString())
            return next
        })
    }

    // Play a game event sound (audio file)
    const playGameSound = useCallback((type: GameEventSoundType) => {
        if (!enabled) return

        try {
            const path = GAME_SOUNDS[type]
            if (!path) return

            let audio = audioCache.current.get(type)
            if (!audio) {
                audio = new Audio(path)
                audioCache.current.set(type, audio)
            }
            audio.volume = volume
            audio.currentTime = 0
            audio.play().catch(err => {
                // Ignore autoplay or load errors to avoid console noise
            })
        } catch (err) {
            // Silently fail
        }
    }, [enabled, volume])

    // Synthesize keystroke sounds using Web Audio API
    // intensity: 0-1 range where 0 = calm (ahead), 1 = intense (behind)
    const playKeystrokeSound: (type?: KeystrokeSoundType, char?: string, intensity?: number, wpm?: number) => void = useCallback((type: KeystrokeSoundType = 'piano', char?: string, intensity: number = 0.5, wpm: number = 0) => {
        if (!enabled || !audioContextRef.current) return
        if (audioContextRef.current.state !== 'running') return

        const ctx = audioContextRef.current
        const t = ctx.currentTime

        // Master gain for this sound instance
        const masterGain = ctx.createGain()
        masterGain.connect(ctx.destination)
        masterGain.gain.setValueAtTime(volume, t)

        if (type === 'thock' || type === 'piano') {
            // "Thock" Sound Synthesis
            // intensity 0 = calm, 1 = intense

            const clampedIntensity = Math.max(0, Math.min(1, intensity))
            const clampedWpm = Math.max(0, Math.min(200, wpm)) // Cap effect at 200 WPM

            // === SPEED MODULATION (Excitement) ===
            const speedPitchMult = 1 + (clampedWpm / 150) * 0.15
            const speedDecaySub = (clampedWpm / 200) * 0.04
            const speedBrightness = (clampedWpm / 100) * 300

            // === INTENSITY MODULATION (Tension) ===
            const intensityDetune = clampedIntensity * 15

            // === KEY DIFFERENTIATION ===
            let baseFreq = 100 // Default key
            let freqMultiplier = 1 + (clampedIntensity * 0.3)
            let decayTime = 0.1 // Default decay
            let bodyGainValue = 0.7
            let clickGainValue = 0.3
            let filterFreqStart = 800
            let filterFreqEnd = 200

            // Unique Key Profiles
            if (char === ' ') {
                // SPACEBAR: Deeper, hollower, longer decay ("Thud")
                baseFreq = 65
                decayTime = 0.18
                bodyGainValue = 0.9
                clickGainValue = 0.15 // Less click, more thud
                filterFreqStart = 500
                filterFreqEnd = 100
            } else if (char === '\b') {
                // BACKSPACE: Sharper, lighter, shorter ("Tick")
                baseFreq = 180
                decayTime = 0.08
                bodyGainValue = 0.5
                clickGainValue = 0.5
                filterFreqStart = 1500
                filterFreqEnd = 600
            } else if (char === 'Enter') {
                // ENTER: Punchy, distinct
                baseFreq = 80
                decayTime = 0.15
                bodyGainValue = 0.8
                clickGainValue = 0.4
            } else {
                // Alphanumeric Variance
                // Map char code to slight pitch variation to make keys sound "positioned"
                // (Pseudo-random but consistent for the same key)
                if (char && char.length === 1) {
                    const val = char.charCodeAt(0) % 20 // 0-19 range
                    baseFreq += (val - 10) * 1.5 // +/- 15Hz spread
                } else {
                    // Pure random if no char
                    baseFreq += (Math.random() - 0.5) * 20
                }
            }

            // APPLY MODIFIERS
            baseFreq *= speedPitchMult
            decayTime = Math.max(0.04, decayTime - speedDecaySub)
            const startFilter = filterFreqStart + speedBrightness

            // Random "Human" Variation + Intensity Dissonance
            const humanDetune = (Math.random() - 0.5) * 10
            const totalDetune = humanDetune + ((Math.random() - 0.5) * intensityDetune * 2) // Add chaos if intense

            // --- LAYER 1: The Body (Resonant Thud) ---
            const osc1 = ctx.createOscillator()
            const gain1 = ctx.createGain()

            osc1.type = 'triangle' // Warmer than square/saw
            osc1.frequency.setValueAtTime(baseFreq * 1.5, t)
            osc1.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.04) // Pitch envelope
            osc1.detune.value = humanDetune

            // Envelope
            gain1.gain.setValueAtTime(0, t)
            gain1.gain.linearRampToValueAtTime(bodyGainValue, t + 0.005) // Fast attack
            gain1.gain.exponentialRampToValueAtTime(0.01, t + decayTime)

            // Filter
            const filter1 = ctx.createBiquadFilter()
            filter1.type = 'lowpass'
            filter1.frequency.setValueAtTime(filterFreqStart + (clampedIntensity * 500), t)
            filter1.frequency.exponentialRampToValueAtTime(filterFreqEnd, t + decayTime)

            osc1.connect(filter1)
            filter1.connect(gain1)
            gain1.connect(masterGain)

            osc1.start(t)
            osc1.stop(t + decayTime + 0.05)


            // --- LAYER 2: The Click (Tactile Snap) ---
            // Only for non-spacebar mainly, or reduced for spacebar
            if (clickGainValue > 0) {
                const clickOsc = ctx.createOscillator()
                const clickGain = ctx.createGain()

                clickOsc.type = 'square' // Sharp
                clickOsc.frequency.setValueAtTime(baseFreq * 8, t) // High harmonic
                clickOsc.frequency.exponentialRampToValueAtTime(baseFreq * 2, t + 0.03)

                clickGain.gain.setValueAtTime(clickGainValue, t)
                clickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.03) // Very short

                // Highpass to remove muddiness
                const hpFilter = ctx.createBiquadFilter()
                hpFilter.type = 'highpass'
                hpFilter.frequency.value = 2000

                clickOsc.connect(hpFilter)
                hpFilter.connect(clickGain)
                clickGain.connect(masterGain)

                clickOsc.start(t)
                clickOsc.stop(t + 0.05)
            }


            // --- LAYER 3: The Case "Ping" (Subtle Resonance) ---
            // Simulates the keyboard chassis sound
            const pingOsc = ctx.createOscillator()
            const pingGain = ctx.createGain()

            pingOsc.type = 'sine'
            pingOsc.frequency.setValueAtTime(400, t) // Resonance freq

            pingGain.gain.setValueAtTime(0.05 * bodyGainValue, t) // Very quiet
            pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2) // Longer tail

            pingOsc.connect(pingGain)
            pingGain.connect(masterGain)

            pingOsc.start(t)
            pingOsc.stop(t + 0.25)


        } else if (type === 'error') {
            // Error Sound: Dull "Dead Key" Thud (Unchanged)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(80, t);
            osc.frequency.linearRampToValueAtTime(60, t + 0.1);

            gain.gain.setValueAtTime(0.4, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, t);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);

            osc.start(t);
            osc.stop(t + 0.15);

        } else if (type === 'click') {
            // Simple Click (Unchanged)
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'square'
            osc.frequency.setValueAtTime(800, t)
            osc.frequency.exponentialRampToValueAtTime(400, t + 0.05)
            gain.gain.setValueAtTime(0.5, t)
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05)
            osc.connect(gain)
            gain.connect(masterGain)
            osc.start(t)
            osc.stop(t + 0.05)
        } else {
            // Fallback
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(300, t)
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.1)
            gain.gain.setValueAtTime(0.8, t)
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15)
            osc.connect(gain)
            gain.connect(masterGain)
            osc.start(t)
            osc.stop(t + 0.15)
        }

    }, [enabled, volume])

    // Unified playSound function that routes to the correct method
    // intensity: 0 = calm (ahead), 1 = intense (behind) - used for position-based sound
    const playSound = useCallback((type: SoundType = 'piano', char?: string, intensity: number = 0.5, wpm: number = 0) => {
        if (type in GAME_SOUNDS) {
            playGameSound(type as GameEventSoundType)
        } else {
            playKeystrokeSound(type as KeystrokeSoundType, char, intensity, wpm)
        }
    }, [playGameSound, playKeystrokeSound])

    return { playSound, playGameSound, volume, enabled, toggleSound, setVolume: updateVolume }
}
