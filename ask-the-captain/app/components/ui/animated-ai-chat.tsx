'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Send, Loader2, MessageCircle, Zap } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import CaptainImage from '@/app/components/chat/CaptainImage'
import PerformanceMonitor from '@/app/components/chat/PerformanceMonitor'
import { CaveLoading, CaptainLoading } from '@/app/components/ui/cave-loading'
import { CaveButton } from '@/app/components/ui/cave-button'
import { HoverFeedback, SuccessFeedback, ErrorFeedback } from '@/app/components/ui/interactive-feedback'
import { EnhancedLoadingState } from '@/app/components/ui/enhanced-loading-states'
import { HOVER_VARIANTS, STAGGER_VARIANTS } from '@/app/lib/micro-animations'
import { useCaptainImageConsistency } from '@/app/hooks/useCaptainImageConsistency'
import { useAnimationPerformance, useDevicePerformance, useOptimizedRerender } from '@/app/hooks/useAnimationPerformance'
import { 
  useOptimizedChatState, 
  useImageCache, 
  useAPIBatching,
  useVirtualScrolling,
  useMessageMemoryManagement
} from '@/app/hooks/useOptimizedChatState'
import { 
  BRAND_ASSETS, 
  getCaptainImageForContext, 
  getFallbackImageUrl,
  preloadBrandAssets,
  CAVE_TYPOGRAPHY,
  CAVE_ANIMATIONS
} from '@/app/lib/brand-assets'
import type { ResponseContext } from '@/app/lib/captain-image-validator'
import { offlineStateManager } from '@/lib/offline-state-manager'
import { TrainingFeedback } from '@/app/components/chat/TrainingFeedback'

// TypeScript interfaces for the component
interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  imageUrl?: string
  isTyping?: boolean
}

// Remove duplicate interface - using the one from useOptimizedChatState

interface AnimatedAIChatProps {
  initialMessage?: string
  onMessageSent?: (message: string) => void
  onResponseReceived?: (response: ChatResponse) => void
  className?: string
}

interface ChatRequest {
  message: string
  conversationId?: string
}

interface APIError {
  error: {
    code: string
    message: string
    details?: object
    timestamp: string
  }
  fallback?: {
    response?: string
    imageUrl?: string
  }
}

interface RetryConfig {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

class CaptainErrorHandler {
  private defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2
  }

  private fallbackImages = BRAND_ASSETS.fallbackImages

  // Get Captain persona error message based on error type
  getCaptainErrorMessage(error: Error | APIError, context: 'chat' | 'image' = 'chat'): string {
    // Import the enhanced Captain persona messaging system
    const { captainErrorMessaging } = require('@/lib/captain-error-messaging')
    const { ErrorType } = require('@/lib/error-handling')
    
    // Add null checks to prevent undefined errors
    const errorMessage = error instanceof Error 
      ? (error.message || 'Unknown error') 
      : (error?.error?.message || error?.message || 'Unknown error')
    
    let errorType = ErrorType.INTERNAL_ERROR
    
    // Add null check before calling toLowerCase
    const lowerErrorMessage = errorMessage?.toLowerCase() || ''
    
    if (lowerErrorMessage.includes('network') || lowerErrorMessage.includes('fetch')) {
      errorType = ErrorType.SERVICE_UNAVAILABLE
    } else if (lowerErrorMessage.includes('timeout')) {
      errorType = ErrorType.TIMEOUT_ERROR
    } else if (lowerErrorMessage.includes('rate limit') || lowerErrorMessage.includes('429')) {
      errorType = ErrorType.RATE_LIMIT_EXCEEDED
    } else if (lowerErrorMessage.includes('unauthorized') || lowerErrorMessage.includes('401')) {
      errorType = ErrorType.UNAUTHORIZED
    } else if (lowerErrorMessage.includes('server') || lowerErrorMessage.includes('500')) {
      errorType = ErrorType.SERVICE_UNAVAILABLE
    } else if (context === 'image') {
      errorType = ErrorType.IMAGE_GENERATION_FAILED
    }
    
    const captainMessage = captainErrorMessaging.getCaptainErrorMessage(errorType, {
      userMessage: errorMessage,
      attemptCount: 1
    })
    
    return captainMessage?.message || 'Desculpe, algo deu errado. Tente novamente.'
  }

  // Get fallback image based on context using comprehensive fallback system
  getFallbackImage(context?: string): string {
    const { comprehensiveFallbackSystem } = require('@/lib/comprehensive-fallback-system')
    
    // Use the comprehensive fallback system for better context awareness
    comprehensiveFallbackSystem.getFallbackImage(context || 'default', {
      preferHighQuality: false,
      allowOfflineOnly: true,
      maxAttempts: 1
    }).then(result => {
      return result.url
    }).catch(() => {
      return getFallbackImageUrl(context)
    })
    
    // Return immediate fallback while async operation completes
    return getFallbackImageUrl(context)
  }

  // Implement exponential backoff retry logic
  async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context: string = 'operation'
  ): Promise<T> {
    const finalConfig = { ...this.defaultRetryConfig, ...config }
    let lastError: Error
    
    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt === finalConfig.maxAttempts) {
          console.error(`${context} failed after ${finalConfig.maxAttempts} attempts:`, lastError)
          break
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          finalConfig.baseDelayMs * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
          finalConfig.maxDelayMs
        )
        
        console.warn(`${context} attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError!
  }

  // Check if error is retryable
  isRetryableError(error: Error | APIError): boolean {
    const errorMessage = error instanceof Error 
      ? (error.message || '') 
      : (error?.error?.message || error?.message || '')
    
    // Add null check and length validation
    if (!errorMessage || errorMessage.length === 0) {
      return false
    }
    
    const lowerErrorMessage = errorMessage.toLowerCase()
    
    // Don't retry validation errors or client errors
    if (lowerErrorMessage.includes('400') || lowerErrorMessage.includes('validation')) {
      return false
    }
    
    // Don't retry unauthorized errors
    if (lowerErrorMessage.includes('401') || lowerErrorMessage.includes('unauthorized')) {
      return false
    }
    
    // Retry network, timeout, and server errors
    return (
      lowerErrorMessage.includes('network') ||
      lowerErrorMessage.includes('timeout') ||
      lowerErrorMessage.includes('fetch') ||
      lowerErrorMessage.includes('500') ||
      lowerErrorMessage.includes('502') ||
      lowerErrorMessage.includes('503') ||
      lowerErrorMessage.includes('504') ||
      lowerErrorMessage.includes('rate limit') ||
      lowerErrorMessage.includes('429')
    )
  }
}

interface ChatResponse {
  response: string
  imageUrl: string
  conversationId: string
}

interface ImageGenerationResponse {
  imageUrl: string
  imageId: string
  promptParameters: object
}

interface AnimationConfig {
  messageEntry: {
    initial: { opacity: number; y: number; scale: number }
    animate: { opacity: number; y: number; scale: number }
    transition: { duration: number; ease: string }
  }
  typingIndicator: {
    animate: { scale: number[] }
    transition: { repeat: number; duration: number }
  }
  imageTransition: {
    initial: { opacity: number; scale: number }
    animate: { opacity: number; scale: number }
    exit: { opacity: number; scale: number }
    transition: { duration: number }
  }
  rippleEffect: {
    initial: { scale: number; opacity: number }
    animate: { scale: number; opacity: number }
    transition: { duration: number }
  }
}

// Animation configurations with reduced motion support
const getAnimationConfig = (prefersReducedMotion: boolean): AnimationConfig => ({
  messageEntry: {
    initial: prefersReducedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: prefersReducedMotion ? 0 : 0.3, ease: "easeOut" }
  },
  typingIndicator: {
    animate: prefersReducedMotion ? { scale: 1 } : { scale: [1, 1.1, 1] },
    transition: { repeat: prefersReducedMotion ? 0 : Infinity, duration: prefersReducedMotion ? 0 : 1.5 }
  },
  imageTransition: {
    initial: prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.1 },
    transition: { duration: prefersReducedMotion ? 0 : 0.5 }
  },
  rippleEffect: {
    initial: prefersReducedMotion ? { scale: 1, opacity: 0 } : { scale: 0, opacity: 0.8 },
    animate: prefersReducedMotion ? { scale: 1, opacity: 0 } : { scale: 4, opacity: 0 },
    transition: { duration: prefersReducedMotion ? 0 : 0.6 }
  }
})

export function AnimatedAIChat({ 
  initialMessage, 
  onMessageSent, 
  onResponseReceived, 
  className 
}: AnimatedAIChatProps) {
  // Error handler instance
  const errorHandler = new CaptainErrorHandler()

  // Performance and motion detection
  const shouldReduceMotion = useReducedMotion()
  const deviceCapabilities = useDevicePerformance()
  const { metrics: performanceMetrics, isMonitoring } = useAnimationPerformance({
    targetFPS: 60,
    enableLogging: process.env.NODE_ENV === 'development',
    onPerformanceChange: (metrics) => {
      // Adjust animation complexity based on performance
      if (metrics.fps < 30 || !metrics.isOptimal) {
        console.warn('Animation performance degraded, consider reducing complexity')
      }
    }
  })

  // Determine optimal animation settings
  const animationSettings = useMemo(() => {
    const baseSettings = {
      enableComplexAnimations: true,
      enableBlur: true,
      enableShadows: true,
      maxConcurrentAnimations: 10
    }

    // Reduce complexity based on motion preferences
    if (shouldReduceMotion) {
      return {
        ...baseSettings,
        enableComplexAnimations: false,
        maxConcurrentAnimations: 2
      }
    }

    // Reduce complexity based on device capabilities
    if (!deviceCapabilities.isHighPerformance) {
      return {
        ...baseSettings,
        ...deviceCapabilities.recommendedSettings
      }
    }

    // Reduce complexity based on runtime performance
    if (performanceMetrics.fps < 45 && performanceMetrics.totalFrames > 100) {
      return {
        ...baseSettings,
        enableComplexAnimations: false,
        enableBlur: false,
        maxConcurrentAnimations: 5
      }
    }

    return baseSettings
  }, [shouldReduceMotion, deviceCapabilities, performanceMetrics])

  // Get animation config based on motion preferences and performance
  const animationConfig = useMemo(() => 
    getAnimationConfig(shouldReduceMotion || !animationSettings.enableComplexAnimations), 
    [shouldReduceMotion, animationSettings.enableComplexAnimations]
  )

  // Optimized state management with virtual scrolling support
  const { state: chatState, actions: chatActions, selectors } = useOptimizedChatState({
    maxVisibleMessages: 50,
    enableMessageCaching: true,
    autoOptimizeThreshold: 100
  })

  // Memory-efficient message rendering
  const { 
    renderableMessages, 
    renderMode, 
    memoryStats, 
    shouldUseVirtualization 
  } = useMessageMemoryManagement(chatState.messages, 50, true)

  // Virtual scrolling for large message lists
  const {
    scrollElementRef,
    visibleItems: virtualizedMessages,
    totalHeight: virtualScrollHeight,
    handleScroll: handleVirtualScroll,
    scrollToBottom: virtualScrollToBottom,
    visibleRange
  } = useVirtualScrolling(renderableMessages, 80, 600, 5) // 80px per message, 600px container

  // Image caching for better performance
  const { preloadImage, getCachedImage, getCacheStats } = useImageCache(20)

  // API batching for efficient requests
  const { addRequest: batchAPIRequest } = useAPIBatching(
    async (requests: { endpoint: string; body: any }[]) => {
      // Process multiple API requests in batch
      const results = await Promise.allSettled(
        requests.map(req => 
          fetch(req.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
          }).then(res => res.json())
        )
      )
      
      return results.map(result => 
        result.status === 'fulfilled' ? result.value : null
      )
    },
    3, // batch size
    200, // batch delay
    true // enable caching
  )

  // Enhanced Captain image consistency management
  const {
    currentImageUrl: captainImageUrl,
    isValidating: isValidatingImage,
    validationResult,
    usedFallback: captainUsedFallback,
    loadCaptainImage,
    validateCurrentImage
  } = useCaptainImageConsistency(BRAND_ASSETS.fallbackImages.default, {
    enableValidation: true,
    maxRetries: 3,
    autoRetryOnFailure: true
  })
  
  const [inputValue, setInputValue] = useState('')
  const [showRipple, setShowRipple] = useState(false)
  const [apiResponseTime, setApiResponseTime] = useState(0)
  const [imageLoadTime, setImageLoadTime] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Enhanced network connectivity detection using the comprehensive system
  const { useNetworkConnectivity } = require('@/lib/network-connectivity')
  const {
    state: connectivityState,
    quality: networkQuality,
    isOnline,
    isOffline,
    checkConnectivity,
    getCaptainMessage: getCaptainConnectivityMessage
  } = useNetworkConnectivity()

  // Handle network connectivity issues with Captain persona
  const handleNetworkError = async () => {
    if (isOffline) {
      const captainMessage = getCaptainConnectivityMessage()
      chatActions.setError(captainMessage.message)
      return false
    }
    
    // Check if connection is slow or unstable
    if (connectivityState === 'slow' || connectivityState === 'unstable') {
      const captainMessage = getCaptainConnectivityMessage()
      // Show warning but allow operation to continue
      console.warn('Network quality degraded:', captainMessage.message)
    }
    
    return true
  }

  // Monitor connectivity changes
  React.useEffect(() => {
    if (isOffline && !chatState.error) {
      const captainMessage = getCaptainConnectivityMessage()
      chatActions.setError(captainMessage.message)
    } else if (isOnline && chatState.error && chatState.error.includes('desconectado')) {
      // Clear connectivity-related errors when back online
      chatActions.setError(null)
    }
  }, [connectivityState, isOffline, isOnline, chatState.error, chatActions])

  // Optimized scroll to bottom with performance considerations
  const scrollToBottom = useCallback(() => {
    if (shouldUseVirtualization) {
      // Use virtual scrolling method
      const behavior = animationSettings.enableComplexAnimations ? 'smooth' : 'auto'
      virtualScrollToBottom(behavior)
    } else if (messagesEndRef.current) {
      // Use traditional scrolling
      const behavior = animationSettings.enableComplexAnimations ? 'smooth' : 'auto'
      messagesEndRef.current.scrollIntoView({ behavior })
    }
  }, [shouldUseVirtualization, virtualScrollToBottom, animationSettings.enableComplexAnimations])

  // Debounced scroll effect to prevent excessive scrolling - moved after visibleMessages declaration

  // Helper function to get previous user message for training feedback
  const getPreviousUserMessage = useCallback((messageId: string): string | null => {
    const messageIndex = chatState.messages.findIndex(msg => msg.id === messageId)
    if (messageIndex > 0) {
      // Look for the most recent user message before this assistant message
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (chatState.messages[i].role === 'user') {
          return chatState.messages[i].content
        }
      }
    }
    return null
  }, [chatState.messages])

  // Memoized message components for better performance
  const MessageComponent = useMemo(() => {
    return React.memo(({ message, index }: { message: ChatMessage; index: number }) => (
      <motion.div
        key={message.id}
        className={cn(
          "flex",
          message.role === 'user' ? 'justify-end' : 'justify-start'
        )}
        initial={animationConfig.messageEntry.initial}
        animate={animationConfig.messageEntry.animate}
        transition={{ 
          ...animationConfig.messageEntry.transition,
          delay: animationSettings.enableComplexAnimations ? index * 0.05 : 0
        }}
        layout={animationSettings.enableComplexAnimations}
        role="article"
        aria-label={`Mensagem ${index + 1} de ${message.role === 'user' ? 'você' : 'Capitão Caverna'}`}
      >
        <HoverFeedback
          variant="subtle"
          disabled={!animationSettings.enableComplexAnimations}
          className={cn(
            "max-w-[80%] rounded-3xl p-5 transition-all duration-300",
            message.role === 'user' 
              ? "cave-glass-subtle bg-gradient-to-br from-cave-red/20 to-cave-ember/10 cave-glow-subtle" 
              : "cave-glass bg-gradient-to-br from-cave-charcoal/20 to-cave-stone/10",
            "focus-within:cave-focus cursor-pointer"
          )}
          tabIndex={0}
          role="group"
          aria-labelledby={`message-${message.id}-content`}
        >
          <div className="flex items-start gap-3">
            {message.role === 'assistant' && (
              <div 
                className="flex-shrink-0 w-8 h-8 rounded-full bg-cave-red/20 flex items-center justify-center"
                aria-label="Ícone do Capitão Caverna"
                role="img"
              >
                <MessageCircle className="w-4 h-4 text-cave-red" aria-hidden="true" />
              </div>
            )}
            
            <div className="flex-1">
              <p 
                id={`message-${message.id}-content`}
                className={cn(
                  CAVE_TYPOGRAPHY.body.normal,
                  message.role === 'user' 
                    ? "text-cave-white font-medium" 
                    : "text-cave-off-white"
                )}
                role="text"
              >
                {message.content}
              </p>
              
              <time 
                className={cn("mt-2 block", CAVE_TYPOGRAPHY.body.small, "text-cave-mist/70")}
                dateTime={message.timestamp.toISOString()}
                aria-label={`Enviado às ${message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}`}
              >
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </time>
              
              {/* Add TrainingFeedback for assistant messages */}
              {message.role === 'assistant' && (
                <TrainingFeedback
                  messageId={message.id}
                  userMessage={getPreviousUserMessage(message.id) || ''}
                  captainResponse={message.content}
                  className="mt-3"
                  onFeedbackSent={(feedback) => {
                    console.log('Feedback sent:', feedback)
                    // Optional: Handle feedback sent event
                  }}
                />
              )}
            </div>
          </div>
        </HoverFeedback>
      </motion.div>
    ))
  }, [animationConfig, animationSettings, getPreviousUserMessage])

  // Get optimized visible messages based on rendering mode
  const visibleMessages = useMemo(() => {
    if (shouldUseVirtualization) {
      return virtualizedMessages.map(item => item.item)
    }
    return renderableMessages.slice(-50) // Show last 50 messages in non-virtual mode
  }, [shouldUseVirtualization, virtualizedMessages, renderableMessages])
  
  // Debounced scroll effect to prevent excessive scrolling
  const optimizedMessages = useOptimizedRerender(visibleMessages, 16)
  
  useEffect(() => {
    scrollToBottom()
  }, [optimizedMessages, scrollToBottom])
  
  // Get conversation stats for performance monitoring
  const conversationStats = useMemo(() => ({
    ...selectors.getStats(),
    ...memoryStats,
    imageCache: getCacheStats(),
    virtualScrolling: {
      enabled: shouldUseVirtualization,
      visibleRange: shouldUseVirtualization ? visibleRange : null,
      totalHeight: shouldUseVirtualization ? virtualScrollHeight : null
    }
  }), [selectors, memoryStats, getCacheStats, shouldUseVirtualization, visibleRange, virtualScrollHeight])

  // Initialize with welcome message and preload brand assets
  useEffect(() => {
    // Preload brand assets for better performance
    preloadBrandAssets().catch(error => {
      console.warn('Failed to preload some brand assets:', error)
    })

    if (initialMessage) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome-' + Date.now(),
        content: initialMessage,
        role: 'assistant',
        timestamp: new Date()
      }
      chatActions.addMessage(welcomeMessage)
    }
  }, [initialMessage, chatActions])

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!inputValue.trim() || chatState.isTyping) return

    // Add defensive check
    if (!chatState?.messages) {
      console.error('Chat state messages is undefined, reinitializing...')
      chatActions.clearMessages() // This will reset to empty array
      return
    }

    const messageCount = chatState?.messages?.length || 0

    // Clear any existing errors when user tries again
    if (chatState.error) {
      chatActions.setError(null)
    }

    const userMessage: ChatMessage = {
      id: 'user-' + Date.now(),
      content: inputValue.trim(),
      role: 'user',
      timestamp: new Date()
    }

    // Add user message and set typing state
    chatActions.addMessage(userMessage)
    chatActions.setTyping(true)
    chatActions.setError(null)
    
    const messageToSend = inputValue.trim()
    const currentConversationId = chatState.conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    setInputValue('')
    
    // Trigger ripple effect
    setShowRipple(true)
    setTimeout(() => setShowRipple(false), 600)

    // Call onMessageSent callback
    onMessageSent?.(messageToSend)

    // Announce user message to screen readers
    announceMessage(messageToSend, 'user')

    // Show success feedback for message sent
    window.dispatchEvent(new CustomEvent('show-feedback', {
      detail: { 
        type: 'success', 
        message: 'Mensagem enviada ao Capitão!', 
        duration: 2000 
      }
    }))

    try {
      // Track API response time
      const apiStartTime = performance.now()
      
      // Use batched API call for better performance
      const chatRequest = {
        endpoint: '/api/chat/simple',
        body: {
          message: messageToSend,
          conversationId: currentConversationId
        }
      }

      const chatResponse: ChatResponse = await errorHandler.withRetry(
        async () => {
          // Try batched request first (will be processed with other pending requests)
          try {
            const batchedResult = await batchAPIRequest(chatRequest)
            if (batchedResult) {
              return batchedResult
            }
          } catch (batchError) {
            console.warn('Batched request failed, falling back to direct request:', batchError)
          }

          // Fallback to direct API call
          const response = await fetch('/api/chat/simple', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: messageToSend,
              conversationId: currentConversationId
            })
          })

          if (!response.ok) {
            // Handle HTTP error responses
            let errorData: APIError
            try {
              errorData = await response.json()
            } catch {
              // If JSON parsing fails, create a generic error
              errorData = {
                error: {
                  code: `HTTP_${response.status}`,
                  message: `HTTP ${response.status}: ${response.statusText}`,
                  timestamp: new Date().toISOString()
                }
              }
            }
            
            // Use fallback response if available
            if (errorData.fallback?.response) {
              return {
                response: errorData.fallback.response,
                imageUrl: errorData.fallback.imageUrl || errorHandler.getFallbackImage(),
                conversationId: currentConversationId
              }
            }
            
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`)
          }

          return await response.json()
        },
        { maxAttempts: 2, baseDelayMs: 1000 },
        'chat-api-call'
      )

      // Update API response time
      setApiResponseTime(performance.now() - apiStartTime)

      // Create AI message from response
      const aiResponse: ChatMessage = {
        id: 'ai-' + Date.now(),
        content: chatResponse.response,
        role: 'assistant',
        timestamp: new Date(),
        imageUrl: chatResponse.imageUrl
      }

      // Update state with response and start image generation
      chatActions.addMessage(aiResponse)
      chatActions.setTyping(false)
      chatActions.setGeneratingImage(true)
      chatActions.setConversationId(chatResponse.conversationId)

      // Announce new message to screen readers
      announceMessage(chatResponse.response, 'assistant')

      // Automatically generate new Captain image based on response
      try {
        // Debug image generation request
        const tone = analyzeResponseTone(aiResponse.content)
        const themes = extractThemes(aiResponse.content)
        
        // Validate content before sending to API
        if (!aiResponse.content || aiResponse.content.trim().length === 0) {
          console.warn('Skipping image generation: empty response content')
          chatActions.setGeneratingImage(false)
          return
        }
        
        if (aiResponse.content.length > 5000) {
          console.warn('Truncating response content for image generation')
          aiResponse.content = aiResponse.content.substring(0, 5000)
        }
        
        console.log('Image generation request:', {
          responseContent: aiResponse.content,
          contentLength: aiResponse.content?.length,
          tone: tone,
          themes: themes
        });
        
        await generateCaptainImage(aiResponse.content, aiResponse.id)
      } catch (imageError) {
        console.warn('Image generation failed, using comprehensive fallback system:', imageError)
        
        // Import recovery mechanisms
        const { recoveryMechanisms } = require('@/lib/recovery-mechanisms')
        const { CaptainError, ErrorType } = require('@/lib/error-handling')
        
        try {
          // Try image recovery mechanisms
          const imageRecoveryResult = await recoveryMechanisms.executeRecovery('image_generation', {
            originalOperation: 'image_generation',
            partialData: {
              responseContext: {
                content: chatResponse.response,
                tone: analyzeResponseTone(chatResponse.response),
                themes: extractThemes(chatResponse.response),
                intensity: analyzeIntensity(chatResponse.response)
              }
            },
            attemptCount: 1,
            startTime: new Date()
          })
          
          if (imageRecoveryResult.success && imageRecoveryResult.data) {
            chatActions.setGeneratingImage(false)
            chatActions.setCaptainImage(imageRecoveryResult.data)
            chatActions.updateMessage(aiResponse.id, { imageUrl: imageRecoveryResult.data })
            
            // Show recovery notification if fallback was used
            if (imageRecoveryResult.fallbackUsed) {
              window.dispatchEvent(new CustomEvent('show-feedback', {
                detail: { 
                  type: 'info', 
                  message: 'Usando imagem de fallback contextual', 
                  duration: 2000 
                }
              }))
            }
            
            return
          }
        } catch (recoveryError) {
          console.warn('Image recovery failed:', recoveryError)
        }
        
        // Final fallback - use basic error handler
        const fallbackImageUrl = errorHandler.getFallbackImage('default')
        
        chatActions.setGeneratingImage(false)
        chatActions.setCaptainImage(fallbackImageUrl)
        chatActions.updateMessage(aiResponse.id, { imageUrl: fallbackImageUrl })
      }

      // Call the callback with proper validation
      if (onResponseReceived && chatResponse) {
        // Ensure response object has required properties
        const validatedResponse: ChatResponse = {
          response: chatResponse.response || '',
          imageUrl: chatResponse.imageUrl || '',
          conversationId: chatResponse.conversationId || ''
        };
        onResponseReceived(validatedResponse);
      }

    } catch (error) {
      console.error('Error sending message:', error)
      
      // Import recovery mechanisms and offline state manager
      const { recoveryMechanisms } = require('@/lib/recovery-mechanisms')
      const { offlineStateManager } = require('@/lib/offline-state-manager')
      const { CaptainError, ErrorType } = require('@/lib/error-handling')
      
      chatActions.setTyping(false)
      
      // Check if we're offline and can provide offline response
      if (offlineStateManager.isOffline()) {
        const offlineState = offlineStateManager.createOfflineErrorState(messageToSend)
        chatActions.setError(offlineState.fallback.response)
        
        // Add offline response as a message
        const offlineMessage: ChatMessage = {
          id: 'offline-' + Date.now(),
          content: offlineState.fallback.response,
          role: 'assistant',
          timestamp: new Date(),
          imageUrl: offlineState.fallback.imageUrl
        }
        chatActions.addMessage(offlineMessage)
        return
      }
      
      // Try recovery mechanisms for online failures
      try {
        const captainError = error instanceof CaptainError ? error : new CaptainError(
          ErrorType.CHAT_COMPLETION_FAILED,
          error instanceof Error ? error.message : 'Unknown error',
          { cause: error instanceof Error ? error : undefined }
        )
        
        const recoveryResult = await recoveryMechanisms.executeRecovery('chat_completion', {
          originalOperation: 'chat_completion',
          userMessage: messageToSend,
          conversationId: currentConversationId,
          attemptCount: 1,
          lastError: captainError,
          startTime: new Date()
        })
        
        if (recoveryResult.success && recoveryResult.data) {
          // Recovery succeeded - add the recovered response
          const recoveredMessage: ChatMessage = {
            id: 'recovered-' + Date.now(),
            content: recoveryResult.data.response,
            role: 'assistant',
            timestamp: new Date(),
            imageUrl: recoveryResult.data.imageUrl
          }
          
          chatActions.addMessage(recoveredMessage)
          chatActions.setConversationId(recoveryResult.data.conversationId)
          
          // Show recovery notification
          window.dispatchEvent(new CustomEvent('show-feedback', {
            detail: { 
              type: 'info', 
              message: `Resposta recuperada usando: ${recoveryResult.recoveryMethod}`, 
              duration: 3000 
            }
          }))
          
          return
        }
      } catch (recoveryError) {
        console.warn('Recovery failed:', recoveryError)
      }
      
      // Final fallback - use Captain error handler
      const errorMessage = errorHandler.getCaptainErrorMessage(
        error instanceof Error ? error : new Error('Unknown error'),
        'chat'
      )
      
      chatActions.setError(errorMessage)
    }
  }

  // Enhanced Captain image generation with consistency validation
  const generateCaptainImage = async (responseContent: string, messageId: string) => {
    try {
      // Validate input before processing
      if (!responseContent || typeof responseContent !== 'string') {
        throw new Error('Invalid response content for image generation')
      }
      
      const trimmedContent = responseContent.trim()
      if (trimmedContent.length === 0) {
        throw new Error('Empty response content for image generation')
      }
      
      if (trimmedContent.length > 5000) {
        console.warn('Truncating response content for image generation')
        responseContent = trimmedContent.substring(0, 5000)
      }
      
      // Analyze response content to determine context
      const responseContext: ResponseContext = {
        content: responseContent,
        tone: analyzeResponseTone(responseContent),
        themes: extractThemes(responseContent),
        intensity: analyzeIntensity(responseContent)
      }

      const imageRequest = {
        responseContent: responseContent,
        context: responseContext
      }
      
      console.log('Sending image generation request:', {
        contentLength: responseContent.length,
        hasContext: !!responseContext,
        tone: responseContext.tone
      })

      const imageResponse: ImageGenerationResponse = await errorHandler.withRetry(
        async (): Promise<ImageGenerationResponse> => {
          const response = await fetch('/api/v1/images/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(imageRequest)
          })

          if (!response.ok) {
            let errorData: APIError
            try {
              errorData = await response.json()
            } catch {
              errorData = {
                error: {
                  code: `HTTP_${response.status}`,
                  message: `HTTP ${response.status}: ${response.statusText}`,
                  timestamp: new Date().toISOString()
                }
              }
            }
            
            if (errorData.fallback?.imageUrl) {
              return {
                imageUrl: errorData.fallback.imageUrl,
                imageId: `fallback_${Date.now()}`,
                promptParameters: {}
              }
            }
            
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`)
          }

          return await response.json() as ImageGenerationResponse
        },
        { maxAttempts: 2, baseDelayMs: 1500 },
        'image-generation-api-call'
      )
      
      // If image generation succeeded, use the generated image
      // Otherwise, fall back to brand-consistent contextual image
      let finalImageUrl = imageResponse.imageUrl
      
      if (!finalImageUrl || finalImageUrl.includes('fallback')) {
        // Use brand assets for contextual fallback
        const contextualAsset = getCaptainImageForContext(
          responseContext.tone,
          responseContext.themes,
          responseContext.content
        )
        finalImageUrl = contextualAsset.url
      }

      // Load and validate the image using the consistency system
      const loadResult = await loadCaptainImage(finalImageUrl, responseContext)
      
      if (loadResult.success) {
        // Preload image for better performance
        try {
          await preloadImage(loadResult.imageUrl)
        } catch (preloadError) {
          console.warn('Failed to preload image:', preloadError)
        }

        // Update chat state with validated image
        chatActions.setGeneratingImage(false)
        chatActions.setCaptainImage(loadResult.imageUrl)
        chatActions.updateMessage(messageId, { imageUrl: loadResult.imageUrl })

        // Log validation results for monitoring
        if (loadResult.validationResult) {
          console.log('Image validation result:', {
            score: loadResult.validationResult.score,
            usedFallback: loadResult.usedFallback,
            issues: loadResult.validationResult.issues.length,
            selectedAsset: finalImageUrl
          })
        }
      } else {
        throw new Error('Failed to load validated Captain image')
      }

    } catch (error) {
      console.warn('Image generation failed:', error)
      
      // Use fallback image
      const fallbackUrl = getFallbackImageUrl('error')
      chatActions.setGeneratingImage(false)
      chatActions.setCaptainImage(fallbackUrl)
      chatActions.updateMessage(messageId, { imageUrl: fallbackUrl })
    }
  }

  // Helper functions for response analysis with proper null checking
  const analyzeResponseTone = (content: string): ResponseContext['tone'] => {
    if (!content || content.length === 0) return 'supportive'
    
    const lowerContent = content.toLowerCase()
    
    if (lowerContent.includes('parabéns') || lowerContent.includes('muito bem') || lowerContent.includes('excelente')) {
      return 'supportive'
    } else if (lowerContent.includes('disciplina') || lowerContent.includes('foco') || lowerContent.includes('ação')) {
      return 'challenging'
    } else if (lowerContent.includes('vamos') || lowerContent.includes('juntos') || lowerContent.includes('força')) {
      return 'motivational'
    } else if (lowerContent.includes('primeiro') || lowerContent.includes('passo') || lowerContent.includes('como')) {
      return 'instructional'
    }
    
    return 'supportive' // Default to supportive tone
  }

  const extractThemes = (content: string): string[] => {
    if (!content || content.length === 0) return []
    
    const themes: string[] = []
    const lowerContent = content.toLowerCase()
    
    if (lowerContent.includes('caverna') || lowerContent.includes('modo caverna')) themes.push('cave-mode')
    if (lowerContent.includes('disciplina')) themes.push('discipline')
    if (lowerContent.includes('foco')) themes.push('focus')
    if (lowerContent.includes('ação')) themes.push('action')
    if (lowerContent.includes('guerreiro')) themes.push('warrior')
    if (lowerContent.includes('transformação')) themes.push('transformation')
    
    return themes
  }

  const analyzeIntensity = (content: string): ResponseContext['intensity'] => {
    if (!content || content.length === 0) return 'medium'
    
    const lowerContent = content.toLowerCase()
    const intensityWords = ['muito', 'extremamente', 'totalmente', 'completamente', 'absolutamente']
    const urgencyWords = ['agora', 'imediatamente', 'urgente', 'rápido']
    
    if (intensityWords.some(word => lowerContent.includes(word)) || 
        urgencyWords.some(word => lowerContent.includes(word))) {
      return 'high'
    } else if (lowerContent.includes('pouco') || lowerContent.includes('gradualmente')) {
      return 'low'
    }
    
    return 'medium'
  }

  // Enhanced keyboard navigation and accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    } else if (e.key === 'Escape') {
      // Clear input on Escape
      setInputValue('')
      // Clear error if present
      if (chatState.error) {
        setChatState(prev => ({ ...prev, error: null }))
      }
    }
  }

  // Focus management for accessibility
  const focusInput = () => {
    inputRef.current?.focus()
  }

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Focus input with Ctrl/Cmd + /
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        focusInput()
      }
      
      // Clear conversation with Ctrl/Cmd + K (if needed in future)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        // Could implement clear conversation functionality
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Announce new messages to screen readers
  const announceMessage = (message: string, role: 'user' | 'assistant') => {
    const announcement = role === 'user' 
      ? `Você disse: ${message}` 
      : `Capitão Caverna respondeu: ${message}`
    
    // Create temporary element for screen reader announcement
    const announcer = document.createElement('div')
    announcer.setAttribute('aria-live', 'polite')
    announcer.setAttribute('aria-atomic', 'true')
    announcer.className = 'sr-only'
    announcer.textContent = announcement
    
    document.body.appendChild(announcer)
    setTimeout(() => document.body.removeChild(announcer), 1000)
  }

  return (
    <div 
      className={cn(
        "flex flex-col h-full max-h-screen",
        "bg-gradient-to-br from-cave-dark via-cave-charcoal to-cave-stone",
        className
      )}
      role="main"
      aria-label="Conversa com Capitão Caverna"
    >
      {/* Enhanced Captain Image Display */}
      <header 
        className="flex-shrink-0 p-6 border-b border-cave-stone/30"
        role="banner"
        aria-label="Área do Capitão Caverna"
      >
        <div className="flex items-center justify-center">
          <HoverFeedback variant="glow" disabled={chatState.isGeneratingImage}>
            <CaptainImage
            imageUrl={captainImageUrl || chatState.currentCaptainImage}
            isGenerating={chatState.isGeneratingImage || isValidatingImage}
            size="md"
            enableAnimations={true}
            showGlowEffect={true}
            enableValidation={true}
            contextualVariation="default"
            onImageLoad={() => {
              console.log('Captain image loaded successfully');
            }}
            onImageError={(error) => {
              console.error('Captain image failed to load:', error);
            }}
            onValidationComplete={(result) => {
              console.log('Image validation completed:', result);
            }}
          />
          </HoverFeedback>
        </div>
        
        {/* Captain status indicator */}
        <div className="text-center mt-3">
          <motion.div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full cave-glass-subtle text-sm"
            animate={chatState.isTyping || chatState.isGeneratingImage ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 1.5, repeat: (chatState.isTyping || chatState.isGeneratingImage) ? Infinity : 0 }}
            role="status"
            aria-live="polite"
            aria-label={
              chatState.isTyping 
                ? "Capitão está pensando na resposta" 
                : chatState.isGeneratingImage 
                  ? "Capitão está materializando sua imagem" 
                  : "Capitão pronto para orientar"
            }
          >
            {chatState.isTyping ? (
              <>
                <motion.div
                  className="w-2 h-2 bg-cave-ember rounded-full"
                  animate={animationConfig.typingIndicator.animate}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  aria-hidden="true"
                />
                <span className="text-cave-off-white">Pensando...</span>
              </>
            ) : chatState.isGeneratingImage ? (
              <CaptainLoading isGeneratingImage={true} />
            ) : (
              <>
                <div className="w-2 h-2 bg-cave-ember rounded-full animate-pulse" aria-hidden="true" />
                <span className="text-cave-off-white">Pronto para orientar</span>
              </>
            )}
          </motion.div>
        </div>
      </header>

      {/* Messages Container */}
      <main 
        ref={shouldUseVirtualization ? scrollElementRef : undefined}
        className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-glass scrollbar-thumb-glass-border"
        role="log"
        aria-label="Histórico da conversa"
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
        onScroll={shouldUseVirtualization ? handleVirtualScroll : undefined}
        style={shouldUseVirtualization ? { height: '600px' } : undefined}
      >
        {shouldUseVirtualization ? (
          // Virtual scrolling mode for large message lists
          <motion.div 
            style={{ 
              height: virtualScrollHeight, 
              position: 'relative',
              paddingTop: '1.5rem',
              paddingBottom: '1.5rem'
            }}
            role="presentation"
            variants={STAGGER_VARIANTS.container}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="wait">
              {virtualizedMessages.map((virtualItem) => (
                <motion.div
                  key={virtualItem.item.id}
                  style={virtualItem.style}
                  className="px-0"
                  variants={STAGGER_VARIANTS.item}
                >
                  <MessageComponent 
                    message={virtualItem.item} 
                    index={virtualItem.index} 
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          // Traditional scrolling mode with stagger animations
          <motion.div 
            className="space-y-4"
            variants={STAGGER_VARIANTS.container}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode={animationSettings.enableComplexAnimations ? "popLayout" : "wait"}>
              {visibleMessages.map((message, index) => (
                <motion.div
                  key={message.id}
                  variants={STAGGER_VARIANTS.item}
                >
                  <MessageComponent message={message} index={index} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        
        {/* Performance indicator for development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-20 right-4 text-xs text-cave-mist/50 bg-cave-dark/80 p-2 rounded">
            <div>Mode: {renderMode}</div>
            <div>Messages: {conversationStats.totalMessages}/{conversationStats.renderedMessages}</div>
            <div>FPS: {performanceMetrics.fps}</div>
            <div>Memory: {(memoryStats.memoryUsage * 100).toFixed(1)}%</div>
            {shouldUseVirtualization && (
              <div>Virtual: {visibleRange.startIndex}-{visibleRange.endIndex}</div>
            )}
          </div>
        )}

        {/* Enhanced typing indicator with brand consistency */}
        {chatState.isTyping && (
          <motion.div
            className="flex justify-start"
            initial={animationConfig.messageEntry.initial}
            animate={animationConfig.messageEntry.animate}
            exit={animationConfig.messageEntry.initial}
            role="status"
            aria-live="polite"
            aria-label="Capitão Caverna está digitando"
          >
            <div 
              className="max-w-[80%] rounded-3xl p-5 cave-glass bg-gradient-to-br from-cave-charcoal/20 to-cave-stone/10"
              role="group"
              aria-label="Indicador de digitação"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full bg-cave-red/20 flex items-center justify-center"
                  aria-label="Ícone do Capitão Caverna"
                  role="img"
                >
                  <MessageCircle className="w-4 h-4 text-cave-red" aria-hidden="true" />
                </div>
                <CaptainLoading isTyping={true} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Enhanced error message with shake animation */}
        {chatState.error && (
          <ErrorFeedback hasError={!!chatState.error}>
            <motion.div
              className="flex justify-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              aria-live="assertive"
            >
            <div 
              className="max-w-[80%] px-4 py-3 rounded-lg cave-glass-subtle bg-cave-red/20 text-cave-white text-sm cave-glow-subtle"
              role="group"
              aria-labelledby="error-message"
            >
              <div className="flex items-start gap-3">
                <div 
                  className="flex-shrink-0 w-6 h-6 rounded-full bg-cave-red/30 flex items-center justify-center mt-0.5"
                  aria-label="Ícone de erro"
                  role="img"
                >
                  <MessageCircle className="w-3 h-3 text-cave-red" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p id="error-message" className="leading-relaxed" role="text">
                    {chatState.error}
                  </p>
                  <button
                    onClick={() => setChatState(prev => ({ ...prev, error: null }))}
                    className="mt-2 text-xs text-cave-ember hover:text-cave-red transition-colors underline focus:cave-focus focus:outline-none focus:ring-2 focus:ring-cave-red focus:ring-offset-2 focus:ring-offset-cave-dark rounded px-1"
                    aria-label="Fechar mensagem de erro e tentar novamente"
                    type="button"
                  >
                    Tentar novamente
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
          </ErrorFeedback>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer 
        className="flex-shrink-0 p-6 border-t border-cave-stone/30"
        role="contentinfo"
        aria-label="Área de entrada de mensagem"
      >
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative"
          role="form"
          aria-label="Formulário para enviar mensagem ao Capitão"
        >
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <label htmlFor="message-input" className="sr-only">
                Digite sua mensagem para o Capitão Caverna
              </label>
              <input
                id="message-input"
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem para o Capitão..."
                className={cn(
                  "w-full px-4 py-3 pr-12 rounded-2xl cave-glass",
                  "bg-gradient-to-r from-cave-charcoal/40 to-cave-stone/20",
                  "text-cave-white placeholder:text-cave-mist/60",
                  "transition-all duration-300 resize-none",
                  "focus:cave-focus focus:outline-none focus:ring-2 focus:ring-cave-red focus:ring-offset-2 focus:ring-offset-cave-dark"
                )}
                disabled={chatState.isTyping}
                aria-describedby="input-help"
                aria-invalid={chatState.error ? 'true' : 'false'}
                autoComplete="off"
                maxLength={1000}
              />
              <div id="input-help" className="sr-only">
                Pressione Enter para enviar sua mensagem ou use o botão de envio
              </div>
            </div>
            
            <CaveButton
              type="submit"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || chatState.isTyping}
              isLoading={chatState.isTyping}
              loadingText="Enviando..."
              icon={<Send className="w-5 h-5" />}
              size="md"
              glowEffect={true}
              className="min-w-[48px] min-h-[48px] p-3"
              aria-label={
                chatState.isTyping 
                  ? "Aguardando resposta do Capitão" 
                  : inputValue.trim() 
                    ? "Enviar mensagem para o Capitão" 
                    : "Digite uma mensagem para enviar"
              }
              aria-describedby="send-button-help"
            >
              <div id="send-button-help" className="sr-only">
                {chatState.isTyping 
                  ? "O Capitão está processando sua mensagem anterior" 
                  : "Clique para enviar sua mensagem ao Capitão Caverna"
                }
              </div>
            </CaveButton>
          </div>
        </form>
      </footer>

      {/* Performance indicator for development */}
      {process.env.NODE_ENV === 'development' && isMonitoring && (
        <div 
          className="fixed bottom-4 right-4 p-2 rounded-lg cave-glass-subtle text-xs text-cave-off-white z-50"
          role="status"
          aria-label="Indicador de performance"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div 
                className={cn(
                  "w-2 h-2 rounded-full",
                  performanceMetrics.isOptimal ? "bg-green-500" : "bg-red-500"
                )}
                aria-hidden="true"
              />
              <span>FPS: {performanceMetrics.fps}</span>
            </div>
            <div>Frame Time: {performanceMetrics.frameTime}ms</div>
            <div>Dropped: {performanceMetrics.droppedFrames}/{performanceMetrics.totalFrames}</div>
            <div className="text-xs opacity-70">
              Animations: {animationSettings.enableComplexAnimations ? 'Full' : 'Reduced'}
            </div>
          </div>
        </div>
      )}

      {/* Performance Monitor */}
      <PerformanceMonitor
        stats={{
          fps: performanceMetrics.fps,
          memoryUsage: memoryStats.memoryUsage,
          renderMode: renderMode,
          totalMessages: conversationStats.totalMessages,
          renderedMessages: conversationStats.renderedMessages,
          cacheHitRate: 85, // Placeholder - could be calculated from actual cache stats
          apiResponseTime: apiResponseTime,
          imageLoadTime: imageLoadTime
        }}
        isVisible={process.env.NODE_ENV === 'development'}
        position="bottom-right"
      />
    </div>
  )
}

export default AnimatedAIChat