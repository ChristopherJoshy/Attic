/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * SparklineChart Component - A premium SVG chart for displaying trends.
 * Features gradient fills, glow effects, data point markers, grid lines,
 * and min/max value labels for a polished look.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * SparklineChart: Main component.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * data: Array of numerical points.
 * paths: Calculated SVG paths.
 * points: Array of coordinate points.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React hooks.
 */

import { useMemo } from 'react'

interface SparklineChartProps {
    data: number[]
    color?: string
    height?: number
    className?: string
    showArea?: boolean
    showDots?: boolean
    showGrid?: boolean
    showLabels?: boolean
}

export default function SparklineChart({
    data,
    color = '#22c55e',
    height = 40,
    className = '',
    showArea = true,
    showDots = true,
    showGrid = true,
    showLabels = true
}: SparklineChartProps) {

    const { paths, points, min, max } = useMemo(() => {
        if (!data || data.length < 2) return { paths: { stroke: '', fill: '' }, points: [], min: 0, max: 0 }

        const minVal = Math.min(...data)
        const maxVal = Math.max(...data)
        const range = maxVal - minVal || 1

        const pts = data.map((val, i) => {
            const x = 10 + (i / (data.length - 1)) * 80
            const normalizedY = (val - minVal) / range
            const y = 85 - (normalizedY * 70)
            return { x, y, value: val }
        })

        const pointsStr = pts.map(p => `${p.x},${p.y}`).join(' L ')
        const strokePath = `M ${pointsStr}`

        const fillPath = `
      M ${pts[0].x},95 
      L ${pts[0].x},${pts[0].y} 
      L ${pointsStr} 
      L ${pts[pts.length - 1].x},95 
      Z
    `

        return {
            paths: { stroke: strokePath, fill: fillPath },
            points: pts,
            min: minVal,
            max: maxVal
        }
    }, [data])

    if (!data || data.length < 2) return null

    const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`
    const glowId = `sparkline-glow-${Math.random().toString(36).substr(2, 9)}`

    return (
        <div className="relative" style={{ height }}>
            <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className={`overflow-visible w-full h-full ${className}`}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                        <stop offset="50%" stopColor={color} stopOpacity="0.15" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                    <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {showGrid && (
                    <>
                        <line x1="10" y1="15" x2="90" y2="15" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                        <line x1="10" y1="50" x2="90" y2="50" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                        <line x1="10" y1="85" x2="90" y2="85" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                    </>
                )}

                {showArea && (
                    <path
                        d={paths.fill}
                        fill={`url(#${gradientId})`}
                        stroke="none"
                    />
                )}

                <path
                    d={paths.stroke}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    filter={`url(#${glowId})`}
                />

                {showDots && points.map((pt, i) => (
                    <g key={i}>
                        <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="1.5"
                            fill={color}
                            vectorEffect="non-scaling-stroke"
                        />
                        {i === points.length - 1 && (
                            <>
                                <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r="4"
                                    fill={color}
                                    opacity="0.3"
                                    vectorEffect="non-scaling-stroke"
                                />
                                <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r="2.5"
                                    fill={color}
                                    vectorEffect="non-scaling-stroke"
                                />
                            </>
                        )}
                    </g>
                ))}
            </svg>

            {showLabels && (
                <>
                    <div
                        className="absolute right-0 text-[10px] font-mono opacity-60"
                        style={{ top: 0, color }}
                    >
                        {max.toLocaleString()}
                    </div>
                    <div
                        className="absolute right-0 text-[10px] font-mono opacity-40"
                        style={{ bottom: 0, color }}
                    >
                        {min.toLocaleString()}
                    </div>
                </>
            )}
        </div>
    )
}
