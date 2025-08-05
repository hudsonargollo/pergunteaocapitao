// Fallback systems for Ask the Captain
import type { ChatResponse, SearchResult, ToneAnalysis } from '@/types'
import { CaptainError, ErrorType, ErrorSeverity } from './error-handling'

/**
 * Fallback response generator for search failures
 */
export class SearchFallbackService {
  private readonly fallbackResponses: Record<string, SearchResult[]> = {
    // General motivation and discipline
    motivation: [{
      content: 'Guerreiro, a verdadeira transformação não vem de respostas externas, mas da sua capacidade de agir mesmo na incerteza. O Cave Mode ensina que Purpose > Focus > Progress. Defina seu propósito agora, foque no que pode controlar, e dê o próximo passo.',
      score: 0.8,
      metadata: {
        source: 'fallback_motivation',
        section: 'core_principles'
      }
    }],

    // Discipline and action
    discipline: [{
      content: 'A disciplina é a ponte entre objetivos e conquistas. No Cave Mode, não esperamos motivação - criamos disciplina através da ação consistente. Comece pequeno, seja consistente, e construa momentum. Cada ação disciplinada fortalece o guerreiro interior.',
      score: 0.8,
      metadata: {
        source: 'fallback_discipline',
        section: 'action_principles'
      }
    }],

    // Focus and concentration
    focus: [{
      content: 'O foco é sua arma mais poderosa contra a mediocridade. Elimine distrações, defina prioridades claras, e proteja seu tempo como um recurso sagrado. Um guerreiro focado vale por mil dispersos.',
      score: 0.8,
      metadata: {
        source: 'fallback_focus',
        section: 'concentration_mastery'
      }
    }],

    // Progress and growth
    progress: [{
      content: 'O progresso não é sobre perfeição, é sobre consistência. Cada dia que você escolhe a ação sobre a procrastinação, você está vencendo. Meça seu progresso em ações tomadas, não em resultados alcançados.',
      score: 0.8,
      metadata: {
        source: 'fallback_progress',
        section: 'growth_mindset'
      }
    }],

    // Overcoming obstacles
    obstacles: [{
      content: 'Obstáculos não são impedimentos - são oportunidades disfarçadas para fortalecer sua determinação. O Cave Mode ensina que cada desafio é um teste da sua resolução. Encare-os de frente e cresça através deles.',
      score: 0.8,
      metadata: {
        source: 'fallback_obstacles',
        section: 'resilience_building'
      }
    }],

    // Default fallback
    default: [{
      content: 'Guerreiro, mesmo quando as respostas não estão claras, sua capacidade de ação permanece intacta. Use este momento para refletir sobre seus objetivos, reorganizar suas prioridades, e dar o próximo passo com determinação. A caverna ensina que a força vem de dentro.',
      score: 0.7,
      metadata: {
        source: 'fallback_default',
        section: 'general_guidance'
      }
    }]
  }

  /**
   * Generate fallback search results based on query analysis
   */
  generateFallbackResults(query: string): SearchResult[] {
    const normalizedQuery = query.toLowerCase()
    
    // Analyze query for key themes
    if (this.containsKeywords(normalizedQuery, ['motivação', 'motivation', 'inspiração', 'energia'])) {
      return this.fallbackResponses.motivation
    }
    
    if (this.containsKeywords(normalizedQuery, ['disciplina', 'discipline', 'hábito', 'rotina', 'consistência'])) {
      return this.fallbackResponses.discipline
    }
    
    if (this.containsKeywords(normalizedQuery, ['foco', 'focus', 'concentração', 'atenção', 'distração'])) {
      return this.fallbackResponses.focus
    }
    
    if (this.containsKeywords(normalizedQuery, ['progresso', 'progress', 'crescimento', 'evolução', 'melhoria'])) {
      return this.fallbackResponses.progress
    }
    
    if (this.containsKeywords(normalizedQuery, ['obstáculo', 'problema', 'dificuldade', 'desafio', 'barreira'])) {
      return this.fallbackResponses.obstacles
    }

    // Return default fallback
    return this.fallbackResponses.default
  }

  private containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword))
  }

  /**
   * Create fallback search context
   */
  createFallbackSearchContext(query: string): {
    results: SearchResult[]
    fallbackUsed: boolean
    searchTime: number
  } {
    const startTime = Date.now()
    const results = this.generateFallbackResults(query)
    
    return {
      results,
      fallbackUsed: true,
      searchTime: Date.now() - startTime
    }
  }
}

/**
 * Default image system for generation failures
 */
export class ImageFallbackService {
  private readonly defaultImages: Record<string, string> = {
    // Default captain images for different tones
    supportive: '/placeholder-captain.svg',
    challenging: '/placeholder-captain.svg',
    instructional: '/placeholder-captain.svg',
    motivational: '/placeholder-captain.svg',
    default: '/placeholder-captain.svg',
    
    // Loading states
    loading: '/placeholder-captain-response.svg',
    error: '/placeholder-captain.svg'
  }

  /**
   * Get fallback image URL based on tone analysis
   */
  getFallbackImageUrl(toneAnalysis?: ToneAnalysis): string {
    if (!toneAnalysis) {
      return this.defaultImages.default
    }

    return this.defaultImages[toneAnalysis.primary] || this.defaultImages.default
  }

  /**
   * Get loading image URL
   */
  getLoadingImageUrl(): string {
    return this.defaultImages.loading
  }

  /**
   * Get error image URL
   */
  getErrorImageUrl(): string {
    return this.defaultImages.error
  }

  /**
   * Check if image URL is available
   */
  async validateImageUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get fallback image with validation
   */
  async getFallbackImageWithValidation(toneAnalysis?: ToneAnalysis): Promise<string> {
    const fallbackUrl = this.getFallbackImageUrl(toneAnalysis)
    
    const isValid = await this.validateImageUrl(fallbackUrl)
    if (isValid) {
      return fallbackUrl
    }

    // Return absolute fallback if validation fails
    return this.defaultImages.default
  }
}

/**
 * Response fallback service for chat completion failures
 */
export class ResponseFallbackService {
  private readonly fallbackResponses: Record<string, string> = {
    // System unavailable
    system_unavailable: 'Guerreiro, estou enfrentando dificuldades técnicas no momento. Mas lembre-se: os obstáculos são oportunidades disfarçadas. Use este tempo para refletir sobre suas próximas ações e volte mais forte.',
    
    // Rate limit exceeded
    rate_limit: 'Muitas consultas, guerreiro. A paciência é uma virtude fundamental no Cave Mode. Use este momento para processar o que já aprendeu e planejar suas próximas ações.',
    
    // Context processing failed
    context_failed: 'Não consegui processar completamente sua consulta, mas posso te dizer isto: a verdadeira transformação vem da ação, não das respostas perfeitas. Foque no que pode fazer agora.',
    
    // Search failed
    search_failed: 'O sistema de busca está temporariamente indisponível, guerreiro, mas a sabedoria que você precisa já está dentro de você. Confie na sua capacidade de tomar decisões e agir.',
    
    // General error
    general_error: 'Guerreiro, encontrei um obstáculo técnico. Mas lembre-se: no Cave Mode, não deixamos que circunstâncias externas determinem nosso progresso. Continue focado em suas ações.',
    
    // Default fallback
    default: 'Guerreiro, estou enfrentando dificuldades no momento. Mas a força do Cave Mode não depende de sistemas externos - ela vem da sua determinação interior. Continue sua jornada.'
  }

  /**
   * Generate fallback response based on error type
   */
  generateFallbackResponse(errorType: ErrorType, context?: string): string {
    switch (errorType) {
      case ErrorType.SERVICE_UNAVAILABLE:
      case ErrorType.INTERNAL_ERROR:
        return this.fallbackResponses.system_unavailable

      case ErrorType.RATE_LIMIT_EXCEEDED:
      case ErrorType.OPENAI_RATE_LIMIT:
        return this.fallbackResponses.rate_limit

      case ErrorType.CONTEXT_PROCESSING_FAILED:
        return this.fallbackResponses.context_failed

      case ErrorType.SEMANTIC_SEARCH_FAILED:
      case ErrorType.KNOWLEDGE_BASE_UNAVAILABLE:
        return this.fallbackResponses.search_failed

      case ErrorType.CHAT_COMPLETION_FAILED:
      case ErrorType.OPENAI_API_ERROR:
        return this.fallbackResponses.general_error

      default:
        return this.fallbackResponses.default
    }
  }

  /**
   * Create complete fallback chat response
   */
  createFallbackChatResponse(
    errorType: ErrorType,
    conversationId: string,
    toneAnalysis?: ToneAnalysis
  ): ChatResponse {
    const imageFallback = new ImageFallbackService()
    
    return {
      response: this.generateFallbackResponse(errorType),
      imageUrl: imageFallback.getFallbackImageUrl(toneAnalysis),
      conversationId
    }
  }
}

/**
 * Offline-capable error states
 */
export class OfflineStateService {
  private readonly offlineMessages = {
    connection_lost: 'Conexão perdida, guerreiro. Mas a disciplina não depende de conectividade. Continue trabalhando em seus objetivos offline.',
    service_down: 'Serviços temporariamente indisponíveis. Use este tempo para reflexão e planejamento estratégico.',
    maintenance: 'Sistema em manutenção. A manutenção é essencial - tanto para sistemas quanto para guerreiros.',
    timeout: 'Operação demorou mais que o esperado. A paciência é uma virtude do Cave Mode.'
  }

  /**
   * Check if we're in offline state
   */
  isOffline(): boolean {
    // In Cloudflare Workers, we don't have navigator.onLine
    // This would be implemented based on service availability checks
    return false
  }

  /**
   * Get offline state message
   */
  getOfflineMessage(reason: 'connection_lost' | 'service_down' | 'maintenance' | 'timeout' = 'connection_lost'): string {
    return this.offlineMessages[reason]
  }

  /**
   * Create offline error response
   */
  createOfflineResponse(reason: 'connection_lost' | 'service_down' | 'maintenance' | 'timeout' = 'connection_lost'): {
    error: {
      code: string
      message: string
      timestamp: string
    }
    fallback: {
      response: string
      imageUrl: string
    }
  } {
    const imageFallback = new ImageFallbackService()
    
    return {
      error: {
        code: 'OFFLINE_STATE',
        message: 'System temporarily offline',
        timestamp: new Date().toISOString()
      },
      fallback: {
        response: this.getOfflineMessage(reason),
        imageUrl: imageFallback.getErrorImageUrl()
      }
    }
  }
}

/**
 * Recovery mechanisms for partial failures
 */
export class PartialFailureRecoveryService {
  /**
   * Handle partial chat completion failure
   */
  async recoverFromPartialChatFailure(
    originalQuery: string,
    partialResponse?: string,
    searchResults?: SearchResult[]
  ): Promise<{
    response: string
    recovered: boolean
    recoveryMethod: string
  }> {
    // If we have partial response, try to complete it
    if (partialResponse && partialResponse.trim().length > 20) {
      const completedResponse = this.completePartialResponse(partialResponse)
      return {
        response: completedResponse,
        recovered: true,
        recoveryMethod: 'partial_completion'
      }
    }

    // If we have search results but no response, create response from context
    if (searchResults && searchResults.length > 0) {
      const contextResponse = this.createResponseFromContext(originalQuery, searchResults)
      return {
        response: contextResponse,
        recovered: true,
        recoveryMethod: 'context_based'
      }
    }

    // Fall back to general guidance
    const fallbackService = new ResponseFallbackService()
    return {
      response: fallbackService.generateFallbackResponse(ErrorType.CHAT_COMPLETION_FAILED),
      recovered: false,
      recoveryMethod: 'fallback'
    }
  }

  /**
   * Complete partial response with appropriate ending
   */
  private completePartialResponse(partialResponse: string): string {
    // Check if response ends mid-sentence
    const lastChar = partialResponse.trim().slice(-1)
    
    if (!['.', '!', '?'].includes(lastChar)) {
      // Add appropriate completion based on context
      if (partialResponse.toLowerCase().includes('lembre-se')) {
        return partialResponse + ' - a ação é sempre o próximo passo.'
      }
      
      if (partialResponse.toLowerCase().includes('guerreiro')) {
        return partialResponse + ' Continue firme na sua jornada.'
      }
      
      // Generic completion
      return partialResponse + ' Mantenha o foco e continue avançando.'
    }

    return partialResponse
  }

  /**
   * Create response from search context when chat completion fails
   */
  private createResponseFromContext(query: string, searchResults: SearchResult[]): string {
    const topResult = searchResults[0]
    
    if (!topResult) {
      return 'Guerreiro, não encontrei informações específicas sobre sua consulta, mas lembre-se: a resposta que você procura pode estar na ação que você ainda não tomou.'
    }

    // Create a contextual response based on the search result
    const contextSnippet = topResult.content.substring(0, 200)
    
    return `Baseado no que encontrei sobre sua consulta, guerreiro: ${contextSnippet}... 

A chave está em aplicar esse conhecimento através da ação consistente. Qual será seu próximo passo?`
  }

  /**
   * Handle partial image generation failure
   */
  async recoverFromPartialImageFailure(
    toneAnalysis?: ToneAnalysis,
    fallbackToDefault: boolean = true
  ): Promise<{
    imageUrl: string
    recovered: boolean
    recoveryMethod: string
  }> {
    const imageFallback = new ImageFallbackService()

    if (fallbackToDefault) {
      return {
        imageUrl: imageFallback.getFallbackImageUrl(toneAnalysis),
        recovered: true,
        recoveryMethod: 'default_image'
      }
    }

    return {
      imageUrl: '',
      recovered: false,
      recoveryMethod: 'no_image'
    }
  }

  /**
   * Handle partial search failure
   */
  async recoverFromPartialSearchFailure(
    query: string,
    partialResults?: SearchResult[]
  ): Promise<{
    results: SearchResult[]
    recovered: boolean
    recoveryMethod: string
  }> {
    // If we have some results, use them
    if (partialResults && partialResults.length > 0) {
      return {
        results: partialResults,
        recovered: true,
        recoveryMethod: 'partial_results'
      }
    }

    // Fall back to generated results
    const searchFallback = new SearchFallbackService()
    const fallbackResults = searchFallback.generateFallbackResults(query)

    return {
      results: fallbackResults,
      recovered: true,
      recoveryMethod: 'fallback_generation'
    }
  }
}

/**
 * Comprehensive fallback orchestrator
 */
export class FallbackOrchestrator {
  private searchFallback = new SearchFallbackService()
  private imageFallback = new ImageFallbackService()
  private responseFallback = new ResponseFallbackService()
  private offlineState = new OfflineStateService()
  private partialRecovery = new PartialFailureRecoveryService()

  /**
   * Handle complete chat flow failure with comprehensive fallback
   */
  async handleChatFlowFailure(
    error: CaptainError,
    context: {
      query: string
      conversationId: string
      partialResponse?: string
      partialResults?: SearchResult[]
      toneAnalysis?: ToneAnalysis
    }
  ): Promise<ChatResponse> {
    console.warn('Handling chat flow failure with fallback:', error.type)

    // Check if we're in offline state
    if (this.offlineState.isOffline()) {
      const offlineResponse = this.offlineState.createOfflineResponse()
      return {
        response: offlineResponse.fallback.response,
        imageUrl: offlineResponse.fallback.imageUrl,
        conversationId: context.conversationId
      }
    }

    // Try partial recovery first
    const responseRecovery = await this.partialRecovery.recoverFromPartialChatFailure(
      context.query,
      context.partialResponse,
      context.partialResults
    )

    const imageRecovery = await this.partialRecovery.recoverFromPartialImageFailure(
      context.toneAnalysis,
      true
    )

    return {
      response: responseRecovery.response,
      imageUrl: imageRecovery.imageUrl,
      conversationId: context.conversationId
    }
  }

  /**
   * Handle search failure with fallback
   */
  async handleSearchFailure(query: string): Promise<SearchResult[]> {
    console.warn('Handling search failure with fallback')
    return this.searchFallback.generateFallbackResults(query)
  }

  /**
   * Handle image generation failure with fallback
   */
  async handleImageFailure(toneAnalysis?: ToneAnalysis): Promise<string> {
    console.warn('Handling image generation failure with fallback')
    return this.imageFallback.getFallbackImageUrl(toneAnalysis)
  }

  /**
   * Get system health status
   */
  getSystemHealthStatus(): {
    search: 'available' | 'degraded' | 'unavailable'
    chat: 'available' | 'degraded' | 'unavailable'
    images: 'available' | 'degraded' | 'unavailable'
    overall: 'healthy' | 'degraded' | 'critical'
  } {
    // This would be implemented with actual health checks
    // For now, return a default healthy state
    return {
      search: 'available',
      chat: 'available',
      images: 'available',
      overall: 'healthy'
    }
  }
}

// Export singleton instance
export const fallbackOrchestrator = new FallbackOrchestrator()