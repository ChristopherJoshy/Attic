/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * RankBadge Component - Visual representation of a player's rank.
 * Supports animations and click interactions.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * RankBadge: Main component.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * rankIcons: Map of rank names to image assets.
 * rankConfig: Configuration for rank colors and aesthetics.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * framer-motion: Animations.
 * types: Rank type definition.
 * assets: Rank icon images.
 */

import { motion } from 'framer-motion'
import type { Rank } from '../../types'

import UnrankedIcon from '../../assets/icons/ranks/unranked.png'
import BronzeIcon from '../../assets/icons/ranks/bronze.png'
import GoldIcon from '../../assets/icons/ranks/gold.png'
import PlatinumIcon from '../../assets/icons/ranks/platinum.png'
import RankerIcon from '../../assets/icons/ranks/ranker.png'

interface RankBadgeProps {
  rank: Rank
  size?: number
  className?: string
  onClick?: () => void
  showLabel?: boolean
  animate?: boolean
}

const rankIcons: Record<Rank, string> = {
  Unranked: UnrankedIcon,
  Bronze: BronzeIcon,
  Gold: GoldIcon,
  Platinum: PlatinumIcon,
  Ranker: RankerIcon,
}

const rankConfig: Record<Rank, {
  primaryColor: string
  secondaryColor: string
  gradient: string[]
  eloRange: string
  borderColor: string
}> = {
  Unranked: {
    primaryColor: '#71717a',
    secondaryColor: '#52525b',
    gradient: ['#71717a', '#52525b'],
    eloRange: '0 - 999',
    borderColor: '#71717a',
  },
  Bronze: {
    primaryColor: '#cd7f32',
    secondaryColor: '#a0522d',
    gradient: ['#cd7f32', '#b87333'],
    eloRange: '1000 - 1999',
    borderColor: '#cd7f32',
  },
  Gold: {
    primaryColor: '#ffd700',
    secondaryColor: '#daa520',
    gradient: ['#ffd700', '#f0c200'],
    eloRange: '2000 - 2999',
    borderColor: '#ffd700',
  },
  Platinum: {
    primaryColor: '#e5e4e2',
    secondaryColor: '#b8b8b8',
    gradient: ['#e5e4e2', '#c0c0c0'],
    eloRange: '3000 - 9999',
    borderColor: '#e5e4e2',
  },
  Ranker: {
    primaryColor: '#a855f7',
    secondaryColor: '#ec4899',
    gradient: ['#a855f7', '#ec4899', '#f43f5e'],
    eloRange: '10000+',
    borderColor: '#a855f7',
  },
}

export default function RankBadge({
  rank,
  size = 32,
  className = '',
  onClick,
  showLabel = false,
  animate = false
}: RankBadgeProps) {
  const config = rankConfig[rank]
  const isClickable = !!onClick
  const isRanker = rank === 'Ranker'
  const iconSrc = rankIcons[rank]

  return (
    <motion.div
      className={`relative inline-flex flex-col items-center gap-1 ${isClickable ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      whileHover={isClickable ? { scale: 1.1 } : undefined}
      whileTap={isClickable ? { scale: 0.95 } : undefined}
    >
      <motion.div
        className="relative"
        style={{
          width: size,
          height: size,
          filter: animate ? `drop-shadow(0 0 6px ${config.borderColor}60)` : undefined,
        }}
        initial={animate ? { opacity: 0.9, scale: 0.98 } : undefined}
        animate={animate && isRanker ? {
          opacity: [0.9, 1, 0.9],
          scale: [0.98, 1.02, 0.98],
          filter: [
            `drop-shadow(0 0 6px ${config.borderColor}60)`,
            `drop-shadow(0 0 12px ${config.borderColor}90)`,
            `drop-shadow(0 0 6px ${config.borderColor}60)`
          ]
        } : animate ? {
          opacity: [0.9, 1, 0.9],
          scale: [0.98, 1.01, 0.98]
        } : undefined}
        transition={animate ? {
          duration: isRanker ? 3 : 2,
          repeat: Infinity,
          ease: "easeInOut"
        } : undefined}
      >
        <img
          src={iconSrc}
          alt={`${rank} rank`}
          className="w-full h-full object-contain"
        />
      </motion.div>

      {showLabel && (
        <span
          className="text-[10px] uppercase tracking-wider font-medium"
          style={{ color: config.primaryColor }}
        >
          {rank}
        </span>
      )}
    </motion.div>
  )
}

export { rankConfig }
