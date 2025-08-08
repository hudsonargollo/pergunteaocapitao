'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Flame, Zap, Mountain, Circle } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { BREATHING_VARIANTS, PULSE_VARIANTS } from '@/app/lib/micro-animations'

interface LoadingStateProps {
  variant?: 'dots' | 'pulse' | 'wave' | 'orbit' | 'cave-crystals'
  size?: 'sm' | 'md' | 'lg'
  message?: string
  className?: string
}

/**
 * Enhanced loading states with engaging cave-themed animations
 */
export function EnhancedLoadingState({ 
  variant = 'dots', 
  size = 'md', 
  message,
  className 
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  const containerSizes = {
    sm: 'gap-1',
    md: 'gap-2',
    lg: 'gap-3'
  }

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const renderLoadingAnimation = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className={cn("flex items-center", containerSizes[size])}>
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className={cn("bg-cave-red rounded-full", sizeClasses[size])}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.4, 1, 0.4]
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: index * 0.2,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        )

      case 'pulse':
        return (
          <motion.div
            className={cn(
              "bg-gradient-to-r from-cave-red to-cave-ember rounded-full",
              sizeClasses[size]
            )}
            variants={PULSE_VARIANTS}
            animate="pulse"
          />
        )

      case 'wave':
        return (
          <div className={cn("flex items-end", containerSizes[size])}>
            {[0, 1, 2, 3, 4].map((index) => (
              <motion.div
                key={index}
                className="w-1 bg-cave-red rounded-full"
                animate={{
                  height: ['8px', '24px', '8px']
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: index * 0.1,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        )

      case 'orbit':
        return (
          <div className={cn("relative", sizeClasses[size])}>
            <motion.div
              className="absolute inset-0 border-2 border-cave-red/30 rounded-full"
              animate={{ rotate: 360 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear"
              }}
            />
            <motion.div
              className="absolute top-0 left-1/2 w-2 h-2 bg-cave-red rounded-full -translate-x-1/2 -translate-y-1"
              animate={{ rotate: 360 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear"
              }}
              style={{ transformOrigin: '50% 200%' }}
            />
          </div>
        )

      case 'cave-crystals':
        return (
          <div className={cn("flex items-center", containerSizes[size])}>
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className={cn(
                  "bg-gradient-to-t from-cave-red to-cave-ember",
                  "clip-path-triangle",
                  sizeClasses[size]
                )}
                animate={{
                  scaleY: [0.5, 1.2, 0.5],
                  opacity: [0.6, 1, 0.6],
                  filter: [
                    'brightness(0.8) saturate(0.8)',
                    'brightness(1.2) saturate(1.2)',
                    'brightness(0.8) saturate(0.8)'
                  ]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: index * 0.3,
                  ease: "easeInOut"
                }}
                style={{
                  clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
                }}
              />
            ))}
          </div>
        )

      default:
        return (
          <motion.div
            className={cn("bg-cave-red rounded-full", sizeClasses[size])}
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        )
    }
  }

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center",
        containerSizes[size],
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="status"
      aria-label={message || "Carregando..."}
    >
      {renderLoadingAnimation()}
      
      {message && (
        <motion.p
          className={cn(
            "text-cave-off-white font-medium text-center mt-2",
            textSizes[size]
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.p>
      )}
      
      <span className="sr-only">
        {message || "Carregando conteúdo..."}
      </span>
    </motion.div>
  )
}

/**
 * Skeleton loading component with cave theme
 */
export function CaveSkeleton({ 
  lines = 3, 
  className 
}: { 
  lines?: number
  className?: string 
}) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-label="Carregando conteúdo">
      {Array.from({ length: lines }).map((_, index) => (
        <motion.div
          key={index}
          className="h-4 bg-gradient-to-r from-cave-stone/20 to-cave-charcoal/20 rounded-lg"
          animate={{
            opacity: [0.4, 0.8, 0.4]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: index * 0.2,
            ease: "easeInOut"
          }}
          style={{
            width: index === lines - 1 ? '75%' : '100%'
          }}
        />
      ))}
      <span className="sr-only">Carregando conteúdo...</span>
    </div>
  )
}

/**
 * Progress indicator with cave theme
 */
export function CaveProgressIndicator({ 
  progress, 
  message,
  className 
}: { 
  progress: number
  message?: string
  className?: string 
}) {
  return (
    <div className={cn("w-full space-y-2", className)}>
      {message && (
        <p className="text-sm text-cave-off-white font-medium">
          {message}
        </p>
      )}
      
      <div className="relative h-2 bg-cave-stone/20 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cave-red to-cave-ember rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        
        {/* Animated glow effect */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full"
          animate={{
            x: ['-100%', '100%']
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{ width: '30%' }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-cave-mist">
        <span>{Math.round(progress)}%</span>
        <span>Completo</span>
      </div>
    </div>
  )
}

/**
 * Breathing ambient loading for background processes
 */
export function AmbientLoading({ 
  className 
}: { 
  className?: string 
}) {
  return (
    <motion.div
      className={cn(
        "w-3 h-3 bg-cave-ember/60 rounded-full",
        className
      )}
      variants={BREATHING_VARIANTS}
      animate="breathe"
      role="status"
      aria-label="Processamento em segundo plano"
    >
      <span className="sr-only">Processamento em segundo plano</span>
    </motion.div>
  )
}