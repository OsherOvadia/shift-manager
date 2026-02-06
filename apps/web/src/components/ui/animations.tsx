'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ReactNode } from 'react'

// Page transition wrapper
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

// Fade in animation for lists
export function FadeIn({ 
  children, 
  delay = 0,
  duration = 0.3,
  className = ''
}: { 
  children: ReactNode
  delay?: number
  duration?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Stagger children animation
export function StaggerContainer({ 
  children,
  className = '',
  staggerDelay = 0.05
}: { 
  children: ReactNode
  className?: string
  staggerDelay?: number
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ 
  children,
  className = ''
}: { 
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: { 
          opacity: 1, 
          y: 0, 
          scale: 1,
          transition: {
            type: 'spring',
            stiffness: 300,
            damping: 24,
          }
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Scale on tap/click
export function ScaleOnTap({ 
  children,
  className = ''
}: { 
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Slide in from side
export function SlideIn({ 
  children,
  direction = 'right',
  className = ''
}: { 
  children: ReactNode
  direction?: 'left' | 'right' | 'up' | 'down'
  className?: string
}) {
  const variants = {
    left: { x: -30, opacity: 0 },
    right: { x: 30, opacity: 0 },
    up: { y: -30, opacity: 0 },
    down: { y: 30, opacity: 0 },
  }

  return (
    <motion.div
      initial={variants[direction]}
      animate={{ x: 0, y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Number counter animation
export function AnimatedNumber({ 
  value,
  duration = 0.5,
  className = ''
}: { 
  value: number
  duration?: number
  className?: string
}) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration }}
      className={className}
    >
      {value}
    </motion.span>
  )
}

// Pulse animation for notifications/badges
export function Pulse({ 
  children,
  className = ''
}: { 
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Success checkmark animation
export function SuccessCheck({ className = '' }: { className?: string }) {
  return (
    <motion.svg
      className={className}
      viewBox="0 0 24 24"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3 }}
      />
      <motion.path
        d="M6 12l4 4 8-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      />
    </motion.svg>
  )
}

// Loading skeleton with shimmer effect
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={`bg-muted rounded ${className}`}
      animate={{
        backgroundPosition: ['200% 0', '-200% 0'],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear',
      }}
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
        backgroundSize: '200% 100%',
      }}
    />
  )
}

// Card skeleton
export function CardSkeleton() {
  return (
    <div className="p-4 border rounded-lg bg-card space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
          <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-6 bg-muted rounded animate-pulse w-16" />
        <div className="h-6 bg-muted rounded animate-pulse w-20" />
      </div>
    </div>
  )
}

// Grid skeleton
export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

// Confetti explosion effect
export function Confetti({ trigger }: { trigger: boolean }) {
  if (!trigger) return null
  
  return (
    <AnimatePresence>
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="fixed w-3 h-3 rounded-full pointer-events-none z-50"
          style={{
            backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6'][i % 5],
            left: '50%',
            top: '50%',
          }}
          initial={{ scale: 0, x: 0, y: 0 }}
          animate={{
            scale: [0, 1, 0],
            x: (Math.random() - 0.5) * 400,
            y: (Math.random() - 0.5) * 400,
            rotate: Math.random() * 360,
          }}
          transition={{
            duration: 0.8,
            ease: 'easeOut',
          }}
        />
      ))}
    </AnimatePresence>
  )
}

// Re-export framer-motion
export { motion } from 'framer-motion'
export { AnimatePresence } from 'framer-motion'
