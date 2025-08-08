// Enhanced offline state management system
import { captainErrorMessaging } from './captain-error-messaging'
import { comprehensiveFallbackSystem } from './comprehensive-fallback-system'
import { networkConnectivity, ConnectivityState } from './network-connectivity'

/**
 * Offline capability levels
 */
export enum OfflineCapability {
  FULL = 'full',           // Full offline functionality
  LIMITED = 'limited',     // Basic offline functionality
  MINIMAL = 'minimal',     // Only cached content
  NONE = 'none'           // No offline capability
}

/**
 * Offline data types
 */
interface OfflineData {
  conversations: Array<{
    id: string
    messages: any[]
    timestamp: Date
    synced: boolean
  }>
  cachedResponses: Map<string, {
    response: string
    imageUrl: string
    timestamp: Date
    expiresAt: Date
  }>
  userPreferences: {
    offlineMode: boolean
    syncOnReconnect: boolean
    cacheSize: number
  }
  systemState: {
    lastOnline: Date
    offlineDuration: number
    pendingOperations: any[]
  }
}

/**
 * Offline operation queue item
 */
interface OfflineOperation {
  id: string
  type: 'chat' | 'image' | 'storage' | 'sync'
  data: any
  timestamp: Date
  retryCount: number
  maxRetries: number
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

/**
 * Sync result
 */
interface SyncResult {
  success: boolean
  operationsSynced: number
  operationsFailed: number
  errors: Array<{ operation: OfflineOperation; error: string }>
  duration: number
}

/**
 * Enhanced offline state manager
 */
export class OfflineStateManager {
  private offlineData: OfflineData = {
    conversations: [],
    cachedResponses: new Map(),
    userPreferences: {
      offlineMode: false,
      syncOnReconnect: true,
      cacheSize: 50
    },
    systemState: {
      lastOnline: new Date(),
      offlineDuration: 0,
      pendingOperations: []
    }
  }

  private operationQueue: OfflineOperation[] = []
  private isProcessingQueue = false
  private syncInProgress = false
  private offlineStartTime: Date | null = null
  private listeners: Array<(state: OfflineCapability, data: OfflineData) => void> = []

  constructor() {
    this.initializeOfflineState()
    this.setupConnectivityMonitoring()
    this.loadPersistedData()
  }

  /**
   * Initialize offline state management
   */
  private initializeOfflineState(): void {
    // Set up periodic data persistence
    setInterval(() => {
      this.persistData().catch(error => {
        console.warn('Failed to persist offline data:', error)
      })
    }, 30000) // Persist every 30 seconds

    // Set up queue processing
    setInterval(() => {
      if (!this.isProcessingQueue && this.operationQueue.length > 0) {
        this.processOperationQueue().catch(error => {
          console.warn('Failed to process operation queue:', error)
        })
      }
    }, 5000) // Process queue every 5 seconds
  }

  /**
   * Setup connectivity monitoring
   */
  private setupConnectivityMonitoring(): void {
    networkConnectivity.addListener((state, quality) => {
      this.handleConnectivityChange(state, quality)
    })
  }

  /**
   * Handle connectivity state changes
   */
  private handleConnectivityChange(state: ConnectivityState, quality: any): void {
    const wasOffline = this.isOffline()
    const isNowOffline = state === ConnectivityState.OFFLINE

    if (!wasOffline && isNowOffline) {
      // Going offline
      this.handleGoingOffline()
    } else if (wasOffline && !isNowOffline) {
      // Coming back online
      this.handleComingOnline()
    }

    // Update system state
    if (!isNowOffline) {
      this.offlineData.systemState.lastOnline = new Date()
      if (this.offlineStartTime) {
        this.offlineData.systemState.offlineDuration += Date.now() - this.offlineStartTime.getTime()
        this.offlineStartTime = null
      }
    } else if (!this.offlineStartTime) {
      this.offlineStartTime = new Date()
    }

    // Notify listeners
    this.notifyListeners(this.getCurrentCapability(), this.offlineData)
  }

  /**
   * Handle going offline
   */
  private handleGoingOffline(): void {
    console.log('Going offline - enabling offline mode')
    
    // Enable offline mode
    this.offlineData.userPreferences.offlineMode = true
    
    // Cache current state
    this.persistData().catch(error => {
      console.warn('Failed to persist data when going offline:', error)
    })

    // Prepare offline capabilities
    this.prepareOfflineCapabilities()
  }

  /**
   * Handle coming back online
   */
  private handleComingOnline(): void {
    console.log('Coming back online - initiating sync')
    
    // Disable offline mode if auto-sync is enabled
    if (this.offlineData.userPreferences.syncOnReconnect) {
      this.syncPendingOperations().catch(error => {
        console.warn('Failed to sync pending operations:', error)
      })
    }
  }

  /**
   * Prepare offline capabilities
   */
  private prepareOfflineCapabilities(): void {
    // Preload essential fallback images
    this.preloadOfflineAssets()
    
    // Cache recent conversations
    this.cacheRecentConversations()
    
    // Prepare offline responses
    this.prepareOfflineResponses()
  }

  /**
   * Preload offline assets
   */
  private async preloadOfflineAssets(): Promise<void> {
    try {
      // Get essential fallback images
      const essentialImages = [
        await comprehensiveFallbackSystem.getFallbackImage('default'),
        await comprehensiveFallbackSystem.getFallbackImage('offline'),
        await comprehensiveFallbackSystem.getFallbackImage('error')
      ]

      // Cache images in browser cache
      await Promise.all(
        essentialImages.map(async (image) => {
          try {
            await fetch(image.url, { cache: 'force-cache' })
          } catch (error) {
            console.warn(`Failed to cache image ${image.url}:`, error)
          }
        })
      )
    } catch (error) {
      console.warn('Failed to preload offline assets:', error)
    }
  }

  /**
   * Cache recent conversations
   */
  private cacheRecentConversations(): void {
    // This would integrate with the actual conversation storage
    // For now, maintain the current cached conversations
    console.log('Caching recent conversations for offline access')
  }

  /**
   * Prepare offline responses
   */
  private prepareOfflineResponses(): void {
    const commonQueries = [
      'motivação',
      'disciplina',
      'foco',
      'procrastinação',
      'hábitos',
      'objetivos'
    ]

    commonQueries.forEach(query => {
      if (!this.offlineData.cachedResponses.has(query)) {
        const offlineResponse = this.generateOfflineResponse(query)
        this.offlineData.cachedResponses.set(query, {
          response: offlineResponse.response,
          imageUrl: offlineResponse.imageUrl,
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        })
      }
    })
  }

  /**
   * Generate offline response for common queries
   */
  private generateOfflineResponse(query: string): { response: string; imageUrl: string } {
    const lowerQuery = query.toLowerCase()
    
    let response = ''
    let context = 'default'

    if (lowerQuery.includes('motivação') || lowerQuery.includes('motivation')) {
      response = 'Guerreiro, mesmo offline, sua motivação deve vir de dentro. Lembre-se: Purpose > Focus > Progress. Defina seu propósito, mantenha o foco e dê o próximo passo, independente de conectividade.'
      context = 'motivational'
    } else if (lowerQuery.includes('disciplina')) {
      response = 'A disciplina não depende de conexão com a internet, guerreiro. Ela vem da sua capacidade de agir mesmo quando não há sistemas externos para te guiar. Continue praticando seus hábitos.'
      context = 'challenging'
    } else if (lowerQuery.includes('foco')) {
      response = 'Foco é uma habilidade interna, guerreiro. Use este momento offline para eliminar distrações digitais e se concentrar no que realmente importa: suas ações no mundo real.'
      context = 'instructional'
    } else if (lowerQuery.includes('procrastinação')) {
      response = 'Procrastinação não tem desculpa, nem mesmo estar offline. Na verdade, este é o momento perfeito para agir sem as distrações da conectividade. Qual ação você pode tomar agora?'
      context = 'challenging'
    } else {
      response = 'Guerreiro, mesmo desconectado da rede, você permanece conectado com sua essência. Use este tempo offline para reflexão, planejamento e ação direta no mundo real.'
      context = 'supportive'
    }

    return {
      response,
      imageUrl: '/placeholder-captain.svg' // Use local fallback
    }
  }

  /**
   * Add operation to offline queue
   */
  addToQueue(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): string {
    const queueItem: OfflineOperation = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending',
      ...operation
    }

    this.operationQueue.push(queueItem)
    
    // Sort queue by priority and timestamp
    this.operationQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return a.timestamp.getTime() - b.timestamp.getTime()
    })

    return queueItem.id
  }

  /**
   * Process operation queue
   */
  private async processOperationQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true

    try {
      const pendingOperations = this.operationQueue.filter(op => op.status === 'pending')
      
      for (const operation of pendingOperations.slice(0, 5)) { // Process up to 5 operations at a time
        try {
          operation.status = 'processing'
          await this.executeOperation(operation)
          operation.status = 'completed'
        } catch (error) {
          operation.retryCount++
          
          if (operation.retryCount >= operation.maxRetries) {
            operation.status = 'failed'
            console.error(`Operation ${operation.id} failed permanently:`, error)
          } else {
            operation.status = 'pending'
            console.warn(`Operation ${operation.id} failed, will retry:`, error)
          }
        }
      }

      // Clean up completed and permanently failed operations
      this.operationQueue = this.operationQueue.filter(op => 
        op.status !== 'completed' && op.status !== 'failed'
      )

    } finally {
      this.isProcessingQueue = false
    }
  }

  /**
   * Execute individual operation
   */
  private async executeOperation(operation: OfflineOperation): Promise<void> {
    if (!networkConnectivity.isOnline()) {
      throw new Error('Cannot execute operation while offline')
    }

    switch (operation.type) {
      case 'chat':
        await this.executeChatOperation(operation)
        break
      case 'image':
        await this.executeImageOperation(operation)
        break
      case 'storage':
        await this.executeStorageOperation(operation)
        break
      case 'sync':
        await this.executeSyncOperation(operation)
        break
      default:
        throw new Error(`Unknown operation type: ${operation.type}`)
    }
  }

  /**
   * Execute chat operation
   */
  private async executeChatOperation(operation: OfflineOperation): Promise<void> {
    const { message, conversationId } = operation.data

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationId })
    })

    if (!response.ok) {
      throw new Error(`Chat operation failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    
    // Update cached conversation
    this.updateCachedConversation(conversationId, {
      role: 'user',
      content: message,
      timestamp: operation.timestamp
    }, {
      role: 'assistant',
      content: result.response,
      imageUrl: result.imageUrl,
      timestamp: new Date()
    })
  }

  /**
   * Execute image operation
   */
  private async executeImageOperation(operation: OfflineOperation): Promise<void> {
    const { responseContent, context } = operation.data

    const response = await fetch('/api/v1/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responseContent, context })
    })

    if (!response.ok) {
      throw new Error(`Image operation failed: ${response.status} ${response.statusText}`)
    }

    // Image generation completed successfully
    console.log('Image operation completed successfully')
  }

  /**
   * Execute storage operation
   */
  private async executeStorageOperation(operation: OfflineOperation): Promise<void> {
    // Placeholder for storage operation execution
    console.log('Executing storage operation:', operation.id)
  }

  /**
   * Execute sync operation
   */
  private async executeSyncOperation(operation: OfflineOperation): Promise<void> {
    // Placeholder for sync operation execution
    console.log('Executing sync operation:', operation.id)
  }

  /**
   * Update cached conversation
   */
  private updateCachedConversation(conversationId: string, ...messages: any[]): void {
    let conversation = this.offlineData.conversations.find(c => c.id === conversationId)
    
    if (!conversation) {
      conversation = {
        id: conversationId,
        messages: [],
        timestamp: new Date(),
        synced: false
      }
      this.offlineData.conversations.push(conversation)
    }

    conversation.messages.push(...messages)
    conversation.timestamp = new Date()
    conversation.synced = true

    // Limit conversation history
    if (conversation.messages.length > 100) {
      conversation.messages = conversation.messages.slice(-100)
    }
  }

  /**
   * Sync pending operations
   */
  async syncPendingOperations(): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress')
    }

    this.syncInProgress = true
    const startTime = Date.now()
    let operationsSynced = 0
    let operationsFailed = 0
    const errors: Array<{ operation: OfflineOperation; error: string }> = []

    try {
      const pendingOperations = this.operationQueue.filter(op => op.status === 'pending')
      
      for (const operation of pendingOperations) {
        try {
          await this.executeOperation(operation)
          operation.status = 'completed'
          operationsSynced++
        } catch (error) {
          operationsFailed++
          errors.push({
            operation,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      // Clean up completed operations
      this.operationQueue = this.operationQueue.filter(op => op.status !== 'completed')

      return {
        success: operationsFailed === 0,
        operationsSynced,
        operationsFailed,
        errors,
        duration: Date.now() - startTime
      }

    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * Get offline response for user query
   */
  getOfflineResponse(query: string): {
    response: string
    imageUrl: string
    fromCache: boolean
  } {
    // Check cached responses first
    const cached = this.offlineData.cachedResponses.get(query.toLowerCase())
    
    if (cached && cached.expiresAt > new Date()) {
      return {
        response: cached.response,
        imageUrl: cached.imageUrl,
        fromCache: true
      }
    }

    // Generate contextual offline response
    const offlineResponse = this.generateOfflineResponse(query)
    
    return {
      response: offlineResponse.response,
      imageUrl: offlineResponse.imageUrl,
      fromCache: false
    }
  }

  /**
   * Get current offline capability level
   */
  getCurrentCapability(): OfflineCapability {
    if (!this.isOffline()) {
      return OfflineCapability.FULL
    }

    const hasCachedData = this.offlineData.cachedResponses.size > 0
    const hasConversations = this.offlineData.conversations.length > 0

    if (hasCachedData && hasConversations) {
      return OfflineCapability.LIMITED
    } else if (hasCachedData || hasConversations) {
      return OfflineCapability.MINIMAL
    }

    return OfflineCapability.NONE
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return networkConnectivity.isOffline()
  }

  /**
   * Get offline statistics
   */
  getOfflineStats(): {
    capability: OfflineCapability
    cachedResponses: number
    cachedConversations: number
    pendingOperations: number
    offlineDuration: number
    lastOnline: Date
    queueSize: number
  } {
    return {
      capability: this.getCurrentCapability(),
      cachedResponses: this.offlineData.cachedResponses.size,
      cachedConversations: this.offlineData.conversations.length,
      pendingOperations: this.operationQueue.filter(op => op.status === 'pending').length,
      offlineDuration: this.offlineData.systemState.offlineDuration,
      lastOnline: this.offlineData.systemState.lastOnline,
      queueSize: this.operationQueue.length
    }
  }

  /**
   * Create offline error state
   */
  createOfflineErrorState(userMessage: string): {
    error: {
      code: string
      message: string
      offline: true
      timestamp: string
    }
    fallback: {
      response: string
      imageUrl: string
      capability: OfflineCapability
      guidance: string[]
    }
  } {
    const capability = this.getCurrentCapability()
    const offlineResponse = this.getOfflineResponse(userMessage)
    
    return {
      error: {
        code: 'OFFLINE_STATE',
        message: 'Sistema offline - usando capacidades locais',
        offline: true,
        timestamp: new Date().toISOString()
      },
      fallback: {
        response: offlineResponse.response,
        imageUrl: offlineResponse.imageUrl,
        capability,
        guidance: this.getOfflineGuidance(capability)
      }
    }
  }

  /**
   * Get offline guidance based on capability level
   */
  private getOfflineGuidance(capability: OfflineCapability): string[] {
    switch (capability) {
      case OfflineCapability.FULL:
        return [
          'Sistema funcionando normalmente',
          'Todas as funcionalidades disponíveis',
          'Continue sua jornada sem interrupções'
        ]
      
      case OfflineCapability.LIMITED:
        return [
          'Funcionalidade limitada offline',
          'Respostas baseadas em cache local',
          'Operações serão sincronizadas quando voltar online',
          'Continue praticando a disciplina independente de sistemas'
        ]
      
      case OfflineCapability.MINIMAL:
        return [
          'Capacidade mínima offline',
          'Apenas conteúdo básico disponível',
          'Foque nos princípios fundamentais que já conhece',
          'Use este tempo para reflexão e ação direta'
        ]
      
      case OfflineCapability.NONE:
        return [
          'Sem capacidade offline no momento',
          'Aguarde a conexão ser restabelecida',
          'Pratique a disciplina independente de tecnologia',
          'Lembre-se: a força vem de dentro, não de sistemas externos'
        ]
    }
  }

  /**
   * Persist data to local storage
   */
  private async persistData(): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        const dataToStore = {
          conversations: this.offlineData.conversations,
          cachedResponses: Array.from(this.offlineData.cachedResponses.entries()),
          userPreferences: this.offlineData.userPreferences,
          systemState: this.offlineData.systemState
        }
        
        localStorage.setItem('askTheCaptain_offlineData', JSON.stringify(dataToStore))
      }
    } catch (error) {
      console.warn('Failed to persist offline data:', error)
    }
  }

  /**
   * Load persisted data from local storage
   */
  private loadPersistedData(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('askTheCaptain_offlineData')
        
        if (stored) {
          const data = JSON.parse(stored)
          
          this.offlineData.conversations = data.conversations || []
          this.offlineData.cachedResponses = new Map(data.cachedResponses || [])
          this.offlineData.userPreferences = { ...this.offlineData.userPreferences, ...data.userPreferences }
          this.offlineData.systemState = { ...this.offlineData.systemState, ...data.systemState }
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted offline data:', error)
    }
  }

  /**
   * Add state change listener
   */
  addListener(listener: (state: OfflineCapability, data: OfflineData) => void): void {
    this.listeners.push(listener)
  }

  /**
   * Remove state change listener
   */
  removeListener(listener: (state: OfflineCapability, data: OfflineData) => void): void {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * Notify listeners of state changes
   */
  private notifyListeners(state: OfflineCapability, data: OfflineData): void {
    this.listeners.forEach(listener => {
      try {
        listener(state, data)
      } catch (error) {
        console.error('Error in offline state listener:', error)
      }
    })
  }

  /**
   * Clear all offline data
   */
  clearOfflineData(): void {
    this.offlineData.conversations = []
    this.offlineData.cachedResponses.clear()
    this.operationQueue = []
    
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('askTheCaptain_offlineData')
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.listeners = []
    this.clearOfflineData()
  }
}

// Export singleton instance
export const offlineStateManager = new OfflineStateManager()