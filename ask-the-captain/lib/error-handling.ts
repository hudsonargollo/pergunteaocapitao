// Comprehensive error handling system for Ask the Captain
import type { ErrorResponse, ToneAnalysis } from '@/types'

/**
 * Error classification system for different failure types
 */
export enum ErrorType {
  // User input errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_JSON = 'INVALID_JSON',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Authentication and authorization
  MISSING_API_KEY = 'MISSING_API_KEY',
  INVALID_API_KEY = 'INVALID_API_KEY',
  UNAUTHORIZED = 'UNAUTHORIZED',
  
  // External service errors
  OPENAI_API_ERROR = 'OPENAI_API_ERROR',
  OPENAI_RATE_LIMIT = 'OPENAI_RATE_LIMIT',
  OPENAI_QUOTA_EXCEEDED = 'OPENAI_QUOTA_EXCEEDED',
  EMBEDDING_GENERATION_FAILED = 'EMBEDDING_GENERATION_FAILED',
  CHAT_COMPLETION_FAILED = 'CHAT_COMPLETION_FAILED',
  IMAGE_GENERATION_FAILED = 'IMAGE_GENERATION_FAILED',
  
  // Cloudflare service errors
  VECTORIZE_ERROR = 'VECTORIZE_ERROR',
  VECTORIZE_TIMEOUT = 'VECTORIZE_TIMEOUT',
  D1_DATABASE_ERROR = 'D1_DATABASE_ERROR',
  R2_STORAGE_ERROR = 'R2_STORAGE_ERROR',
  
  // Search and processing errors
  SEMANTIC_SEARCH_FAILED = 'SEMANTIC_SEARCH_FAILED',
  KNOWLEDGE_BASE_UNAVAILABLE = 'KNOWLEDGE_BASE_UNAVAILABLE',
  CONTEXT_PROCESSING_FAILED = 'CONTEXT_PROCESSING_FAILED',
  
  // Image processing errors
  IMAGE_DOWNLOAD_FAILED = 'IMAGE_DOWNLOAD_FAILED',
  IMAGE_UPLOAD_FAILED = 'IMAGE_UPLOAD_FAILED',
  IMAGE_PROCESSING_FAILED = 'IMAGE_PROCESSING_FAILED',
  STORAGE_FAILED = 'STORAGE_FAILED',
  METADATA_RETRIEVAL_FAILED = 'METADATA_RETRIEVAL_FAILED',
  
  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  
  // Data consistency errors
  DATABASE_CONSTRAINT_VIOLATION = 'DATABASE_CONSTRAINT_VIOLATION',
  VECTOR_INDEX_CORRUPTION = 'VECTOR_INDEX_CORRUPTION',
  DATA_INTEGRITY_ERROR = 'DATA_INTEGRITY_ERROR'
}

/**
 * Error severity levels for monitoring and alerting
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error recovery strategies
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  GRACEFUL_DEGRADATION = 'graceful_degradation',
  FAIL_FAST = 'fail_fast',
  USER_INTERVENTION = 'user_intervention'
}

/**
 * Comprehensive error class with classification and recovery information
 */
export class CaptainError extends Error {
  public readonly type: ErrorType
  public readonly severity: ErrorSeverity
  public readonly recoveryStrategy: RecoveryStrategy
  public readonly userMessage: string
  public readonly details: Record<string, any>
  public readonly timestamp: string
  public readonly retryable: boolean
  public readonly fallbackAvailable: boolean

  constructor(
    type: ErrorType,
    message: string,
    options: {
      severity?: ErrorSeverity
      recoveryStrategy?: RecoveryStrategy
      userMessage?: string
      details?: Record<string, any>
      cause?: Error
      retryable?: boolean
      fallbackAvailable?: boolean
    } = {}
  ) {
    super(message)
    this.name = 'CaptainError'
    this.type = type
    this.severity = options.severity || this.getDefaultSeverity(type)
    this.recoveryStrategy = options.recoveryStrategy || this.getDefaultRecoveryStrategy(type)
    this.userMessage = options.userMessage || this.generateUserMessage(type)
    this.details = options.details || {}
    this.timestamp = new Date().toISOString()
    this.retryable = options.retryable ?? this.isRetryableByDefault(type)
    this.fallbackAvailable = options.fallbackAvailable ?? this.hasFallbackByDefault(type)

    if (options.cause) {
      this.cause = options.cause
    }
  }

  private getDefaultSeverity(type: ErrorType): ErrorSeverity {
    const severityMap: Record<ErrorType, ErrorSeverity> = {
      [ErrorType.VALIDATION_ERROR]: ErrorSeverity.LOW,
      [ErrorType.INVALID_JSON]: ErrorSeverity.LOW,
      [ErrorType.MISSING_PARAMETER]: ErrorSeverity.LOW,
      [ErrorType.RATE_LIMIT_EXCEEDED]: ErrorSeverity.MEDIUM,
      
      [ErrorType.MISSING_API_KEY]: ErrorSeverity.CRITICAL,
      [ErrorType.INVALID_API_KEY]: ErrorSeverity.HIGH,
      [ErrorType.UNAUTHORIZED]: ErrorSeverity.HIGH,
      
      [ErrorType.OPENAI_API_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.OPENAI_RATE_LIMIT]: ErrorSeverity.MEDIUM,
      [ErrorType.OPENAI_QUOTA_EXCEEDED]: ErrorSeverity.HIGH,
      [ErrorType.EMBEDDING_GENERATION_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.CHAT_COMPLETION_FAILED]: ErrorSeverity.HIGH,
      [ErrorType.IMAGE_GENERATION_FAILED]: ErrorSeverity.MEDIUM,
      
      [ErrorType.VECTORIZE_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.VECTORIZE_TIMEOUT]: ErrorSeverity.MEDIUM,
      [ErrorType.D1_DATABASE_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.R2_STORAGE_ERROR]: ErrorSeverity.MEDIUM,
      
      [ErrorType.SEMANTIC_SEARCH_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.KNOWLEDGE_BASE_UNAVAILABLE]: ErrorSeverity.HIGH,
      [ErrorType.CONTEXT_PROCESSING_FAILED]: ErrorSeverity.MEDIUM,
      
      [ErrorType.IMAGE_DOWNLOAD_FAILED]: ErrorSeverity.LOW,
      [ErrorType.IMAGE_UPLOAD_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.IMAGE_PROCESSING_FAILED]: ErrorSeverity.LOW,
      [ErrorType.STORAGE_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.METADATA_RETRIEVAL_FAILED]: ErrorSeverity.LOW,
      
      [ErrorType.INTERNAL_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.SERVICE_UNAVAILABLE]: ErrorSeverity.HIGH,
      [ErrorType.TIMEOUT_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.MEMORY_LIMIT_EXCEEDED]: ErrorSeverity.HIGH,
      
      [ErrorType.DATABASE_CONSTRAINT_VIOLATION]: ErrorSeverity.MEDIUM,
      [ErrorType.VECTOR_INDEX_CORRUPTION]: ErrorSeverity.CRITICAL,
      [ErrorType.DATA_INTEGRITY_ERROR]: ErrorSeverity.HIGH
    }

    return severityMap[type] || ErrorSeverity.MEDIUM
  }

  private getDefaultRecoveryStrategy(type: ErrorType): RecoveryStrategy {
    const strategyMap: Record<ErrorType, RecoveryStrategy> = {
      [ErrorType.VALIDATION_ERROR]: RecoveryStrategy.USER_INTERVENTION,
      [ErrorType.INVALID_JSON]: RecoveryStrategy.USER_INTERVENTION,
      [ErrorType.MISSING_PARAMETER]: RecoveryStrategy.USER_INTERVENTION,
      [ErrorType.RATE_LIMIT_EXCEEDED]: RecoveryStrategy.RETRY,
      
      [ErrorType.MISSING_API_KEY]: RecoveryStrategy.FAIL_FAST,
      [ErrorType.INVALID_API_KEY]: RecoveryStrategy.FAIL_FAST,
      [ErrorType.UNAUTHORIZED]: RecoveryStrategy.FAIL_FAST,
      
      [ErrorType.OPENAI_API_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.OPENAI_RATE_LIMIT]: RecoveryStrategy.RETRY,
      [ErrorType.OPENAI_QUOTA_EXCEEDED]: RecoveryStrategy.FALLBACK,
      [ErrorType.EMBEDDING_GENERATION_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.CHAT_COMPLETION_FAILED]: RecoveryStrategy.FALLBACK,
      [ErrorType.IMAGE_GENERATION_FAILED]: RecoveryStrategy.FALLBACK,
      
      [ErrorType.VECTORIZE_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.VECTORIZE_TIMEOUT]: RecoveryStrategy.RETRY,
      [ErrorType.D1_DATABASE_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.R2_STORAGE_ERROR]: RecoveryStrategy.RETRY,
      
      [ErrorType.SEMANTIC_SEARCH_FAILED]: RecoveryStrategy.FALLBACK,
      [ErrorType.KNOWLEDGE_BASE_UNAVAILABLE]: RecoveryStrategy.FALLBACK,
      [ErrorType.CONTEXT_PROCESSING_FAILED]: RecoveryStrategy.GRACEFUL_DEGRADATION,
      
      [ErrorType.IMAGE_DOWNLOAD_FAILED]: RecoveryStrategy.FALLBACK,
      [ErrorType.IMAGE_UPLOAD_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.IMAGE_PROCESSING_FAILED]: RecoveryStrategy.FALLBACK,
      [ErrorType.STORAGE_FAILED]: RecoveryStrategy.RETRY,
      [ErrorType.METADATA_RETRIEVAL_FAILED]: RecoveryStrategy.GRACEFUL_DEGRADATION,
      
      [ErrorType.INTERNAL_ERROR]: RecoveryStrategy.GRACEFUL_DEGRADATION,
      [ErrorType.SERVICE_UNAVAILABLE]: RecoveryStrategy.RETRY,
      [ErrorType.TIMEOUT_ERROR]: RecoveryStrategy.RETRY,
      [ErrorType.MEMORY_LIMIT_EXCEEDED]: RecoveryStrategy.GRACEFUL_DEGRADATION,
      
      [ErrorType.DATABASE_CONSTRAINT_VIOLATION]: RecoveryStrategy.USER_INTERVENTION,
      [ErrorType.VECTOR_INDEX_CORRUPTION]: RecoveryStrategy.FAIL_FAST,
      [ErrorType.DATA_INTEGRITY_ERROR]: RecoveryStrategy.GRACEFUL_DEGRADATION
    }

    return strategyMap[type] || RecoveryStrategy.GRACEFUL_DEGRADATION
  }

  private generateUserMessage(type: ErrorType): string {
    const userMessages: Record<ErrorType, string> = {
      [ErrorType.VALIDATION_ERROR]: 'Guerreiro, verifique sua mensagem e tente novamente. A disciplina começa com a atenção aos detalhes.',
      [ErrorType.INVALID_JSON]: 'Formato de dados inválido. Reorganize sua abordagem e tente novamente.',
      [ErrorType.MISSING_PARAMETER]: 'Informações incompletas. Um guerreiro sempre verifica seus recursos antes da batalha.',
      [ErrorType.RATE_LIMIT_EXCEEDED]: 'Muitas tentativas, guerreiro. A paciência é uma virtude do cave mode. Aguarde um momento.',
      
      [ErrorType.MISSING_API_KEY]: 'Sistema não configurado adequadamente. Entre em contato com o suporte.',
      [ErrorType.INVALID_API_KEY]: 'Credenciais inválidas. Verifique a configuração do sistema.',
      [ErrorType.UNAUTHORIZED]: 'Acesso não autorizado. Verifique suas permissões.',
      
      [ErrorType.OPENAI_API_ERROR]: 'Dificuldades técnicas temporárias, guerreiro. A persistência é fundamental - tente novamente.',
      [ErrorType.OPENAI_RATE_LIMIT]: 'Sistema sobrecarregado. Use este tempo para refletir sobre sua próxima ação.',
      [ErrorType.OPENAI_QUOTA_EXCEEDED]: 'Limite de uso atingido. Mesmo na caverna, os recursos são finitos.',
      [ErrorType.EMBEDDING_GENERATION_FAILED]: 'Falha no processamento da consulta. Reformule sua pergunta e tente novamente.',
      [ErrorType.CHAT_COMPLETION_FAILED]: 'Não consegui processar sua mensagem no momento. A persistência vence os obstáculos.',
      [ErrorType.IMAGE_GENERATION_FAILED]: 'Falha na geração da imagem. Continuemos com o texto - a essência está na mensagem.',
      
      [ErrorType.VECTORIZE_ERROR]: 'Sistema de busca temporariamente indisponível. Foque no que você pode controlar agora.',
      [ErrorType.VECTORIZE_TIMEOUT]: 'Busca demorou mais que o esperado. A paciência é uma virtude do guerreiro.',
      [ErrorType.D1_DATABASE_ERROR]: 'Problema no armazenamento de dados. Seus progressos não se perdem - continue.',
      [ErrorType.R2_STORAGE_ERROR]: 'Falha no armazenamento de arquivos. O importante é a ação, não o registro.',
      
      [ErrorType.SEMANTIC_SEARCH_FAILED]: 'Sistema de busca indisponível. Mas lembre-se: a verdadeira sabedoria vem da ação.',
      [ErrorType.KNOWLEDGE_BASE_UNAVAILABLE]: 'Base de conhecimento temporariamente inacessível. Use sua experiência interna.',
      [ErrorType.CONTEXT_PROCESSING_FAILED]: 'Dificuldade no processamento. Simplifique sua abordagem e tente novamente.',
      
      [ErrorType.IMAGE_DOWNLOAD_FAILED]: 'Falha no download da imagem. O foco deve estar na mensagem, não na visualização.',
      [ErrorType.IMAGE_UPLOAD_FAILED]: 'Falha no upload da imagem. Tentarei novamente - a persistência é chave.',
      [ErrorType.IMAGE_PROCESSING_FAILED]: 'Erro no processamento da imagem. Continuemos sem ela - a ação é o que importa.',
      [ErrorType.STORAGE_FAILED]: 'Falha no armazenamento. Seus progressos reais estão nas suas ações, não nos registros.',
      [ErrorType.METADATA_RETRIEVAL_FAILED]: 'Falha na recuperação de informações. Foque no presente e na próxima ação.',
      
      [ErrorType.INTERNAL_ERROR]: 'Erro interno do sistema. Mesmo na adversidade, o guerreiro encontra oportunidades.',
      [ErrorType.SERVICE_UNAVAILABLE]: 'Serviço temporariamente indisponível. Use este tempo para reflexão e planejamento.',
      [ErrorType.TIMEOUT_ERROR]: 'Operação demorou mais que o esperado. A paciência é fundamental no cave mode.',
      [ErrorType.MEMORY_LIMIT_EXCEEDED]: 'Sistema sobrecarregado. Simplifique sua abordagem e tente novamente.',
      
      [ErrorType.DATABASE_CONSTRAINT_VIOLATION]: 'Conflito nos dados. Revise suas informações e tente novamente.',
      [ErrorType.VECTOR_INDEX_CORRUPTION]: 'Sistema de busca corrompido. Entre em contato com o suporte técnico.',
      [ErrorType.DATA_INTEGRITY_ERROR]: 'Inconsistência nos dados. Verificarei a integridade e continuaremos.'
    }

    return userMessages[type] || 'Obstáculo temporário, guerreiro. A persistência é a chave para superar qualquer desafio.'
  }

  private isRetryableByDefault(type: ErrorType): boolean {
    const retryableTypes = [
      ErrorType.RATE_LIMIT_EXCEEDED,
      ErrorType.OPENAI_API_ERROR,
      ErrorType.OPENAI_RATE_LIMIT,
      ErrorType.EMBEDDING_GENERATION_FAILED,
      ErrorType.VECTORIZE_ERROR,
      ErrorType.VECTORIZE_TIMEOUT,
      ErrorType.D1_DATABASE_ERROR,
      ErrorType.R2_STORAGE_ERROR,
      ErrorType.IMAGE_UPLOAD_FAILED,
      ErrorType.SERVICE_UNAVAILABLE,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.STORAGE_FAILED
    ]

    return retryableTypes.includes(type)
  }

  private hasFallbackByDefault(type: ErrorType): boolean {
    const fallbackTypes = [
      ErrorType.OPENAI_QUOTA_EXCEEDED,
      ErrorType.CHAT_COMPLETION_FAILED,
      ErrorType.IMAGE_GENERATION_FAILED,
      ErrorType.SEMANTIC_SEARCH_FAILED,
      ErrorType.KNOWLEDGE_BASE_UNAVAILABLE,
      ErrorType.IMAGE_DOWNLOAD_FAILED,
      ErrorType.IMAGE_PROCESSING_FAILED
    ]

    return fallbackTypes.includes(type)
  }

  /**
   * Convert to standardized error response format
   */
  toErrorResponse(): ErrorResponse {
    return {
      error: {
        code: this.type,
        message: this.userMessage,
        details: {
          ...this.details,
          severity: this.severity,
          recoveryStrategy: this.recoveryStrategy,
          retryable: this.retryable,
          fallbackAvailable: this.fallbackAvailable
        },
        timestamp: this.timestamp
      }
    }
  }

  /**
   * Check if error should trigger monitoring alert
   */
  shouldAlert(): boolean {
    return this.severity === ErrorSeverity.HIGH || this.severity === ErrorSeverity.CRITICAL
  }

  /**
   * Get monitoring tags for error tracking
   */
  getMonitoringTags(): Record<string, string> {
    return {
      error_type: this.type,
      severity: this.severity,
      recovery_strategy: this.recoveryStrategy,
      retryable: this.retryable.toString(),
      fallback_available: this.fallbackAvailable.toString()
    }
  }
}

/**
 * Retry configuration for exponential backoff
 */
export interface RetryConfig {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitterEnabled: boolean
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterEnabled: true
}

/**
 * Retry logic with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  errorContext?: string
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: Error = new Error('No attempts made')

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      // Don't retry if it's not a retryable error
      if (error instanceof CaptainError && !error.retryable) {
        throw error
      }

      // Don't retry on the last attempt
      if (attempt === finalConfig.maxAttempts) {
        break
      }

      // Calculate delay with exponential backoff
      const baseDelay = finalConfig.baseDelayMs * Math.pow(finalConfig.backoffMultiplier, attempt - 1)
      const jitter = finalConfig.jitterEnabled ? Math.random() * 0.1 * baseDelay : 0
      const delay = Math.min(baseDelay + jitter, finalConfig.maxDelayMs)

      console.warn(`Retry attempt ${attempt}/${finalConfig.maxAttempts} for ${errorContext || 'operation'} after ${delay}ms delay:`, error)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // If we get here, all retries failed
  throw new CaptainError(
    ErrorType.INTERNAL_ERROR,
    `Operation failed after ${finalConfig.maxAttempts} attempts: ${lastError.message}`,
    {
      severity: ErrorSeverity.HIGH,
      details: {
        attempts: finalConfig.maxAttempts,
        lastError: lastError.message,
        context: errorContext
      },
      cause: lastError
    }
  )
}

/**
 * Error handler factory for different contexts
 */
export class ErrorHandler {
  constructor(private context: string) {}

  /**
   * Handle and classify errors from external APIs
   */
  handleExternalApiError(error: any, service: string): CaptainError {
    if (error.code === 'rate_limit_exceeded') {
      return new CaptainError(
        ErrorType.OPENAI_RATE_LIMIT,
        `Rate limit exceeded for ${service}`,
        {
          details: { service, originalError: error.message },
          retryable: true
        }
      )
    }

    if (error.code === 'insufficient_quota') {
      return new CaptainError(
        ErrorType.OPENAI_QUOTA_EXCEEDED,
        `Quota exceeded for ${service}`,
        {
          details: { service, originalError: error.message },
          fallbackAvailable: true
        }
      )
    }

    if (error.code === 'invalid_api_key') {
      return new CaptainError(
        ErrorType.INVALID_API_KEY,
        `Invalid API key for ${service}`,
        {
          severity: ErrorSeverity.CRITICAL,
          details: { service }
        }
      )
    }

    // Generic external API error
    return new CaptainError(
      ErrorType.OPENAI_API_ERROR,
      `External API error from ${service}: ${error.message}`,
      {
        details: { service, originalError: error.message, code: error.code },
        retryable: true
      }
    )
  }

  /**
   * Handle database errors
   */
  handleDatabaseError(error: any, operation: string): CaptainError {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return new CaptainError(
        ErrorType.DATABASE_CONSTRAINT_VIOLATION,
        `Database constraint violation during ${operation}`,
        {
          details: { operation, constraint: 'unique', originalError: error.message }
        }
      )
    }

    if (error.message?.includes('timeout')) {
      return new CaptainError(
        ErrorType.TIMEOUT_ERROR,
        `Database timeout during ${operation}`,
        {
          details: { operation, originalError: error.message },
          retryable: true
        }
      )
    }

    return new CaptainError(
      ErrorType.D1_DATABASE_ERROR,
      `Database error during ${operation}: ${error.message}`,
      {
        details: { operation, originalError: error.message },
        retryable: true
      }
    )
  }

  /**
   * Handle storage errors
   */
  handleStorageError(error: any, operation: string): CaptainError {
    if (error.message?.includes('NoSuchKey')) {
      return new CaptainError(
        ErrorType.METADATA_RETRIEVAL_FAILED,
        `Object not found during ${operation}`,
        {
          severity: ErrorSeverity.LOW,
          details: { operation, originalError: error.message }
        }
      )
    }

    if (error.message?.includes('AccessDenied')) {
      return new CaptainError(
        ErrorType.UNAUTHORIZED,
        `Access denied during ${operation}`,
        {
          details: { operation, originalError: error.message }
        }
      )
    }

    return new CaptainError(
      ErrorType.R2_STORAGE_ERROR,
      `Storage error during ${operation}: ${error.message}`,
      {
        details: { operation, originalError: error.message },
        retryable: true
      }
    )
  }

  /**
   * Handle validation errors
   */
  handleValidationError(field: string, value: any, constraint: string): CaptainError {
    return new CaptainError(
      ErrorType.VALIDATION_ERROR,
      `Validation failed for ${field}: ${constraint}`,
      {
        severity: ErrorSeverity.LOW,
        details: { field, value, constraint },
        recoveryStrategy: RecoveryStrategy.USER_INTERVENTION
      }
    )
  }

  /**
   * Create error response with fallback content
   */
  createErrorResponseWithFallback(error: CaptainError, fallback?: {
    response?: string
    imageUrl?: string
  }): ErrorResponse {
    const errorResponse = error.toErrorResponse()
    
    if (fallback && error.fallbackAvailable) {
      errorResponse.fallback = fallback
    }

    return errorResponse
  }
}

/**
 * Global error handler for unhandled errors
 */
export function handleUnexpectedError(error: any, context: string): CaptainError {
  console.error(`Unexpected error in ${context}:`, error)

  if (error instanceof CaptainError) {
    return error
  }

  return new CaptainError(
    ErrorType.INTERNAL_ERROR,
    `Unexpected error in ${context}: ${error.message || 'Unknown error'}`,
    {
      severity: ErrorSeverity.HIGH,
      details: {
        context,
        originalError: error.message,
        stack: error.stack
      },
      cause: error
    }
  )
}

/**
 * Utility to check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof CaptainError) {
    return error.retryable
  }

  // Check common retryable error patterns
  const retryablePatterns = [
    /timeout/i,
    /rate.?limit/i,
    /service.?unavailable/i,
    /temporary/i,
    /network/i,
    /connection/i
  ]

  const errorMessage = error.message || error.toString()
  return retryablePatterns.some(pattern => pattern.test(errorMessage))
}

/**
 * Utility to extract error details for logging
 */
export function extractErrorDetails(error: any): Record<string, any> {
  if (error instanceof CaptainError) {
    return {
      type: error.type,
      severity: error.severity,
      recoveryStrategy: error.recoveryStrategy,
      retryable: error.retryable,
      fallbackAvailable: error.fallbackAvailable,
      details: error.details,
      timestamp: error.timestamp
    }
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    timestamp: new Date().toISOString()
  }
}