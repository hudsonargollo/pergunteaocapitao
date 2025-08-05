/**
 * Usage Analytics and Metrics Collection
 * Tracks user behavior, feature usage, and business metrics for Ask the Captain
 */

import type { CloudflareEnv } from '@/types'

export interface UsageEvent {
  id: string
  timestamp: number
  type: 'page_view' | 'chat_message' | 'image_generation' | 'search_query' | 'error' | 'feature_usage'
  category: string
  action: string
  label?: string
  value?: number
  userId?: string
  sessionId: string
  context: {
    userAgent?: string
    country?: string
    colo?: string
    referrer?: string
    path: string
    environment: string
  }
  metadata?: Record<string, any>
}

export interface ConversationMetrics {
  id: string
  sessionId: string
  startTime: number
  endTime?: number
  messageCount: number
  averageResponseTime: number
  imagesGenerated: number
  searchQueries: number
  userSatisfaction?: number // 1-5 rating
  topics: string[]
  completed: boolean
}

export interface UsageSummary {
  timeRange: {
    start: number
    end: number
  }
  overview: {
    totalSessions: number
    totalMessages: number
    totalImages: number
    totalSearches: number
    averageSessionDuration: number
    averageMessagesPerSession: number
    bounceRate: number
  }
  engagement: {
    activeUsers: number
    returningUsers: number
    newUsers: number
    averageSessionsPerUser: number
    userRetentionRate: number
  }
  performance: {
    averageResponseTime: number
    successRate: number
    errorRate: number
    cacheHitRate: number
  }
  geography: {
    topCountries: { country: string; sessions: number }[]
    topColos: { colo: string; sessions: number }[]
  }
  features: {
    mostUsedFeatures: { feature: string; usage: number }[]
    featureAdoptionRate: Record<string, number>
  }
  content: {
    popularTopics: { topic: string; mentions: number }[]
    searchPatterns: { query: string; frequency: number }[]
  }
}

export interface UserJourney {
  sessionId: string
  userId?: string
  startTime: number
  endTime?: number
  events: UsageEvent[]
  path: string[]
  conversions: {
    type: string
    timestamp: number
    value?: number
  }[]
  dropoffPoint?: string
}

/**
 * Usage Analytics Service
 */
export class UsageAnalytics {
  private events: UsageEvent[] = []
  private conversations: Map<string, ConversationMetrics> = new Map()
  private sessions: Map<string, UserJourney> = new Map()
  private readonly maxEventsInMemory = 10000

  constructor(private env: CloudflareEnv) {}

  /**
   * Track a usage event
   */
  trackEvent(
    type: UsageEvent['type'],
    category: string,
    action: string,
    context: Partial<UsageEvent['context']>,
    options?: {
      label?: string
      value?: number
      userId?: string
      sessionId?: string
      metadata?: Record<string, any>
    }
  ): string {
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const sessionId = options?.sessionId || this.generateSessionId()

    const event: UsageEvent = {
      id: eventId,
      timestamp: Date.now(),
      type,
      category,
      action,
      label: options?.label,
      value: options?.value,
      userId: options?.userId,
      sessionId,
      context: {
        environment: this.env.NODE_ENV || 'unknown',
        path: context.path || '/',
        ...context
      },
      metadata: options?.metadata
    }

    this.events.push(event)

    // Maintain memory limit
    if (this.events.length > this.maxEventsInMemory) {
      this.events = this.events.slice(-this.maxEventsInMemory)
    }

    // Update user journey
    this.updateUserJourney(event)

    // Update conversation metrics if applicable
    if (type === 'chat_message' || type === 'image_generation' || type === 'search_query') {
      this.updateConversationMetrics(event)
    }

    // Send to external analytics
    this.sendToExternalAnalytics(event)

    return eventId
  }

  /**
   * Track page view
   */
  trackPageView(
    path: string,
    context: Partial<UsageEvent['context']>,
    options?: {
      userId?: string
      sessionId?: string
      referrer?: string
    }
  ): string {
    return this.trackEvent('page_view', 'navigation', 'page_view', {
      ...context,
      path,
      referrer: options?.referrer
    }, {
      userId: options?.userId,
      sessionId: options?.sessionId
    })
  }

  /**
   * Track chat message
   */
  trackChatMessage(
    messageType: 'user' | 'assistant',
    responseTime?: number,
    context?: Partial<UsageEvent['context']>,
    options?: {
      userId?: string
      sessionId?: string
      topics?: string[]
      sentiment?: string
    }
  ): string {
    return this.trackEvent('chat_message', 'conversation', messageType, context || {}, {
      value: responseTime,
      userId: options?.userId,
      sessionId: options?.sessionId,
      metadata: {
        topics: options?.topics,
        sentiment: options?.sentiment
      }
    })
  }

  /**
   * Track image generation
   */
  trackImageGeneration(
    success: boolean,
    generationTime?: number,
    context?: Partial<UsageEvent['context']>,
    options?: {
      userId?: string
      sessionId?: string
      prompt?: string
      parameters?: Record<string, any>
    }
  ): string {
    return this.trackEvent('image_generation', 'content', success ? 'success' : 'failure', context || {}, {
      value: generationTime,
      userId: options?.userId,
      sessionId: options?.sessionId,
      metadata: {
        prompt: options?.prompt,
        parameters: options?.parameters
      }
    })
  }

  /**
   * Track search query
   */
  trackSearchQuery(
    query: string,
    resultsCount: number,
    responseTime?: number,
    context?: Partial<UsageEvent['context']>,
    options?: {
      userId?: string
      sessionId?: string
      relevanceScore?: number
    }
  ): string {
    return this.trackEvent('search_query', 'search', 'query', context || {}, {
      label: query,
      value: responseTime,
      userId: options?.userId,
      sessionId: options?.sessionId,
      metadata: {
        resultsCount,
        relevanceScore: options?.relevanceScore
      }
    })
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(
    feature: string,
    action: string,
    context?: Partial<UsageEvent['context']>,
    options?: {
      userId?: string
      sessionId?: string
      value?: number
      metadata?: Record<string, any>
    }
  ): string {
    return this.trackEvent('feature_usage', 'features', action, context || {}, {
      label: feature,
      value: options?.value,
      userId: options?.userId,
      sessionId: options?.sessionId,
      metadata: options?.metadata
    })
  }

  /**
   * Start conversation tracking
   */
  startConversation(
    sessionId: string,
    userId?: string,
    metadata?: Record<string, any>
  ): string {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const conversation: ConversationMetrics = {
      id: conversationId,
      sessionId,
      startTime: Date.now(),
      messageCount: 0,
      averageResponseTime: 0,
      imagesGenerated: 0,
      searchQueries: 0,
      topics: [],
      completed: false
    }

    this.conversations.set(conversationId, conversation)
    return conversationId
  }

  /**
   * End conversation tracking
   */
  endConversation(
    conversationId: string,
    userSatisfaction?: number,
    completed: boolean = true
  ): void {
    const conversation = this.conversations.get(conversationId)
    if (conversation) {
      conversation.endTime = Date.now()
      conversation.userSatisfaction = userSatisfaction
      conversation.completed = completed
    }
  }

  /**
   * Get usage summary for a time range
   */
  getUsageSummary(
    startTime: number,
    endTime: number = Date.now()
  ): UsageSummary {
    const filteredEvents = this.events.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime
    )

    const sessions = new Set(filteredEvents.map(e => e.sessionId))
    const users = new Set(filteredEvents.filter(e => e.userId).map(e => e.userId))
    
    // Calculate session durations
    const sessionDurations = Array.from(sessions).map(sessionId => {
      const sessionEvents = filteredEvents.filter(e => e.sessionId === sessionId)
      if (sessionEvents.length < 2) return 0
      
      const firstEvent = sessionEvents.reduce((min, e) => e.timestamp < min.timestamp ? e : min)
      const lastEvent = sessionEvents.reduce((max, e) => e.timestamp > max.timestamp ? e : max)
      
      return lastEvent.timestamp - firstEvent.timestamp
    })

    const averageSessionDuration = sessionDurations.length > 0 
      ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
      : 0

    // Calculate bounce rate (sessions with only one event)
    const singleEventSessions = Array.from(sessions).filter(sessionId => {
      return filteredEvents.filter(e => e.sessionId === sessionId).length === 1
    })
    const bounceRate = sessions.size > 0 ? singleEventSessions.length / sessions.size : 0

    // Group events by type
    const messageEvents = filteredEvents.filter(e => e.type === 'chat_message')
    const imageEvents = filteredEvents.filter(e => e.type === 'image_generation')
    const searchEvents = filteredEvents.filter(e => e.type === 'search_query')

    // Calculate response times
    const responseTimes = messageEvents
      .filter(e => e.value !== undefined)
      .map(e => e.value!)
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0

    // Calculate success/error rates
    const successfulEvents = filteredEvents.filter(e => 
      e.action !== 'failure' && e.action !== 'error'
    )
    const successRate = filteredEvents.length > 0 
      ? successfulEvents.length / filteredEvents.length 
      : 0

    // Geography analysis
    const countryCount: Record<string, number> = {}
    const coloCount: Record<string, number> = {}
    
    filteredEvents.forEach(event => {
      if (event.context.country) {
        countryCount[event.context.country] = (countryCount[event.context.country] || 0) + 1
      }
      if (event.context.colo) {
        coloCount[event.context.colo] = (coloCount[event.context.colo] || 0) + 1
      }
    })

    const topCountries = Object.entries(countryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([country, sessions]) => ({ country, sessions }))

    const topColos = Object.entries(coloCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([colo, sessions]) => ({ colo, sessions }))

    // Feature usage analysis
    const featureEvents = filteredEvents.filter(e => e.type === 'feature_usage')
    const featureCount: Record<string, number> = {}
    
    featureEvents.forEach(event => {
      if (event.label) {
        featureCount[event.label] = (featureCount[event.label] || 0) + 1
      }
    })

    const mostUsedFeatures = Object.entries(featureCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([feature, usage]) => ({ feature, usage }))

    // Topic analysis
    const topicCount: Record<string, number> = {}
    messageEvents.forEach(event => {
      if (event.metadata?.topics) {
        event.metadata.topics.forEach((topic: string) => {
          topicCount[topic] = (topicCount[topic] || 0) + 1
        })
      }
    })

    const popularTopics = Object.entries(topicCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([topic, mentions]) => ({ topic, mentions }))

    // Search pattern analysis
    const searchQueries: Record<string, number> = {}
    searchEvents.forEach(event => {
      if (event.label) {
        searchQueries[event.label] = (searchQueries[event.label] || 0) + 1
      }
    })

    const searchPatterns = Object.entries(searchQueries)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([query, frequency]) => ({ query, frequency }))

    return {
      timeRange: { start: startTime, end: endTime },
      overview: {
        totalSessions: sessions.size,
        totalMessages: messageEvents.length,
        totalImages: imageEvents.length,
        totalSearches: searchEvents.length,
        averageSessionDuration,
        averageMessagesPerSession: sessions.size > 0 ? messageEvents.length / sessions.size : 0,
        bounceRate
      },
      engagement: {
        activeUsers: users.size,
        returningUsers: 0, // Would need historical data
        newUsers: users.size, // Simplified for now
        averageSessionsPerUser: users.size > 0 ? sessions.size / users.size : 0,
        userRetentionRate: 0 // Would need historical data
      },
      performance: {
        averageResponseTime,
        successRate,
        errorRate: 1 - successRate,
        cacheHitRate: 0 // Would need cache metrics
      },
      geography: {
        topCountries,
        topColos
      },
      features: {
        mostUsedFeatures,
        featureAdoptionRate: {} // Would need baseline data
      },
      content: {
        popularTopics,
        searchPatterns
      }
    }
  }

  /**
   * Get user journey for a session
   */
  getUserJourney(sessionId: string): UserJourney | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Get conversation metrics
   */
  getConversationMetrics(conversationId: string): ConversationMetrics | undefined {
    return this.conversations.get(conversationId)
  }

  /**
   * Export analytics data
   */
  exportAnalytics(
    format: 'json' | 'csv',
    startTime?: number,
    endTime?: number
  ): string {
    const events = startTime 
      ? this.events.filter(e => e.timestamp >= startTime && (!endTime || e.timestamp <= endTime))
      : this.events

    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2)
      
      case 'csv':
        return this.exportToCSV(events)
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Update user journey
   */
  private updateUserJourney(event: UsageEvent): void {
    let journey = this.sessions.get(event.sessionId)
    
    if (!journey) {
      journey = {
        sessionId: event.sessionId,
        userId: event.userId,
        startTime: event.timestamp,
        events: [],
        path: [],
        conversions: []
      }
      this.sessions.set(event.sessionId, journey)
    }

    journey.events.push(event)
    journey.endTime = event.timestamp

    // Update path
    if (event.type === 'page_view' && !journey.path.includes(event.context.path)) {
      journey.path.push(event.context.path)
    }

    // Track conversions
    if (this.isConversionEvent(event)) {
      journey.conversions.push({
        type: event.action,
        timestamp: event.timestamp,
        value: event.value
      })
    }
  }

  /**
   * Update conversation metrics
   */
  private updateConversationMetrics(event: UsageEvent): void {
    // Find or create conversation for this session
    let conversation = Array.from(this.conversations.values())
      .find(c => c.sessionId === event.sessionId && !c.endTime)

    if (!conversation) {
      const conversationId = this.startConversation(event.sessionId, event.userId)
      conversation = this.conversations.get(conversationId)!
    }

    // Update metrics based on event type
    switch (event.type) {
      case 'chat_message':
        conversation.messageCount++
        if (event.value) {
          const currentAvg = conversation.averageResponseTime
          const count = conversation.messageCount
          conversation.averageResponseTime = (currentAvg * (count - 1) + event.value) / count
        }
        if (event.metadata?.topics) {
          event.metadata.topics.forEach((topic: string) => {
            if (!conversation!.topics.includes(topic)) {
              conversation!.topics.push(topic)
            }
          })
        }
        break

      case 'image_generation':
        conversation.imagesGenerated++
        break

      case 'search_query':
        conversation.searchQueries++
        break
    }
  }

  /**
   * Check if event is a conversion
   */
  private isConversionEvent(event: UsageEvent): boolean {
    const conversionActions = [
      'message_sent',
      'image_generated',
      'search_completed',
      'session_completed'
    ]
    return conversionActions.includes(event.action)
  }

  /**
   * Send event to external analytics
   */
  private async sendToExternalAnalytics(event: UsageEvent): Promise<void> {
    try {
      // Send to Google Analytics, Mixpanel, or other analytics service
      if (this.env.ANALYTICS_ENDPOINT) {
        await fetch(this.env.ANALYTICS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.env.ANALYTICS_TOKEN}`
          },
          body: JSON.stringify(event)
        })
      }
    } catch (error) {
      console.error('Failed to send event to external analytics:', error)
    }
  }

  /**
   * Export events to CSV format
   */
  private exportToCSV(events: UsageEvent[]): string {
    const headers = [
      'id', 'timestamp', 'type', 'category', 'action', 'label', 'value',
      'userId', 'sessionId', 'userAgent', 'country', 'colo', 'referrer',
      'path', 'environment'
    ]

    const csvRows = [headers.join(',')]

    events.forEach(event => {
      const row = [
        event.id,
        event.timestamp,
        event.type,
        event.category,
        event.action,
        event.label || '',
        event.value || '',
        event.userId || '',
        event.sessionId,
        event.context.userAgent || '',
        event.context.country || '',
        event.context.colo || '',
        event.context.referrer || '',
        event.context.path,
        event.context.environment
      ]
      csvRows.push(row.join(','))
    })

    return csvRows.join('\n')
  }
}

// Create singleton instance
export const usageAnalytics = new UsageAnalytics({} as CloudflareEnv)

// Utility functions
export function trackPageView(
  path: string,
  context: Partial<UsageEvent['context']>,
  options?: Parameters<typeof usageAnalytics.trackPageView>[2]
): string {
  return usageAnalytics.trackPageView(path, context, options)
}

export function trackChatMessage(
  messageType: 'user' | 'assistant',
  responseTime?: number,
  context?: Partial<UsageEvent['context']>,
  options?: Parameters<typeof usageAnalytics.trackChatMessage>[3]
): string {
  return usageAnalytics.trackChatMessage(messageType, responseTime, context, options)
}

export function trackImageGeneration(
  success: boolean,
  generationTime?: number,
  context?: Partial<UsageEvent['context']>,
  options?: Parameters<typeof usageAnalytics.trackImageGeneration>[3]
): string {
  return usageAnalytics.trackImageGeneration(success, generationTime, context, options)
}

// Export types
export type { 
  UsageEvent, 
  ConversationMetrics, 
  UsageSummary, 
  UserJourney 
}