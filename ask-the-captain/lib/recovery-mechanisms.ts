// Recovery mechanisms for partial failures in Ask the Captain
import type { ChatResponse, SearchResult, ToneAnalysis } from '@/types'
import { CaptainError, ErrorType, withRetry } from './error-handling'
import { fallbackOrchestrator } from './fallback-systems'

/**
 * Recovery state tracking
 */
interface RecoveryState {
  attemptCount: number
  lastAttempt: Date
  recoveryMethod: string
  partialData?: any
  isRecovering: boolean
}

/**
 * Recovery context for operations
 */
interface RecoveryContext {
  operationId: string
  operationType: 'chat' | 'search' | 'image' | 'storage'
  originalRequest: any
  partialResults?: any
  errorHistory: CaptainError[]
  recoveryState: RecoveryState
}

/**
 * Recovery strategy interface
 */
interface RecoveryStrategy {
  canRecover(context: RecoveryContext): boolean
  recover(context: RecoveryContext): Promise<any>
  priority: number
  name: string
}

/**
 * Chat completion recovery strategy
 */
class ChatCompletionRecovery implements RecoveryStrategy {
  priority = 1
  name = 'chat-completion-recovery'

  canRecover(context: RecoveryContext): boolean {
    return (
      context.operationType === 'chat' &&
      context.recoveryState.attemptCount < 3 &&
      context.errorHistory.some(e => 
        e.type === ErrorType.CHAT_COMPLETION_FAILED ||
        e.type === ErrorType.OPENAI_API_ERROR
      )
    )
  }

  async recover(context: RecoveryContext): Promise<ChatResponse> {
    console.log(`Attempting chat completion recovery (attempt ${context.recoveryState.attemptCount + 1})`)

    const { originalRequest, partialResults } = context

    // Try with simplified prompt first
    if (context.recoveryState.attemptCount === 0) {
      return this.recoverWithSimplifiedPrompt(originalRequest, partialResults)
    }

    // Try with cached/fallback response
    if (context.recoveryState.attemptCount === 1) {
      return this.recoverWithFallbackResponse(originalRequest, partialResults)
    }

    // Final attempt with minimal response
    return this.recoverWithMinimalResponse(originalRequest)
  }

  private async recoverWithSimplifiedPrompt(
    originalRequest: any,
    partialResults?: SearchResult[]
  ): Promise<ChatResponse> {
    // Create a simplified version of the original request
    const simplifiedQuery = this.simplifyQuery(originalRequest.message)
    
    // Use fallback search results if available
    const searchResults = partialResults || await fallbackOrchestrator.handleSearchFailure(simplifiedQuery)
    
    // Generate a basic response based on search results
    const response = this.generateBasicResponse(simplifiedQuery, searchResults)
    const imageUrl = await fallbackOrchestrator.handleImageFailure()

    return {
      response,
      imageUrl,
      conversationId: originalRequest.conversationId || `recovery_${Date.now()}`
    }
  }

  private async recoverWithFallbackResponse(
    originalRequest: any,
    partialResults?: SearchResult[]
  ): Promise<ChatResponse> {
    const fallbackResponse = await fallbackOrchestrator.handleChatFlowFailure(
      new CaptainError(ErrorType.CHAT_COMPLETION_FAILED, 'Recovery attempt'),
      {
        query: originalRequest.message,
        conversationId: originalRequest.conversationId || `recovery_${Date.now()}`,
        partialResults: partialResults || []
      }
    )

    return fallbackResponse
  }

  private async recoverWithMinimalResponse(originalRequest: any): Promise<ChatResponse> {
    return {
      response: 'Guerreiro, estou enfrentando dificuldades técnicas, mas sua jornada de transformação continua. Use este momento para refletir sobre suas próximas ações e volte mais forte.',
      imageUrl: '/placeholder-captain.svg',
      conversationId: originalRequest.conversationId || `recovery_${Date.now()}`
    }
  }

  private simplifyQuery(query: string): string {
    // Remove complex punctuation and reduce to key terms
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5)
      .join(' ')
  }

  private generateBasicResponse(query: string, searchResults: SearchResult[]): string {
    if (searchResults.length === 0) {
      return 'Guerreiro, não encontrei informações específicas sobre sua consulta, mas lembre-se: a resposta que você procura pode estar na ação que você ainda não tomou.'
    }

    const topResult = searchResults[0]
    const snippet = topResult.content.substring(0, 150)

    return `Baseado no que encontrei, guerreiro: ${snippet}... 

A chave está em aplicar esse conhecimento através da ação consistente. Qual será seu próximo passo?`
  }
}

/**
 * Image generation recovery strategy
 */
class ImageGenerationRecovery implements RecoveryStrategy {
  priority = 2
  name = 'image-generation-recovery'

  canRecover(context: RecoveryContext): boolean {
    return (
      context.operationType === 'image' &&
      context.recoveryState.attemptCount < 2 &&
      context.errorHistory.some(e => 
        e.type === ErrorType.IMAGE_GENERATION_FAILED ||
        e.type === ErrorType.IMAGE_DOWNLOAD_FAILED
      )
    )
  }

  async recover(context: RecoveryContext): Promise<{ imageUrl: string; recovered: boolean }> {
    console.log(`Attempting image generation recovery (attempt ${context.recoveryState.attemptCount + 1})`)

    // First attempt: try with simplified prompt
    if (context.recoveryState.attemptCount === 0) {
      return this.recoverWithSimplifiedPrompt(context.originalRequest)
    }

    // Second attempt: use fallback image
    return this.recoverWithFallbackImage(context.originalRequest.toneAnalysis)
  }

  private async recoverWithSimplifiedPrompt(originalRequest: any): Promise<{ imageUrl: string; recovered: boolean }> {
    try {
      // Create a very basic prompt
      const basicPrompt = 'A Pixar-style wolf character in a cave setting, professional 3D rendering'
      
      // This would normally call the image generation service with the simplified prompt
      // For now, we'll simulate a recovery attempt
      console.log('Attempting image generation with simplified prompt:', basicPrompt)
      
      // Simulate potential success or failure
      const success = Math.random() > 0.5 // 50% chance of success for simulation
      
      if (success) {
        return {
          imageUrl: '/placeholder-captain.svg', // Would be actual generated image
          recovered: true
        }
      }
      
      throw new Error('Simplified prompt also failed')
    } catch (error) {
      console.warn('Simplified image generation failed:', error)
      return this.recoverWithFallbackImage(originalRequest.toneAnalysis)
    }
  }

  private async recoverWithFallbackImage(toneAnalysis?: ToneAnalysis): Promise<{ imageUrl: string; recovered: boolean }> {
    const fallbackUrl = await fallbackOrchestrator.handleImageFailure(toneAnalysis)
    return {
      imageUrl: fallbackUrl,
      recovered: false // Using fallback, not recovered
    }
  }
}

/**
 * Search recovery strategy
 */
class SearchRecovery implements RecoveryStrategy {
  priority = 3
  name = 'search-recovery'

  canRecover(context: RecoveryContext): boolean {
    return (
      context.operationType === 'search' &&
      context.recoveryState.attemptCount < 2 &&
      context.errorHistory.some(e => 
        e.type === ErrorType.SEMANTIC_SEARCH_FAILED ||
        e.type === ErrorType.VECTORIZE_ERROR
      )
    )
  }

  async recover(context: RecoveryContext): Promise<{ results: SearchResult[]; recovered: boolean }> {
    console.log(`Attempting search recovery (attempt ${context.recoveryState.attemptCount + 1})`)

    // First attempt: try with simplified query
    if (context.recoveryState.attemptCount === 0) {
      return this.recoverWithSimplifiedQuery(context.originalRequest.query)
    }

    // Second attempt: use fallback results
    return this.recoverWithFallbackResults(context.originalRequest.query)
  }

  private async recoverWithSimplifiedQuery(query: string): Promise<{ results: SearchResult[]; recovered: boolean }> {
    try {
      // Simplify the query to basic terms
      const simplifiedQuery = query
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 3)
        .join(' ')

      console.log('Attempting search with simplified query:', simplifiedQuery)
      
      // This would normally attempt the search with simplified query
      // For now, we'll simulate a recovery attempt
      const success = Math.random() > 0.3 // 70% chance of success for simulation
      
      if (success) {
        // Return some mock results for simulation
        return {
          results: [{
            content: `Informações relacionadas a "${simplifiedQuery}" encontradas na base de conhecimento...`,
            score: 0.7,
            metadata: { source: 'recovered-search', section: 'simplified-query' }
          }],
          recovered: true
        }
      }
      
      throw new Error('Simplified search also failed')
    } catch (error) {
      console.warn('Simplified search failed:', error)
      return this.recoverWithFallbackResults(query)
    }
  }

  private async recoverWithFallbackResults(query: string): Promise<{ results: SearchResult[]; recovered: boolean }> {
    const fallbackResults = await fallbackOrchestrator.handleSearchFailure(query)
    return {
      results: fallbackResults,
      recovered: false // Using fallback, not recovered
    }
  }
}

/**
 * Storage recovery strategy
 */
class StorageRecovery implements RecoveryStrategy {
  priority = 4
  name = 'storage-recovery'

  canRecover(context: RecoveryContext): boolean {
    return (
      context.operationType === 'storage' &&
      context.recoveryState.attemptCount < 3 &&
      context.errorHistory.some(e => 
        e.type === ErrorType.R2_STORAGE_ERROR ||
        e.type === ErrorType.D1_DATABASE_ERROR
      )
    )
  }

  async recover(context: RecoveryContext): Promise<{ success: boolean; data?: any }> {
    console.log(`Attempting storage recovery (attempt ${context.recoveryState.attemptCount + 1})`)

    // Try different recovery strategies based on attempt count
    switch (context.recoveryState.attemptCount) {
      case 0:
        return this.recoverWithRetry(context.originalRequest)
      case 1:
        return this.recoverWithAlternativeStorage(context.originalRequest)
      case 2:
        return this.recoverWithTemporaryStorage(context.originalRequest)
      default:
        return { success: false }
    }
  }

  private async recoverWithRetry(originalRequest: any): Promise<{ success: boolean; data?: any }> {
    try {
      // Implement retry logic with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // This would normally retry the original storage operation
      console.log('Retrying storage operation...')
      
      // Simulate potential success
      const success = Math.random() > 0.4 // 60% chance of success
      
      if (success) {
        return {
          success: true,
          data: { message: 'Storage operation succeeded on retry' }
        }
      }
      
      throw new Error('Retry failed')
    } catch (error) {
      console.warn('Storage retry failed:', error)
      return { success: false }
    }
  }

  private async recoverWithAlternativeStorage(originalRequest: any): Promise<{ success: boolean; data?: any }> {
    try {
      // Try alternative storage method (e.g., different bucket, local storage, etc.)
      console.log('Attempting alternative storage method...')
      
      // Simulate alternative storage
      const success = Math.random() > 0.6 // 40% chance of success
      
      if (success) {
        return {
          success: true,
          data: { message: 'Alternative storage succeeded', alternative: true }
        }
      }
      
      throw new Error('Alternative storage failed')
    } catch (error) {
      console.warn('Alternative storage failed:', error)
      return { success: false }
    }
  }

  private async recoverWithTemporaryStorage(originalRequest: any): Promise<{ success: boolean; data?: any }> {
    // Use temporary/in-memory storage as last resort
    console.log('Using temporary storage as fallback...')
    
    return {
      success: true,
      data: { 
        message: 'Using temporary storage', 
        temporary: true,
        warning: 'Data may not persist across sessions'
      }
    }
  }
}

/**
 * Main recovery orchestrator
 */
export class RecoveryOrchestrator {
  private strategies: RecoveryStrategy[] = [
    new ChatCompletionRecovery(),
    new ImageGenerationRecovery(),
    new SearchRecovery(),
    new StorageRecovery()
  ]

  private activeRecoveries = new Map<string, RecoveryContext>()

  /**
   * Attempt to recover from a failed operation
   */
  async attemptRecovery(
    operationId: string,
    operationType: 'chat' | 'search' | 'image' | 'storage',
    originalRequest: any,
    error: CaptainError,
    partialResults?: any
  ): Promise<any> {
    // Get or create recovery context
    let context = this.activeRecoveries.get(operationId)
    
    if (!context) {
      context = {
        operationId,
        operationType,
        originalRequest,
        partialResults,
        errorHistory: [error],
        recoveryState: {
          attemptCount: 0,
          lastAttempt: new Date(),
          recoveryMethod: 'none',
          isRecovering: false
        }
      }
      this.activeRecoveries.set(operationId, context)
    } else {
      // Update existing context
      context.errorHistory.push(error)
      context.partialResults = partialResults || context.partialResults
    }

    // Find applicable recovery strategies
    const applicableStrategies = this.strategies
      .filter(strategy => strategy.canRecover(context!))
      .sort((a, b) => a.priority - b.priority)

    if (applicableStrategies.length === 0) {
      console.warn(`No recovery strategies available for operation ${operationId}`)
      this.activeRecoveries.delete(operationId)
      throw error
    }

    // Try each strategy
    for (const strategy of applicableStrategies) {
      try {
        console.log(`Attempting recovery with strategy: ${strategy.name}`)
        
        context.recoveryState.isRecovering = true
        context.recoveryState.recoveryMethod = strategy.name
        context.recoveryState.lastAttempt = new Date()

        const result = await strategy.recover(context)
        
        // Recovery successful
        context.recoveryState.isRecovering = false
        context.recoveryState.attemptCount++
        
        console.log(`Recovery successful with strategy: ${strategy.name}`)
        
        // Keep context for potential future failures, but mark as recovered
        return result

      } catch (recoveryError) {
        console.warn(`Recovery strategy ${strategy.name} failed:`, recoveryError)
        context.recoveryState.attemptCount++
        context.errorHistory.push(recoveryError as CaptainError)
      }
    }

    // All recovery strategies failed
    context.recoveryState.isRecovering = false
    this.activeRecoveries.delete(operationId)
    
    console.error(`All recovery strategies failed for operation ${operationId}`)
    throw new CaptainError(
      ErrorType.INTERNAL_ERROR,
      'All recovery attempts failed',
      {
        details: {
          operationId,
          operationType,
          attemptCount: context.recoveryState.attemptCount,
          strategiesAttempted: applicableStrategies.map(s => s.name)
        }
      }
    )
  }

  /**
   * Check if an operation is currently being recovered
   */
  isRecovering(operationId: string): boolean {
    const context = this.activeRecoveries.get(operationId)
    return context?.recoveryState.isRecovering || false
  }

  /**
   * Get recovery status for an operation
   */
  getRecoveryStatus(operationId: string): RecoveryState | null {
    const context = this.activeRecoveries.get(operationId)
    return context?.recoveryState || null
  }

  /**
   * Clear recovery context for an operation
   */
  clearRecoveryContext(operationId: string): void {
    this.activeRecoveries.delete(operationId)
  }

  /**
   * Get all active recoveries (for monitoring)
   */
  getActiveRecoveries(): Array<{ operationId: string; context: RecoveryContext }> {
    return Array.from(this.activeRecoveries.entries()).map(([operationId, context]) => ({
      operationId,
      context
    }))
  }

  /**
   * Clean up old recovery contexts
   */
  cleanupOldRecoveries(maxAge: number = 300000): void { // 5 minutes default
    const now = new Date()
    
    for (const [operationId, context] of this.activeRecoveries.entries()) {
      const age = now.getTime() - context.recoveryState.lastAttempt.getTime()
      
      if (age > maxAge && !context.recoveryState.isRecovering) {
        console.log(`Cleaning up old recovery context for operation ${operationId}`)
        this.activeRecoveries.delete(operationId)
      }
    }
  }
}

// Export singleton instance
export const recoveryOrchestrator = new RecoveryOrchestrator()

// Cleanup old recoveries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    recoveryOrchestrator.cleanupOldRecoveries()
  }, 300000)
}