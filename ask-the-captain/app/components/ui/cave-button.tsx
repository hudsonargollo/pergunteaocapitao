'use client'

import React, { forwardRef } from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/app/lib/utils'
import { MicroCaveLoading } from './cave-loading'

interface CaveButtonProps extends Omit<HTMLMotionProps<"button">, 'size'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  loadingText?: string
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
  glowEffect?: boolean
}

/**
 * Cave-themed button component with brand-consistent styling and animations
 */
export const CaveButton = forwardRef<HTMLButtonElement, CaveButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    isLoading = false,
    loadingText,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    glowEffect = false,
    children,
    className,
    disabled,
    ...props
  }, ref) => {
    const baseClasses = cn(
      // Base styling
      "relative inline-flex items-center justify-center",
      "font-medium transition-all duration-300 ease-out",
      "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-cave-dark",
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
      "overflow-hidden group",
      
      // Full width
      fullWidth && "w-full"
    )

    const variantClasses = {
      primary: cn(
        "bg-gradient-to-r from-cave-red to-cave-red/90",
        "border border-cave-red/20 text-cave-white",
        "hover:from-cave-red/90 hover:to-cave-red",
        "hover:border-cave-red/40 hover:shadow-lg hover:shadow-cave-red/25",
        "focus:ring-cave-red/50",
        "active:scale-[0.98] active:shadow-inner",
        glowEffect && "shadow-lg shadow-cave-red/20 hover:shadow-cave-red/40"
      ),
      
      secondary: cn(
        "bg-gradient-to-r from-cave-stone/20 to-cave-charcoal/20",
        "border border-cave-border text-cave-off-white",
        "hover:from-cave-stone/30 hover:to-cave-charcoal/30",
        "hover:border-cave-red/20 hover:text-cave-white",
        "focus:ring-cave-red/30",
        "active:scale-[0.98]"
      ),
      
      ghost: cn(
        "bg-transparent border border-transparent text-cave-off-white",
        "hover:bg-cave-red/10 hover:border-cave-red/20 hover:text-cave-white",
        "focus:ring-cave-red/30",
        "active:scale-[0.98]"
      ),
      
      danger: cn(
        "bg-gradient-to-r from-red-600 to-red-700",
        "border border-red-500/20 text-white",
        "hover:from-red-700 hover:to-red-800",
        "hover:border-red-400/40 hover:shadow-lg hover:shadow-red-500/25",
        "focus:ring-red-500/50",
        "active:scale-[0.98]"
      )
    }

    const sizeClasses = {
      sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
      md: "px-4 py-2 text-sm rounded-xl gap-2",
      lg: "px-6 py-3 text-base rounded-xl gap-2.5"
    }

    const iconSizeClasses = {
      sm: "w-3 h-3",
      md: "w-4 h-4", 
      lg: "w-5 h-5"
    }

    const rippleVariants = {
      initial: { scale: 0, opacity: 0.8 },
      animate: { scale: 4, opacity: 0 },
      transition: { duration: 0.6, ease: "easeOut" }
    }

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isLoading || disabled) return
      
      // Create ripple effect
      const button = e.currentTarget
      const rect = button.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height)
      const x = e.clientX - rect.left - size / 2
      const y = e.clientY - rect.top - size / 2
      
      // Call original onClick
      props.onClick?.(e)
    }

    const buttonContent = (
      <>
        {/* Ripple effect container */}
        <div className="absolute inset-0 overflow-hidden rounded-inherit">
          <motion.div
            className="absolute bg-white/20 rounded-full pointer-events-none"
            initial="initial"
            animate="animate"
            variants={rippleVariants}
          />
        </div>
        
        {/* Glow effect for primary buttons */}
        {variant === 'primary' && glowEffect && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-cave-red/20 to-cave-ember/20 rounded-inherit blur-sm"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [0.95, 1.05, 0.95]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}
        
        {/* Button content */}
        <div className="relative flex items-center justify-center gap-inherit">
          {/* Left icon */}
          {icon && iconPosition === 'left' && !isLoading && (
            <span className={cn("flex-shrink-0", iconSizeClasses[size])}>
              {icon}
            </span>
          )}
          
          {/* Loading state */}
          {isLoading && (
            <MicroCaveLoading className="flex-shrink-0" />
          )}
          
          {/* Button text */}
          <span className="flex-1 text-center">
            {isLoading ? (loadingText || 'Carregando...') : children}
          </span>
          
          {/* Right icon */}
          {icon && iconPosition === 'right' && !isLoading && (
            <span className={cn("flex-shrink-0", iconSizeClasses[size])}>
              {icon}
            </span>
          )}
        </div>
      </>
    )

    return (
      <motion.button
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        disabled={disabled || isLoading}
        onClick={handleClick}
        whileHover={!disabled && !isLoading ? { scale: 1.02 } : undefined}
        whileTap={!disabled && !isLoading ? { scale: 0.98 } : undefined}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        {...props}
      >
        {buttonContent}
      </motion.button>
    )
  }
)

CaveButton.displayName = 'CaveButton'

/**
 * Floating Action Button with cave theme
 */
export const CaveFAB = forwardRef<HTMLButtonElement, Omit<CaveButtonProps, 'size' | 'fullWidth'>>(
  ({ className, glowEffect = true, ...props }, ref) => {
    return (
      <CaveButton
        ref={ref}
        size="lg"
        glowEffect={glowEffect}
        className={cn(
          "rounded-full w-14 h-14 p-0 shadow-lg shadow-cave-red/30",
          "hover:shadow-xl hover:shadow-cave-red/40",
          "fixed bottom-6 right-6 z-50",
          className
        )}
        {...props}
      />
    )
  }
)

CaveFAB.displayName = 'CaveFAB'