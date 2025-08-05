/**
 * API Client for Ask the Captain
 * 
 * Provides typed API client for chat and image endpoints with:
 * - Request/response handling with error management
 * - Loading state management for UI components
 * - Retry logic for failed API calls
 * - Type safety for all API interactions
 */

import type { 
  ChatRequest, 
  ChatResponse, 
  ImageGenerationRequest, 
  ImageGenerationResponse,
  ErrorResponse 
} from '@/types'

// API Client Configuration
export interface ApiClientConfig {
  baseUrl?: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
  enableLogging?: boolean
}

// Request options for individual API calls
export interface RequestOptions {
  timeout?: number
  retryAttempts?: number
  signal?: AbortSignal
}

// Loading state management
export interface LoadingState {
  isLoading: boolean
  operation: string | null
  progress?: number
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  metadata?: {
    processingTime?: number
    searchResults?: number
    fallbackUsed?: boolean
    imageId?: string
    tonePrimary?: string
    toneIntensity?: string
  }
}

// Enhanced error information
export interface ApiError {
  code: string
  message: string
  details?: object
  timestamp: string
  fallback?: {
    response?: string
    imageUrl?: string
  }
  retryable?: boolean
  statusCode?: number
}

// Default configuration
const DEFAULT_CONFIG: Required<ApiClientConfig> = {
  baseUrl: '',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  enableLogging: process.env.NODE_ENV === 'development'
}

/**
 * Main API Client class
 */
export class ApiClient {
  private config: Required<ApiClientConfig>
  private loadingState: LoadingState = { isLoading: false, operation: null }
  private loadingCallbacks: Set<(state: LoadingState) => void> = new Set()

  constructor(config: ApiClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Subscribe to loading state changes
   */
  onLoadingStateChange(callback: (state: LoadingState) => void): () => void {
    this.loadingCallbacks.add(callback)
    // Return unsubscribe function
    return () => this.loadingCallbacks.delete(callback)
  }

  /**
   * Get current loading state
   */
  getLoadingState(): LoadingState {
    return { ...this.loadingState }
  }

  /**
   * Update loading state and notify subscribers
   */
  private updateLoadingState(state: Partial<LoadingState>) {
    this.loadingState = { ...this.loadingState, ...state }
    this.loadingCallbacks.forEach(callback => callback(this.loadingState))
  }

  /**
   * Send chat message to the API
   */
  async sendChatMessage(
    message: string, 
    conversationId?: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<ChatResponse>> {
    const operation = 'chat'
    this.updateLoadingState({ isLoading: true, operation })

    try {
      const request: ChatRequest = { message, conversationId }
      
      const response = await this.makeRequest<ChatResponse>(
        '/api/chat',
        {
          method: 'POST',
          body: JSON.stringify(request),
          headers: { 'Content-Type': 'application/json' }
        },
        options
      )

      return response
    } finally {
      this.updateLoadingState({ isLoading: false, operation: null })
    }
  }

  /**
   * Generate image via the API
   */
  async generateImage(
    request: ImageGenerationRequest,
    options: RequestOptions = {}
  ): Promise<ApiResponse<ImageGenerationResponse>> {
    const operation = 'image-generation'
    this.updateLoadingState({ isLoading: true, operation })

    try {
      const response = await this.makeRequest<ImageGenerationResponse>(
        '/api/v1/images/generate',
        {
          method: 'POST',
          body: JSON.stringify(request),
          headers: { 'Content-Type': 'application/json' }
        },
        options
      )

      return response
    } finally {
      this.updateLoadingState({ isLoading: false, operation: null })
    }
  }

  /**
   * Get image metadata
   */
  async getImageMetadata(
    imageId: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<any>> {
    const operation = 'image-metadata'
    this.updateLoadingState({ isLoading: true, operation })

    try {
      const response = await this.makeRequest<any>(
        `/api/v1/images/generate?imageId=${encodeURIComponent(imageId)}`,
        { method: 'GET' },
        options
      )

      return response
    } finally {
      this.updateLoadingState({ isLoading: false, operation: null })
    }
  }

  /**
   * Core request method with retry logic and error handling
   */
  private async makeRequest<T>(
    endpoint: string,
    init: RequestInit,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`
    const timeout = options.timeout || this.config.timeout
    const maxRetries = options.retryAttempts ?? this.config.retryAttempts

    let lastError: ApiError | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (this.config.enableLogging) {
          console.log(`API Request [Attempt ${attempt + 1}/${maxRetries + 1}]:`, {
            url,
            method: init.method,
            headers: init.headers
          })
        }

        // Create abort controller for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        // Combine signals if provided
        const signal = options.signal 
          ? this.combineAbortSignals([controller.signal, options.signal])
          : controller.signal

        const response = await fetch(url, {
          ...init,
          signal
        })

        clearTimeout(timeoutId)

        // Extract metadata from headers
        const metadata = this.extractMetadata(response)

        if (!response.ok) {
          const errorData = await this.parseErrorResponse(response)
          lastError = {
            ...errorData,
            statusCode: response.status,
            retryable: this.isRetryableError(response.status)
          }

          if (this.config.enableLogging) {
            console.error('API Error Response:', lastError)
          }

          // Don't retry non-retryable errors
          if (!lastError.retryable) {
            return { success: false, error: lastError, metadata }
          }

          // Continue to retry logic
        } else {
          // Success case
          const data = await response.json() as T

          if (this.config.enableLogging) {
            console.log('API Success Response:', { data, metadata })
          }

          return { success: true, data, metadata }
        }
      } catch (error) {
        if (this.config.enableLogging) {
          console.error(`API Request failed [Attempt ${attempt + 1}]:`, error)
        }

        lastError = this.createErrorFromException(error)

        // Don't retry if aborted by user
        if (error instanceof Error && error.name === 'AbortError') {
          break
        }
      }

      // Wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        const delay = this.calculateRetryDelay(attempt)
        await this.sleep(delay)
      }
    }

    return { success: false, error: lastError! }
  }

  /**
   * Extract metadata from response headers
   */
  private extractMetadata(response: Response): ApiResponse<any>['metadata'] {
    const metadata: any = {}

    const processingTime = response.headers.get('X-Processing-Time')
    if (processingTime) metadata.processingTime = parseInt(processingTime, 10)

    const searchResults = response.headers.get('X-Search-Results')
    if (searchResults) metadata.searchResults = parseInt(searchResults, 10)

    const fallbackUsed = response.headers.get('X-Fallback-Used')
    if (fallbackUsed) metadata.fallbackUsed = fallbackUsed === 'true'

    const imageId = response.headers.get('X-Image-ID')
    if (imageId) metadata.imageId = imageId

    const tonePrimary = response.headers.get('X-Tone-Primary')
    if (tonePrimary) metadata.tonePrimary = tonePrimary

    const toneIntensity = response.headers.get('X-Tone-Intensity')
    if (toneIntensity) metadata.toneIntensity = toneIntensity

    return Object.keys(metadata).length > 0 ? metadata : undefined
  }

  /**
   * Parse error response from API
   */
  private async parseErrorResponse(response: Response): Promise<ApiError> {
    try {
      const errorData = await response.json() as ErrorResponse
      return {
        code: errorData.error.code,
        message: errorData.error.message,
        details: errorData.error.details,
        timestamp: errorData.error.timestamp,
        fallback: errorData.fallback,
        retryable: this.isRetryableError(response.status)
      }
    } catch {
      return {
        code: 'PARSE_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
        timestamp: new Date().toISOString(),
        retryable: this.isRetryableError(response.status)
      }
    }
  }

  /**
   * Create error from JavaScript exception
   */
  private createErrorFromException(error: unknown): ApiError {
    if (error instanceof Error) {
      return {
        code: error.name === 'AbortError' ? 'REQUEST_ABORTED' : 'NETWORK_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
        retryable: error.name !== 'AbortError'
      }
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      timestamp: new Date().toISOString(),
      retryable: true
    }
  }

  /**
   * Determine if an HTTP status code indicates a retryable error
   */
  private isRetryableError(statusCode: number): boolean {
    // Retry on server errors and rate limiting
    return statusCode >= 500 || statusCode === 429
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelay
    const exponentialDelay = baseDelay * Math.pow(2, attempt)
    const jitter = Math.random() * 0.1 * exponentialDelay
    return Math.min(exponentialDelay + jitter, 10000) // Cap at 10 seconds
  }

  /**
   * Combine multiple AbortSignals
   */
  private combineAbortSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController()

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort()
        break
      }
      signal.addEventListener('abort', () => controller.abort())
    }

    return controller.signal
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient()

/**
 * Utility functions for API client
 */

/**
 * Create a configured API client instance
 */
export function createApiClient(config: ApiClientConfig = {}): ApiClient {
  return new ApiClient(config)
}

/**
 * Validate API response structure
 */
export function isValidApiResponse<T>(response: any): response is ApiResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    typeof response.success === 'boolean' &&
    (response.success === false || response.data !== undefined)
  )
}