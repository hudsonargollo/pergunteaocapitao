// Network connectivity detection and offline state management
import { captainErrorMessaging } from './captain-error-messaging'

/**
 * Network connectivity states
 */
export enum ConnectivityState {
  ONLINE = 'online',
  OFFLINE = 'offline',
  SLOW = 'slow',
  UNSTABLE = 'unstable',
  UNKNOWN = 'unknown'
}

/**
 * Network quality metrics
 */
interface NetworkQuality {
  state: ConnectivityState
  latency: number
  bandwidth: 'high' | 'medium' | 'low' | 'unknown'
  stability: 'stable' | 'unstable' | 'unknown'
  lastChecked: Date
}

/**
 * Connectivity check result
 */
interface ConnectivityCheck {
  isOnline: boolean
  responseTime: number
  timestamp: Date
  endpoint: string
  success: boolean
  error?: string
}

/**
 * Network connectivity manager for Ask the Captain
 */
export class NetworkConnectivityManager {
  private currentState: ConnectivityState = ConnectivityState.UNKNOWN
  private quality: NetworkQuality = {
    state: ConnectivityState.UNKNOWN,
    latency: 0,
    bandwidth: 'unknown',
    stability: 'unknown',
    lastChecked: new Date()
  }
  
  private checkInterval: NodeJS.Timeout | null = null
  private listeners: Array<(state: ConnectivityState, quality: NetworkQuality) => void> = []
  private checkHistory: ConnectivityCheck[] = []
  private maxHistorySize = 10

  // Health check endpoints in order of preference
  private readonly healthEndpoints = [
    '/api/health',
    '/api/chat',
    '/'
  ]

  constructor() {
    this.initializeConnectivityMonitoring()
  }

  /**
   * Initialize connectivity monitoring
   */
  private initializeConnectivityMonitoring(): void {
    // Perform initial connectivity check
    this.checkConnectivity().then(() => {
      // Start periodic monitoring
      this.startPeriodicChecks()
    })

    // Listen for browser online/offline events (if available)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.handleConnectivityChange(ConnectivityState.ONLINE)
      })

      window.addEventListener('offline', () => {
        this.handleConnectivityChange(ConnectivityState.OFFLINE)
      })
    }
  }

  /**
   * Check current network connectivity
   */
  async checkConnectivity(): Promise<ConnectivityCheck> {
    const startTime = performance.now()
    let lastError: string | undefined

    // Try each health endpoint until one succeeds
    for (const endpoint of this.healthEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        })

        const responseTime = performance.now() - startTime
        const check: ConnectivityCheck = {
          isOnline: response.ok,
          responseTime,
          timestamp: new Date(),
          endpoint,
          success: response.ok
        }

        if (response.ok) {
          this.updateConnectivityState(check)
          this.addToHistory(check)
          return check
        } else {
          lastError = `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Network error'
        
        // If this is a timeout or network error, we're likely offline
        if (error instanceof Error && (
          error.name === 'AbortError' ||
          error.message.includes('fetch') ||
          error.message.includes('network')
        )) {
          break
        }
      }
    }

    // All endpoints failed
    const responseTime = performance.now() - startTime
    const check: ConnectivityCheck = {
      isOnline: false,
      responseTime,
      timestamp: new Date(),
      endpoint: this.healthEndpoints[0],
      success: false,
      error: lastError
    }

    this.updateConnectivityState(check)
    this.addToHistory(check)
    return check
  }

  /**
   * Update connectivity state based on check result
   */
  private updateConnectivityState(check: ConnectivityCheck): void {
    let newState: ConnectivityState

    if (!check.success) {
      newState = ConnectivityState.OFFLINE
    } else if (check.responseTime > 3000) {
      newState = ConnectivityState.SLOW
    } else if (this.isConnectionUnstable()) {
      newState = ConnectivityState.UNSTABLE
    } else {
      newState = ConnectivityState.ONLINE
    }

    // Update quality metrics
    this.quality = {
      state: newState,
      latency: check.responseTime,
      bandwidth: this.estimateBandwidth(check.responseTime),
      stability: this.assessStability(),
      lastChecked: check.timestamp
    }

    // Notify listeners if state changed
    if (newState !== this.currentState) {
      this.currentState = newState
      this.notifyListeners(newState, this.quality)
    }
  }

  /**
   * Check if connection is unstable based on recent history
   */
  private isConnectionUnstable(): boolean {
    if (this.checkHistory.length < 3) return false

    const recentChecks = this.checkHistory.slice(-5)
    const failureRate = recentChecks.filter(check => !check.success).length / recentChecks.length
    const avgResponseTime = recentChecks
      .filter(check => check.success)
      .reduce((sum, check) => sum + check.responseTime, 0) / recentChecks.length

    return failureRate > 0.3 || avgResponseTime > 2000
  }

  /**
   * Estimate bandwidth based on response time
   */
  private estimateBandwidth(responseTime: number): 'high' | 'medium' | 'low' | 'unknown' {
    if (responseTime < 500) return 'high'
    if (responseTime < 1500) return 'medium'
    if (responseTime < 3000) return 'low'
    return 'unknown'
  }

  /**
   * Assess connection stability
   */
  private assessStability(): 'stable' | 'unstable' | 'unknown' {
    if (this.checkHistory.length < 3) return 'unknown'
    
    const recentChecks = this.checkHistory.slice(-5)
    const successRate = recentChecks.filter(check => check.success).length / recentChecks.length
    const responseTimeVariance = this.calculateResponseTimeVariance(recentChecks)

    if (successRate >= 0.8 && responseTimeVariance < 1000) return 'stable'
    return 'unstable'
  }

  /**
   * Calculate response time variance
   */
  private calculateResponseTimeVariance(checks: ConnectivityCheck[]): number {
    const successfulChecks = checks.filter(check => check.success)
    if (successfulChecks.length < 2) return 0

    const avgResponseTime = successfulChecks.reduce((sum, check) => sum + check.responseTime, 0) / successfulChecks.length
    const variance = successfulChecks.reduce((sum, check) => {
      return sum + Math.pow(check.responseTime - avgResponseTime, 2)
    }, 0) / successfulChecks.length

    return Math.sqrt(variance)
  }

  /**
   * Add check to history
   */
  private addToHistory(check: ConnectivityCheck): void {
    this.checkHistory.push(check)
    if (this.checkHistory.length > this.maxHistorySize) {
      this.checkHistory.shift()
    }
  }

  /**
   * Handle connectivity state changes
   */
  private handleConnectivityChange(newState: ConnectivityState): void {
    if (newState !== this.currentState) {
      this.currentState = newState
      this.quality.state = newState
      this.quality.lastChecked = new Date()
      this.notifyListeners(newState, this.quality)
    }
  }

  /**
   * Start periodic connectivity checks
   */
  private startPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    // Check every 30 seconds when online, every 10 seconds when offline
    const interval = this.currentState === ConnectivityState.OFFLINE ? 10000 : 30000

    this.checkInterval = setInterval(() => {
      this.checkConnectivity().catch(error => {
        console.warn('Periodic connectivity check failed:', error)
      })
    }, interval)
  }

  /**
   * Stop periodic connectivity checks
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  /**
   * Add connectivity state listener
   */
  addListener(listener: (state: ConnectivityState, quality: NetworkQuality) => void): void {
    this.listeners.push(listener)
  }

  /**
   * Remove connectivity state listener
   */
  removeListener(listener: (state: ConnectivityState, quality: NetworkQuality) => void): void {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(state: ConnectivityState, quality: NetworkQuality): void {
    this.listeners.forEach(listener => {
      try {
        listener(state, quality)
      } catch (error) {
        console.error('Error in connectivity listener:', error)
      }
    })
  }

  /**
   * Get current connectivity state
   */
  getCurrentState(): ConnectivityState {
    return this.currentState
  }

  /**
   * Get current network quality
   */
  getNetworkQuality(): NetworkQuality {
    return { ...this.quality }
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.currentState === ConnectivityState.ONLINE || 
           this.currentState === ConnectivityState.SLOW ||
           this.currentState === ConnectivityState.UNSTABLE
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return this.currentState === ConnectivityState.OFFLINE
  }

  /**
   * Get Captain persona message for current connectivity state
   */
  getCaptainConnectivityMessage(): {
    message: string
    action: string
    guidance: string[]
  } {
    switch (this.currentState) {
      case ConnectivityState.OFFLINE:
        return captainErrorMessaging.createNetworkErrorMessage(true)

      case ConnectivityState.SLOW:
        return {
          message: 'Conexão lenta detectada, guerreiro. A paciência é uma virtude - aguarde o carregamento.',
          action: 'wait',
          guidance: [
            'Aguarde o carregamento das respostas',
            'Evite múltiplas tentativas simultâneas',
            'Use este tempo para refletir sobre sua consulta',
            'A disciplina inclui saber aguardar o momento certo'
          ]
        }

      case ConnectivityState.UNSTABLE:
        return {
          message: 'Conexão instável, guerreiro. Mantenha a calma e tente novamente se necessário.',
          action: 'retry_carefully',
          guidance: [
            'Aguarde alguns segundos entre tentativas',
            'Evite ações múltiplas simultâneas',
            'Mantenha sua mensagem preparada para reenvio',
            'A persistência supera instabilidades técnicas'
          ]
        }

      case ConnectivityState.ONLINE:
        return {
          message: 'Conexão estável, guerreiro. Continue sua jornada com confiança.',
          action: 'continue',
          guidance: [
            'Sistema funcionando normalmente',
            'Pode prosseguir com suas consultas',
            'Mantenha o foco em seus objetivos',
            'Use este momento de estabilidade para avançar'
          ]
        }

      default:
        return captainErrorMessaging.createNetworkErrorMessage(false)
    }
  }

  /**
   * Get connectivity statistics
   */
  getConnectivityStats(): {
    currentState: ConnectivityState
    quality: NetworkQuality
    recentHistory: ConnectivityCheck[]
    uptime: number
    averageResponseTime: number
    successRate: number
  } {
    const successfulChecks = this.checkHistory.filter(check => check.success)
    const averageResponseTime = successfulChecks.length > 0 
      ? successfulChecks.reduce((sum, check) => sum + check.responseTime, 0) / successfulChecks.length
      : 0
    
    const successRate = this.checkHistory.length > 0
      ? successfulChecks.length / this.checkHistory.length
      : 0

    // Calculate uptime based on recent history
    const onlineChecks = this.checkHistory.filter(check => check.success)
    const uptime = this.checkHistory.length > 0 
      ? (onlineChecks.length / this.checkHistory.length) * 100
      : 0

    return {
      currentState: this.currentState,
      quality: { ...this.quality },
      recentHistory: [...this.checkHistory],
      uptime,
      averageResponseTime,
      successRate
    }
  }

  /**
   * Force immediate connectivity check
   */
  async forceCheck(): Promise<ConnectivityCheck> {
    return await this.checkConnectivity()
  }

  /**
   * Reset connectivity history
   */
  resetHistory(): void {
    this.checkHistory = []
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopPeriodicChecks()
    this.listeners = []
    this.checkHistory = []
  }
}

// Export singleton instance
export const networkConnectivity = new NetworkConnectivityManager()

/**
 * React hook for network connectivity
 */
export function useNetworkConnectivity() {
  const [state, setState] = React.useState<ConnectivityState>(networkConnectivity.getCurrentState())
  const [quality, setQuality] = React.useState<NetworkQuality>(networkConnectivity.getNetworkQuality())

  React.useEffect(() => {
    const listener = (newState: ConnectivityState, newQuality: NetworkQuality) => {
      setState(newState)
      setQuality(newQuality)
    }

    networkConnectivity.addListener(listener)

    return () => {
      networkConnectivity.removeListener(listener)
    }
  }, [])

  return {
    state,
    quality,
    isOnline: networkConnectivity.isOnline(),
    isOffline: networkConnectivity.isOffline(),
    checkConnectivity: () => networkConnectivity.forceCheck(),
    getCaptainMessage: () => networkConnectivity.getCaptainConnectivityMessage(),
    getStats: () => networkConnectivity.getConnectivityStats()
  }
}

// Import React for the hook
import React from 'react'