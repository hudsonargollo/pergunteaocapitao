/**
 * User Interaction Analytics Hook
 * Tracks user behavior and interactions for optimization insights
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { usageAnalytics } from '@/lib/usage-analytics'

export interface InteractionEvent {
  type: 'click' | 'hover' | 'focus' | 'scroll' | 'input' | 'keypress'
  element: string
  timestamp: number
  metadata?: Record<string, any>
}

export interface SessionData {
  sessionId: string
  startTime: number
  interactions: InteractionEvent[]
  pageViews: string[]
  conversationId?: string
}

export interface AnalyticsConfig {
  enableClickTracking: boolean
  enableHoverTracking: boolean
  enableScrollTracking: boolean
  enableInputTracking: boolean
  enablePerformanceTracking: boolean
  sampleRate: number
  batchSize: number
  batchInterval: number
}

/**
 * Hook for tracking user interactions and analytics
 */
export function useUserInteractionAnalytics(config: Partial<AnalyticsConfig> = {}) {
  const defaultConfig: AnalyticsConfig = {
    enableClickTracking: true,
    enableHoverTracking: false, // Disabled by default to reduce noise
    enableScrollTracking: true,
    enableInputTracking: true,
    enablePerformanceTracking: true,
    sampleRate: 1.0,
    batchSize: 10,
    batchInterval: 5000 // 5 seconds
  }

  const finalConfig = { ...defaultConfig, ...config }
  
  const [sessionData, setSessionData] = useState<SessionData>(() => ({
    sessionId: generateSessionId(),
    startTime: Date.now(),
    interactions: [],
    pageViews: []
  }))

  const interactionQueue = useRef<InteractionEvent[]>([])
  const batchTimer = useRef<NodeJS.Timeout>()
  const performanceObserver = useRef<PerformanceObserver>()
  const lastScrollTime = useRef<number>(0)
  const scrollThrottle = useRef<NodeJS.Timeout>()

  /**
   * Track a user interaction
   */
  const trackInteraction = useCallback((
    type: InteractionEvent['type'],
    element: string,
    metadata?: Record<string, any>
  ) => {
    // Check sample rate
    if (Math.random() > finalConfig.sampleRate) return

    const interaction: InteractionEvent = {
      type,
      element,
      timestamp: Date.now(),
      metadata
    }

    // Add to queue
    interactionQueue.current.push(interaction)

    // Update session data
    setSessionData(prev => ({
      ...prev,
      interactions: [...prev.interactions.slice(-100), interaction] // Keep last 100 interactions
    }))

    // Batch send if queue is full
    if (interactionQueue.current.length >= finalConfig.batchSize) {
      flushInteractionQueue()
    }
  }, [finalConfig.sampleRate, finalConfig.batchSize])

  /**
   * Track page view
   */
  const trackPageView = useCallback((path: string, referrer?: string) => {
    usageAnalytics.trackPageView(path, {
      path,
      referrer,
      userAgent: navigator.userAgent
    }, {
      sessionId: sessionData.sessionId
    })

    setSessionData(prev => ({
      ...prev,
      pageViews: [...prev.pageViews, path]
    }))
  }, [sessionData.sessionId])

  /**
   * Track chat message
   */
  const trackChatMessage = useCallback((
    messageType: 'user' | 'assistant',
    responseTime?: number,
    options?: {
      topics?: string[]
      sentiment?: string
      conversationId?: string
    }
  ) => {
    usageAnalytics.trackChatMessage(
      messageType,
      responseTime,
      {
        path: window.location.pathname,
        userAgent: navigator.userAgent
      },
      {
        sessionId: sessionData.sessionId,
        topics: options?.topics,
        sentiment: options?.sentiment
      }
    )

    if (options?.conversationId) {
      setSessionData(prev => ({
        ...prev,
        conversationId: options.conversationId
      }))
    }
  }, [sessionData.sessionId])

  /**
   * Track feature usage
   */
  const trackFeatureUsage = useCallback((
    feature: string,
    action: string,
    value?: number,
    metadata?: Record<string, any>
  ) => {
    usageAnalytics.trackFeatureUsage(
      feature,
      action,
      {
        path: window.location.pathname,
        userAgent: navigator.userAgent
      },
      {
        sessionId: sessionData.sessionId,
        value,
        metadata
      }
    )
  }, [sessionData.sessionId])

  /**
   * Track search query
   */
  const trackSearchQuery = useCallback((
    query: string,
    resultsCount: number,
    responseTime?: number,
    relevanceScore?: number
  ) => {
    usageAnalytics.trackSearchQuery(
      query,
      resultsCount,
      responseTime,
      {
        path: window.location.pathname,
        userAgent: navigator.userAgent
      },
      {
        sessionId: sessionData.sessionId,
        relevanceScore
      }
    )
  }, [sessionData.sessionId])

  /**
   * Flush interaction queue
   */
  const flushInteractionQueue = useCallback(() => {
    if (interactionQueue.current.length === 0) return

    const interactions = [...interactionQueue.current]
    interactionQueue.current = []

    // Send interactions to analytics
    interactions.forEach(interaction => {
      usageAnalytics.trackEvent(
        'feature_usage',
        'interaction',
        interaction.type,
        {
          path: window.location.pathname,
          userAgent: navigator.userAgent
        },
        {
          label: interaction.element,
          sessionId: sessionData.sessionId,
          metadata: interaction.metadata
        }
      )
    })
  }, [sessionData.sessionId])

  /**
   * Set up event listeners
   */
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!finalConfig.enableClickTracking) return

      const target = event.target as HTMLElement
      const element = getElementIdentifier(target)
      
      trackInteraction('click', element, {
        x: event.clientX,
        y: event.clientY,
        button: event.button,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey
      })
    }

    const handleHover = (event: MouseEvent) => {
      if (!finalConfig.enableHoverTracking) return

      const target = event.target as HTMLElement
      const element = getElementIdentifier(target)
      
      trackInteraction('hover', element, {
        x: event.clientX,
        y: event.clientY
      })
    }

    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement
      const element = getElementIdentifier(target)
      
      trackInteraction('focus', element)
    }

    const handleScroll = () => {
      if (!finalConfig.enableScrollTracking) return

      const now = Date.now()
      if (now - lastScrollTime.current < 100) return // Throttle to 100ms

      lastScrollTime.current = now

      if (scrollThrottle.current) {
        clearTimeout(scrollThrottle.current)
      }

      scrollThrottle.current = setTimeout(() => {
        trackInteraction('scroll', 'window', {
          scrollY: window.scrollY,
          scrollX: window.scrollX,
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: document.documentElement.clientHeight,
          scrollPercentage: Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100)
        })
      }, 200)
    }

    const handleInput = (event: Event) => {
      if (!finalConfig.enableInputTracking) return

      const target = event.target as HTMLInputElement
      const element = getElementIdentifier(target)
      
      trackInteraction('input', element, {
        inputType: target.type,
        valueLength: target.value.length,
        placeholder: target.placeholder
      })
    }

    const handleKeyPress = (event: KeyboardEvent) => {
      // Only track special keys, not regular typing
      if (event.key.length === 1) return

      const target = event.target as HTMLElement
      const element = getElementIdentifier(target)
      
      trackInteraction('keypress', element, {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey
      })
    }

    // Add event listeners
    document.addEventListener('click', handleClick, { passive: true })
    document.addEventListener('mouseover', handleHover, { passive: true })
    document.addEventListener('focusin', handleFocus, { passive: true })
    document.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('input', handleInput, { passive: true })
    document.addEventListener('keydown', handleKeyPress, { passive: true })

    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('mouseover', handleHover)
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('scroll', handleScroll)
      document.removeEventListener('input', handleInput)
      document.removeEventListener('keydown', handleKeyPress)
    }
  }, [finalConfig, trackInteraction])

  /**
   * Set up performance monitoring
   */
  useEffect(() => {
    if (!finalConfig.enablePerformanceTracking || typeof PerformanceObserver === 'undefined') {
      return
    }

    performanceObserver.current = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming
          
          usageAnalytics.trackEvent(
            'feature_usage',
            'performance',
            'page_load',
            {
              path: window.location.pathname,
              userAgent: navigator.userAgent
            },
            {
              sessionId: sessionData.sessionId,
              value: navEntry.loadEventEnd - navEntry.loadEventStart,
              metadata: {
                domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
                firstPaint: navEntry.responseEnd - navEntry.requestStart,
                transferSize: navEntry.transferSize,
                type: navEntry.type
              }
            }
          )
        }

        if (entry.entryType === 'largest-contentful-paint') {
          usageAnalytics.trackEvent(
            'feature_usage',
            'performance',
            'lcp',
            {
              path: window.location.pathname,
              userAgent: navigator.userAgent
            },
            {
              sessionId: sessionData.sessionId,
              value: entry.startTime,
              metadata: {
                element: (entry as any).element?.tagName
              }
            }
          )
        }

        if (entry.entryType === 'first-input') {
          const fidEntry = entry as PerformanceEventTiming
          
          usageAnalytics.trackEvent(
            'feature_usage',
            'performance',
            'fid',
            {
              path: window.location.pathname,
              userAgent: navigator.userAgent
            },
            {
              sessionId: sessionData.sessionId,
              value: fidEntry.processingStart - fidEntry.startTime,
              metadata: {
                name: fidEntry.name
              }
            }
          )
        }
      })
    })

    performanceObserver.current.observe({
      entryTypes: ['navigation', 'largest-contentful-paint', 'first-input']
    })

    return () => {
      if (performanceObserver.current) {
        performanceObserver.current.disconnect()
      }
    }
  }, [finalConfig.enablePerformanceTracking, sessionData.sessionId])

  /**
   * Set up batch timer
   */
  useEffect(() => {
    batchTimer.current = setInterval(() => {
      flushInteractionQueue()
    }, finalConfig.batchInterval)

    return () => {
      if (batchTimer.current) {
        clearInterval(batchTimer.current)
      }
    }
  }, [finalConfig.batchInterval, flushInteractionQueue])

  /**
   * Flush queue on unmount
   */
  useEffect(() => {
    return () => {
      flushInteractionQueue()
    }
  }, [flushInteractionQueue])

  /**
   * Track page view on mount
   */
  useEffect(() => {
    trackPageView(window.location.pathname, document.referrer)
  }, [trackPageView])

  return {
    sessionData,
    trackInteraction,
    trackPageView,
    trackChatMessage,
    trackFeatureUsage,
    trackSearchQuery,
    flushInteractionQueue
  }
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get element identifier for tracking
 */
function getElementIdentifier(element: HTMLElement): string {
  // Try to get a meaningful identifier
  if (element.id) {
    return `#${element.id}`
  }

  if (element.className) {
    const classes = element.className.split(' ').filter(c => c.length > 0)
    if (classes.length > 0) {
      return `.${classes[0]}`
    }
  }

  if (element.getAttribute('data-testid')) {
    return `[data-testid="${element.getAttribute('data-testid')}"]`
  }

  if (element.getAttribute('aria-label')) {
    return `[aria-label="${element.getAttribute('aria-label')}"]`
  }

  // Fallback to tag name and position
  const tagName = element.tagName.toLowerCase()
  const parent = element.parentElement
  
  if (parent) {
    const siblings = Array.from(parent.children).filter(child => child.tagName === element.tagName)
    const index = siblings.indexOf(element)
    return `${tagName}:nth-of-type(${index + 1})`
  }

  return tagName
}

/**
 * Hook for A/B testing and feature flags
 */
export function useAnalyticsExperiments() {
  const [experiments, setExperiments] = useState<Record<string, string>>({})

  const trackExperiment = useCallback((
    experimentName: string,
    variant: string,
    sessionId: string
  ) => {
    usageAnalytics.trackEvent(
      'feature_usage',
      'experiment',
      'variant_assigned',
      {
        path: window.location.pathname,
        userAgent: navigator.userAgent
      },
      {
        label: experimentName,
        sessionId,
        metadata: { variant }
      }
    )

    setExperiments(prev => ({
      ...prev,
      [experimentName]: variant
    }))
  }, [])

  const trackConversion = useCallback((
    experimentName: string,
    conversionType: string,
    value?: number,
    sessionId?: string
  ) => {
    const variant = experiments[experimentName]
    if (!variant) return

    usageAnalytics.trackEvent(
      'feature_usage',
      'experiment',
      'conversion',
      {
        path: window.location.pathname,
        userAgent: navigator.userAgent
      },
      {
        label: experimentName,
        value,
        sessionId,
        metadata: {
          variant,
          conversionType
        }
      }
    )
  }, [experiments])

  return {
    experiments,
    trackExperiment,
    trackConversion
  }
}