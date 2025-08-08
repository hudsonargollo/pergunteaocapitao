'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { FADE_VARIANTS, SUCCESS_VARIANTS, ERROR_SHAKE_VARIANTS } from '@/app/lib/micro-animations'

interface FeedbackToast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

interface InteractiveFeedbackProps {
  className?: string
}

/**
 * Global feedback system for user interactions
 */
export function InteractiveFeedback({ className }: InteractiveFeedbackProps) {
  const [toasts, setToasts] = useState<FeedbackToast[]>([])

  const addToast = useCallback((toast: Omit<FeedbackToast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    const newToast = { ...toast, id }
    
    setToasts(prev => [...prev, newToast])
    
    // Auto-remove toast after duration
    const duration = toast.duration || 4000
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const getToastIcon = (type: FeedbackToast['type']) => {
    switch (type) {
      case 'success':
        return <Check className="w-5 h-5 text-green-400" />
      case 'error':
        return <X className="w-5 h-5 text-red-400" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const getToastStyles = (type: FeedbackToast['type']) => {
    const baseStyles = "border cave-glass backdrop-blur-md"
    
    switch (type) {
      case 'success':
        return cn(baseStyles, "border-green-500/20 bg-green-500/10")
      case 'error':
        return cn(baseStyles, "border-red-500/20 bg-red-500/10")
      case 'warning':
        return cn(baseStyles, "border-yellow-500/20 bg-yellow-500/10")
      case 'info':
        return cn(baseStyles, "border-blue-500/20 bg-blue-500/10")
    }
  }

  return (
    <div 
      className={cn(
        "fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none",
        className
      )}
      role="region"
      aria-label="Notificações do sistema"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            variants={FADE_VARIANTS.down}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl shadow-lg pointer-events-auto",
              "max-w-sm min-w-[300px]",
              getToastStyles(toast.type)
            )}
            role="alert"
            aria-live="polite"
          >
            <div className="flex-shrink-0">
              {getToastIcon(toast.type)}
            </div>
            
            <div className="flex-1">
              <p className="text-sm font-medium text-cave-white">
                {toast.message}
              </p>
            </div>
            
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Fechar notificação"
            >
              <X className="w-4 h-4 text-cave-mist hover:text-cave-white" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * Hook for using the feedback system
 */
export function useFeedback() {
  const showSuccess = useCallback((message: string, duration?: number) => {
    // This would typically use a context or global state
    // For now, we'll use a custom event
    window.dispatchEvent(new CustomEvent('show-feedback', {
      detail: { type: 'success', message, duration }
    }))
  }, [])

  const showError = useCallback((message: string, duration?: number) => {
    window.dispatchEvent(new CustomEvent('show-feedback', {
      detail: { type: 'error', message, duration }
    }))
  }, [])

  const showWarning = useCallback((message: string, duration?: number) => {
    window.dispatchEvent(new CustomEvent('show-feedback', {
      detail: { type: 'warning', message, duration }
    }))
  }, [])

  const showInfo = useCallback((message: string, duration?: number) => {
    window.dispatchEvent(new CustomEvent('show-feedback', {
      detail: { type: 'info', message, duration }
    }))
  }, [])

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo
  }
}

/**
 * Visual feedback component for successful actions
 */
export function SuccessFeedback({ 
  children, 
  onSuccess,
  className 
}: { 
  children: React.ReactNode
  onSuccess?: () => void
  className?: string 
}) {
  const [showSuccess, setShowSuccess] = useState(false)

  const handleSuccess = useCallback(() => {
    setShowSuccess(true)
    onSuccess?.()
    
    // Reset after animation
    setTimeout(() => setShowSuccess(false), 600)
  }, [onSuccess])

  return (
    <motion.div
      className={className}
      variants={SUCCESS_VARIANTS}
      initial="initial"
      animate={showSuccess ? "success" : "initial"}
      onClick={handleSuccess}
    >
      {children}
    </motion.div>
  )
}

/**
 * Error feedback component with shake animation
 */
export function ErrorFeedback({ 
  children, 
  hasError,
  className 
}: { 
  children: React.ReactNode
  hasError: boolean
  className?: string 
}) {
  return (
    <motion.div
      className={className}
      variants={ERROR_SHAKE_VARIANTS}
      initial="initial"
      animate={hasError ? "error" : "initial"}
    >
      {children}
    </motion.div>
  )
}

/**
 * Hover feedback wrapper with customizable effects
 */
export function HoverFeedback({
  children,
  variant = 'subtle',
  disabled = false,
  className
}: {
  children: React.ReactNode
  variant?: 'subtle' | 'prominent' | 'lift' | 'glow'
  disabled?: boolean
  className?: string
}) {
  const variants = {
    subtle: {
      rest: { scale: 1, filter: 'brightness(1)' },
      hover: { scale: 1.02, filter: 'brightness(1.1)' }
    },
    prominent: {
      rest: { scale: 1, boxShadow: '0 0 0 rgba(255, 51, 51, 0)' },
      hover: { scale: 1.05, boxShadow: '0 0 20px rgba(255, 51, 51, 0.3)' }
    },
    lift: {
      rest: { y: 0, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' },
      hover: { y: -4, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)' }
    },
    glow: {
      rest: { filter: 'drop-shadow(0 0 0 rgba(255, 51, 51, 0))' },
      hover: { filter: 'drop-shadow(0 0 8px rgba(255, 51, 51, 0.4))' }
    }
  }

  return (
    <motion.div
      className={className}
      variants={variants[variant]}
      initial="rest"
      whileHover={disabled ? undefined : "hover"}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}