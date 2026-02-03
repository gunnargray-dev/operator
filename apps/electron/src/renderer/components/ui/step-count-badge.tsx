/**
 * StepCountBadge - Animated step counter with context usage ring
 *
 * Features:
 * - Circular progress ring showing context window usage
 * - Color transitions: green → yellow → orange as context fills
 * - Spring animation when step count increments
 * - Pulse glow effect on increment
 */

import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface StepCountBadgeProps {
  /** Number of completed steps */
  stepCount: number
  /** Total tokens used */
  totalTokens?: number
  /** Context window size (max tokens) */
  contextWindow?: number
  /** Whether the task is currently processing */
  isProcessing?: boolean
  /** Size variant */
  size?: 'sm' | 'md'
  /** Additional class name */
  className?: string
}

/**
 * Get ring color based on context usage percentage
 */
function getRingColor(percentage: number): string {
  if (percentage < 0.5) return 'stroke-success' // Green
  if (percentage < 0.75) return 'stroke-warning' // Yellow/Orange
  return 'stroke-destructive' // Red/Orange
}

/**
 * Get glow color for pulse animation
 */
function getGlowColor(percentage: number): string {
  if (percentage < 0.5) return 'rgba(34, 197, 94, 0.4)' // Green glow
  if (percentage < 0.75) return 'rgba(234, 179, 8, 0.4)' // Yellow glow
  return 'rgba(239, 68, 68, 0.4)' // Red glow
}

export function StepCountBadge({
  stepCount,
  totalTokens = 0,
  contextWindow = 200000, // Default 200K context
  isProcessing = false,
  size = 'md',
  className,
}: StepCountBadgeProps) {
  const prevStepCountRef = useRef(stepCount)
  const [showPulse, setShowPulse] = useState(false)
  const [incrementAmount, setIncrementAmount] = useState<number | null>(null)

  // Calculate context usage
  const contextUsage = contextWindow > 0 ? Math.min(totalTokens / contextWindow, 1) : 0
  const ringColor = getRingColor(contextUsage)
  const glowColor = getGlowColor(contextUsage)

  // Spring animation for scale
  const scale = useSpring(1, { stiffness: 400, damping: 15 })

  // Detect step count changes and trigger animation
  useEffect(() => {
    if (stepCount > prevStepCountRef.current) {
      const diff = stepCount - prevStepCountRef.current
      setIncrementAmount(diff)

      // Trigger scale animation
      scale.set(1.2)
      setTimeout(() => scale.set(1), 150)

      // Trigger pulse glow
      setShowPulse(true)
      setTimeout(() => setShowPulse(false), 400)

      // Clear increment indicator
      setTimeout(() => setIncrementAmount(null), 800)
    }
    prevStepCountRef.current = stepCount
  }, [stepCount, scale])

  // Size configs
  const sizeConfig = size === 'sm'
    ? { outer: 28, inner: 22, stroke: 2, text: 'text-[9px]', ring: 24 }
    : { outer: 36, inner: 28, stroke: 2.5, text: 'text-[11px]', ring: 32 }

  // SVG circle calculations
  const radius = (sizeConfig.ring - sizeConfig.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - contextUsage)

  return (
    <motion.div
      style={{ scale }}
      className={cn('relative inline-flex items-center justify-center', className)}
    >
      {/* Pulse glow effect */}
      <AnimatePresence>
        {showPulse && (
          <motion.div
            initial={{ opacity: 0.8, scale: 1 }}
            animate={{ opacity: 0, scale: 1.8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full"
            style={{
              backgroundColor: glowColor,
              width: sizeConfig.outer,
              height: sizeConfig.outer,
            }}
          />
        )}
      </AnimatePresence>

      {/* Progress ring SVG */}
      <svg
        width={sizeConfig.ring}
        height={sizeConfig.ring}
        className="absolute -rotate-90"
      >
        {/* Background ring (subtle) */}
        <circle
          cx={sizeConfig.ring / 2}
          cy={sizeConfig.ring / 2}
          r={radius}
          fill="none"
          strokeWidth={sizeConfig.stroke}
          className="stroke-foreground/10"
        />
        {/* Progress ring */}
        {contextUsage > 0 && (
          <motion.circle
            cx={sizeConfig.ring / 2}
            cy={sizeConfig.ring / 2}
            r={radius}
            fill="none"
            strokeWidth={sizeConfig.stroke}
            strokeLinecap="round"
            className={cn(ringColor, 'transition-colors duration-300')}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
            }}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}
        {/* Shimmer effect while processing */}
        {isProcessing && (
          <circle
            cx={sizeConfig.ring / 2}
            cy={sizeConfig.ring / 2}
            r={radius}
            fill="none"
            strokeWidth={sizeConfig.stroke}
            className="stroke-foreground/20 animate-pulse"
            strokeDasharray={`${circumference * 0.1} ${circumference * 0.9}`}
          />
        )}
      </svg>

      {/* Step count number */}
      <span
        className={cn(
          sizeConfig.text,
          'font-semibold tabular-nums z-10',
          isProcessing ? 'text-foreground' : 'text-foreground/70'
        )}
      >
        {stepCount}
      </span>

      {/* Floating +N indicator */}
      <AnimatePresence>
        {incrementAmount !== null && (
          <motion.span
            initial={{ opacity: 1, y: 0, x: 8 }}
            animate={{ opacity: 0, y: -12 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute -right-1 -top-1 text-[9px] font-medium text-success"
          >
            +{incrementAmount}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
