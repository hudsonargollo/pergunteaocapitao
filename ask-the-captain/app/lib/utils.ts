import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Cave-themed utility functions for enhanced glass morphism styling
 */

// Glass morphism intensity levels
export const glassLevels = {
  subtle: 'glass-subtle',
  default: 'glass',
  medium: 'glass-medium', 
  strong: 'glass-strong',
  intense: 'glass-intense'
} as const

// Cave-themed text variants with proper contrast
export const textVariants = {
  primary: 'text-cave-primary',
  secondary: 'text-cave-secondary', 
  accent: 'text-cave-accent',
  ember: 'text-cave-ember'
} as const

// Interactive hover effects
export const hoverEffects = {
  glow: 'hover-cave-glow',
  lift: 'hover-cave-lift',
  intense: 'hover-cave-intense'
} as const

// Focus states for accessibility
export const focusStates = {
  default: 'focus-cave',
  strong: 'focus-cave-strong'
} as const

/**
 * Generate glass morphism classes based on intensity and features
 */
export function getGlassClasses(
  intensity: keyof typeof glassLevels = 'default',
  options: {
    border?: boolean
    elevated?: boolean
    hover?: keyof typeof hoverEffects
    lighting?: boolean
  } = {}
) {
  const classes: string[] = [glassLevels[intensity]]
  
  if (options.border) classes.push('glass-border')
  if (options.elevated) classes.push('card-elevated')
  if (options.hover) classes.push(hoverEffects[options.hover])
  if (options.lighting) classes.push('cave-lighting')
  
  return cn(...classes)
}

/**
 * Generate button classes with cave theme
 */
export function getCaveButtonClasses(
  variant: 'primary' | 'secondary' | 'cave' = 'primary',
  size: 'sm' | 'default' | 'lg' | 'icon' = 'default',
  options: {
    hover?: keyof typeof hoverEffects
    focus?: keyof typeof focusStates
  } = {}
) {
  const baseClasses: string[] = ['transition-all', 'duration-300']
  
  if (variant === 'primary') {
    baseClasses.push('btn-cave-primary')
  } else if (variant === 'secondary') {
    baseClasses.push('btn-cave-secondary')
  } else {
    baseClasses.push('glass-medium', 'border-glass-border/30')
  }
  
  if (options.hover) baseClasses.push(hoverEffects[options.hover])
  if (options.focus) baseClasses.push(focusStates[options.focus])
  
  return cn(...baseClasses)
}

/**
 * Generate accessible text classes with proper contrast
 */
export function getCaveTextClasses(
  variant: keyof typeof textVariants = 'primary',
  options: {
    weight?: 'normal' | 'medium' | 'semibold' | 'bold'
    size?: 'sm' | 'base' | 'lg' | 'xl' | '2xl'
  } = {}
) {
  const classes: string[] = [textVariants[variant]]
  
  if (options.weight) {
    const weights = {
      normal: 'font-normal',
      medium: 'font-medium', 
      semibold: 'font-semibold',
      bold: 'font-bold'
    }
    classes.push(weights[options.weight])
  }
  
  if (options.size) {
    const sizes = {
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg', 
      xl: 'text-xl',
      '2xl': 'text-2xl'
    }
    classes.push(sizes[options.size])
  }
  
  return cn(...classes)
}

/**
 * Accessibility helpers
 */
export function getAccessibleClasses(options: {
  focusVisible?: boolean
  reducedMotion?: boolean
  highContrast?: boolean
} = {}) {
  const classes: string[] = []
  
  if (options.focusVisible) {
    classes.push('focus-visible:focus-cave-strong')
  }
  
  // These are handled by CSS media queries, but can be used for JS detection
  if (options.reducedMotion) {
    classes.push('motion-reduce:transition-none', 'motion-reduce:transform-none')
  }
  
  if (options.highContrast) {
    classes.push('contrast-more:border-2', 'contrast-more:border-primary')
  }
  
  return cn(...classes)
}

/**
 * Chat message styling helper
 */
export function getChatMessageClasses(type: 'user' | 'ai', isLoading = false) {
  const baseClasses: string[] = [
    'rounded-3xl',
    'p-5', 
    'card-elevated',
    'hover-cave-lift',
    'transition-all',
    'duration-300'
  ]
  
  if (type === 'user') {
    baseClasses.push('chat-message-user')
  } else {
    baseClasses.push('chat-message-ai')
  }
  
  if (isLoading) {
    baseClasses.push('loading-cave')
  }
  
  return cn(...baseClasses)
}