// Recovery mechanisms for partial system failures
import type { ChatResponse, SearchResult, ResponseContext } from '@/types'
import { CaptainError, ErrorType, ErrorSeverity } from './error-handling'
import { captainErrorMessaging } from './captain-error-messaging'
import { comprehensiveFallbackSystem } from './comprehensive-fallback-system'
import { networkConnectivity, ConnectivityState } from './network-connectivity'

/**
 * Recovery operation result
 */
interface RecoveryResult<T> {
  success: boolean
  data?: T
  error?: CaptainError
  recoveryMethod: string
  fallbackUsed: boolean
  retryCount: number
  timestamp: Date
}

/**
 * Partial failure context
 */
interface PartialFailureContext {
  originalOperation: string
  userMessage?: string
  conversationId?: string
  partialData?: any
  attemptCount: number
  lastError?: CaptainError
  startTime: Date
}

/**
 * Recovery strategy definition
 */
interface RecoveryStrategy {
  name: string
  priority: number
  condition: (context: PartialFailureContext) => boolean
  execute: (context: PartialFailureContext) => Promise<RecoveryResult<any>>
  maxAttempts: number
  delayMs: number
}

/**
 * Recovery mechanisms manager for handling partial system failures
 */
export class RecoveryMechanisms {
  private strategies: Map<string, RecoveryStrategy[]> = new Map()
  private activeRecoveries: Map<string, PartialFailureContext> = new Map()
  private recoveryHistory: Array<{
    operation: string
    result: RecoveryResult<any>
    context: PartialFailureContext
  }> = []

  constructor() {
    this.initializeRecoveryStrategies()
  }

  /**
   * Initialize recovery strategies for different operations
   */
  private initializeRecoveryStrategies(): void {
    // Chat completion recovery strategies
    this.strategies.set('chat_completion', [
      {
        name: 'partial_response_completion',
        priority: 10,
        condition: (ctx) => ctx.partialData?.partialResponse && ctx.partialData.partialResponse.length > 20,
        execute: this.completePartialResponse.bind(this),
        maxAttempts: 1,
        delayMs: 0
      },
      {
        name: 'context_based_response',
        priority: 8,
        condition: (ctx) => ctx.partialData?.searchResults && ctx.partialData.searchResults.length > 0,
        execute: this.generateContextBasedResponse.bind(this),
        maxAttempts: 1,
        delayMs: 0
      },
      {
        name: 'retry_with_simplified_prompt',
        priority: 6,
        condition: (ctx) => ctx.attemptCount < 2 && networkConnectivity.isOnline(),
        execute: this.retryWithSimplifiedPrompt.bind(this),
        maxAttempts: 2,
        delayMs: 1000
      },
      {
        name: 'fallback_response',
        priority: 4,
        condition: () => true,
        execute: this.generateFallbackResponse.bind(this),
        maxAttempts: 1,
        delayMs: 0
      }
    ])

    // Image generation recovery strategies
    this.strategies.set('image_generation', [
      {
        name: 'retry_with_fallback_prompt',
        priority: 10,
        condition: (ctx) => ctx.attemptCount < 2 && networkConnectivity.isOnline(),
        execute: this.retryImageWithFallbackPrompt.bind(this),
        maxAttempts: 2,
        delayMs: 1500
      },
      {
        name: 'contextual_brand_asset',
        priority: 8,
        condition: (ctx) => ctx.partialData?.responseContext,
        execute: this.selectContextualBrandAsset.bind(this),
        maxAttempts: 1,
        delayMs: 0
      },
      {
        name: 'default_captain_image',
        priority: 6,
        condition: () => true,
        execute: this.useDefaultCaptainImage.bind(this),
        maxAttempts: 1,
        delayMs: 0
      }
    ])

    // Search recovery strategies
    this.strategies.set('semantic_search', [
      {
        name: 'retry_with_modified_query',
        priority: 10,
        condition: (ctx) => ctx.attemptCount < 2 && networkConnectivity.isOnline(),
        execute: this.retrySearchWithModifiedQuery.bind(this),
        maxAttempts: 2,
        delayMs: 500
      },
      {
        name: 'keyword_based_search',
        priority: 8,
        condition: (ctx) => ctx.userMessage && ctx.userMessage.length > 0,
        execute: this.performKeywordBasedSearch.bind(this),
        maxAttempts: 1,
        delayMs: 0
      },
      {
        name: 'cached_results',
        priority: 6,
        condition: (ctx) => this.hasCachedResults(ctx.userMessage || ''),
        execute: this.retrieveCachedResults.bind(this),
        maxAttempts: 1,
        delayMs: 0
      },
      {
        name: 'fallback_knowledge',
        priority: 4,
        condition: () => true,
        execute: this.generateFallbackKnowledge.bind(this),
        maxAttempts: 1,
        delayMs: 0
      }
    ])

    // Storage recovery strategies
    this.strategies.set('storage_operation', [
      {
        name: 'retry_with_exponential_backoff',
        priority: 10,
        condition: (ctx) => ctx.attemptCount < 3 && networkConnectivity.isOnline(),
        execute: this.retryStorageWithBackoff.bind(this),
        maxAttempts: 3,
        delayMs: 1000
      },
      {
        name: 'alternative_storage_method',
        priority: 8,
        condition: (ctx) => ctx.attemptCount < 2,
        execute: this.useAlternativeStorageMethod.bind(this),
        maxAttempts: 2,
        delayMs: 500
      },
      {
        name: 'graceful_degradation',
        priority: 6,
        condition: () => true,
        execute: this.gracefulStorageDegradation.bind(this),
        maxAttempts: 1,
        delayMs: 0
      }
    ])
  }

  /**
   * Execute recovery for a failed operation
   */
  async executeRecovery<T>(
    operation: string,
    context: Partial<PartialFailureContext>
  ): Promise<RecoveryResult<T>> {
    const fullContext: PartialFailureContext = {
      originalOperation: operation,
      attemptCount: context.attemptCount || 1,
      startTime: context.startTime || new Date(),
      ...context
    }

    // Track active recovery
    const recoveryId = `${operation}_${Date.now()}`
    this.activeRecoveries.set(recoveryId, fullContext)

    try {
      const strategies = this.strategies.get(operation) || []
      
      // Sort strategies by priority (highest first)
      const sortedStrategies = strategies
        .filter(strategy => strategy.condition(fullContext))
        .sort((a, b) => b.priority - a.priority)

      if (sortedStrategies.length === 0) {
        throw new CaptainError(
          ErrorType.INTERNAL_ERROR,
          `No recovery strategies available for operation: ${operation}`,
          { details: { operation, context: fullContext } }
        )
      }

      // Try each strategy until one succeeds
      for (const strategy of sortedStrategies) {
        try {
          console.log(`Attempting recovery strategy: ${strategy.name} for operation: ${operation}`)
          
          const result = await strategy.execute(fullContext)
          
          if (result.success) {
            // Log successful recovery
            this.logRecoveryResult(operation, result, fullContext)
            return result
          }
        } catch (error) {
          console.warn(`Recovery strategy ${strategy.name} failed:`, error)
          continue
        }
      }

      // All strategies failed
      const failureResult: RecoveryResult<T> = {
        success: false,
        error: new CaptainError(
          ErrorType.INTERNAL_ERROR,
          `All recovery strategies failed for operation: ${operation}`,
          { details: { operation, strategiesAttempted: sortedStrategies.length } }
        ),
        recoveryMethod: 'none',
        fallbackUsed: false,
        retryCount: fullContext.attemptCount,
        timestamp: new Date()
      }

      this.logRecoveryResult(operation, failureResult, fullContext)
      return failureResult

    } finally {
      // Clean up active recovery tracking
      this.activeRecoveries.delete(recoveryId)
    }
  }

  /**
   * Complete partial response strategy
   */
  private async completePartialResponse(context: PartialFailureContext): Promise<RecoveryResult<ChatResponse>> {
    const partialResponse = context.partialData?.partialResponse || ''
    
    // Analyze the partial response to determine appropriate completion
    let completedResponse = partialResponse.trim()
    
    // Check if response ends mid-sentence
    const lastChar = completedResponse.slice(-1)
    if (!['.', '!', '?'].includes(lastChar)) {
      // Add contextual completion based on content
      if (completedResponse.toLowerCase().includes('lembre-se')) {
        completedResponse += ' - a ação é sempre o próximo passo.'
      } else if (completedResponse.toLowerCase().includes('guerreiro')) {
        completedResponse += ' Continue firme na sua jornada.'
      } else if (completedResponse.toLowerCase().includes('disciplina')) {
        completedResponse += ' Mantenha o foco e persista.'
      } else {
        completedResponse += ' Mantenha a determinação e continue avançando.'
      }
    }

    // Get appropriate Captain image for the completed response
    const fallbackImage = await comprehensiveFallbackSystem.getFallbackImage('supportive')

    return {
      success: true,
      data: {
        response: completedResponse,
        imageUrl: fallbackImage.url,
        conversationId: context.conversationId || `recovery_${Date.now()}`
      },
      recoveryMethod: 'partial_response_completion',
      fallbackUsed: true,
      retryCount: context.attemptCount,
      timestamp: new Date()
    }
  }

  /**
   * Generate response based on search context
   */
  private async generateContextBasedResponse(context: PartialFailureContext): Promise<RecoveryResult<ChatResponse>> {
    const searchResults = context.partialData?.searchResults || []
    const userMessage = context.userMessage || ''

    if (searchResults.length === 0) {
      throw new Error('No search results available for context-based response')
    }

    const topResult = searchResults[0]
    const contextSnippet = topResult.content.substring(0, 200)

    const contextualResponse = `Baseado no que encontrei sobre sua consulta, guerreiro: ${contextSnippet}...

A chave está em aplicar esse conhecimento através da ação consistente. Qual será seu próximo passo?`

    const fallbackImage = await comprehensiveFallbackSystem.getFallbackImage('instructional')

    return {
      success: true,
      data: {
        response: contextualResponse,
        imageUrl: fallbackImage.url,
        conversationId: context.conversationId || `recovery_${Date.now()}`
      },
      recoveryMethod: 'context_based_response',
      fallbackUsed: true,
      retryCount: context.attemptCount,
      timestamp: new Date()
    }
  }

  /**
   * Retry with simplified prompt
   */
  private async retryWithSimplifiedPrompt(context: PartialFailureContext): Promise<RecoveryResult<ChatResponse>> {
    const userMessage = context.userMessage || ''
    
    // Simplify the user message for retry
    const simplifiedMessage = this.simplifyUserMessage(userMessage)

    try {
      // Attempt simplified API call
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: simplifiedMessage,
          conversationId: context.conversationId,
          simplified: true
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const chatResponse = await response.json()

      return {
        success: true,
        data: chatResponse,
        recoveryMethod: 'retry_with_simplified_prompt',
        fallbackUsed: false,
        retryCount: context.attemptCount + 1,
        timestamp: new Date()
      }
    } catch (error) {
      throw new CaptainError(
        ErrorType.CHAT_COMPLETION_FAILED,
        `Simplified retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error instanceof Error ? error : undefined }
      )
    }
  }

  /**
   * Generate fallback response
   */
  private async generateFallbackResponse(context: PartialFailureContext): Promise<RecoveryResult<ChatResponse>> {
    const errorType = context.lastError?.type || ErrorType.CHAT_COMPLETION_FAILED
    const captainMessage = captainErrorMessaging.getCaptainErrorMessage(errorType, {
      userMessage: context.userMessage,
      attemptCount: context.attemptCount
    })

    const fallbackImage = await comprehensiveFallbackSystem.getFallbackImage('supportive')

    return {
      success: true,
      data: {
        response: captainMessage.message,
        imageUrl: fallbackImage.url,
        conversationId: context.conversationId || `fallback_${Date.now()}`
      },
      recoveryMethod: 'fallback_response',
      fallbackUsed: true,
      retryCount: context.attemptCount,
      timestamp: new Date()
    }
  }

  /**
   * Retry image generation with fallback prompt
   */
  private async retryImageWithFallbackPrompt(context: PartialFailureContext): Promise<RecoveryResult<string>> {
    const responseContext = context.partialData?.responseContext

    try {
      // Use a simplified, more reliable prompt
      const fallbackPrompt = {
        responseContent: 'Capitão Caverna em pose padrão',
        context: {
          tone: 'supportive',
          themes: ['default'],
          intensity: 'medium'
        }
      }

      const response = await fetch('/api/v1/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fallbackPrompt)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const imageResponse = await response.json()

      return {
        success: true,
        data: imageResponse.imageUrl,
        recoveryMethod: 'retry_with_fallback_prompt',
        fallbackUsed: true,
        retryCount: context.attemptCount + 1,
        timestamp: new Date()
      }
    } catch (error) {
      throw new CaptainError(
        ErrorType.IMAGE_GENERATION_FAILED,
        `Fallback image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error instanceof Error ? error : undefined }
      )
    }
  }

  /**
   * Select contextual brand asset
   */
  private async selectContextualBrandAsset(context: PartialFailureContext): Promise<RecoveryResult<string>> {
    const responseContext = context.partialData?.responseContext
    const fallbackContext = responseContext?.tone || 'default'

    const brandAsset = await comprehensiveFallbackSystem.getFallbackImage(fallbackContext, {
      preferHighQuality: true,
      maxAttempts: 1
    })

    return {
      success: true,
      data: brandAsset.url,
      recoveryMethod: 'contextual_brand_asset',
      fallbackUsed: brandAsset.usedFallback,
      retryCount: context.attemptCount,
      timestamp: new Date()
    }
  }

  /**
   * Use default Captain image
   */
  private async useDefaultCaptainImage(context: PartialFailureContext): Promise<RecoveryResult<string>> {
    const defaultImage = await comprehensiveFallbackSystem.getFallbackImage('default', {
      preferHighQuality: false,
      maxAttempts: 1
    })

    return {
      success: true,
      data: defaultImage.url,
      recoveryMethod: 'default_captain_image',
      fallbackUsed: true,
      retryCount: context.attemptCount,
      timestamp: new Date()
    }
  }

  /**
   * Retry search with modified query
   */
  private async retrySearchWithModifiedQuery(context: PartialFailureContext): Promise<RecoveryResult<SearchResult[]>> {
    const originalQuery = context.userMessage || ''
    const modifiedQuery = this.modifySearchQuery(originalQuery)

    try {
      // This would integrate with the actual search system
      // For now, return a placeholder implementation
      throw new Error('Search retry not implemented')
    } catch (error) {
      throw new CaptainError(
        ErrorType.SEMANTIC_SEARCH_FAILED,
        `Modified search retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error instanceof Error ? error : undefined }
      )
    }
  }

  /**
   * Perform keyword-based search fallback
   */
  private async performKeywordBasedSearch(context: PartialFailureContext): Promise<RecoveryResult<SearchResult[]>> {
    // Placeholder for keyword-based search implementation
    const keywords = this.extractKeywords(context.userMessage || '')
    
    // Return basic fallback results
    const fallbackResults: SearchResult[] = [{
      content: 'Guerreiro, não consegui encontrar informações específicas sobre sua consulta no momento. Mas lembre-se: a verdadeira sabedoria vem da ação consistente e da disciplina diária.',
      score: 0.7,
      metadata: {
        source: 'fallback_search',
        section: 'general_guidance'
      }
    }]

    return {
      success: true,
      data: fallbackResults,
      recoveryMethod: 'keyword_based_search',
      fallbackUsed: true,
      retryCount: context.attemptCount,
      timestamp: new Date()
    }
  }

  /**
   * Retrieve cached search results
   */
  private async retrieveCachedResults(context: PartialFailureContext): Promise<RecoveryResult<SearchResult[]>> {
    // Placeholder for cached results retrieval
    // In a real implementation, this would check a cache system
    
    throw new Error('No cached results available')
  }

  /**
   * Generate fallback knowledge
   */
  private async generateFallbackKnowledge(context: PartialFailureContext): Promise<RecoveryResult<SearchResult[]>> {
    const fallbackKnowledge: SearchResult[] = [{
      content: 'Guerreiro, mesmo sem acesso completo à base de conhecimento, posso te orientar com os princípios fundamentais: Purpose > Focus > Progress. Defina seu propósito, mantenha o foco e dê o próximo passo.',
      score: 0.8,
      metadata: {
        source: 'fallback_knowledge',
        section: 'core_principles'
      }
    }]

    return {
      success: true,
      data: fallbackKnowledge,
      recoveryMethod: 'fallback_knowledge',
      fallbackUsed: true,
      retryCount: context.attemptCount,
      timestamp: new Date()
    }
  }

  /**
   * Retry storage with exponential backoff
   */
  private async retryStorageWithBackoff(context: PartialFailureContext): Promise<RecoveryResult<any>> {
    const delay = Math.min(1000 * Math.pow(2, context.attemptCount - 1), 10000)
    
    await new Promise(resolve => setTimeout(resolve, delay))
    
    // Placeholder for actual storage retry logic
    throw new Error('Storage retry not implemented')
  }

  /**
   * Use alternative storage method
   */
  private async useAlternativeStorageMethod(context: PartialFailureContext): Promise<RecoveryResult<any>> {
    // Placeholder for alternative storage implementation
    throw new Error('Alternative storage not implemented')
  }

  /**
   * Graceful storage degradation
   */
  private async gracefulStorageDegradation(context: PartialFailureContext): Promise<RecoveryResult<any>> {
    // Continue without storage - graceful degradation
    return {
      success: true,
      data: { stored: false, message: 'Continuing without storage' },
      recoveryMethod: 'graceful_storage_degradation',
      fallbackUsed: true,
      retryCount: context.attemptCount,
      timestamp: new Date()
    }
  }

  /**
   * Helper methods
   */
  private simplifyUserMessage(message: string): string {
    // Remove complex punctuation and shorten message
    return message
      .replace(/[^\w\s\?\.!]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200)
  }

  private modifySearchQuery(query: string): string {
    // Extract key terms and create a simpler query
    const keywords = this.extractKeywords(query)
    return keywords.slice(0, 3).join(' ')
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['para', 'como', 'onde', 'quando', 'porque', 'qual'].includes(word))
      .slice(0, 5)
  }

  private hasCachedResults(query: string): boolean {
    // Placeholder for cache check
    return false
  }

  /**
   * Log recovery result for monitoring
   */
  private logRecoveryResult(
    operation: string,
    result: RecoveryResult<any>,
    context: PartialFailureContext
  ): void {
    this.recoveryHistory.push({
      operation,
      result,
      context
    })

    // Keep only last 100 recovery attempts
    if (this.recoveryHistory.length > 100) {
      this.recoveryHistory.shift()
    }

    // Log for monitoring
    console.log(`Recovery ${result.success ? 'succeeded' : 'failed'} for ${operation}:`, {
      method: result.recoveryMethod,
      fallbackUsed: result.fallbackUsed,
      retryCount: result.retryCount,
      duration: Date.now() - context.startTime.getTime()
    })
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalRecoveries: number
    successRate: number
    mostUsedMethods: Array<{ method: string; count: number }>
    recentFailures: Array<{ operation: string; error: string; timestamp: Date }>
  } {
    const totalRecoveries = this.recoveryHistory.length
    const successfulRecoveries = this.recoveryHistory.filter(r => r.result.success).length
    const successRate = totalRecoveries > 0 ? successfulRecoveries / totalRecoveries : 0

    // Count recovery methods
    const methodCounts = new Map<string, number>()
    this.recoveryHistory.forEach(r => {
      const method = r.result.recoveryMethod
      methodCounts.set(method, (methodCounts.get(method) || 0) + 1)
    })

    const mostUsedMethods = Array.from(methodCounts.entries())
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Recent failures
    const recentFailures = this.recoveryHistory
      .filter(r => !r.result.success)
      .slice(-10)
      .map(r => ({
        operation: r.operation,
        error: r.result.error?.message || 'Unknown error',
        timestamp: r.result.timestamp
      }))

    return {
      totalRecoveries,
      successRate,
      mostUsedMethods,
      recentFailures
    }
  }

  /**
   * Clear recovery history
   */
  clearHistory(): void {
    this.recoveryHistory = []
  }

  /**
   * Get active recoveries
   */
  getActiveRecoveries(): Array<{ id: string; context: PartialFailureContext }> {
    return Array.from(this.activeRecoveries.entries()).map(([id, context]) => ({
      id,
      context
    }))
  }
}

// Export singleton instance
export const recoveryMechanisms = new RecoveryMechanisms()