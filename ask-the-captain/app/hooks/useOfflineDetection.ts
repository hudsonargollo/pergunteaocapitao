'use client'

import { useState, useEffect, useCallback } from 'react'

interface OfflineState {
  isOffline: boolean
  isOnline: boolean
  lastOnline: Date | null
  offlineDuration: number
}

interface OfflineDetectionOptions {
  checkInterval?: number
  pingUrl?: string
  timeout?: number
  retryAttempts?: number
}

/**
 * Hook for detecting offline/online state with Captain-themed messaging
 */
export function useOfflineDetection(options: OfflineDetectionOptions = {}) {
  const {
    checkInterval = 30000, // 30 seconds
    pingUrl = '/api/health',
    timeout = 5000,
    retryAttempts = 3
  } = options

  const [state, setState] = useState<OfflineState>({
    isOffline: false,
    isOnline: true,
    lastOnline: new Date(),
    offlineDuration: 0
  })

  const [isChecking, setIsChecking] = useState(false)

  // Check online status by attempting to fetch a lightweight endpoint
  const checkOnlineStatus = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return true

    // First check navigator.onLine (basic check)
    if (!navigator.onLine) {
      return false
    }

    // Then perform actual network check
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      console.warn('Network check failed:', error)
      return false
    }
  }, [pingUrl, timeout])

  // Perform online check with retries
  const checkWithRetries = useCallback(async (): Promise<boolean> => {
    setIsChecking(true)
    
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      const isOnline = await checkOnlineStatus()
      
      if (isOnline) {
        setIsChecking(false)
        return true
      }

      // Wait before retry (exponential backoff)
      if (attempt < retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }

    setIsChecking(false)
    return false
  }, [checkOnlineStatus, retryAttempts])

  // Update state based on online status
  const updateOnlineStatus = useCallback(async () => {
    const isOnline = await checkWithRetries()
    const now = new Date()

    setState(prevState => {
      const wasOffline = prevState.isOffline
      const isNowOffline = !isOnline

      // Calculate offline duration
      let offlineDuration = prevState.offlineDuration
      if (wasOffline && prevState.lastOnline) {
        offlineDuration = now.getTime() - prevState.lastOnline.getTime()
      }

      return {
        isOffline: isNowOffline,
        isOnline,
        lastOnline: isOnline ? now : prevState.lastOnline,
        offlineDuration: isNowOffline ? offlineDuration : 0
      }
    })
  }, [checkWithRetries])

  // Handle browser online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      console.log('Browser detected online status')
      updateOnlineStatus()
    }

    const handleOffline = () => {
      console.log('Browser detected offline status')
      setState(prevState => ({
        ...prevState,
        isOffline: true,
        isOnline: false
      }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [updateOnlineStatus])

  // Periodic online status check
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initial check
    updateOnlineStatus()

    // Set up interval for periodic checks
    const intervalId = setInterval(updateOnlineStatus, checkInterval)

    return () => clearInterval(intervalId)
  }, [updateOnlineStatus, checkInterval])

  // Get Captain-themed offline message
  const getOfflineMessage = useCallback((): string => {
    const duration = state.offlineDuration
    const minutes = Math.floor(duration / (1000 * 60))

    if (minutes < 1) {
      return 'Conexão perdida, guerreiro. Mas a disciplina não depende de conectividade. Continue trabalhando em seus objetivos offline.'
    } else if (minutes < 5) {
      return 'Sem conexão há alguns minutos. Use este tempo para reflexão e planejamento estratégico. A caverna ensina paciência.'
    } else if (minutes < 30) {
      return 'Desconectado há um tempo, guerreiro. Mesmo isolado, um verdadeiro guerreiro continua sua jornada de autodisciplina.'
    } else {
      return 'Longa desconexão detectada. Mas lembre-se: a verdadeira transformação acontece independente de sistemas externos. Continue focado.'
    }
  }, [state.offlineDuration])

  // Get reconnection message
  const getReconnectionMessage = useCallback((): string => {
    const duration = state.offlineDuration
    const minutes = Math.floor(duration / (1000 * 60))

    if (minutes < 1) {
      return 'Conexão restaurada, guerreiro! Continuemos nossa jornada de transformação.'
    } else if (minutes < 5) {
      return 'De volta online! Espero que tenha usado esse tempo offline para reflexão e planejamento.'
    } else {
      return 'Reconectado após um período offline. Bem-vindo de volta, guerreiro. Vamos retomar nossa disciplina digital.'
    }
  }, [state.offlineDuration])

  // Manual retry function
  const retry = useCallback(async (): Promise<boolean> => {
    const isOnline = await checkWithRetries()
    if (isOnline) {
      setState(prevState => ({
        ...prevState,
        isOffline: false,
        isOnline: true,
        lastOnline: new Date(),
        offlineDuration: 0
      }))
    }
    return isOnline
  }, [checkWithRetries])

  return {
    ...state,
    isChecking,
    getOfflineMessage,
    getReconnectionMessage,
    retry,
    checkOnlineStatus: updateOnlineStatus
  }
}

/**
 * Component for displaying offline status with Captain messaging
 */
export function OfflineIndicator() {
  const { 
    isOffline, 
    isChecking, 
    getOfflineMessage, 
    getReconnectionMessage, 
    retry 
  } = useOfflineDetection()

  const [showReconnected, setShowReconnected] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  // Show reconnection message briefly when coming back online
  useEffect(() => {
    if (wasOffline && !isOffline) {
      setShowReconnected(true)
      const timer = setTimeout(() => setShowReconnected(false), 5000)
      return () => clearTimeout(timer)
    }
    setWasOffline(isOffline)
  }, [isOffline, wasOffline])

  if (showReconnected) {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-sm">
        <div className="glass-container p-4 border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-300 font-medium">
                Conexão Restaurada
              </p>
              <p className="text-xs text-gray-300 mt-1">
                {getReconnectionMessage()}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isOffline) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="glass-container p-4 border-l-4 border-yellow-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-300 font-medium">
                Modo Offline
              </p>
              <p className="text-xs text-gray-300 mt-1">
                {getOfflineMessage()}
              </p>
            </div>
          </div>
          <button
            onClick={retry}
            disabled={isChecking}
            className="ml-4 px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 text-white rounded transition-colors duration-200"
          >
            {isChecking ? 'Verificando...' : 'Tentar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook for handling offline-capable operations
 */
export function useOfflineCapableOperation<T>(
  operation: () => Promise<T>,
  fallback: () => T,
  options: { retryOnReconnect?: boolean } = {}
) {
  const { isOffline, isOnline } = useOfflineDetection()
  const [pendingOperations, setPendingOperations] = useState<(() => Promise<T>)[]>([])
  const { retryOnReconnect = true } = options

  // Execute pending operations when coming back online
  useEffect(() => {
    if (isOnline && retryOnReconnect && pendingOperations.length > 0) {
      console.log(`Executing ${pendingOperations.length} pending operations`)
      
      pendingOperations.forEach(async (pendingOp) => {
        try {
          await pendingOp()
        } catch (error) {
          console.error('Failed to execute pending operation:', error)
        }
      })
      
      setPendingOperations([])
    }
  }, [isOnline, pendingOperations, retryOnReconnect])

  const executeOperation = useCallback(async (): Promise<T> => {
    if (isOffline) {
      console.log('Offline: using fallback for operation')
      
      if (retryOnReconnect) {
        setPendingOperations(prev => [...prev, operation])
      }
      
      return fallback()
    }

    try {
      return await operation()
    } catch (error) {
      console.error('Operation failed, using fallback:', error)
      
      if (retryOnReconnect) {
        setPendingOperations(prev => [...prev, operation])
      }
      
      return fallback()
    }
  }, [isOffline, operation, fallback, retryOnReconnect])

  return {
    executeOperation,
    isOffline,
    pendingOperationsCount: pendingOperations.length
  }
}