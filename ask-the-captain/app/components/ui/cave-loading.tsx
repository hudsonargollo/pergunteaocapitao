'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Flame, Zap, Mountain } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { CAVE_ANIMATIONS } from '@/app/lib/brand-assets'

interface CaveLoadingProps {
  variant?: 'ember' | 'crystal' | 'torch' | 'typing'
  size?: 'sm' | 'md' | 'lg'
  message?: string
  className?: string
}

/**
 * Cave-themed loading component with brand-consistent animations
 */
export function CaveLoading({ 
  variant = 'ember', 
  size = 'md', 
  message,
  className 
}: CaveLoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  const containerSizeClasses = {
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4'
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const renderLoadingIcon = () => {
    const iconClass = cn(sizeClasses[size], 'text-cave-red')
    
    switch (variant) {
      case 'ember':
        return (
          <motion.div
            className="relative"
            {...CAVE_ANIMATIONS.emberPulse}
          >
            <Zap className={iconClass} />
            <motion.div
              className="absolute inset-0 bg-cave-red/20 rounded-full blur-sm"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>
        )
      
      case 'crystal':
        return (
          <motion.div
            className={cn(
              "relative rounded-lg bg-gradient-to-r from-cave-red via-cave-ember to-cave-red",
              "bg-[length:200%_100%]",
              sizeClasses[size]
            )}
            {...CAVE_ANIMATIONS.crystalShimmer}
            style={{
              backgroundImage: 'linear-gradient(90deg, #FF3333 0%, #FFA500 50%, #FF3333 100%)'
            }}
          >
            <Mountain className={cn(iconClass, 'relative z-10 mix-blend-overlay')} />
          </motion.div>
        )
      
      case 'torch':
        return (
          <motion.div
            className="relative"
            {...CAVE_ANIMATIONS.torchFlicker}
          >
            <Flame className={iconClass} />
            {/* Flame glow effect */}
            <motion.div
              className="absolute -inset-1 bg-gradient-radial from-cave-ember/40 to-transparent rounded-full"
              animate={{
                scale: [0.8, 1.2, 0.9, 1.1, 0.85],
                opacity: [0.4, 0.7, 0.5, 0.6, 0.45]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>
        )
      
      case 'typing':
        return (
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="w-2 h-2 bg-cave-red rounded-full"
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
      
      default:
        return <Zap className={iconClass} />
    }
  }

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center",
        containerSizeClasses[size],
        className
      )}
      {...CAVE_ANIMATIONS.caveDepthFade}
      role="status"
      aria-label={message || "Carregando..."}
    >
      {renderLoadingIcon()}
      
      {message && (
        <motion.p
          className={cn(
            "text-cave-off-white font-medium text-center",
            textSizeClasses[size]
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.p>
      )}
      
      {/* Screen reader text */}
      <span className="sr-only">
        {message || "Carregando conteúdo..."}
      </span>
    </motion.div>
  )
}

/**
 * Captain-specific loading component with persona messaging
 */
export function CaptainLoading({ 
  isGeneratingImage = false,
  isTyping = false,
  className 
}: {
  isGeneratingImage?: boolean
  isTyping?: boolean
  className?: string
}) {
  if (isGeneratingImage) {
    return (
      <CaveLoading
        variant="crystal"
        size="md"
        message="O Capitão está se preparando para aparecer..."
        className={className}
      />
    )
  }
  
  if (isTyping) {
    return (
      <CaveLoading
        variant="typing"
        size="md"
        message="O Capitão está formulando sua resposta..."
        className={className}
      />
    )
  }
  
  return (
    <CaveLoading
      variant="torch"
      size="md"
      message="Conectando com a caverna..."
      className={className}
    />
  )
}

/**
 * Micro-loading component for subtle interactions
 */
export function MicroCaveLoading({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn("inline-flex items-center gap-1", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className="w-1 h-1 bg-cave-red rounded-full"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: index * 0.15,
            ease: "easeInOut"
          }}
        />
      ))}
    </motion.div>
  )
}