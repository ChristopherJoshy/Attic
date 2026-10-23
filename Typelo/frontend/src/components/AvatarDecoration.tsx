/**
 *   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______|\_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *
 * AvatarDecoration - Discord-style avatar decorations with SVG graphics
 * Renders unique visual elements (flowers, flames, stars, etc.) around avatars
 *
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * AvatarDecoration: Main component that renders decorative SVG elements
 * getDecorationSVG: Returns the SVG markup for a specific decoration type
 *
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * decorationType: The type of decoration to render
 * size: The size of the decoration container
 * animate: Whether to animate the decoration
 *
 * --------------------------------------------------------------------------
 *                                   Imports
 * --------------------------------------------------------------------------
 * react: React framework
 */

import React from 'react'

interface AvatarDecorationProps {
    decorationType: string
    size?: number | string
    animate?: boolean
    className?: string
    style?: React.CSSProperties
}

// Helper for frame scaling - preserves aspect ratio of corners
const FrameCorner = ({ x, y, rotate = 0, children }: { x: number, y: number, rotate?: number, children: React.ReactNode }) => (
    <svg x={x} y={y} width="15" height="15" viewBox="0 0 100 100" overflow="visible">
        <g transform={`rotate(${rotate} 50 50)`}>{children}</g>
    </svg>
)

const FrameEdge = ({ x, y, rotate = 0, children }: { x: number, y: number, rotate?: number, children: React.ReactNode }) => (
    <svg x={x} y={y} width="10" height="10" viewBox="0 0 100 100" overflow="visible">
        <g transform={`rotate(${rotate} 50 50)`}>{children}</g>
    </svg>
)

// Decoration SVG definitions - each unique decoration type
const DECORATION_SVGS: Record<string, (size: number, animate: boolean) => React.ReactNode> = {
    // FLOWERS & NATURE
    'cherry_blossom': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100" className={animate ? 'animate-spin-slow' : ''}>
            {[0, 72, 144, 216, 288].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <ellipse cx="50" cy="15" rx="8" ry="15" fill="#FFB7C5" opacity="0.9">
                        {animate && <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" begin={`${i * 0.2}s`} />}
                    </ellipse>
                </g>
            ))}
            <circle cx="50" cy="50" r="8" fill="#FFD700" />
        </svg>
    ),

    'rose_thorns': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <path d="M50 5 L48 20 L52 20 Z" fill="#DC143C" opacity="0.9">
                        {animate && <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite" begin={`${i * 0.1}s`} />}
                    </path>
                    <circle cx="50" cy="8" r="4" fill="#FF69B4" />
                </g>
            ))}
        </svg>
    ),

    'sunflower': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[...Array(12)].map((_, i) => (
                <ellipse key={i} cx="50" cy="12" rx="6" ry="14" fill="#FFD700" transform={`rotate(${i * 30} 50 50)`}>
                    {animate && <animate attributeName="ry" values="14;16;14" dur="2s" repeatCount="indefinite" begin={`${i * 0.1}s`} />}
                </ellipse>
            ))}
            <circle cx="50" cy="50" r="15" fill="#8B4513" />
            <circle cx="50" cy="50" r="12" fill="#654321" />
        </svg>
    ),

    'vine_wrap': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <path d="M20 80 Q10 50 25 25 Q40 10 60 15 Q80 20 85 45 Q90 70 75 85" fill="none" stroke="#228B22" strokeWidth="3" strokeLinecap="round">
                {animate && <animate attributeName="stroke-dashoffset" from="200" to="0" dur="3s" repeatCount="indefinite" />}
            </path>
            {[25, 50, 75].map((pos, i) => (
                <circle key={i} cx={20 + pos * 0.6} cy={60 - pos * 0.3} r="3" fill="#32CD32">
                    {animate && <animate attributeName="r" values="2;4;2" dur="1.5s" repeatCount="indefinite" begin={`${i * 0.3}s`} />}
                </circle>
            ))}
        </svg>
    ),

    'butterfly_wings': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <g transform="translate(50, 20)">
                <ellipse cx="-15" cy="0" rx="12" ry="18" fill="#9370DB" opacity="0.8">
                    {animate && <animate attributeName="rx" values="12;14;12" dur="0.5s" repeatCount="indefinite" />}
                </ellipse>
                <ellipse cx="15" cy="0" rx="12" ry="18" fill="#9370DB" opacity="0.8">
                    {animate && <animate attributeName="rx" values="12;14;12" dur="0.5s" repeatCount="indefinite" />}
                </ellipse>
                <ellipse cx="-10" cy="15" rx="8" ry="12" fill="#BA55D3" opacity="0.8" />
                <ellipse cx="10" cy="15" rx="8" ry="12" fill="#BA55D3" opacity="0.8" />
                <rect x="-1" y="-5" width="2" height="25" fill="#4B0082" />
            </g>
        </svg>
    ),

    // COSMIC & CELESTIAL
    'stardust_trail': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[...Array(8)].map((_, i) => {
                const angle = (i * 45) * Math.PI / 180
                const r = 35 + (i % 2) * 8
                const x = 50 + r * Math.cos(angle)
                const y = 50 + r * Math.sin(angle)
                return (
                    <g key={i}>
                        <polygon points={`${x},${y - 6} ${x + 2},${y - 2} ${x + 6},${y} ${x + 2},${y + 2} ${x},${y + 6} ${x - 2},${y + 2} ${x - 6},${y} ${x - 2},${y - 2}`} fill="#FFD700">
                            {animate && <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" begin={`${i * 0.1}s`} />}
                        </polygon>
                    </g>
                )
            })}
        </svg>
    ),

    'galaxy_spiral': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100" className={animate ? 'animate-spin-slow' : ''}>
            <defs>
                <linearGradient id="galaxyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="50%" stopColor="#EC4899" />
                    <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
            </defs>
            <path d="M50 50 Q60 30 80 35 Q95 45 85 65 Q75 85 50 80 Q30 75 25 55 Q22 35 40 25 Q55 18 70 30" fill="none" stroke="url(#galaxyGrad)" strokeWidth="4" opacity="0.8" />
            {[...Array(5)].map((_, i) => (
                <circle key={i} cx={40 + i * 5} cy={30 + i * 8} r="2" fill="white" opacity="0.8">
                    {animate && <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" begin={`${i * 0.2}s`} />}
                </circle>
            ))}
        </svg>
    ),

    'northern_lights': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <defs>
                <linearGradient id="auroraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity="0.8">
                        {animate && <animate attributeName="stopColor" values="#22C55E;#06B6D4;#8B5CF6;#22C55E" dur="4s" repeatCount="indefinite" />}
                    </stop>
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.6">
                        {animate && <animate attributeName="stopColor" values="#8B5CF6;#22C55E;#06B6D4;#8B5CF6" dur="4s" repeatCount="indefinite" />}
                    </stop>
                </linearGradient>
            </defs>
            <path d="M10 70 Q30 30 50 50 Q70 70 90 30" fill="none" stroke="url(#auroraGrad)" strokeWidth="8" strokeLinecap="round" opacity="0.7" />
            <path d="M15 60 Q35 20 55 40 Q75 60 85 25" fill="none" stroke="url(#auroraGrad)" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
        </svg>
    ),

    'moon_phases': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <circle cx="50" cy="15" r="10" fill="#F5F5DC">
                {animate && <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />}
            </circle>
            <circle cx="48" cy="14" r="8" fill="#1a1a2e" />
            {[...Array(6)].map((_, i) => (
                <circle key={i} cx={20 + i * 12} cy={85} r="2" fill="#F5F5DC" opacity="0.6">
                    {animate && <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" begin={`${i * 0.2}s`} />}
                </circle>
            ))}
        </svg>
    ),

    // FIRE & ENERGY
    'flame_ring': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <defs>
                <linearGradient id="flameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#FF0000" />
                    <stop offset="40%" stopColor="#FF4500" />
                    <stop offset="70%" stopColor="#FF8C00" />
                    <stop offset="100%" stopColor="#FFD700" />
                </linearGradient>
            </defs>
            {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <path d="M50 2 Q45 12 48 20 Q46 15 50 24 Q54 15 52 20 Q55 12 50 2" fill="url(#flameGrad)">
                        {animate && <animate attributeName="d" values="M50 2 Q45 12 48 20 Q46 15 50 24 Q54 15 52 20 Q55 12 50 2;M50 0 Q43 14 47 22 Q44 17 50 28 Q56 17 53 22 Q57 14 50 0;M50 2 Q45 12 48 20 Q46 15 50 24 Q54 15 52 20 Q55 12 50 2" dur={`${0.3 + (i % 4) * 0.1}s`} repeatCount="indefinite" />}
                    </path>
                    <path d="M50 8 Q48 14 50 18 Q52 14 50 8" fill="#FFFF00" opacity="0.9">
                        {animate && <animate attributeName="opacity" values="0.6;1;0.6" dur="0.2s" repeatCount="indefinite" begin={`${i * 0.03}s`} />}
                    </path>
                </g>
            ))}
        </svg>
    ),

    'phoenix_feathers': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <defs>
                <linearGradient id="phoenixGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#FF4500" />
                    <stop offset="50%" stopColor="#FF6B35" />
                    <stop offset="100%" stopColor="#FFD700" />
                </linearGradient>
            </defs>
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <path d={`M50 3 Q44 12 47 22 L50 18 L53 22 Q56 12 50 3`} fill="url(#phoenixGrad)">
                        {animate && <animate attributeName="d" values="M50 3 Q44 12 47 22 L50 18 L53 22 Q56 12 50 3;M50 0 Q42 14 46 26 L50 20 L54 26 Q58 14 50 0;M50 3 Q44 12 47 22 L50 18 L53 22 Q56 12 50 3" dur={`${0.8 + i * 0.05}s`} repeatCount="indefinite" />}
                    </path>
                    <path d={`M50 8 Q47 14 49 19 L50 17 L51 19 Q53 14 50 8`} fill="#FFD700" opacity="0.8">
                        {animate && <animate attributeName="opacity" values="0.5;1;0.5" dur="0.6s" repeatCount="indefinite" begin={`${i * 0.08}s`} />}
                    </path>
                </g>
            ))}
        </svg>
    ),

    'lightning_bolt': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[0, 120, 240].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <path d="M50 5 L45 25 L52 22 L48 40 L55 20 L48 23 Z" fill="#FFD700" stroke="#FFA500" strokeWidth="1">
                        {animate && <animate attributeName="opacity" values="0.5;1;0.5" dur="0.3s" repeatCount="indefinite" begin={`${i * 0.1}s`} />}
                    </path>
                </g>
            ))}
        </svg>
    ),

    // ICE & WATER
    'snowflake_crown': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100" className={animate ? 'animate-spin-slow' : ''}>
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <line x1="50" y1="50" x2="50" y2="15" stroke="#87CEEB" strokeWidth="2" />
                    <line x1="50" y1="25" x2="45" y2="20" stroke="#87CEEB" strokeWidth="1.5" />
                    <line x1="50" y1="25" x2="55" y2="20" stroke="#87CEEB" strokeWidth="1.5" />
                    <circle cx="50" cy="15" r="3" fill="#E0FFFF">
                        {animate && <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" begin={`${i * 0.2}s`} />}
                    </circle>
                </g>
            ))}
        </svg>
    ),

    'frost_crystals': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[...Array(8)].map((_, i) => {
                const angle = i * 45 * Math.PI / 180
                const x = 50 + 35 * Math.cos(angle)
                const y = 50 + 35 * Math.sin(angle)
                return (
                    <polygon key={i} points={`${x},${y - 8} ${x + 5},${y} ${x},${y + 8} ${x - 5},${y}`} fill="#E0FFFF" opacity="0.8">
                        {animate && <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" begin={`${i * 0.15}s`} />}
                    </polygon>
                )
            })}
        </svg>
    ),

    'water_droplets': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[0, 72, 144, 216, 288].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <path d="M50 10 Q45 20 50 28 Q55 20 50 10" fill="#4FC3F7">
                        {animate && <animate attributeName="transform" values="translate(0,0);translate(0,3);translate(0,0)" dur="1.5s" repeatCount="indefinite" begin={`${i * 0.2}s`} />}
                    </path>
                </g>
            ))}
        </svg>
    ),

    // HEARTS & LOVE
    'heart_ring': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <path d="M50 15 C45 10 38 10 38 18 C38 25 50 32 50 32 C50 32 62 25 62 18 C62 10 55 10 50 15" fill="#FF6B9D">
                        {animate && <animate attributeName="opacity" values="0.6;1;0.6" dur="1s" repeatCount="indefinite" begin={`${i * 0.15}s`} />}
                    </path>
                </g>
            ))}
        </svg>
    ),

    // CRYSTALS & GEMS
    'diamond_crown': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[0, 72, 144, 216, 288].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <polygon points="50,8 45,20 50,25 55,20" fill="#00CED1" stroke="#40E0D0" strokeWidth="1">
                        {animate && <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" begin={`${i * 0.2}s`} />}
                    </polygon>
                </g>
            ))}
        </svg>
    ),

    'amethyst_ring': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <polygon points="50,5 47,18 50,22 53,18" fill="#9B59B6">
                        {animate && <animate attributeName="fill" values="#9B59B6;#8E44AD;#9B59B6" dur="2s" repeatCount="indefinite" begin={`${i * 0.1}s`} />}
                    </polygon>
                </g>
            ))}
        </svg>
    ),

    // TECH & DIGITAL
    'digital_circuit': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="38" fill="none" stroke="#00FF88" strokeWidth="2" strokeDasharray="8 4">
                {animate && <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1s" repeatCount="indefinite" />}
            </circle>
            {[0, 90, 180, 270].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <rect x="48" y="10" width="4" height="8" fill="#00FF88">
                        {animate && <animate attributeName="opacity" values="0.3;1;0.3" dur="0.5s" repeatCount="indefinite" begin={`${i * 0.1}s`} />}
                    </rect>
                </g>
            ))}
        </svg>
    ),

    'matrix_code': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[20, 35, 50, 65, 80].map((x, i) => (
                <text key={i} x={x} y="20" fill="#22C55E" fontSize="10" fontFamily="monospace" opacity="0.8">
                    {animate && <animate attributeName="y" values="10;90;10" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />}
                    {String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))}
                </text>
            ))}
        </svg>
    ),

    // MUSIC & SOUND
    'music_notes': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[30, 50, 70].map((x, i) => (
                <g key={i}>
                    <ellipse cx={x} cy={75 - i * 10} rx="6" ry="4" fill="#FF69B4">
                        {animate && <animate attributeName="cy" values={`${75 - i * 10};${70 - i * 10};${75 - i * 10}`} dur="1s" repeatCount="indefinite" begin={`${i * 0.2}s`} />}
                    </ellipse>
                    <line x1={x + 5} y1={75 - i * 10} x2={x + 5} y2={55 - i * 10} stroke="#FF69B4" strokeWidth="2" />
                </g>
            ))}
        </svg>
    ),

    // ELEMENTS - MORE NATURE
    'bamboo_ring': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[0, 90, 180, 270].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <rect x="48" y="8" width="4" height="20" fill="#228B22" rx="2" />
                    <line x1="46" y1="12" x2="54" y2="12" stroke="#006400" strokeWidth="1" />
                    <line x1="46" y1="22" x2="54" y2="22" stroke="#006400" strokeWidth="1" />
                    {animate && <circle cx="50" cy="8" r="2" fill="#90EE90"><animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" begin={`${i * 0.3}s`} /></circle>}
                </g>
            ))}
        </svg>
    ),

    'autumn_leaves': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[0, 72, 144, 216, 288].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <path d="M50 10 Q45 15 48 22 L50 20 L52 22 Q55 15 50 10" fill={['#FF4500', '#FF6347', '#FFD700', '#FF8C00', '#DC143C'][i]}>
                        {animate && <animate attributeName="transform" values="rotate(0 50 15);rotate(10 50 15);rotate(0 50 15)" dur="2s" repeatCount="indefinite" begin={`${i * 0.2}s`} />}
                    </path>
                </g>
            ))}
        </svg>
    ),

    // CELESTIAL - MORE
    'sun_rays': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[...Array(12)].map((_, i) => (
                <line key={i} x1="50" y1="50" x2="50" y2="12" stroke="#FFD700" strokeWidth="3" strokeLinecap="round" transform={`rotate(${i * 30} 50 50)`}>
                    {animate && <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" begin={`${i * 0.1}s`} />}
                </line>
            ))}
            <circle cx="50" cy="50" r="15" fill="#FFD700" />
        </svg>
    ),

    'shooting_stars': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[[20, 20], [80, 30], [30, 70]].map(([x, y], i) => (
                <g key={i}>
                    <polygon points={`${x},${y} ${x + 4},${y + 2} ${x},${y + 4} ${x - 4},${y + 2}`} fill="white">
                        {animate && <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" begin={`${i * 0.5}s`} />}
                    </polygon>
                    <line x1={x} y1={y} x2={x - 15} y2={y + 10} stroke="white" strokeWidth="1" opacity="0.5" />
                </g>
            ))}
        </svg>
    ),

    // MYSTICAL
    'magic_sparkles': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[[25, 20], [75, 25], [20, 75], [80, 70], [50, 10], [50, 90]].map(([x, y], i) => (
                <g key={i}>
                    <polygon points={`${x},${y - 5} ${x + 2},${y} ${x},${y + 5} ${x - 2},${y}`} fill="#FFD700">
                        {animate && <animate attributeName="transform" values={`scale(1) translate(${x},${y});scale(1.5) translate(${x},${y});scale(1) translate(${x},${y})`} dur="1s" repeatCount="indefinite" begin={`${i * 0.15}s`} />}
                    </polygon>
                </g>
            ))}
        </svg>
    ),

    'fairy_dust': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[...Array(12)].map((_, i) => {
                const angle = i * 30 * Math.PI / 180
                const r = 30 + (i % 3) * 8
                const x = 50 + r * Math.cos(angle)
                const y = 50 + r * Math.sin(angle)
                return (
                    <circle key={i} cx={x} cy={y} r="3" fill={i % 2 === 0 ? '#FF69B4' : '#DDA0DD'}>
                        {animate && <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" begin={`${i * 0.1}s`} />}
                    </circle>
                )
            })}
        </svg>
    ),

    'ethereal_wings': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <path d="M50 50 Q30 30 15 50 Q30 70 50 50" fill="none" stroke="#E6E6FA" strokeWidth="2" opacity="0.7">
                {animate && <animate attributeName="d" values="M50 50 Q30 30 15 50 Q30 70 50 50;M50 50 Q25 35 10 50 Q25 65 50 50;M50 50 Q30 30 15 50 Q30 70 50 50" dur="1s" repeatCount="indefinite" />}
            </path>
            <path d="M50 50 Q70 30 85 50 Q70 70 50 50" fill="none" stroke="#E6E6FA" strokeWidth="2" opacity="0.7">
                {animate && <animate attributeName="d" values="M50 50 Q70 30 85 50 Q70 70 50 50;M50 50 Q75 35 90 50 Q75 65 50 50;M50 50 Q70 30 85 50 Q70 70 50 50" dur="1s" repeatCount="indefinite" />}
            </path>
        </svg>
    ),

    // DRAGON & MYTHICAL
    'dragon_scales': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <path d="M50 12 Q45 18 50 25 Q55 18 50 12" fill="#DC2626" stroke="#991B1B" strokeWidth="1">
                        {animate && <animate attributeName="fill" values="#DC2626;#EF4444;#DC2626" dur="2s" repeatCount="indefinite" begin={`${i * 0.15}s`} />}
                    </path>
                </g>
            ))}
        </svg>
    ),

    'serpent_coil': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <path d="M30 50 Q50 30 70 50 Q50 70 30 50" fill="none" stroke="#228B22" strokeWidth="4" strokeLinecap="round">
                {animate && <animate attributeName="stroke-dashoffset" from="100" to="0" dur="2s" repeatCount="indefinite" />}
            </path>
            <circle cx="75" cy="50" r="5" fill="#228B22" />
            <circle cx="73" cy="48" r="1.5" fill="#FFD700" />
            <circle cx="77" cy="48" r="1.5" fill="#FFD700" />
        </svg>
    ),

    // FOOD & FUN (lighter themes)
    'candy_swirl': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100" className={animate ? 'animate-spin-slow' : ''}>
            <circle cx="50" cy="50" r="35" fill="none" stroke="#FF69B4" strokeWidth="8" strokeDasharray="15 10" />
            <circle cx="50" cy="50" r="35" fill="none" stroke="#87CEEB" strokeWidth="8" strokeDasharray="15 10" strokeDashoffset="15" />
        </svg>
    ),

    // DARK & SHADOW
    'shadow_tendrils': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[0, 72, 144, 216, 288].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <path d="M50 10 Q45 25 50 35 Q55 25 50 10" fill="#1a1a2e" opacity="0.8">
                        {animate && <animate attributeName="d" values="M50 10 Q45 25 50 35 Q55 25 50 10;M50 5 Q42 25 50 40 Q58 25 50 5;M50 10 Q45 25 50 35 Q55 25 50 10" dur="2s" repeatCount="indefinite" begin={`${i * 0.2}s`} />}
                    </path>
                </g>
            ))}
        </svg>
    ),

    'void_portal': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="35" fill="none" stroke="#4B0082" strokeWidth="3" opacity="0.6">
                {animate && <animate attributeName="r" values="35;38;35" dur="2s" repeatCount="indefinite" />}
            </circle>
            <circle cx="50" cy="50" r="28" fill="none" stroke="#8B008B" strokeWidth="2" opacity="0.5" />
            <circle cx="50" cy="50" r="20" fill="#0a0a0a" />
        </svg>
    ),

    // EARTH & GROUND
    'stone_circle': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <ellipse cx="50" cy="12" rx="8" ry="6" fill="#808080">
                        {animate && <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" begin={`${i * 0.2}s`} />}
                    </ellipse>
                </g>
            ))}
        </svg>
    ),

    // ANGEL & DIVINE
    'angel_halo': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <ellipse cx="50" cy="18" rx="25" ry="8" fill="none" stroke="#FFD700" strokeWidth="3">
                {animate && <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />}
            </ellipse>
            <ellipse cx="50" cy="18" rx="20" ry="6" fill="none" stroke="#FFF8DC" strokeWidth="2" opacity="0.6" />
        </svg>
    ),

    'divine_rays': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[...Array(8)].map((_, i) => (
                <line key={i} x1="50" y1="50" x2="50" y2="8" stroke="#FFF8DC" strokeWidth="2" strokeLinecap="round" transform={`rotate(${i * 45} 50 50)`} opacity="0.6">
                    {animate && <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" begin={`${i * 0.15}s`} />}
                </line>
            ))}
        </svg>
    ),

    // PRISM & RAINBOW  
    'prism_light': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <defs>
                <linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FF0080" />
                    <stop offset="25%" stopColor="#FF8C00" />
                    <stop offset="50%" stopColor="#40E0D0" />
                    <stop offset="75%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#FF0080" />
                </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="38" fill="none" stroke="url(#rainbowGrad)" strokeWidth="4">
                {animate && <animate attributeName="stroke-dashoffset" from="0" to="240" dur="3s" repeatCount="indefinite" />}
            </circle>
        </svg>
    ),

    // GLITCH & CYBER


    // NEON
    'neon_ring': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="38" fill="none" stroke="#FF00FF" strokeWidth="3">
                {animate && <animate attributeName="opacity" values="0.5;1;0.5" dur="0.5s" repeatCount="indefinite" />}
            </circle>
            <circle cx="50" cy="50" r="38" fill="none" stroke="#FF00FF" strokeWidth="6" opacity="0.3" filter="blur(4px)" />
        </svg>
    ),

    'plasma_orbs': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[0, 120, 240].map((angle, i) => {
                const rad = angle * Math.PI / 180
                const x = 50 + 35 * Math.cos(rad)
                const y = 50 + 35 * Math.sin(rad)
                return (
                    <circle key={i} cx={x} cy={y} r="8" fill="#14B8A6">
                        {animate && <animate attributeName="r" values="6;10;6" dur="1.5s" repeatCount="indefinite" begin={`${i * 0.3}s`} />}
                    </circle>
                )
            })}
        </svg>
    ),

    'quantum_particles': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[...Array(8)].map((_, i) => {
                const angle = i * 45 * Math.PI / 180
                const x = 50 + 35 * Math.cos(angle)
                const y = 50 + 35 * Math.sin(angle)
                return (
                    <circle key={i} cx={x} cy={y} r="4" fill="#818CF8">
                        {animate && <animate attributeName="opacity" values="0.2;1;0.2" dur="1s" repeatCount="indefinite" begin={`${i * 0.1}s`} />}
                    </circle>
                )
            })}
            <circle cx="50" cy="50" r="30" fill="none" stroke="#818CF8" strokeWidth="1" strokeDasharray="4 4">
                {animate && <animate attributeName="stroke-dashoffset" from="0" to="16" dur="1s" repeatCount="indefinite" />}
            </circle>
        </svg>
    ),

    'infinity_loop': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <path d="M30 50 C30 35 45 35 50 50 C55 65 70 65 70 50 C70 35 55 35 50 50 C45 65 30 65 30 50" fill="none" stroke="#A855F7" strokeWidth="3">
                {animate && <animate attributeName="stroke-dashoffset" from="200" to="0" dur="3s" repeatCount="indefinite" />}
            </path>
        </svg>
    ),

    // COSMIC FINAL
    'black_hole': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="15" fill="#0a0a0a" />
            <circle cx="50" cy="50" r="25" fill="none" stroke="#4B0082" strokeWidth="2" opacity="0.5">
                {animate && <animate attributeName="r" values="25;30;25" dur="2s" repeatCount="indefinite" />}
            </circle>
            <circle cx="50" cy="50" r="35" fill="none" stroke="#8B008B" strokeWidth="1" opacity="0.3">
                {animate && <animate attributeName="r" values="35;40;35" dur="2s" repeatCount="indefinite" />}
            </circle>
        </svg>
    ),

    'cosmic_dust': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            {[...Array(15)].map((_, i) => {
                const x = 15 + Math.random() * 70
                const y = 15 + Math.random() * 70
                return (
                    <circle key={i} cx={x} cy={y} r={1 + Math.random() * 2} fill="#D946EF" opacity="0.7">
                        {animate && <animate attributeName="opacity" values="0.3;0.9;0.3" dur={`${1 + Math.random()}s`} repeatCount="indefinite" begin={`${Math.random()}s`} />}
                    </circle>
                )
            })}
        </svg>
    ),

    'supernova': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="12" fill="#FEF08A">
                {animate && <animate attributeName="r" values="10;15;10" dur="1s" repeatCount="indefinite" />}
            </circle>
            {[...Array(8)].map((_, i) => (
                <line key={i} x1="50" y1="50" x2="50" y2="10" stroke="#FEF08A" strokeWidth="2" transform={`rotate(${i * 45} 50 50)`}>
                    {animate && <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" begin={`${i * 0.1}s`} />}
                </line>
            ))}
        </svg>
    ),

    'hibiscus_ring': (size, animate) => (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <defs>
                <linearGradient id="hibiscusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fb923c" />
                    <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
            </defs>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                <g key={i} transform={`rotate(${angle} 50 50)`}>
                    <ellipse cx="50" cy="8" rx="10" ry="16" fill="url(#hibiscusGrad)" opacity="0.9">
                        {animate && <animate attributeName="ry" values="16;18;16" dur="2s" repeatCount="indefinite" begin={`${i * 0.15}s`} />}
                    </ellipse>
                    <ellipse cx="50" cy="12" rx="5" ry="8" fill="#fcd34d" opacity="0.7" />
                </g>
            ))}
            {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((angle, i) => (
                <g key={`inner-${i}`} transform={`rotate(${angle} 50 50)`}>
                    <ellipse cx="50" cy="14" rx="6" ry="10" fill="url(#hibiscusGrad)" opacity="0.7">
                        {animate && <animate attributeName="opacity" values="0.5;0.9;0.5" dur="1.8s" repeatCount="indefinite" begin={`${i * 0.1}s`} />}
                    </ellipse>
                </g>
            ))}
        </svg>
    ),

    // DEFAULT
    'default': (size, animate) => (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect x="2" y="2" width="96" height="96" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" opacity="0.5" rx="4" />
        </svg>
    ),

    // ==========================================
    // FRAME VARIANTS (Responsive Div Containers)
    // ==========================================

    'nature_frame': (size, animate) => (
        <div className={`absolute inset-0 w-full h-full pointer-events-none ${animate ? 'animate-frame-nature' : ''}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs><linearGradient id="natureFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#4ade80" /></linearGradient></defs>
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="url(#natureFrameGrad)" strokeWidth="3" vectorEffect="non-scaling-stroke" rx="8" />
            </svg>
            <div className="absolute -top-2 left-0 right-0 flex justify-around">
                {[...Array(5)].map((_, i) => <div key={`t${i}`} className="w-6 h-6" style={{ transform: 'rotate(180deg)' }}>{DECORATION_SVGS['vine_wrap']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -bottom-2 left-0 right-0 flex justify-around">
                {[...Array(5)].map((_, i) => <div key={`b${i}`} className="w-6 h-6">{DECORATION_SVGS['vine_wrap']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(3)].map((_, i) => <div key={`l${i}`} className="w-6 h-6" style={{ transform: 'rotate(90deg)' }}>{DECORATION_SVGS['vine_wrap']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(3)].map((_, i) => <div key={`r${i}`} className="w-6 h-6" style={{ transform: 'rotate(-90deg)' }}>{DECORATION_SVGS['vine_wrap']?.(24, animate)}</div>)}
            </div>
        </div>
    ),

    'fire_frame': (size, animate) => (
        <div className={`absolute inset-0 w-full h-full pointer-events-none ${animate ? 'animate-frame-fire' : ''}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="fireFrameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#FF0000"><animate attributeName="stop-color" values="#FF0000;#FF4500;#FF0000" dur="0.5s" repeatCount="indefinite" /></stop>
                        <stop offset="50%" stopColor="#FF4500" />
                        <stop offset="100%" stopColor="#FFD700" />
                    </linearGradient>
                </defs>
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="url(#fireFrameGrad)" strokeWidth="3" vectorEffect="non-scaling-stroke" rx="8" />
            </svg>
            {/* Top edge flames */}
            <div className="absolute -top-2 left-0 right-0 flex justify-around">
                {[...Array(8)].map((_, i) => <div key={`t${i}`} className="w-6 h-6" style={{ transform: 'rotate(180deg)' }}>{DECORATION_SVGS['flame_ring']?.(24, animate)}</div>)}
            </div>
            {/* Bottom edge flames */}
            <div className="absolute -bottom-2 left-0 right-0 flex justify-around">
                {[...Array(8)].map((_, i) => <div key={`b${i}`} className="w-6 h-6">{DECORATION_SVGS['flame_ring']?.(24, animate)}</div>)}
            </div>
            {/* Left edge flames */}
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(5)].map((_, i) => <div key={`l${i}`} className="w-6 h-6" style={{ transform: 'rotate(90deg)' }}>{DECORATION_SVGS['flame_ring']?.(24, animate)}</div>)}
            </div>
            {/* Right edge flames */}
            <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(5)].map((_, i) => <div key={`r${i}`} className="w-6 h-6" style={{ transform: 'rotate(-90deg)' }}>{DECORATION_SVGS['flame_ring']?.(24, animate)}</div>)}
            </div>
        </div>
    ),

    'water_frame': (size, animate) => (
        <div className={`absolute inset-0 w-full h-full pointer-events-none ${animate ? 'animate-frame-water' : ''}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="waterFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#0ea5e9" /></linearGradient>
                </defs>
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="url(#waterFrameGrad)" strokeWidth="3" vectorEffect="non-scaling-stroke" rx="8" />
            </svg>
            <div className="absolute -top-2 left-0 right-0 flex justify-around">
                {[...Array(6)].map((_, i) => <div key={`t${i}`} className="w-6 h-6" style={{ transform: 'rotate(180deg)' }}>{DECORATION_SVGS['water_droplets']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -bottom-2 left-0 right-0 flex justify-around">
                {[...Array(6)].map((_, i) => <div key={`b${i}`} className="w-6 h-6">{DECORATION_SVGS['water_droplets']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(4)].map((_, i) => <div key={`l${i}`} className="w-6 h-6" style={{ transform: 'rotate(90deg)' }}>{DECORATION_SVGS['water_droplets']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(4)].map((_, i) => <div key={`r${i}`} className="w-6 h-6" style={{ transform: 'rotate(-90deg)' }}>{DECORATION_SVGS['water_droplets']?.(24, animate)}</div>)}
            </div>
        </div>
    ),

    'neon_frame': (size, animate) => (
        <div className={`absolute inset-0 w-full h-full pointer-events-none ${animate ? 'animate-frame-neon' : ''}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="#FF00FF" strokeWidth="3" vectorEffect="non-scaling-stroke" rx="6" />
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="#FF00FF" strokeWidth="6" vectorEffect="non-scaling-stroke" opacity="0.3" rx="6" />
            </svg>
            <div className="absolute -top-2 left-0 right-0 flex justify-around">
                {[...Array(5)].map((_, i) => <div key={`t${i}`} className="w-6 h-6">{DECORATION_SVGS['neon_ring']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -bottom-2 left-0 right-0 flex justify-around">
                {[...Array(5)].map((_, i) => <div key={`b${i}`} className="w-6 h-6">{DECORATION_SVGS['neon_ring']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(3)].map((_, i) => <div key={`l${i}`} className="w-6 h-6">{DECORATION_SVGS['neon_ring']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(3)].map((_, i) => <div key={`r${i}`} className="w-6 h-6">{DECORATION_SVGS['neon_ring']?.(24, animate)}</div>)}
            </div>
        </div>
    ),

    'cosmic_frame': (size, animate) => (
        <div className={`absolute inset-0 w-full h-full pointer-events-none ${animate ? 'animate-frame-cosmic' : ''}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs><linearGradient id="cosmicFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="50%" stopColor="#d946ef" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="url(#cosmicFrameGrad)" strokeWidth="3" vectorEffect="non-scaling-stroke" rx="6" />
            </svg>
            <div className="absolute -top-2 left-0 right-0 flex justify-around">
                {[...Array(6)].map((_, i) => <div key={`t${i}`} className="w-5 h-5">{DECORATION_SVGS['stardust_trail']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -bottom-2 left-0 right-0 flex justify-around">
                {[...Array(6)].map((_, i) => <div key={`b${i}`} className="w-5 h-5">{DECORATION_SVGS['stardust_trail']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(4)].map((_, i) => <div key={`l${i}`} className="w-5 h-5">{DECORATION_SVGS['stardust_trail']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(4)].map((_, i) => <div key={`r${i}`} className="w-5 h-5">{DECORATION_SVGS['stardust_trail']?.(20, animate)}</div>)}
            </div>
        </div>
    ),

    'glitch_frame': (size, animate) => (
        <div className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden rounded-lg ${animate ? 'animate-frame-glitch' : ''}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="#00FF88" strokeWidth="3" vectorEffect="non-scaling-stroke" rx="4" />
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="#FF0080" strokeWidth="2" vectorEffect="non-scaling-stroke" rx="4" opacity="0.5" style={{ transform: 'translate(2px, -1px)' }} />
            </svg>
            <div className="absolute inset-0 border-2 border-[#00FF88]/60 rounded-lg" />
        </div>
    ),

    'love_frame': (size, animate) => (
        <div className={`absolute inset-0 w-full h-full pointer-events-none ${animate ? 'animate-frame-love' : ''}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs><linearGradient id="loveFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f472b6" /><stop offset="100%" stopColor="#ec4899" /></linearGradient></defs>
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="url(#loveFrameGrad)" strokeWidth="3" vectorEffect="non-scaling-stroke" rx="8" />
            </svg>
            <div className="absolute -top-2 left-0 right-0 flex justify-around">
                {[...Array(5)].map((_, i) => <div key={`t${i}`} className="w-6 h-6" style={{ transform: 'rotate(180deg)' }}>{DECORATION_SVGS['heart_ring']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -bottom-2 left-0 right-0 flex justify-around">
                {[...Array(5)].map((_, i) => <div key={`b${i}`} className="w-6 h-6">{DECORATION_SVGS['heart_ring']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(3)].map((_, i) => <div key={`l${i}`} className="w-6 h-6" style={{ transform: 'rotate(90deg)' }}>{DECORATION_SVGS['heart_ring']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(3)].map((_, i) => <div key={`r${i}`} className="w-6 h-6" style={{ transform: 'rotate(-90deg)' }}>{DECORATION_SVGS['heart_ring']?.(24, animate)}</div>)}
            </div>
        </div>
    ),

    'ice_frame': (size, animate) => (
        <div className={`absolute inset-0 w-full h-full pointer-events-none ${animate ? 'animate-frame-ice' : ''}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs><linearGradient id="iceFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#67e8f9" /><stop offset="100%" stopColor="#22d3ee" /></linearGradient></defs>
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="url(#iceFrameGrad)" strokeWidth="3" vectorEffect="non-scaling-stroke" rx="6" />
            </svg>
            <div className="absolute -top-2 left-0 right-0 flex justify-around">
                {[...Array(6)].map((_, i) => <div key={`t${i}`} className="w-5 h-5">{DECORATION_SVGS['frost_crystals']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -bottom-2 left-0 right-0 flex justify-around">
                {[...Array(6)].map((_, i) => <div key={`b${i}`} className="w-5 h-5">{DECORATION_SVGS['frost_crystals']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(4)].map((_, i) => <div key={`l${i}`} className="w-5 h-5">{DECORATION_SVGS['frost_crystals']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(4)].map((_, i) => <div key={`r${i}`} className="w-5 h-5">{DECORATION_SVGS['frost_crystals']?.(20, animate)}</div>)}
            </div>
        </div>
    ),

    'shadow_frame': (size, animate) => (
        <div className={`absolute inset-0 w-full h-full pointer-events-none ${animate ? 'animate-frame-shadow' : ''}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="#27272a" strokeWidth="4" vectorEffect="non-scaling-stroke" rx="8" />
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="#18181b" strokeWidth="8" vectorEffect="non-scaling-stroke" opacity="0.4" rx="8" />
            </svg>
            <div className="absolute -top-2 left-0 right-0 flex justify-around">
                {[...Array(5)].map((_, i) => <div key={`t${i}`} className="w-5 h-5" style={{ transform: 'rotate(180deg)' }}>{DECORATION_SVGS['shadow_tendrils']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -bottom-2 left-0 right-0 flex justify-around">
                {[...Array(5)].map((_, i) => <div key={`b${i}`} className="w-5 h-5">{DECORATION_SVGS['shadow_tendrils']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(3)].map((_, i) => <div key={`l${i}`} className="w-5 h-5" style={{ transform: 'rotate(90deg)' }}>{DECORATION_SVGS['shadow_tendrils']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(3)].map((_, i) => <div key={`r${i}`} className="w-5 h-5" style={{ transform: 'rotate(-90deg)' }}>{DECORATION_SVGS['shadow_tendrils']?.(20, animate)}</div>)}
            </div>
        </div>
    ),

    'divine_frame': (size, animate) => (
        <div className={`absolute inset-0 w-full h-full pointer-events-none ${animate ? 'animate-frame-divine' : ''}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs><linearGradient id="divineFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fef08a" /><stop offset="50%" stopColor="#fcd34d" /><stop offset="100%" stopColor="#fef08a" /></linearGradient></defs>
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="url(#divineFrameGrad)" strokeWidth="3" vectorEffect="non-scaling-stroke" rx="8" />
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="#fef9c3" strokeWidth="6" vectorEffect="non-scaling-stroke" opacity="0.3" rx="8" />
            </svg>
            <div className="absolute -top-2 left-0 right-0 flex justify-around">
                {[...Array(5)].map((_, i) => <div key={`t${i}`} className="w-6 h-6">{DECORATION_SVGS['divine_rays']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -bottom-2 left-0 right-0 flex justify-around">
                {[...Array(5)].map((_, i) => <div key={`b${i}`} className="w-6 h-6" style={{ transform: 'rotate(180deg)' }}>{DECORATION_SVGS['divine_rays']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(3)].map((_, i) => <div key={`l${i}`} className="w-6 h-6" style={{ transform: 'rotate(90deg)' }}>{DECORATION_SVGS['divine_rays']?.(24, animate)}</div>)}
            </div>
            <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(3)].map((_, i) => <div key={`r${i}`} className="w-6 h-6" style={{ transform: 'rotate(-90deg)' }}>{DECORATION_SVGS['divine_rays']?.(24, animate)}</div>)}
            </div>
        </div>
    ),

    'moon_frame': (size, animate) => (
        <div className={`absolute inset-0 w-full h-full pointer-events-none ${animate ? 'animate-frame-moon' : ''}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs><linearGradient id="moonFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f5f5dc" /><stop offset="100%" stopColor="#fefce8" /></linearGradient></defs>
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="url(#moonFrameGrad)" strokeWidth="2" vectorEffect="non-scaling-stroke" rx="8" />
            </svg>
            <div className="absolute -top-2 left-0 right-0 flex justify-around">
                {[...Array(5)].map((_, i) => <div key={`t${i}`} className="w-5 h-5">{DECORATION_SVGS['moon_phases']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -bottom-2 left-0 right-0 flex justify-around">
                {[...Array(5)].map((_, i) => <div key={`b${i}`} className="w-5 h-5">{DECORATION_SVGS['moon_phases']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(3)].map((_, i) => <div key={`l${i}`} className="w-5 h-5">{DECORATION_SVGS['moon_phases']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(3)].map((_, i) => <div key={`r${i}`} className="w-5 h-5">{DECORATION_SVGS['moon_phases']?.(20, animate)}</div>)}
            </div>
        </div>
    ),

    'sparkle_frame': (size, animate) => (
        <div className={`absolute inset-0 w-full h-full pointer-events-none ${animate ? 'animate-frame-sparkle' : ''}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs><linearGradient id="sparkleFrameGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#fde047" /></linearGradient></defs>
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="url(#sparkleFrameGrad)" strokeWidth="3" vectorEffect="non-scaling-stroke" rx="8" />
            </svg>
            <div className="absolute -top-2 left-0 right-0 flex justify-around">
                {[...Array(6)].map((_, i) => <div key={`t${i}`} className="w-4 h-4">{DECORATION_SVGS['magic_sparkles']?.(16, animate)}</div>)}
            </div>
            <div className="absolute -bottom-2 left-0 right-0 flex justify-around">
                {[...Array(6)].map((_, i) => <div key={`b${i}`} className="w-4 h-4">{DECORATION_SVGS['magic_sparkles']?.(16, animate)}</div>)}
            </div>
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(4)].map((_, i) => <div key={`l${i}`} className="w-4 h-4">{DECORATION_SVGS['magic_sparkles']?.(16, animate)}</div>)}
            </div>
            <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(4)].map((_, i) => <div key={`r${i}`} className="w-4 h-4">{DECORATION_SVGS['magic_sparkles']?.(16, animate)}</div>)}
            </div>
        </div>
    ),

    'aurora_frame': (size, animate) => (
        <div className={`absolute inset-0 w-full h-full pointer-events-none ${animate ? 'animate-frame-aurora' : ''}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="auroraGradFrame" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#4ade80" />
                        <stop offset="50%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                </defs>
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="url(#auroraGradFrame)" strokeWidth="3" vectorEffect="non-scaling-stroke" rx="8" />
                <rect x="1" y="1" width="98" height="98" fill="none" stroke="url(#auroraGradFrame)" strokeWidth="6" vectorEffect="non-scaling-stroke" rx="8" opacity="0.3" />
            </svg>
            <div className="absolute -top-2 left-0 right-0 flex justify-around">
                {[...Array(6)].map((_, i) => <div key={`t${i}`} className="w-5 h-5">{DECORATION_SVGS['northern_lights']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -bottom-2 left-0 right-0 flex justify-around">
                {[...Array(6)].map((_, i) => <div key={`b${i}`} className="w-5 h-5">{DECORATION_SVGS['northern_lights']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(4)].map((_, i) => <div key={`l${i}`} className="w-5 h-5">{DECORATION_SVGS['northern_lights']?.(20, animate)}</div>)}
            </div>
            <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around">
                {[...Array(4)].map((_, i) => <div key={`r${i}`} className="w-5 h-5">{DECORATION_SVGS['northern_lights']?.(20, animate)}</div>)}
            </div>
        </div>
    ),
}

export default function AvatarDecoration({ decorationType, size, animate = true, className = '', style = {} }: AvatarDecorationProps) {
    const renderDecoration = DECORATION_SVGS[decorationType] || DECORATION_SVGS['default']

    const isNumericSize = typeof size === 'number'

    // Default to full size if no specific size is provided (for frames)
    const containerStyle = isNumericSize
        ? { width: size, height: size, ...style }
        : { width: '100%', height: '100%', ...style };

    // Use centering for numeric sizes, inset-0 for full frames
    const positionClass = isNumericSize
        ? 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
        : 'absolute inset-0';

    return (
        <div className={`${positionClass} pointer-events-none ${className}`} style={containerStyle}>
            {renderDecoration(typeof size === 'number' ? size : 100, animate)}
        </div>
    )
}

// Export decoration types for use elsewhere
export const DECORATION_TYPES = Object.keys(DECORATION_SVGS)

// Map profile effect IDs to decoration types
// Map profile effect IDs to decoration types - NOW USING FRAME VARIANTS
export const EFFECT_TO_DECORATION: Record<string, string> = {
    // Common (12) - Nature & Basic Elements
    'glow_soft': 'moon_frame',            // Moonlit Aura
    'pulse_slow': 'love_frame',           // Heartbeat
    'shimmer_light': 'sparkle_frame',     // Morning Dew -> Sparkle
    'fade_cycle': 'aurora_frame',         // Twilight Fade -> Aurora
    'sparkle_mini': 'sparkle_frame',      // Firefly Dance -> Sparkle
    'wave_gentle': 'water_frame',         // Ocean Breeze
    'float_dots': 'sparkle_frame',        // Dandelion Seeds -> Sparkle
    'blink_soft': 'cosmic_frame',         // Starlight Wink
    'rotate_slow': 'love_frame',          // Compass Rose -> Love (Pink/Swirl)
    'scale_breath': 'nature_frame',       // Living Breath
    'bounce_light': 'water_frame',        // Pebble Skip
    'sway_gentle': 'nature_frame',        // Willow Sway
    // Uncommon (10) - Enhanced Nature & Elements
    'sparkle_gold': 'divine_frame',       // Golden Pollen
    'pulse_neon': 'neon_frame',           // Bioluminescent
    'glow_rainbow': 'aurora_frame',       // Prism Light -> Aurora
    'shimmer_ocean': 'water_frame',       // Coral Reef
    'wave_electric': 'water_frame',       // Tidal Wave
    'float_stars': 'cosmic_frame',        // Stardust Trail
    'pulse_fire': 'fire_frame',           // Ember Heart
    'sparkle_cosmic': 'cosmic_frame',     // Nebula Dust
    'glow_sunset': 'fire_frame',          // Sunset Blaze
    'shimmer_aurora': 'aurora_frame',     // Northern Lights
    // Rare (10) - Mystical & Magical
    'particle_storm': 'nature_frame',     // Fairy Swarm
    'ring_expand': 'neon_frame',          // Sonic Bloom
    'lightning_flash': 'divine_frame',    // Storm Caller
    'fire_outline': 'fire_frame',         // Flame Wreath
    'ice_crystals': 'ice_frame',          // Frost Crown
    'smoke_trail': 'shadow_frame',        // Mist Veil
    'glitch_effect': 'glitch_frame',      // Digital Ghost
    'matrix_rain': 'glitch_frame',        // Code Rain
    'neon_outline': 'neon_frame',         // Neon Halo
    'pixel_burst': 'glitch_frame',        // Retro Wave
    // Epic (8) - Elemental Forces
    'plasma_field': 'neon_frame',         // Plasma Core
    'gravity_warp': 'shadow_frame',       // Gravity Well
    'energy_sphere': 'neon_frame',        // Spirit Orb
    'aurora_dance': 'aurora_frame',       // Aurora Crown
    'fire_storm': 'fire_frame',           // Inferno Ring
    'ice_shatter': 'ice_frame',           // Glacier Break
    'thunder_strike': 'divine_frame',     // Thunder God
    'shadow_shift': 'shadow_frame',       // Shadow Walker
    // Legendary (6) - Cosmic & Divine
    'supernova': 'cosmic_frame',          // Supernova Burst
    'void_rift': 'shadow_frame',          // Void Embrace
    'galaxy_swirl': 'cosmic_frame',       // Galaxy Spiral
    'phoenix_rise': 'fire_frame',         // Phoenix Ascent
    'divine_radiance': 'divine_frame',    // Celestial Glow
    'cosmic_explosion': 'cosmic_frame',   // Cosmic Storm
    // Ultra (3) - Reality-Bending
    'reality_tear': 'glitch_frame',       // Reality Fracture
    'time_warp': 'cosmic_frame',          // Chrono Shift
    'singularity': 'shadow_frame',        // Black Hole
    // Divine (1) - Ultimate
    'transcendence': 'divine_frame',      // Transcendence
}

// Map profile border IDs to decoration types
export const BORDER_TO_DECORATION: Record<string, string> = {
    'solid_white': 'default',
    'solid_gray': 'stone_circle',
    'solid_blue': 'water_droplets',
    'solid_green': 'vine_wrap',
    'solid_red': 'rose_thorns',
    'solid_purple': 'amethyst_ring',
    'solid_pink': 'cherry_blossom',
    'solid_orange': 'autumn_leaves',
    'solid_cyan': 'frost_crystals',
    'solid_yellow': 'sunflower',
    'dashed_white': 'default',
    'dotted_white': 'fairy_dust',
    'double_gold': 'sun_rays',
    'double_silver': 'moon_phases',
    'gradient_sunset': 'hibiscus_ring',
    'gradient_ocean': 'water_droplets',
    'gradient_forest': 'bamboo_ring',
    'gradient_royal': 'butterfly_wings',
    'thick_neon': 'neon_ring',
    'thick_violet': 'amethyst_ring',
    'ridge_gold': 'sun_rays',
    'groove_blue': 'water_droplets',
    'glow_cyan': 'frost_crystals',
    'glow_pink': 'heart_ring',
    'glow_green': 'vine_wrap',
    'glow_gold': 'sun_rays',
    'gradient_fire': 'flame_ring',
    'gradient_ice': 'snowflake_crown',
    'gradient_cosmic': 'galaxy_spiral',
    'animated_pulse': 'plasma_orbs',
    'animated_glow': 'magic_sparkles',
    'pixelated': 'digital_circuit',
    'rainbow_solid': 'prism_light',
    'rainbow_animated': 'candy_swirl',
    'plasma_border': 'plasma_orbs',
    'fire_border': 'flame_ring',
    'ice_border': 'snowflake_crown',
    'electric_border': 'lightning_bolt',
    'neon_animated': 'neon_ring',
    'shadow_border': 'shadow_tendrils',
    'galaxy_border': 'galaxy_spiral',
    'aurora_border': 'northern_lights',
    'supernova_border': 'supernova',
    'phoenix_border': 'phoenix_feathers',
    'dragon_border': 'dragon_scales',
    'crystal_border': 'diamond_crown',
    'void_border': 'void_portal',
    'cosmic_rift': 'cosmic_dust',
    'quantum_border': 'quantum_particles',
    'divine_halo': 'angel_halo',
}
