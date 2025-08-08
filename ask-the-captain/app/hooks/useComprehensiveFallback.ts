// React hook for comprehensive fallback system
import { useState, useEffect, useCallback, useRef } from 'react'
import { comprehensiveFallbackSystem, type FallbackContext } from '@/lib/comprehensive-fallback-system'
import { recoveryMechanisms } from '@/lib/recovery-mechanisms'
import { offlineStateManager, type OfflineCapability } from '@/lib/offline-state-manager'
import { networkConnectivity, type ConnectivityState } from '@/lib/network-connectivity'

/**
 * Fallback state
 */
interface FallbackState {
  isActive: boolean
  context: FallbackContext | null
  imageUrl: string | null
  message: string | null
  source: 'primary' | 'fallback' | 'emergency' | null
  lastUpdated: Date | null
}

/**
 * Recovery state
 */
interface RecoveryState {
  isRecovering: boolean
  operation: string | null
  method: string | null
  attempt: number
  maxAttempts: number
  startTime: Date | null
}

/**
 * System health state
 */
interface SystemHealthState {
  chat: 'healthy' | 'degraded' | 'critical' | 'offline'
  images: 'healthy' | 'degraded' | 'critical' | 'offline'
  search: 'healthy' | 'degraded' | 'critical' | 'offline'
  storage: 'healthy' | 'degraded' | 'critical' | 'offline'
  overall: 'healthy' | 'degraded' | 'critical' | 'offline'
  lastChecked: Date
}

/**
 * Hook options
 */
interface UseComprehensiveFallbackOptions {
  enableAutoRecovery?: boolean
  enableOfflineMode?: boolean
  enableHealthMonitoring?: boolean
  fallbackImagePreference?: 'high_quality' | 'fast_loading' | 'offline_capable'
  recoveryTimeout?: number
}

/**
 * Hook return type
 */
interface UseComprehensiveFallbackReturn {
  // Fallback state
  fallbackState: FallbackState
  
  // Recovery state
  recoveryState: RecoveryState
  
  // System health
  systemHealth: SystemHealthState
  
  // Connectivity
  connectivityState: ConnectivityState
  offlineCapability: OfflineCapability
  isOnline: boolean
  isOffline: boolean
  
  // Actions
  getFallbackImage: (context: FallbackContext, options?: any) => Promise<any>
  executeRecovery: (operation: string, context: any) => Promise<any>
  getOfflineResponse: (query: string) => any
  checkSystemHealth: () => Promise<SystemHealthState>
  
  // Statistics
  fallbackStats: any
  recoveryStats: any
  offlineStats: any
}

/**
 * Comprehensive fallback system hook
 */
export function useComprehensiveFallback(
  options: UseComprehensiveFallbackOptions = {}
): UseComprehensiveFallbackReturn {
  const {
    enableAutoRecovery = true,
    enableOfflineMode = true,
    enableHealthMonitoring = true,
    fallbackImagePreference = 'high_quality',
    recoveryTimeout = 30000
  } = options

  // State management
  const [fallbackState, setFallbackState] = useState<FallbackState>({
    isActive: false,
    context: null,
    imageUrl: null,
    message: null,
    source: null,
    lastUpdated: null
  })

  const [recoveryState, setRecoveryState] = useState<RecoveryState>({
    isRecovering: false,
    operation: null,
    method: null,
    attempt: 0,
    maxAttempts: 0,
    startTime: null
  })

  const [systemHealth, setSystemHealth] = useState<SystemHealthState>({
    chat: 'healthy',
    images: 'healthy',
    search: 'healthy',
    storage: 'healthy',
    overall: 'healthy',
    lastChecked: new Date()
  })

  const [connectivityState, setConnectivityState] = useState<ConnectivityState>(
    networkConnectivity.getCurrentState()
  )
  
  const [offlineCapability, setOfflineCapability] = useState<OfflineCapability>(
    offlineStateManager.getCurrentCapability()
  )

  // Refs for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Connectivity monitoring
  useEffect(() => {
    const handleConnectivityChange = (state: ConnectivityState) => {
      setConnectivityState(state)
    }

    networkConnectivity.addListener(handleConnectivityChange)

    return () => {
      networkConnectivity.removeListener(handleConnectivityChange)
    }
  }, [])

  // Offline capability monitoring
  useEffect(() => {
    const handleOfflineStateChange = (capability: OfflineCapability) => {
      setOfflineCapability(capability)
    }

    if (enableOfflineMode) {
      offlineStateManager.addListener(handleOfflineStateChange)
    }

    return () => {
      if (enableOfflineMode) {
        offlineStateManager.removeListener(handleOfflineStateChange)
      }
    }
  }, [enableOfflineMode])

  // System health monitoring
  useEffect(() => {
    if (!enableHealthMonitoring) return

    const checkHealth = async () => {
      try {
        const health = comprehensiveFallbackSystem.getSystemHealth()
        setSystemHealth(health)
      } catch (error) {
        console.warn('Failed to check system health:', error)
      }
    }

    // Initial check
    checkHealth()

    // Periodic checks
    healthCheckIntervalRef.current = setInterval(checkHealth, 60000) // Every minute

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
    }
  }, [enableHealthMonitoring])

  // Get fallback image with comprehensive options
  const getFallbackImage = useCallback(async (
    context: FallbackContext,
    customOptions?: any
  ) => {
    const imageOptions = {
      preferHighQuality: fallbackImagePreference === 'high_quality',
      allowOfflineOnly: offlineStateManager.isOffline(),
      maxAttempts: 3,
      ...customOptions
    }

    try {
      setFallbackState(prev => ({
        ...prev,
        isActive: true,
        context
      }))

      const result = await comprehensiveFallbackSystem.getFallbackImage(context, imageOptions)

      setFallbackState(prev => ({
        ...prev,
        imageUrl: result.url,
        source: result.source,
        lastUpdated: new Date()
      }))

      return result
    } catch (error) {
      setFallbackState(prev => ({
        ...prev,
        isActive: false,
        message: 'Failed to get fallback image'
      }))
      throw error
    } finally {
      setFallbackState(prev => ({
        ...prev,
        isActive: false
      }))
    }
  }, [fallbackImagePreference])

  // Execute recovery with timeout and state management
  const executeRecovery = useCallback(async (
    operation: string,
    context: any
  ) => {
    if (recoveryState.isRecovering) {
      throw new Error('Recovery already in progress')
    }

    setRecoveryState({
      isRecovering: true,
      operation,
      method: null,
      attempt: 1,
      maxAttempts: 3,
      startTime: new Date()
    })

    // Set timeout for recovery
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setRecoveryState(prev => ({
        ...prev,
        isRecovering: false,
        method: 'timeout'
      }))
    }, recoveryTimeout)

    try {
      const result = await recoveryMechanisms.executeRecovery(operation, context)

      setRecoveryState(prev => ({
        ...prev,
        isRecovering: false,
        method: result.recoveryMethod,
        attempt: result.retryCount
      }))

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      return result
    } catch (error) {
      setRecoveryState(prev => ({
        ...prev,
        isRecovering: false,
        method: 'failed'
      }))

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      throw error
    }
  }, [recoveryState.isRecovering, recoveryTimeout])

  // Get offline response
  const getOfflineResponse = useCallback((query: string) => {
    if (!enableOfflineMode) {
      throw new Error('Offline mode not enabled')
    }

    return offlineStateManager.getOfflineResponse(query)
  }, [enableOfflineMode])

  // Check system health manually
  const checkSystemHealth = useCallback(async (): Promise<SystemHealthState> => {
    const health = comprehensiveFallbackSystem.getSystemHealth()
    setSystemHealth(health)
    return health
  }, [])

  // Computed values
  const isOnline = connectivityState !== ConnectivityState.OFFLINE
  const isOffline = connectivityState === ConnectivityState.OFFLINE

  // Statistics
  const fallbackStats = comprehensiveFallbackSystem.getFallbackStats()
  const recoveryStats = recoveryMechanisms.getRecoveryStats()
  const offlineStats = offlineStateManager.getOfflineStats()

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
    }
  }, [])

  return {
    // State
    fallbackState,
    recoveryState,
    systemHealth,
    connectivityState,
    offlineCapability,
    isOnline,
    isOffline,

    // Actions
    getFallbackImage,
    executeRecovery,
    getOfflineResponse,
    checkSystemHealth,

    // Statistics
    fallbackStats,
    recoveryStats,
    offlineStats
  }
}

/**
 * Simplified hook for basic fallback functionality
 */
export function useBasicFallback() {
  const {
    fallbackState,
    isOnline,
    isOffline,
    getFallbackImage,
    getOfflineResponse
  } = useComprehensiveFallback({
    enableAutoRecovery: false,
    enableHealthMonitoring: false,
    fallbackImagePreference: 'fast_loading'
  })

  return {
    fallbackState,
    isOnline,
    isOffline,
    getFallbackImage,
    getOfflineResponse
  }
}

/**
 * Hook for recovery operations only
 */
export function useRecoveryMechanisms() {
  const {
    recoveryState,
    executeRecovery,
    recoveryStats
  } = useComprehensiveFallback({
    enableOfflineMode: false,
    enableHealthMonitoring: false
  })

  return {
    recoveryState,
    executeRecovery,
    recoveryStats
  }
}

/**
 * Hook for offline capabilities only
 */
export function useOfflineCapabilities() {
  const {
    offlineCapability,
    isOffline,
    getOfflineResponse,
    offlineStats
  } = useComprehensiveFallback({
    enableAutoRecovery: false,
    enableHealthMonitoring: false
  })

  return {
    offlineCapability,
    isOffline,
    getOfflineResponse,
    offlineStats
  }
}