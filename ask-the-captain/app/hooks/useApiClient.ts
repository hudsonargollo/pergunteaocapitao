/**
 * React Hook for API Client
 * 
 * Provides React integration for the API client with:
 * - Loading state management
 * - Automatic cleanup
 * - Type-safe API calls
 * - Error handling
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  ApiClient, 
  apiClient as defaultClient,
  type ApiResponse,
  type LoadingState,
  type ApiError
} from '@/app/lib/api-client'
import type { 
  ChatResponse, 
  ImageGenerationRequest, 
  ImageGenerationResponse
} from '@/types'

export interface UseApiClientOptions {
  client?: ApiClient
  autoAbortOnUnmount?: boolean
}

export interface UseApiClientResult {
  // Loading state
  isLoading: boolean
  operation: string | null
  
  // API methods
  sendMessage: (message: string, conversationId?: string) => Promise<ApiResponse<ChatResponse>>
  generateImage: (request: ImageGenerationRequest) => Promise<ApiResponse<ImageGenerationResponse>>
  getImageMetadata: (imageId: string) => Promise<ApiResponse<any>>
  
  // Utility methods
  abort: () => void
  clearError: () => void
  
  // Error state
  lastError: ApiError | null
}

/**
 * Main API client hook
 */
export function useApiClient(options: UseApiClientOptions = {}): UseApiClientResult {
  const { 
    client = defaultClient, 
    autoAbortOnUnmount = true 
  } = options

  // State management
  const [loadingState, setLoadingState] = useState<LoadingState>(client.getLoadingState())
  const [lastError, setLastError] = useState<ApiError | null>(null)
  
  // Abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null)

  // Subscribe to loading state changes
  useEffect(() => {
    const unsubscribe = client.onLoadingStateChange(setLoadingState)
    return unsubscribe
  }, [client])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoAbortOnUnmount && abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [autoAbortOnUnmount])

  // Create new abort controller for requests
  const createAbortController = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    return abortControllerRef.current
  }, [])

  // Send chat message
  const sendMessage = useCallback(async (
    message: string, 
    conversationId?: string
  ): Promise<ApiResponse<ChatResponse>> => {
    const controller = createAbortController()
    setLastError(null)

    try {
      const response = await client.sendChatMessage(message, conversationId, {
        signal: controller.signal
      })

      if (!response.success && response.error) {
        setLastError(response.error)
      }

      return response
    } catch (error) {
      const apiError: ApiError = {
        code: 'HOOK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        retryable: false
      }
      setLastError(apiError)
      return { success: false, error: apiError }
    }
  }, [client, createAbortController])

  // Generate image
  const generateImage = useCallback(async (
    request: ImageGenerationRequest
  ): Promise<ApiResponse<ImageGenerationResponse>> => {
    const controller = createAbortController()
    setLastError(null)

    try {
      const response = await client.generateImage(request, {
        signal: controller.signal
      })

      if (!response.success && response.error) {
        setLastError(response.error)
      }

      return response
    } catch (error) {
      const apiError: ApiError = {
        code: 'HOOK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        retryable: false
      }
      setLastError(apiError)
      return { success: false, error: apiError }
    }
  }, [client, createAbortController])

  // Get image metadata
  const getImageMetadata = useCallback(async (
    imageId: string
  ): Promise<ApiResponse<any>> => {
    const controller = createAbortController()
    setLastError(null)

    try {
      const response = await client.getImageMetadata(imageId, {
        signal: controller.signal
      })

      if (!response.success && response.error) {
        setLastError(response.error)
      }

      return response
    } catch (error) {
      const apiError: ApiError = {
        code: 'HOOK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        retryable: false
      }
      setLastError(apiError)
      return { success: false, error: apiError }
    }
  }, [client, createAbortController])

  // Abort current requests
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  // Clear error state
  const clearError = useCallback(() => {
    setLastError(null)
  }, [])

  return {
    isLoading: loadingState.isLoading,
    operation: loadingState.operation,
    sendMessage,
    generateImage,
    getImageMetadata,
    abort,
    clearError,
    lastError
  }
}

/**
 * Specialized hook for chat functionality
 */
export interface UseChatApiOptions extends UseApiClientOptions {
  onMessageSent?: (response: ApiResponse<ChatResponse>) => void
  onError?: (error: ApiError) => void
}

export interface UseChatApiResult {
  sendMessage: (message: string, conversationId?: string) => Promise<void>
  isLoading: boolean
  lastResponse: ChatResponse | null
  lastError: ApiError | null
  clearError: () => void
}

export function useChatApi(options: UseChatApiOptions = {}): UseChatApiResult {
  const { onMessageSent, onError, ...apiOptions } = options
  const apiClient = useApiClient(apiOptions)
  
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null)

  const sendMessage = useCallback(async (message: string, conversationId?: string) => {
    const response = await apiClient.sendMessage(message, conversationId)
    
    if (response.success && response.data) {
      setLastResponse(response.data)
      onMessageSent?.(response)
    } else if (response.error) {
      onError?.(response.error)
    }
  }, [apiClient.sendMessage, onMessageSent, onError])

  return {
    sendMessage,
    isLoading: apiClient.isLoading,
    lastResponse,
    lastError: apiClient.lastError,
    clearError: apiClient.clearError
  }
}

/**
 * Specialized hook for image generation
 */
export interface UseImageGenerationOptions extends UseApiClientOptions {
  onImageGenerated?: (response: ApiResponse<ImageGenerationResponse>) => void
  onError?: (error: ApiError) => void
}

export interface UseImageGenerationResult {
  generateImage: (request: ImageGenerationRequest) => Promise<void>
  isLoading: boolean
  lastImage: ImageGenerationResponse | null
  lastError: ApiError | null
  clearError: () => void
}

export function useImageGeneration(options: UseImageGenerationOptions = {}): UseImageGenerationResult {
  const { onImageGenerated, onError, ...apiOptions } = options
  const apiClient = useApiClient(apiOptions)
  
  const [lastImage, setLastImage] = useState<ImageGenerationResponse | null>(null)

  const generateImage = useCallback(async (request: ImageGenerationRequest) => {
    const response = await apiClient.generateImage(request)
    
    if (response.success && response.data) {
      setLastImage(response.data)
      onImageGenerated?.(response)
    } else if (response.error) {
      onError?.(response.error)
    }
  }, [apiClient.generateImage, onImageGenerated, onError])

  return {
    generateImage,
    isLoading: apiClient.isLoading,
    lastImage,
    lastError: apiClient.lastError,
    clearError: apiClient.clearError
  }
}