// Comprehensive fallback system for all contexts
import type { ResponseContext } from '@/types'
import { ErrorType, CaptainError } from './error-handling'
import { captainErrorMessaging } from './captain-error-messaging'
import { networkConnectivity, ConnectivityState } from './network-connectivity'

/**
 * Fallback image context types
 */
export type FallbackContext = 
  | 'supportive' 
  | 'challenging' 
  | 'instructional' 
  | 'motivational' 
  | 'error' 
  | 'loading' 
  | 'offline' 
  | 'default'

/**
 * Fallback image asset definition
 */
interface FallbackImageAsset {
  url: string
  alt: string
  description: string
  context: FallbackContext[]
  priority: number // Higher priority = preferred choice
  availability: 'always' | 'online_only' | 'offline_only'
}

/**
 * Recovery mechanism definition
 */
interface RecoveryMechanism {
  type: 'retry' | 'fallback' | 'graceful_degradation' | 'user_intervention'
  maxAttempts: number
  delayMs: number
  backoffMultiplier: number
  condition: (error: CaptainError, attempt: number) => boolean
  execute: (context: any) => Promise<any>
}

/**
 * System health status
 */
interface SystemHealth {
  chat: 'healthy' | 'degraded' | 'critical' | 'offline'
  images: 'healthy' | 'degraded' | 'critical' | 'offline'
  search: 'healthy' | 'degraded' | 'critical' | 'offline'
  storage: 'healthy' | 'degraded' | 'critical' | 'offline'
  overall: 'healthy' | 'degraded' | 'critical' | 'offline'
  lastChecked: Date
}

/**
 * Comprehensive fallback system manager
 */
export class ComprehensiveFallbackSystem {
  private fallbackImages: FallbackImageAsset[] = [
    // High-priority contextual images
    {
      url: '/reference1-capitao-caverna-front-20250422_0526_3D Cartoon Figure_remix_01jse9j3vrfkmasmwvaw81ps2f.webp',
      alt: 'Capitão Caverna - Pose frontal determinada',
      description: 'Imagem frontal do Capitão Caverna com expressão determinada e confiante',
      context: ['supportive', 'motivational', 'default'],
      priority: 10,
      availability: 'always'
    },
    {
      url: '/reference2-capitao-caverna-rightside-20250729_0403_Cartoon Wolf Character_remix_01k1afs0z4e86rk4s6ane7fa4q.webp',
      alt: 'Capitão Caverna - Perfil direito focado',
      description: 'Perfil direito do Capitão Caverna demonstrando foco e concentração',
      context: ['challenging', 'instructional'],
      priority: 9,
      availability: 'always'
    },
    {
      url: '/reference5-capitao-caverna-smiling-holding-smartphone-20250422_0549_3D-Character-Studio-Portrait_remix_01jseaxfmzf0r96grrp29y0hdn.webp',
      alt: 'Capitão Caverna - Sorrindo com smartphone',
      description: 'Capitão Caverna sorrindo e segurando smartphone, demonstrando acessibilidade',
      context: ['supportive', 'instructional'],
      priority: 8,
      availability: 'online_only'
    },
    {
      url: '/reference6-capitao-caverna-winking-smiling-giving-thumbsup-20250422_0558_3D Wolf Character_remix_01jsebd7w4fertysatahzvgvx3.webp',
      alt: 'Capitão Caverna - Piscando e fazendo sinal positivo',
      description: 'Capitão Caverna piscando e fazendo thumbs up, expressando aprovação',
      context: ['supportive', 'motivational'],
      priority: 8,
      availability: 'online_only'
    },
    
    // Medium-priority generic images
    {
      url: '/placeholder-captain.svg',
      alt: 'Capitão Caverna - Imagem padrão',
      description: 'Imagem padrão do Capitão Caverna para uso geral',
      context: ['default', 'error', 'loading'],
      priority: 5,
      availability: 'always'
    },
    {
      url: '/placeholder-captain-response.svg',
      alt: 'Capitão Caverna - Respondendo',
      description: 'Capitão Caverna em pose de resposta ou carregamento',
      context: ['loading', 'default'],
      priority: 4,
      availability: 'always'
    },
    
    // Low-priority emergency fallbacks
    {
      url: '/cave-icon.svg',
      alt: 'Ícone da Caverna',
      description: 'Ícone representativo da caverna como fallback de emergência',
      context: ['offline', 'error'],
      priority: 2,
      availability: 'always'
    },
    {
      url: '/modo-caverna-logo.svg',
      alt: 'Logo Modo Caverna',
      description: 'Logo do Modo Caverna como fallback final',
      context: ['offline', 'error', 'default'],
      priority: 1,
      availability: 'always'
    }
  ]

  private recoveryMechanisms: Map<ErrorType, RecoveryMechanism> = new Map()
  private systemHealth: SystemHealth = {
    chat: 'healthy',
    images: 'healthy',
    search: 'healthy',
    storage: 'healthy',
    overall: 'healthy',
    lastChecked: new Date()
  }

  private imageValidationCache = new Map<string, { isValid: boolean; lastChecked: Date }>()
  private fallbackUsageStats = new Map<string, { count: number; lastUsed: Date }>()

  constructor() {
    this.initializeRecoveryMechanisms()
    this.startHealthMonitoring()
  }

  /**
   * Initialize recovery mechanisms for different error types
   */
  private initializeRecoveryMechanisms(): void {
    // Chat API recovery
    this.recoveryMechanisms.set(ErrorType.CHAT_COMPLETION_FAILED, {
      type: 'retry',
      maxAttempts: 3,
      delayMs: 1000,
      backoffMultiplier: 2,
      condition: (error, attempt) => attempt < 3 && error.retryable,
      execute: async (context) => {
        // Implement chat API retry logic
        return await this.retryChatAPI(context)
      }
    })

    // Image generation recovery
    this.recoveryMechanisms.set(ErrorType.IMAGE_GENERATION_FAILED, {
      type: 'fallback',
      maxAttempts: 1,
      delayMs: 0,
      backoffMultiplier: 1,
      condition: () => true,
      execute: async (context) => {
        return await this.getFallbackImage(context.responseContext)
      }
    })

    // Search failure recovery
    this.recoveryMechanisms.set(ErrorType.SEMANTIC_SEARCH_FAILED, {
      type: 'graceful_degradation',
      maxAttempts: 2,
      delayMs: 500,
      backoffMultiplier: 1.5,
      condition: (error, attempt) => attempt < 2,
      execute: async (context) => {
        return await this.generateFallbackSearchResults(context.query)
      }
    })

    // Network connectivity recovery
    this.recoveryMechanisms.set(ErrorType.SERVICE_UNAVAILABLE, {
      type: 'retry',
      maxAttempts: 5,
      delayMs: 2000,
      backoffMultiplier: 1.5,
      condition: (error, attempt) => {
        const connectivity = networkConnectivity.getCurrentState()
        return attempt < 5 && connectivity !== ConnectivityState.OFFLINE
      },
      execute: async (context) => {
        // Wait for connectivity to improve
        await this.waitForConnectivity()
        return context.originalOperation()
      }
    })
  }

  /**
   * Get fallback image based on context and system state
   */
  async getFallbackImage(
    context?: ResponseContext | FallbackContext,
    options: {
      preferHighQuality?: boolean
      allowOfflineOnly?: boolean
      maxAttempts?: number
    } = {}
  ): Promise<{
    url: string
    alt: string
    description: string
    source: 'primary' | 'fallback' | 'emergency'
    usedFallback: boolean
  }> {
    const {
      preferHighQuality = true,
      allowOfflineOnly = false,
      maxAttempts = 3
    } = options

    // Determine context type
    let contextType: FallbackContext
    if (typeof context === 'string') {
      contextType = context
    } else if (context?.tone) {
      contextType = this.mapToneToContext(context.tone)
    } else {
      contextType = 'default'
    }

    // Get connectivity state
    const isOnline = networkConnectivity.isOnline()
    const connectivityState = networkConnectivity.getCurrentState()

    // Filter available images based on context and connectivity
    let availableImages = this.fallbackImages.filter(image => {
      // Check context match
      if (!image.context.includes(contextType) && !image.context.includes('default')) {
        return false
      }

      // Check availability based on connectivity
      if (!isOnline && image.availability === 'online_only') {
        return false
      }
      if (isOnline && !allowOfflineOnly && image.availability === 'offline_only') {
        return false
      }

      return true
    })

    // Sort by priority (highest first)
    availableImages.sort((a, b) => b.priority - a.priority)

    // If we prefer high quality, try high-priority images first
    if (preferHighQuality) {
      availableImages = availableImages.filter(img => img.priority >= 7)
        .concat(availableImages.filter(img => img.priority < 7))
    }

    // Try each image until we find one that works
    for (let attempt = 0; attempt < maxAttempts && attempt < availableImages.length; attempt++) {
      const image = availableImages[attempt]
      
      try {
        const isValid = await this.validateImageUrl(image.url)
        
        if (isValid) {
          // Update usage stats
          this.updateFallbackUsageStats(image.url)
          
          return {
            url: image.url,
            alt: image.alt,
            description: image.description,
            source: image.priority >= 8 ? 'primary' : image.priority >= 5 ? 'fallback' : 'emergency',
            usedFallback: image.priority < 8
          }
        }
      } catch (error) {
        console.warn(`Failed to validate fallback image ${image.url}:`, error)
        continue
      }
    }

    // If all else fails, return the lowest priority emergency fallback
    const emergencyFallback = this.fallbackImages
      .filter(img => img.availability === 'always')
      .sort((a, b) => a.priority - b.priority)[0]

    if (emergencyFallback) {
      this.updateFallbackUsageStats(emergencyFallback.url)
      
      return {
        url: emergencyFallback.url,
        alt: emergencyFallback.alt,
        description: emergencyFallback.description,
        source: 'emergency',
        usedFallback: true
      }
    }

    // Absolute last resort - return a data URL or empty string
    return {
      url: '',
      alt: 'Capitão Caverna',
      description: 'Imagem do Capitão Caverna não disponível',
      source: 'emergency',
      usedFallback: true
    }
  }

  /**
   * Map response tone to fallback context
   */
  private mapToneToContext(tone: string): FallbackContext {
    switch (tone) {
      case 'supportive':
      case 'encouraging':
        return 'supportive'
      case 'challenging':
      case 'firm':
        return 'challenging'
      case 'instructional':
      case 'teaching':
        return 'instructional'
      case 'motivational':
      case 'inspiring':
        return 'motivational'
      default:
        return 'default'
    }
  }

  /**
   * Validate image URL availability
   */
  private async validateImageUrl(url: string): Promise<boolean> {
    // Check cache first
    const cached = this.imageValidationCache.get(url)
    if (cached && Date.now() - cached.lastChecked.getTime() < 300000) { // 5 minutes cache
      return cached.isValid
    }

    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(3000)
      })
      
      const isValid = response.ok
      
      // Cache result
      this.imageValidationCache.set(url, {
        isValid,
        lastChecked: new Date()
      })
      
      return isValid
    } catch (error) {
      // Cache negative result for shorter time
      this.imageValidationCache.set(url, {
        isValid: false,
        lastChecked: new Date()
      })
      
      return false
    }
  }

  /**
   * Update fallback usage statistics
   */
  private updateFallbackUsageStats(url: string): void {
    const current = this.fallbackUsageStats.get(url) || { count: 0, lastUsed: new Date() }
    this.fallbackUsageStats.set(url, {
      count: current.count + 1,
      lastUsed: new Date()
    })
  }

  /**
   * Execute recovery mechanism for specific error
   */
  async executeRecovery<T>(
    error: CaptainError,
    context: any,
    attempt: number = 1
  ): Promise<T> {
    const mechanism = this.recoveryMechanisms.get(error.type)
    
    if (!mechanism || !mechanism.condition(error, attempt)) {
      throw error
    }

    if (attempt > mechanism.maxAttempts) {
      throw new CaptainError(
        ErrorType.INTERNAL_ERROR,
        `Recovery failed after ${mechanism.maxAttempts} attempts`,
        {
          details: { originalError: error.type, attempts: attempt },
          cause: error
        }
      )
    }

    try {
      // Add delay for retry mechanisms
      if (mechanism.type === 'retry' && attempt > 1) {
        const delay = mechanism.delayMs * Math.pow(mechanism.backoffMultiplier, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      return await mechanism.execute(context)
    } catch (recoveryError) {
      console.warn(`Recovery attempt ${attempt} failed for ${error.type}:`, recoveryError)
      
      // Try again if we haven't exceeded max attempts
      if (attempt < mechanism.maxAttempts) {
        return await this.executeRecovery(error, context, attempt + 1)
      }
      
      throw recoveryError
    }
  }

  /**
   * Create offline-capable error response
   */
  createOfflineResponse(
    errorType: ErrorType,
    context?: {
      userMessage?: string
      conversationId?: string
      responseContext?: ResponseContext
    }
  ): {
    error: {
      code: string
      message: string
      captainResponse: string
      offline: boolean
      timestamp: string
    }
    fallback: {
      response: string
      imageUrl: string
      guidance: string[]
    }
    recovery: {
      whenOnline: string[]
      offlineActions: string[]
    }
  } {
    const isOffline = networkConnectivity.isOffline()
    const captainMessage = captainErrorMessaging.getCaptainErrorMessage(errorType, {
      userMessage: context?.userMessage
    })

    // Get appropriate offline image
    const offlineImageContext = isOffline ? 'offline' : 'error'
    
    return {
      error: {
        code: errorType,
        message: captainMessage.message,
        captainResponse: captainMessage.message,
        offline: isOffline,
        timestamp: new Date().toISOString()
      },
      fallback: {
        response: this.getOfflineResponse(isOffline, captainMessage.tone),
        imageUrl: this.getOfflineImageUrl(offlineImageContext),
        guidance: this.getOfflineGuidance(isOffline)
      },
      recovery: {
        whenOnline: [
          'Tente novamente quando a conexão for restabelecida',
          'Suas mensagens serão processadas normalmente',
          'Continue sua jornada de disciplina'
        ],
        offlineActions: [
          'Reflita sobre os princípios que já aprendeu',
          'Pratique a disciplina independente de sistemas externos',
          'Use este tempo para planejamento estratégico',
          'Mantenha sua determinação mesmo offline'
        ]
      }
    }
  }

  /**
   * Get offline response message
   */
  private getOfflineResponse(isOffline: boolean, tone: string): string {
    if (isOffline) {
      switch (tone) {
        case 'firm':
          return 'Guerreiro, você está desconectado da caverna. Mas lembre-se: a verdadeira disciplina não depende de conectividade. Use este tempo para fortalecer sua determinação interior.'
        case 'supportive':
          return 'Sem conexão no momento, guerreiro, mas isso não interrompe sua jornada. A força do Cave Mode vem de dentro, não de sistemas externos.'
        case 'motivational':
          return 'Desconectado da rede, mas conectado com sua essência, guerreiro! Use este momento offline para reflexão e planejamento estratégico.'
        case 'instructional':
          return 'Conexão perdida, guerreiro. Aproveite para revisar os princípios fundamentais que já conhece e prepare-se para retomar com ainda mais foco.'
        default:
          return 'Guerreiro, você está offline no momento. Mantenha sua disciplina - a conectividade voltará, mas sua determinação deve permanecer constante.'
      }
    }

    return 'Sistema temporariamente indisponível, guerreiro. Use este tempo para fortalecer sua resiliência e preparar-se para retomar com ainda mais força.'
  }

  /**
   * Get offline image URL
   */
  private getOfflineImageUrl(context: FallbackContext): string {
    const offlineImages = this.fallbackImages.filter(img => 
      img.availability === 'always' && 
      (img.context.includes(context) || img.context.includes('default'))
    )

    return offlineImages.length > 0 ? offlineImages[0].url : '/cave-icon.svg'
  }

  /**
   * Get offline guidance
   */
  private getOfflineGuidance(isOffline: boolean): string[] {
    if (isOffline) {
      return [
        'Verifique sua conexão com a internet',
        'Aguarde a conectividade ser restabelecida',
        'Use este tempo para reflexão e planejamento',
        'Pratique os princípios do Cave Mode offline',
        'Mantenha sua disciplina independente de sistemas'
      ]
    }

    return [
      'Aguarde alguns momentos e tente novamente',
      'Verifique se há manutenções em andamento',
      'Use este tempo para organizar seus pensamentos',
      'Mantenha a paciência - obstáculos são temporários'
    ]
  }

  /**
   * Wait for connectivity to improve
   */
  private async waitForConnectivity(maxWaitMs: number = 30000): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitMs) {
      const state = networkConnectivity.getCurrentState()
      
      if (state === ConnectivityState.ONLINE || state === ConnectivityState.SLOW) {
        return
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    throw new Error('Connectivity did not improve within timeout period')
  }

  /**
   * Retry chat API with fallback
   */
  private async retryChatAPI(context: any): Promise<any> {
    // Implementation would depend on the specific chat API structure
    // This is a placeholder for the actual retry logic
    throw new Error('Chat API retry not implemented')
  }

  /**
   * Generate fallback search results
   */
  private async generateFallbackSearchResults(query: string): Promise<any[]> {
    // Implementation would generate contextual fallback results
    // This is a placeholder for the actual fallback search logic
    return []
  }

  /**
   * Start system health monitoring
   */
  private startHealthMonitoring(): void {
    // Monitor system health every 60 seconds
    setInterval(() => {
      this.checkSystemHealth().catch(error => {
        console.warn('System health check failed:', error)
      })
    }, 60000)
  }

  /**
   * Check overall system health
   */
  private async checkSystemHealth(): Promise<SystemHealth> {
    const checks = await Promise.allSettled([
      this.checkChatHealth(),
      this.checkImageHealth(),
      this.checkSearchHealth(),
      this.checkStorageHealth()
    ])

    const [chatResult, imageResult, searchResult, storageResult] = checks

    this.systemHealth = {
      chat: chatResult.status === 'fulfilled' ? chatResult.value : 'critical',
      images: imageResult.status === 'fulfilled' ? imageResult.value : 'critical',
      search: searchResult.status === 'fulfilled' ? searchResult.value : 'critical',
      storage: storageResult.status === 'fulfilled' ? storageResult.value : 'critical',
      overall: this.calculateOverallHealth(),
      lastChecked: new Date()
    }

    return this.systemHealth
  }

  /**
   * Check individual service health
   */
  private async checkChatHealth(): Promise<SystemHealth['chat']> {
    try {
      const response = await fetch('/api/health', { method: 'HEAD' })
      return response.ok ? 'healthy' : 'degraded'
    } catch {
      return 'critical'
    }
  }

  private async checkImageHealth(): Promise<SystemHealth['images']> {
    try {
      const response = await fetch('/api/v1/images/health', { method: 'HEAD' })
      return response.ok ? 'healthy' : 'degraded'
    } catch {
      return 'critical'
    }
  }

  private async checkSearchHealth(): Promise<SystemHealth['search']> {
    // Placeholder for search health check
    return 'healthy'
  }

  private async checkStorageHealth(): Promise<SystemHealth['storage']> {
    // Placeholder for storage health check
    return 'healthy'
  }

  /**
   * Calculate overall system health
   */
  private calculateOverallHealth(): SystemHealth['overall'] {
    const services = [this.systemHealth.chat, this.systemHealth.images, this.systemHealth.search, this.systemHealth.storage]
    
    if (services.every(s => s === 'healthy')) return 'healthy'
    if (services.some(s => s === 'critical')) return 'critical'
    if (services.some(s => s === 'degraded')) return 'degraded'
    
    return 'healthy'
  }

  /**
   * Get system health status
   */
  getSystemHealth(): SystemHealth {
    return { ...this.systemHealth }
  }

  /**
   * Get fallback usage statistics
   */
  getFallbackStats(): {
    imageUsage: Array<{ url: string; count: number; lastUsed: Date }>
    totalFallbacks: number
    mostUsedFallback: string | null
  } {
    const imageUsage = Array.from(this.fallbackUsageStats.entries()).map(([url, stats]) => ({
      url,
      count: stats.count,
      lastUsed: stats.lastUsed
    }))

    const totalFallbacks = imageUsage.reduce((sum, item) => sum + item.count, 0)
    const mostUsedFallback = imageUsage.length > 0 
      ? imageUsage.reduce((max, item) => item.count > max.count ? item : max).url
      : null

    return {
      imageUsage,
      totalFallbacks,
      mostUsedFallback
    }
  }

  /**
   * Clear validation cache
   */
  clearValidationCache(): void {
    this.imageValidationCache.clear()
  }

  /**
   * Reset usage statistics
   */
  resetUsageStats(): void {
    this.fallbackUsageStats.clear()
  }
}

// Export singleton instance
export const comprehensiveFallbackSystem = new ComprehensiveFallbackSystem()