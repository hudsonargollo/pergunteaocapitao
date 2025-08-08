/**
 * Micro-animations and interaction feedback utilities
 * Provides subtle, engaging animations that enhance user experience
 */

import { Variants } from 'framer-motion'

/**
 * Hover effect variants for different UI elements
 */
export const HOVER_VARIANTS = {
  // Subtle scale and glow for interactive elements
  subtle: {
    rest: { scale: 1, filter: 'brightness(1)' },
    hover: { 
      scale: 1.02, 
      filter: 'brightness(1.1)',
      transition: { duration: 0.2, ease: 'easeOut' }
    },
    tap: { 
      scale: 0.98,
      transition: { duration: 0.1, ease: 'easeInOut' }
    }
  },

  // More pronounced effect for primary actions
  prominent: {
    rest: { 
      scale: 1, 
      boxShadow: '0 0 0 rgba(255, 51, 51, 0)' 
    },
    hover: { 
      scale: 1.05, 
      boxShadow: '0 0 20px rgba(255, 51, 51, 0.3)',
      transition: { duration: 0.3, ease: 'easeOut' }
    },
    tap: { 
      scale: 0.95,
      transition: { duration: 0.1, ease: 'easeInOut' }
    }
  },

  // Gentle lift effect for cards and containers
  lift: {
    rest: { 
      y: 0, 
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' 
    },
    hover: { 
      y: -4, 
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
      transition: { duration: 0.3, ease: 'easeOut' }
    }
  },

  // Glow effect for special elements
  glow: {
    rest: { 
      filter: 'drop-shadow(0 0 0 rgba(255, 51, 51, 0))' 
    },
    hover: { 
      filter: 'drop-shadow(0 0 8px rgba(255, 51, 51, 0.4))',
      transition: { duration: 0.3, ease: 'easeOut' }
    }
  }
}

/**
 * Success feedback animations
 */
export const SUCCESS_VARIANTS: Variants = {
  initial: { scale: 1, opacity: 1 },
  success: {
    scale: [1, 1.1, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 0.6,
      ease: 'easeInOut',
      times: [0, 0.5, 1]
    }
  }
}

/**
 * Error shake animation
 */
export const ERROR_SHAKE_VARIANTS: Variants = {
  initial: { x: 0 },
  error: {
    x: [-10, 10, -10, 10, 0],
    transition: {
      duration: 0.5,
      ease: 'easeInOut'
    }
  }
}

/**
 * Stagger animation for lists
 */
export const STAGGER_VARIANTS = {
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeOut'
      }
    }
  }
}

/**
 * Pulse animation for loading states
 */
export const PULSE_VARIANTS: Variants = {
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [0.7, 1, 0.7],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
}

/**
 * Breathing animation for ambient elements
 */
export const BREATHING_VARIANTS: Variants = {
  breathe: {
    scale: [1, 1.02, 1],
    opacity: [0.8, 1, 0.8],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
}

/**
 * Ripple effect for button clicks
 */
export const RIPPLE_VARIANTS: Variants = {
  initial: { 
    scale: 0, 
    opacity: 0.8 
  },
  animate: { 
    scale: 4, 
    opacity: 0,
    transition: {
      duration: 0.6,
      ease: 'easeOut'
    }
  }
}

/**
 * Slide in animations for modals and panels
 */
export const SLIDE_VARIANTS = {
  fromBottom: {
    hidden: { y: '100%', opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30
      }
    },
    exit: {
      y: '100%',
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: 'easeInOut'
      }
    }
  },
  fromRight: {
    hidden: { x: '100%', opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30
      }
    },
    exit: {
      x: '100%',
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: 'easeInOut'
      }
    }
  }
}

/**
 * Fade animations with different directions
 */
export const FADE_VARIANTS = {
  up: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeOut'
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: {
        duration: 0.3,
        ease: 'easeIn'
      }
    }
  },
  down: {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeOut'
      }
    },
    exit: {
      opacity: 0,
      y: 20,
      transition: {
        duration: 0.3,
        ease: 'easeIn'
      }
    }
  }
}

/**
 * Utility function to create custom spring animations
 */
export function createSpringAnimation(
  stiffness: number = 300,
  damping: number = 30,
  mass: number = 1
) {
  return {
    type: 'spring' as const,
    stiffness,
    damping,
    mass
  }
}

/**
 * Utility function to create custom easing animations
 */
export function createEaseAnimation(
  duration: number = 0.3,
  ease: string = 'easeOut'
) {
  return {
    duration,
    ease
  }
}

/**
 * Performance-aware animation settings
 */
export function getOptimizedAnimationSettings(
  enableComplexAnimations: boolean = true,
  reducedMotion: boolean = false
) {
  if (reducedMotion) {
    return {
      duration: 0,
      ease: 'linear' as const,
      scale: 1,
      opacity: 1
    }
  }

  if (!enableComplexAnimations) {
    return {
      duration: 0.2,
      ease: 'easeOut' as const,
      scale: [1, 1.01, 1],
      opacity: [1, 0.95, 1]
    }
  }

  return {
    duration: 0.3,
    ease: 'easeOut' as const,
    scale: [1, 1.05, 1],
    opacity: [1, 0.9, 1]
  }
}