/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * CursorEffect.tsx - Visual effects that follow the mouse cursor.
 * Supports 36 unique trail effects across all rarity tiers.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * CursorEffect: Main component observing mouse movement and rendering particles.
 * createParticle: Creates a new particle based on effect type.
 * updateParticle: Updates particle physics based on effect type.
 * getTransform: Returns CSS transform for particle based on effect.
 * getFilter: Returns CSS filter for particle visual effects.
 * getGlow: Returns CSS box-shadow for particle glow.
 * getParticleShape: Returns CSS properties for non-circular particle shapes.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * Particle: Interface for particle state.
 * MAX_PARTICLES: Limit on concurrent particles for performance.
 * SPAWN_RATE: Milliseconds between particle spawning.
 * 
 * --------------------------------------------------------------------------
 *                                   Imports
 * --------------------------------------------------------------------------
 * react: useEffect, useRef, useState
 * EFFECTS: Effect definitions from types
 * nanoid: unique keys for particles
 */

import { useEffect, useRef, useState } from 'react'
import { EFFECTS } from '../types'
import { nanoid } from 'nanoid'

interface Particle {
    id: string
    x: number
    y: number
    vx: number
    vy: number
    color: string
    size: number
    createdAt: number
    life: number
    rotation?: number
    shape?: string
    char?: string
}

interface CursorEffectProps {
    effectId: string | null
}

const MAX_PARTICLES = 150 // Increased from 80
const SPAWN_RATE = 5 // Reduced from 8 for more frequent spawns

export default function CursorEffect({ effectId }: CursorEffectProps) {
    const [particles, setParticles] = useState<Particle[]>([])
    const mousePos = useRef({ x: 0, y: 0 })
    const lastMousePos = useRef({ x: 0, y: 0 })
    const lastSpawnTime = useRef(0)
    const reqRef = useRef<number>()

    // Track mouse globally
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePos.current = { x: e.clientX, y: e.clientY }
        }
        window.addEventListener('mousemove', handleMouseMove, { passive: true })
        return () => window.removeEventListener('mousemove', handleMouseMove)
    }, [])

    useEffect(() => {
        // Clear particles when effect changes
        setParticles([])
        lastMousePos.current = mousePos.current

        if (!effectId || effectId === 'none' || !EFFECTS[effectId]) {
            if (reqRef.current) cancelAnimationFrame(reqRef.current)
            return
        }

        const tick = (time: number) => {
            const dx = mousePos.current.x - lastMousePos.current.x
            const dy = mousePos.current.y - lastMousePos.current.y
            const speed = Math.sqrt(dx * dx + dy * dy)
            const isMoving = speed > 0.1

            // Spawn particles
            const shouldSpawn = isMoving && (time - lastSpawnTime.current > SPAWN_RATE)
            let newParticles: Particle[] = []

            if (shouldSpawn) {
                lastSpawnTime.current = time
                // Increased spawn count for denser trails
                const spawnCount = Math.min(Math.ceil(speed / 3), 12) // Increased max from 8
                for (let i = 0; i < spawnCount; i++) {
                    newParticles.push(createParticle(effectId, mousePos.current.x, mousePos.current.y, dx, dy))
                }
            }

            // Update existing particles
            setParticles(prev => {
                const next = [...prev, ...newParticles].map(p => updateParticle(p, effectId))
                return next.filter(p => p.life > 0).slice(-MAX_PARTICLES)
            })

            lastMousePos.current = mousePos.current
            reqRef.current = requestAnimationFrame(tick)
        }

        reqRef.current = requestAnimationFrame(tick)
        return () => {
            if (reqRef.current) cancelAnimationFrame(reqRef.current)
        }
    }, [effectId])

    if (!effectId || effectId === 'none') return null

    return (
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[9999] overflow-hidden" style={{ margin: 0, padding: 0 }}>
            {particles.map(p => {
                const shapeStyle = getParticleShape(p, effectId)
                // Determine transform: if shape has transform, use it, else use default centering + getTransform
                const baseTransform = shapeStyle.transform || `translate(-50%, -50%) ${getTransform(p, effectId)}`
                const { transform: _ignoredTransform, ...restShapeStyle } = shapeStyle

                return (
                    <div
                        key={p.id}
                        className={`absolute ${p.shape === 'circle' || !p.shape ? 'rounded-full' : ''}`}
                        style={{
                            left: 0,
                            top: 0,
                            transform: `translate(${p.x}px, ${p.y}px) ${baseTransform}`, // Move using transform to avoid layout sub-pixel issues
                            width: p.size,
                            height: p.size,
                            backgroundColor: p.color,
                            opacity: p.life,
                            filter: getFilter(effectId),
                            boxShadow: getGlow(p, effectId),
                            willChange: 'transform, opacity',
                            ...restShapeStyle
                        }}
                    >
                        {p.char && (
                            <span
                                className="absolute inset-0 flex items-center justify-center font-mono font-bold"
                                style={{
                                    color: p.color,
                                    fontSize: p.size * 0.8,
                                    textShadow: `0 0 4px ${p.color}`
                                }}
                            >
                                {p.char}
                            </span>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function createParticle(type: string, x: number, y: number, dx: number, dy: number): Particle {
    // For trails: particles should stay mostly stationary where spawned
    const spread = 0.5  // Reduced from 1 for tighter trails
    let vx = (Math.random() - 0.5) * spread
    let vy = (Math.random() - 0.5) * spread
    let size = 12 // Increased base size from 8 (was 6)
    let color = '#fff'
    let life = 1.2 // Increased base life from 1
    let shape = 'circle'
    let char: string | undefined = undefined
    let rotation = 0

    switch (type) {
        case 'sparkle':
            color = '#fbbf24'
            size = Math.random() * 8 + 6 // Increased from 6+4
            vx = (Math.random() - 0.5) * 1  // Reduced from 4
            vy = (Math.random() - 0.5) * 1
            life = 1.5  // Increased lifetime for longer trail
            break
        case 'smoke':
            color = '#9ca3af'
            size = Math.random() * 8 + 4
            vx = dx * -0.1 + (Math.random() - 0.5) * 1
            vy = dy * -0.1 + (Math.random() - 0.5) * 1
            life = 0.8
            break
        case 'fire':
            color = Math.random() > 0.5 ? '#ef4444' : '#fb923c'
            size = Math.random() * 10 + 4 // Increased from 6+2
            vy = -1 - Math.random() * 2
            life = 0.6
            break
        case 'electric':
            color = '#60a5fa'
            size = 2
            life = 0.5
            break
        case 'confetti':
            const confettiColors = ['#ec4899', '#8b5cf6', '#ef4444', '#fbbf24', '#22c55e']
            color = confettiColors[Math.floor(Math.random() * confettiColors.length)]
            size = 10 // Increased from 6
            vx = (Math.random() - 0.5) * 1  // Reduced from 5
            vy = (Math.random() - 0.5) * 1
            life = 1.5  // Increased for longer trail
            shape = 'square'
            break
        case 'matrix':
            color = '#22c55e'
            size = 16 // Increased from 10
            life = 0.8
            char = String.fromCharCode(0x30A0 + Math.random() * 96)
            break
        case 'bubble':
            color = '#60a5fa'
            size = Math.random() * 8 + 4
            vy = -0.5 - Math.random() * 1
            vx = (Math.random() - 0.5) * 0.5
            life = 1.2
            break
        case 'leaf':
            color = ['#84cc16', '#22c55e', '#eab308', '#f97316'][Math.floor(Math.random() * 4)]
            size = Math.random() * 6 + 4
            vy = 0.5 + Math.random() * 1
            vx = (Math.random() - 0.5) * 2
            life = 1.5
            rotation = Math.random() * 360
            shape = 'leaf'
            break
        case 'dust':
            color = '#fcd34d'
            size = Math.random() * 3 + 1
            vx = (Math.random() - 0.5) * 1.5
            vy = (Math.random() - 0.5) * 1.5
            life = 0.8
            break
        case 'ripple':
            color = '#06b6d4'
            size = 4
            life = 0.8
            break
        case 'snow':
            color = '#e0f2fe'
            size = Math.random() * 4 + 2
            vy = 0.5 + Math.random() * 1
            vx = (Math.random() - 0.5) * 0.5
            life = 1.5
            break
        case 'hearts':
            color = '#f472b6'
            size = Math.random() * 6 + 4
            vy = -1 - Math.random() * 1
            vx = (Math.random() - 0.5) * 1
            life = 1.0
            shape = 'heart'
            break
        case 'star':
            color = '#fbbf24'
            size = Math.random() * 5 + 3
            vy = -1.5 - Math.random() * 2
            vx = (Math.random() - 0.5) * 2
            life = 0.8
            shape = 'star'
            break
        case 'wind':
            color = '#94a3b8'
            size = 3
            vx = 3 + Math.random() * 2
            vy = (Math.random() - 0.5) * 1
            life = 0.6
            break
        case 'thunder':
            color = '#facc15'
            size = 2
            vx = (Math.random() - 0.5) * 8
            vy = (Math.random() - 0.5) * 8
            life = 0.3
            break
        case 'neon':
            const neonColors = ['#e879f9', '#22d3ee', '#a855f7', '#f472b6']
            color = neonColors[Math.floor(Math.random() * neonColors.length)]
            size = Math.random() * 4 + 2
            life = 0.7
            break
        case 'shadow':
            color = '#a78bfa'
            size = Math.random() * 10 + 6
            vx = dx * -0.3 + (Math.random() - 0.5) * 2
            vy = dy * -0.3 + (Math.random() - 0.5) * 2
            life = 0.6
            break
        case 'ice':
            color = '#7dd3fc'
            size = Math.random() * 5 + 2
            vx = (Math.random() - 0.5) * 2
            vy = 0.5 + Math.random() * 1
            life = 1.0
            shape = 'crystal'
            break
        case 'lava':
            color = Math.random() > 0.5 ? '#f59e0b' : '#ef4444'
            size = Math.random() * 6 + 3
            vy = 1 + Math.random() * 1.5
            vx = (Math.random() - 0.5) * 1
            life = 0.8
            break
        case 'poison':
            color = '#a3e635'
            size = Math.random() * 6 + 4
            vy = -0.5 - Math.random() * 1
            vx = (Math.random() - 0.5) * 1.5
            life = 1.0
            break
        case 'crystal':
            color = '#c4b5fd'
            size = Math.random() * 5 + 3
            vx = (Math.random() - 0.5) * 3
            vy = (Math.random() - 0.5) * 3
            life = 0.9
            shape = 'diamond'
            break
        case 'aurora_trail':
            const auroraColors = ['#2dd4bf', '#22d3ee', '#a78bfa', '#34d399']
            color = auroraColors[Math.floor(Math.random() * auroraColors.length)]
            size = Math.random() * 8 + 4
            vy = -0.5 - Math.random() * 1
            life = 1.0
            break
        case 'galaxy_trail':
            const galaxyColors = ['#8b5cf6', '#6366f1', '#a855f7', '#c084fc']
            color = galaxyColors[Math.floor(Math.random() * galaxyColors.length)]
            size = Math.random() * 4 + 2
            rotation = Math.random() * 360
            life = 1.0
            break
        case 'cherry':
            color = '#fda4af'
            size = Math.random() * 5 + 3
            vy = 0.5 + Math.random() * 1
            vx = Math.sin(Date.now() / 200) * 0.5
            life = 1.2
            shape = 'petal'
            break
        case 'gold_trail':
            color = '#f59e0b'
            size = Math.random() * 4 + 3
            vx = (Math.random() - 0.5) * 1
            vy = (Math.random() - 0.5) * 1
            life = 0.9
            break
        case 'dragon':
            color = Math.random() > 0.3 ? '#ef4444' : '#fbbf24'
            size = Math.random() * 8 + 4
            vy = -1.5 - Math.random() * 2
            vx = (Math.random() - 0.5) * 3
            life = 0.6
            break
        case 'cosmic_dust':
            const cosmicColors = ['#a78bfa', '#c084fc', '#8b5cf6', '#e879f9']
            color = cosmicColors[Math.floor(Math.random() * cosmicColors.length)]
            size = Math.random() * 3 + 1
            vx = (Math.random() - 0.5) * 2
            vy = (Math.random() - 0.5) * 2
            life = 1.2
            break
        case 'lightning':
            color = '#60a5fa'
            size = 2
            vx = (Math.random() - 0.5) * 15
            vy = (Math.random() - 0.5) * 15
            life = 0.2
            break
        case 'supernova':
            const supernovaColors = ['#fef08a', '#fbbf24', '#f59e0b', '#fef3c7']
            color = supernovaColors[Math.floor(Math.random() * supernovaColors.length)]
            size = Math.random() * 6 + 3
            const angle = Math.random() * Math.PI * 2
            const speed = 3 + Math.random() * 3
            vx = Math.cos(angle) * speed
            vy = Math.sin(angle) * speed
            life = 0.7
            break
        case 'void_rift':
            color = '#a78bfa'
            size = Math.random() * 12 + 6
            vx = (Math.random() - 0.5) * 3
            vy = (Math.random() - 0.5) * 3
            life = 0.8
            break
        case 'spirit':
            color = '#22d3ee'
            size = Math.random() * 6 + 3
            vy = -1 - Math.random() * 1.5
            vx = Math.sin(Date.now() / 100) * 1
            life = 1.0
            shape = 'ghost'
            break
        case 'divine_light':
            color = '#fffbeb'
            size = Math.random() * 5 + 3
            vy = 2 + Math.random() * 2
            vx = (Math.random() - 0.5) * 0.5
            life = 0.6
            break
        case 'reality_tear':
            const tearColors = ['#f0abfc', '#e879f9', '#c084fc', '#a855f7']
            color = tearColors[Math.floor(Math.random() * tearColors.length)]
            size = Math.random() * 10 + 5
            vx = (Math.random() - 0.5) * 0.5
            vy = (Math.random() - 0.5) * 0.5
            life = 0.5
            shape = 'tear'
            break
        case 'infinity':
            color = '#818cf8'
            size = 12
            life = 1.0
            char = '∞'
            break
        case 'godray':
            color = '#fef3c7'
            size = Math.random() * 4 + 3
            vy = 4 + Math.random() * 2
            vx = (Math.random() - 0.5) * 0.5
            life = 0.5
            break
        case 'singularity':
            color = '#c084fc'
            size = Math.random() * 8 + 4
            const sAngle = Math.atan2(dy, dx) + Math.PI
            const sDist = Math.random() * 20
            vx = Math.cos(sAngle + Math.random() * 0.5) * -2
            vy = Math.sin(sAngle + Math.random() * 0.5) * -2
            life = 0.8
            break
        // NEW EFFECTS
        case 'sparkle_mini':
            color = '#fbbf24'
            size = Math.random() * 2 + 1
            vx = (Math.random() - 0.5) * 1.5
            vy = (Math.random() - 0.5) * 1.5
            life = 0.6
            break
        case 'dots':
            const dotColors = ['#a78bfa', '#c084fc', '#8b5cf6', '#e879f9']
            color = dotColors[Math.floor(Math.random() * dotColors.length)]
            size = Math.random() * 4 + 2
            vx = (Math.random() - 0.5) * 1
            vy = (Math.random() - 0.5) * 1
            life = 0.8
            break
        case 'music':
            color = '#8b5cf6'
            size = 12
            life = 0.8
            char = ['♪', '♫', '♬'][Math.floor(Math.random() * 3)]
            vy = -1 - Math.random() * 1
            vx = (Math.random() - 0.5) * 2
            break
        case 'feather':
            color = '#e0e7ff'
            size = Math.random() * 6 + 4
            vy = 0.3 + Math.random() * 0.5
            vx = Math.sin(Date.now() / 300) * 0.8
            life = 1.5
            rotation = Math.random() * 360
            shape = 'leaf'
            break
        case 'pixel':
            const pixelColors = ['#22c55e', '#16a34a', '#15803d', '#14532d']
            color = pixelColors[Math.floor(Math.random() * pixelColors.length)]
            size = 4
            vx = (Math.random() - 0.5) * 2
            vy = 1 + Math.random() * 1
            life = 0.8
            shape = 'square'
            break
        case 'glitch':
            const glitchColors = ['#ef4444', '#22d3ee', '#ffffff', '#000000']
            color = glitchColors[Math.floor(Math.random() * glitchColors.length)]
            size = Math.random() * 8 + 2
            vx = (Math.random() - 0.5) * 10
            vy = (Math.random() - 0.5) * 2
            life = 0.15
            shape = 'square'
            break
        case 'plasma_trail':
            const plasmaColors = ['#22d3ee', '#06b6d4', '#0891b2', '#38bdf8']
            color = plasmaColors[Math.floor(Math.random() * plasmaColors.length)]
            size = Math.random() * 6 + 3
            vx = (Math.random() - 0.5) * 2
            vy = (Math.random() - 0.5) * 2
            life = 0.7
            break
        case 'ember':
            color = Math.random() > 0.5 ? '#fb923c' : '#f97316'
            size = Math.random() * 4 + 2
            vy = -0.5 - Math.random() * 1
            vx = (Math.random() - 0.5) * 1.5
            life = 0.8
            break
        case 'cyberpunk':
            color = '#00ff88'
            size = 3
            vx = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3)
            vy = (Math.random() - 0.5) * 1
            life = 0.5
            shape = 'square'
            break
        case 'timeshift':
            const timeColors = ['#6366f1', '#818cf8', '#a5b4fc', '#4f46e5']
            color = timeColors[Math.floor(Math.random() * timeColors.length)]
            size = Math.random() * 5 + 3
            const tAngle = Math.random() * Math.PI * 2
            vx = Math.cos(tAngle) * 2
            vy = Math.sin(tAngle) * 2
            life = 0.6
            rotation = Math.random() * 360
            break
    }

    return {
        id: nanoid(),
        x,
        y,
        vx,
        vy,
        color,
        size,
        createdAt: Date.now(),
        life,
        rotation,
        shape,
        char
    }
}

function updateParticle(p: Particle, type: string): Particle {
    let next = { ...p }

    switch (type) {
        case 'sparkle':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.05
            next.size *= 0.95
            break
        case 'smoke':
            next.x += next.vx
            next.y += next.vy - 0.5
            next.life -= 0.02
            next.size *= 1.02
            break
        case 'fire':
            next.x += next.vx + (Math.random() - 0.5)
            next.y += next.vy
            next.life -= 0.03
            next.size *= 0.9
            break
        case 'electric':
            next.x += next.vx + (Math.random() - 0.5) * 10
            next.y += next.vy + (Math.random() - 0.5) * 10
            next.life -= 0.1
            break
        case 'confetti':
            next.x += next.vx
            next.y += next.vy + 2
            next.life -= 0.02
            next.vx *= 0.95
            next.rotation = (next.rotation || 0) + 10
            break
        case 'matrix':
            next.y += 2
            next.life -= 0.02
            break
        case 'bubble':
            next.x += next.vx + Math.sin(Date.now() / 200 + p.createdAt) * 0.3
            next.y += next.vy
            next.life -= 0.015
            next.size *= 1.01
            break
        case 'leaf':
            next.x += next.vx + Math.sin(Date.now() / 300 + p.createdAt) * 0.5
            next.y += next.vy
            next.life -= 0.015
            next.rotation = (next.rotation || 0) + 3
            break
        case 'dust':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.03
            next.size *= 0.98
            break
        case 'ripple':
            next.life -= 0.03
            next.size *= 1.15
            break
        case 'snow':
            next.x += next.vx + Math.sin(Date.now() / 400 + p.createdAt) * 0.2
            next.y += next.vy
            next.life -= 0.012
            break
        case 'hearts':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.025
            next.size *= 0.98
            break
        case 'star':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.03
            next.rotation = (next.rotation || 0) + 5
            break
        case 'wind':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.04
            next.vx *= 0.95
            break
        case 'thunder':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.15
            break
        case 'neon':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.035
            break
        case 'shadow':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.04
            next.size *= 1.05
            break
        case 'ice':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.025
            next.rotation = (next.rotation || 0) + 2
            break
        case 'lava':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.025
            next.size *= 0.97
            break
        case 'poison':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.02
            next.size *= 1.03
            break
        case 'crystal':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.025
            next.vx *= 0.9
            next.vy *= 0.9
            break
        case 'aurora_trail':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.02
            next.size *= 1.02
            break
        case 'galaxy_trail':
            next.x += Math.cos(Date.now() / 100 + p.createdAt) * 1
            next.y += Math.sin(Date.now() / 100 + p.createdAt) * 1
            next.life -= 0.02
            next.rotation = (next.rotation || 0) + 5
            break
        case 'cherry':
            next.x += next.vx
            next.y += next.vy
            next.vx = Math.sin(Date.now() / 200 + p.createdAt) * 0.8
            next.life -= 0.015
            next.rotation = (next.rotation || 0) + 2
            break
        case 'gold_trail':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.025
            break
        case 'dragon':
            next.x += next.vx + (Math.random() - 0.5) * 2
            next.y += next.vy
            next.life -= 0.04
            next.size *= 0.92
            break
        case 'cosmic_dust':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.015
            break
        case 'lightning':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.2
            break
        case 'supernova':
            next.x += next.vx
            next.y += next.vy
            next.vx *= 0.95
            next.vy *= 0.95
            next.life -= 0.03
            next.size *= 0.95
            break
        case 'void_rift':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.025
            next.size *= 1.05
            break
        case 'spirit':
            next.x += Math.sin(Date.now() / 100 + p.createdAt) * 1
            next.y += next.vy
            next.life -= 0.02
            next.size *= 0.98
            break
        case 'divine_light':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.04
            break
        case 'reality_tear':
            next.life -= 0.02
            next.size *= 1.08
            break
        case 'infinity':
            next.life -= 0.02
            next.rotation = (next.rotation || 0) + 2
            break
        case 'godray':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.05
            break
        case 'singularity':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.025
            next.size *= 0.95
            break
        // NEW EFFECTS
        case 'sparkle_mini':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.04
            next.size *= 0.95
            break
        case 'dots':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.025
            break
        case 'music':
            next.x += next.vx + Math.sin(Date.now() / 150 + p.createdAt) * 0.5
            next.y += next.vy
            next.life -= 0.025
            break
        case 'feather':
            next.x += next.vx
            next.y += next.vy
            next.vx = Math.sin(Date.now() / 300 + p.createdAt) * 0.8
            next.life -= 0.012
            next.rotation = (next.rotation || 0) + 1
            break
        case 'pixel':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.025
            break
        case 'glitch':
            next.x += next.vx + (Math.random() - 0.5) * 5
            next.y += next.vy
            next.life -= 0.15
            break
        case 'plasma_trail':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.03
            next.size *= 0.98
            break
        case 'ember':
            next.x += next.vx + (Math.random() - 0.5) * 0.5
            next.y += next.vy
            next.life -= 0.025
            next.size *= 0.96
            break
        case 'cyberpunk':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.04
            next.vx *= 0.95
            break
        case 'timeshift':
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.035
            next.rotation = (next.rotation || 0) + 8
            next.size *= 0.97
            break
        default:
            next.x += next.vx
            next.y += next.vy
            next.life -= 0.03
    }

    return next
}

function getTransform(p: Particle, type: string): string {
    if (p.rotation) {
        return `rotate(${p.rotation}deg)`
    }
    return ''
}

function getFilter(type: string): string {
    switch (type) {
        case 'fire':
        case 'sparkle':
        case 'electric':
        case 'thunder':
        case 'lightning':
        case 'dragon':
            return 'blur(0.5px)'
        case 'smoke':
        case 'poison':
        case 'void_rift':
            return 'blur(4px)'
        case 'neon':
            return 'blur(1px)'
        case 'divine_light':
        case 'godray':
            return 'blur(2px)'
        case 'glitch':
            return 'none'
        case 'cyberpunk':
        case 'plasma_trail':
            return 'blur(0.5px)'
        default:
            return 'none'
    }
}

function getGlow(p: Particle, type: string): string {
    switch (type) {
        case 'sparkle':
        case 'dust':
        case 'gold_trail':
        case 'sparkle_mini':
            return `0 0 8px ${p.color}, 0 0 16px ${p.color}`
        case 'fire':
        case 'dragon':
        case 'lava':
        case 'ember':
            return `0 0 10px ${p.color}, 0 0 20px #ef4444, 0 0 30px ${p.color}`
        case 'electric':
        case 'thunder':
        case 'lightning':
            return `0 0 12px ${p.color}, 0 0 24px ${p.color}, 0 0 36px ${p.color}`
        case 'neon':
            return `0 0 12px ${p.color}, 0 0 24px ${p.color}, 0 0 36px ${p.color}, 0 0 48px ${p.color}`
        case 'aurora_trail':
        case 'galaxy_trail':
        case 'cosmic_dust':
            return `0 0 10px ${p.color}, 0 0 20px ${p.color}, 0 0 30px ${p.color}`
        case 'divine_light':
        case 'godray':
        case 'supernova':
            return `0 0 12px ${p.color}, 0 0 24px #fef3c7, 0 0 36px ${p.color}`
        case 'void_rift':
        case 'singularity':
        case 'shadow':
            return `0 0 10px ${p.color}, 0 0 20px ${p.color}, 0 0 30px rgba(167, 139, 250, 0.5)`
        case 'spirit':
            return `0 0 10px ${p.color}, 0 0 20px rgba(34, 211, 238, 0.7), 0 0 30px ${p.color}`
        case 'ice':
            return `0 0 8px ${p.color}, 0 0 16px #e0f2fe, 0 0 24px ${p.color}`
        // NEW EFFECTS
        case 'glitch':
            return `0 0 4px ${p.color}`
        case 'cyberpunk':
            return `0 0 6px ${p.color}, 0 0 12px #00ff88`
        case 'plasma_trail':
            return `0 0 6px ${p.color}, 0 0 12px #22d3ee`
        case 'music':
            return `0 0 4px ${p.color}`
        case 'timeshift':
            return `0 0 6px ${p.color}, 0 0 12px #6366f1`
        default:
            return 'none'
    }
}

function getParticleShape(p: Particle, type: string): React.CSSProperties {
    switch (p.shape) {
        case 'square':
            return { borderRadius: '2px' }
        case 'diamond':
            return {
                borderRadius: '2px',
                transform: `translate(-50%, -50%) rotate(45deg) ${p.rotation ? `rotate(${p.rotation}deg)` : ''}`
            }
        case 'heart':
            return {
                backgroundColor: 'transparent',
                width: p.size,
                height: p.size,
                position: 'relative' as const,
                backgroundImage: `radial-gradient(circle at 30% 30%, ${p.color} 0%, ${p.color} 50%, transparent 50%)`,
            }
        case 'star':
            return {
                clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
            }
        case 'leaf':
            return {
                borderRadius: '50% 0% 50% 0%',
            }
        case 'petal':
            return {
                borderRadius: '50% 0% 50% 50%',
            }
        case 'crystal':
            return {
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            }
        case 'tear':
            return {
                borderRadius: '50% 50% 50% 0%',
                transform: `translate(-50%, -50%) rotate(-45deg)`,
            }
        case 'ghost':
            return {
                borderRadius: '50% 50% 30% 30%',
            }
        default:
            return {}
    }
}
