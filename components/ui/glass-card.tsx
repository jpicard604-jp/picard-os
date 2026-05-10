'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

type GlowVariant = 'none' | 'cyan' | 'pink' | 'green' | 'amber'

const GLOW: Record<GlowVariant, string> = {
  none:  '',
  cyan:  'shadow-[0_0_0_1px_rgba(34,211,238,0.14),0_4px_32px_rgba(34,211,238,0.09)] border-cyan-400/[0.13]',
  pink:  'shadow-[0_0_0_1px_rgba(244,114,182,0.14),0_4px_32px_rgba(244,114,182,0.09)] border-pink-400/[0.13]',
  green: 'shadow-[0_0_0_1px_rgba(74,222,128,0.12),0_4px_24px_rgba(74,222,128,0.07)] border-green-400/[0.12]',
  amber: 'shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_4px_24px_rgba(251,191,36,0.07)] border-amber-400/[0.12]',
}

interface GlassCardProps extends HTMLMotionProps<'div'> {
  glow?: GlowVariant
  hover?: boolean
}

export function GlassCard({ glow = 'none', hover = false, className, children, ...props }: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        'glass rounded-2xl overflow-hidden border border-white/[0.08]',
        GLOW[glow],
        className
      )}
      whileHover={hover ? { y: -1, scale: 1.004 } : undefined}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
