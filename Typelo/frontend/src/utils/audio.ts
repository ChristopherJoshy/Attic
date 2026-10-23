/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * Audio Utilities - Plays sounds for gacha reveals and UI feedback.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * playRaritySound: Plays a sound based on rarity tier.
 * playSpinSound: Plays the gacha spin animation sound.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * RARITY_FREQUENCIES: Defines oscillator frequency per rarity for web audio.
 * audioContext: Lazy-loaded AudioContext instance.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * None (uses Web Audio API).
 */

let audioContext: AudioContext | null = null

const getAudioContext = (): AudioContext => {
    if (!audioContext) {
        audioContext = new AudioContext()
    }
    return audioContext
}

// Rarity -> Frequency & duration for Web Audio synthesis
const RARITY_CONFIG: Record<string, { freq: number; duration: number; detune: number }> = {
    common: { freq: 440, duration: 0.15, detune: 0 },
    uncommon: { freq: 523, duration: 0.2, detune: 0 },
    rare: { freq: 659, duration: 0.25, detune: 100 },
    epic: { freq: 784, duration: 0.3, detune: 200 },
    legendary: { freq: 880, duration: 0.4, detune: 300 },
    ultra: { freq: 988, duration: 0.5, detune: 400 },
    divine: { freq: 1047, duration: 0.6, detune: 500 },
    mythical: { freq: 1175, duration: 0.8, detune: 600 },
}

/**
 * Plays a synthesized sound effect based on rarity.
 * Uses Web Audio API for zero-latency playback without audio files.
 */
export function playRaritySound(rarity: string) {
    try {
        const ctx = getAudioContext()
        if (ctx.state === 'suspended') ctx.resume()

        const config = RARITY_CONFIG[rarity] || RARITY_CONFIG.common

        // Create oscillator
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()

        oscillator.type = 'sine'
        oscillator.frequency.value = config.freq
        oscillator.detune.value = config.detune

        // Volume envelope
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + config.duration)

        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + config.duration)

        // Play harmonics for higher rarities
        if (['legendary', 'ultra', 'divine', 'mythical'].includes(rarity)) {
            const harmonic = ctx.createOscillator()
            const harmonicGain = ctx.createGain()

            harmonic.type = 'triangle'
            harmonic.frequency.value = config.freq * 1.5
            harmonicGain.gain.setValueAtTime(0.15, ctx.currentTime)
            harmonicGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + config.duration * 0.8)

            harmonic.connect(harmonicGain)
            harmonicGain.connect(ctx.destination)
            harmonic.start(ctx.currentTime)
            harmonic.stop(ctx.currentTime + config.duration * 0.8)
        }

        // Extra sparkle for divine/mythical
        if (['divine', 'mythical'].includes(rarity)) {
            setTimeout(() => {
                const sparkle = ctx.createOscillator()
                const sparkleGain = ctx.createGain()
                sparkle.type = 'sine'
                sparkle.frequency.value = config.freq * 2
                sparkleGain.gain.setValueAtTime(0.1, ctx.currentTime)
                sparkleGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
                sparkle.connect(sparkleGain)
                sparkleGain.connect(ctx.destination)
                sparkle.start(ctx.currentTime)
                sparkle.stop(ctx.currentTime + 0.2)
            }, 150)
        }
    } catch (e) {
        console.warn('Audio playback failed:', e)
    }
}

/**
 * Plays a spinning slot machine sound (rapidly ascending notes).
 */
export function playSpinSound() {
    try {
        const ctx = getAudioContext()
        if (ctx.state === 'suspended') ctx.resume()

        const baseFreq = 200
        const steps = 8
        const stepDuration = 0.08

        for (let i = 0; i < steps; i++) {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()

            osc.type = 'square'
            osc.frequency.value = baseFreq + (i * 50)

            gain.gain.setValueAtTime(0.1, ctx.currentTime + (i * stepDuration))
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (i * stepDuration) + stepDuration)

            osc.connect(gain)
            gain.connect(ctx.destination)

            osc.start(ctx.currentTime + (i * stepDuration))
            osc.stop(ctx.currentTime + (i * stepDuration) + stepDuration)
        }
    } catch (e) {
        console.warn('Audio playback failed:', e)
    }
}

/**
 * Plays a simple click/tap sound.
 */
export function playClickSound() {
    try {
        const ctx = getAudioContext()
        if (ctx.state === 'suspended') ctx.resume()

        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.value = 600

        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.05)
    } catch (e) {
        console.warn('Audio playback failed:', e)
    }
}
