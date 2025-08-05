/**
 * Error Tracking and Alerting System
 * Comprehensive error monitoring, categorization, and alerting for Ask the Captain
 */

// CloudflareEnv is now available globally from cloudflare-env.d.ts

export interface ErrorEvent {
  id: string
  timestamp: number
  level: 'error' | 'warning' | 'info' | 'debug'
  category: 'api' | 'database' | 'external_service' | 'validation' | 'system' | 'user'
  message: string
  stack?: string
  context: {
    requestId?: string
    userId?: string
    endpoint?: string
    method?: string
    userAgent?: string
    country?: string
    colo?: string
    environment: string
  }
  metadata?: Record<string, any>
  resolved: boolean
  occurrenceCount: number
  firstOccurrence: number
  lastOccurrence: number
}

export interface ErrorSummary {
  timeRange: {
    start: number
    end: number
  }
  totalErrors: number
  errorsByLevel: Record<string, number>
  errorsByCategory: Record<string, number>
  topErrors: {
    message: string
    count: number
    category: string
    level: string
  }[]
  errorRate: number
  totalRequests: number
}

export interface AlertRule {
  id: string
  name: string
  condition: {
    type: 'error_rate' | 'error_count' | 'specific_error' | 'error_spike'
    threshold: number
    timeWindow: number // in minutes
    category?: string
    level?: string
    pattern?: string
  }
  actions: {
    type: 'log' | 'webhook' | 'email'
    config: Record<string, any>
  }[]
  enabled: boolean
  lastTriggered?: number
}

/**
 * Error Tracking Service
 */
export class ErrorTracker {
  private errors: Map<string, ErrorEvent> = new Map()
  private alertRules: AlertRule[] = []
  private readonly maxErrorsInMemory = 5000
  private requestCount = 0

  constructor(private env: CloudflareEnv) {
    this.initializeDefaultAlertRules()
  }

  /**
   * Track an error event
   */
  trackError(
    level: ErrorEvent['level'],
    category: ErrorEvent['category'],
    message: string,
    error?: Error,
    context?: Partial<ErrorEvent['context']>,
    metadata?: Record<string, any>
  ): string {
    const errorId = this.generateErrorId(message, category)
    const timestamp = Date.now()

    // Check if this error already exists
    const existingError = this.errors.get(errorId)
    
    if (existingError) {
      // Update existing error
      existingError.occurrenceCount++
      existingError.lastOccurrence = timestamp
      existingError.context = { ...existingError.context, ...context }
      if (metadata) {
        existingError.metadata = { ...existingError.metadata, ...metadata }
      }
    } else {
      // Create new error event
      const errorEvent: ErrorEvent = {
        id: errorId,
        timestamp,
        level,
        category,
        message,
        stack: error?.stack,
        context: {
          environment: this.env.NODE_ENV || 'unknown',
          ...context
        },
        metadata,
        resolved: false,
        occurrenceCount: 1,
        firstOccurrence: timestamp,
        lastOccurrence: timestamp
      }

      this.errors.set(errorId, errorEvent)

      // Maintain memory limit
      if (this.errors.size > this.maxErrorsInMemory) {
        const oldestError = Array.from(this.errors.values())
          .sort((a, b) => a.firstOccurrence - b.firstOccurrence)[0]
        this.errors.delete(oldestError.id)
      }
    }

    // Log error
    this.logError(this.errors.get(errorId)!)

    // Check alert rules
    this.checkAlertRules(this.errors.get(errorId)!)

    // Send to external error tracking if configured
    this.sendToExternalTracking(this.errors.get(errorId)!)

    return errorId
  }

  /**
   * Track request count for error rate calculation
   */
  trackRequest(): void {
    this.requestCount++
  }

  /**
   * Get error summary for a time range
   */
  getErrorSummary(
    startTime: number,
    endTime: number = Date.now()
  ): ErrorSummary {
    const filteredErrors = Array.from(this.errors.values()).filter(
      error => error.lastOccurrence >= startTime && error.lastOccurrence <= endTime
    )

    const totalErrors = filteredErrors.reduce((sum, error) => sum + error.occurrenceCount, 0)
    
    const errorsByLevel: Record<string, number> = {}
    const errorsByCategory: Record<string, number> = {}
    
    filteredErrors.forEach(error => {
      errorsByLevel[error.level] = (errorsByLevel[error.level] || 0) + error.occurrenceCount
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + error.occurrenceCount
    })

    const topErrors = filteredErrors
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
      .slice(0, 10)
      .map(error => ({
        message: error.message,
        count: error.occurrenceCount,
        category: error.category,
        level: error.level
      }))

    return {
      timeRange: { start: startTime, end: endTime },
      totalErrors,
      errorsByLevel,
      errorsByCategory,
      topErrors,
      errorRate: this.requestCount > 0 ? totalErrors / this.requestCount : 0,
      totalRequests: this.requestCount
    }
  }

  /**
   * Get specific error details
   */
  getError(errorId: string): ErrorEvent | undefined {
    return this.errors.get(errorId)
  }

  /**
   * Get all errors with optional filtering
   */
  getErrors(filters?: {
    level?: string
    category?: string
    resolved?: boolean
    startTime?: number
    endTime?: number
  }): ErrorEvent[] {
    let errors = Array.from(this.errors.values())

    if (filters) {
      if (filters.level) {
        errors = errors.filter(error => error.level === filters.level)
      }
      if (filters.category) {
        errors = errors.filter(error => error.category === filters.category)
      }
      if (filters.resolved !== undefined) {
        errors = errors.filter(error => error.resolved === filters.resolved)
      }
      if (filters.startTime) {
        errors = errors.filter(error => error.lastOccurrence >= filters.startTime!)
      }
      if (filters.endTime) {
        errors = errors.filter(error => error.lastOccurrence <= filters.endTime!)
      }
    }

    return errors.sort((a, b) => b.lastOccurrence - a.lastOccurrence)
  }

  /**
   * Resolve an error
   */
  resolveError(errorId: string): boolean {
    const error = this.errors.get(errorId)
    if (error) {
      error.resolved = true
      return true
    }
    return false
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const alertRule: AlertRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    
    this.alertRules.push(alertRule)
    return alertRule.id
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const index = this.alertRules.findIndex(rule => rule.id === ruleId)
    if (index !== -1) {
      this.alertRules.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules]
  }

  /**
   * Export errors for analysis
   */
  exportErrors(
    format: 'json' | 'csv',
    filters?: Parameters<typeof this.getErrors>[0]
  ): string {
    const errors = this.getErrors(filters)

    switch (format) {
      case 'json':
        return JSON.stringify(errors, null, 2)
      
      case 'csv':
        return this.exportToCSV(errors)
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  /**
   * Generate unique error ID based on message and category
   */
  private generateErrorId(message: string, category: string): string {
    // Create a hash-like ID from message and category
    const combined = `${category}:${message}`
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `error_${Math.abs(hash).toString(36)}`
  }

  /**
   * Log error to console with appropriate level
   */
  private logError(error: ErrorEvent): void {
    const logMessage = `[${error.level.toUpperCase()}] ${error.category}: ${error.message}`
    const logData = {
      id: error.id,
      context: error.context,
      metadata: error.metadata,
      occurrenceCount: error.occurrenceCount
    }

    switch (error.level) {
      case 'error':
        console.error(logMessage, logData)
        if (error.stack) {
          console.error('Stack trace:', error.stack)
        }
        break
      case 'warning':
        console.warn(logMessage, logData)
        break
      case 'info':
        console.info(logMessage, logData)
        break
      case 'debug':
        console.debug(logMessage, logData)
        break
    }
  }

  /**
   * Check alert rules against new error
   */
  private checkAlertRules(error: ErrorEvent): void {
    const now = Date.now()

    this.alertRules.forEach(rule => {
      if (!rule.enabled) return

      // Avoid triggering the same rule too frequently
      if (rule.lastTriggered && (now - rule.lastTriggered) < 60000) { // 1 minute cooldown
        return
      }

      let shouldTrigger = false

      switch (rule.condition.type) {
        case 'specific_error':
          if (rule.condition.pattern) {
            shouldTrigger = error.message.includes(rule.condition.pattern)
          }
          break

        case 'error_count':
          const recentErrors = this.getErrorsInTimeWindow(
            rule.condition.timeWindow,
            rule.condition.category,
            rule.condition.level
          )
          shouldTrigger = recentErrors.length >= rule.condition.threshold
          break

        case 'error_rate':
          const summary = this.getErrorSummary(now - rule.condition.timeWindow * 60000)
          shouldTrigger = summary.errorRate >= rule.condition.threshold
          break

        case 'error_spike':
          // Check if error count has spiked compared to previous period
          const currentPeriod = this.getErrorsInTimeWindow(rule.condition.timeWindow)
          const previousPeriod = this.getErrorsInTimeWindow(
            rule.condition.timeWindow,
            undefined,
            undefined,
            now - rule.condition.timeWindow * 60000 * 2
          )
          
          const currentCount = currentPeriod.length
          const previousCount = previousPeriod.length
          const spikeRatio = previousCount > 0 ? currentCount / previousCount : currentCount
          
          shouldTrigger = spikeRatio >= rule.condition.threshold
          break
      }

      if (shouldTrigger) {
        this.triggerAlert(rule, error)
        rule.lastTriggered = now
      }
    })
  }

  /**
   * Get errors within a time window
   */
  private getErrorsInTimeWindow(
    timeWindowMinutes: number,
    category?: string,
    level?: string,
    endTime: number = Date.now()
  ): ErrorEvent[] {
    const startTime = endTime - timeWindowMinutes * 60000
    
    return Array.from(this.errors.values()).filter(error => {
      const inTimeRange = error.lastOccurrence >= startTime && error.lastOccurrence <= endTime
      const matchesCategory = !category || error.category === category
      const matchesLevel = !level || error.level === level
      
      return inTimeRange && matchesCategory && matchesLevel
    })
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, triggeringError: ErrorEvent): Promise<void> {
    console.warn(`Alert triggered: ${rule.name}`, {
      rule: rule.id,
      error: triggeringError.id,
      message: triggeringError.message
    })

    // Execute alert actions
    for (const action of rule.actions) {
      try {
        await this.executeAlertAction(action, rule, triggeringError)
      } catch (error) {
        console.error(`Failed to execute alert action:`, error)
      }
    }
  }

  /**
   * Execute an alert action
   */
  private async executeAlertAction(
    action: AlertRule['actions'][0],
    rule: AlertRule,
    error: ErrorEvent
  ): Promise<void> {
    switch (action.type) {
      case 'log':
        console.log(`ALERT: ${rule.name} - ${error.message}`)
        break

      case 'webhook':
        if (action.config.url) {
          await fetch(action.config.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(action.config.headers || {})
            },
            body: JSON.stringify({
              alert: rule.name,
              error: {
                id: error.id,
                message: error.message,
                category: error.category,
                level: error.level,
                occurrenceCount: error.occurrenceCount
              },
              timestamp: Date.now()
            })
          })
        }
        break

      case 'email':
        // Email implementation would depend on email service
        console.log(`Email alert would be sent: ${rule.name}`)
        break
    }
  }

  /**
   * Send error to external tracking service
   */
  private async sendToExternalTracking(error: ErrorEvent): Promise<void> {
    try {
      // Send to Sentry, Bugsnag, or other error tracking service
      if (this.env.ERROR_TRACKING_DSN) {
        // Implementation would depend on the service
        console.log('Sending error to external tracking:', error.id)
      }
    } catch (err) {
      console.error('Failed to send error to external tracking:', err)
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    // High error rate alert
    this.alertRules.push({
      id: 'default_error_rate',
      name: 'High Error Rate',
      condition: {
        type: 'error_rate',
        threshold: 0.05, // 5%
        timeWindow: 5 // 5 minutes
      },
      actions: [
        { type: 'log', config: {} }
      ],
      enabled: true
    })

    // Critical error alert
    this.alertRules.push({
      id: 'default_critical_errors',
      name: 'Critical Errors',
      condition: {
        type: 'error_count',
        threshold: 1,
        timeWindow: 1, // 1 minute
        level: 'error'
      },
      actions: [
        { type: 'log', config: {} }
      ],
      enabled: true
    })

    // Database error spike
    this.alertRules.push({
      id: 'default_database_spike',
      name: 'Database Error Spike',
      condition: {
        type: 'error_spike',
        threshold: 3, // 3x increase
        timeWindow: 10, // 10 minutes
        category: 'database'
      },
      actions: [
        { type: 'log', config: {} }
      ],
      enabled: true
    })
  }

  /**
   * Export errors to CSV format
   */
  private exportToCSV(errors: ErrorEvent[]): string {
    const headers = [
      'id', 'timestamp', 'level', 'category', 'message', 'occurrenceCount',
      'firstOccurrence', 'lastOccurrence', 'resolved', 'requestId', 'endpoint',
      'method', 'userAgent', 'country', 'environment'
    ]

    const csvRows = [headers.join(',')]

    errors.forEach(error => {
      const row = [
        error.id,
        error.timestamp,
        error.level,
        error.category,
        `"${error.message.replace(/"/g, '""')}"`, // Escape quotes
        error.occurrenceCount,
        error.firstOccurrence,
        error.lastOccurrence,
        error.resolved,
        error.context.requestId || '',
        error.context.endpoint || '',
        error.context.method || '',
        error.context.userAgent || '',
        error.context.country || '',
        error.context.environment
      ]
      csvRows.push(row.join(','))
    })

    return csvRows.join('\n')
  }
}

// Create singleton instance
export const errorTracker = new ErrorTracker({} as CloudflareEnv)

// Utility functions
export function trackError(
  level: ErrorEvent['level'],
  category: ErrorEvent['category'],
  message: string,
  error?: Error,
  context?: Partial<ErrorEvent['context']>,
  metadata?: Record<string, any>
): string {
  return errorTracker.trackError(level, category, message, error, context, metadata)
}

export function trackRequest(): void {
  errorTracker.trackRequest()
}

// Export types
export type { ErrorEvent, ErrorSummary, AlertRule }