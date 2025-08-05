// Tests for comprehensive error handling system
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  CaptainError, 
  ErrorType, 
  ErrorSeverity, 
  RecoveryStrategy,
  ErrorHandler,
  withRetry,
  handleUnexpectedError,
  isRetryableError,
  extractErrorDetails,
  DEFAULT_RETRY_CONFIG
} from '../error-handling'

describe('CaptainError', () => {
  it('should create error with default properties', () => {
    const error = new CaptainError(
      ErrorType.VALIDATION_ERROR,
      'Test validation error'
    )

    expect(error.type).toBe(ErrorType.VALIDATION_ERROR)
    expect(error.severity).toBe(ErrorSeverity.LOW)
    expect(error.recoveryStrategy).toBe(RecoveryStrategy.USER_INTERVENTION)
    expect(error.retryable).toBe(false)
    expect(error.fallbackAvailable).toBe(false)
    expect(error.userMessage).toContain('Guerreiro')
  })

  it('should create error with custom properties', () => {
    const error = new CaptainError(
      ErrorType.OPENAI_API_ERROR,
      'Custom error message',
      {
        severity: ErrorSeverity.HIGH,
        recoveryStrategy: RecoveryStrategy.RETRY,
        userMessage: 'Custom user message',
        details: { customField: 'value' },
        retryable: true,
        fallbackAvailable: true
      }
    )

    expect(error.severity).toBe(ErrorSeverity.HIGH)
    expect(error.recoveryStrategy).toBe(RecoveryStrategy.RETRY)
    expect(error.userMessage).toBe('Custom user message')
    expect(error.details.customField).toBe('value')
    expect(error.retryable).toBe(true)
    expect(error.fallbackAvailable).toBe(true)
  })

  it('should convert to error response format', () => {
    const error = new CaptainError(
      ErrorType.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded'
    )

    const response = error.toErrorResponse()

    expect(response.error.code).toBe(ErrorType.RATE_LIMIT_EXCEEDED)
    expect(response.error.message).toContain('paciência')
    expect(response.error.details.severity).toBe(ErrorSeverity.MEDIUM)
    expect(response.error.details.retryable).toBe(true)
    expect(response.error.timestamp).toBeDefined()
  })

  it('should determine if error should trigger alert', () => {
    const lowSeverityError = new CaptainError(ErrorType.VALIDATION_ERROR, 'Test')
    const highSeverityError = new CaptainError(ErrorType.MISSING_API_KEY, 'Test')

    expect(lowSeverityError.shouldAlert()).toBe(false)
    expect(highSeverityError.shouldAlert()).toBe(true)
  })

  it('should generate monitoring tags', () => {
    const error = new CaptainError(ErrorType.OPENAI_API_ERROR, 'Test')
    const tags = error.getMonitoringTags()

    expect(tags.error_type).toBe(ErrorType.OPENAI_API_ERROR)
    expect(tags.severity).toBe(ErrorSeverity.HIGH)
    expect(tags.retryable).toBe('true')
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should succeed on first attempt', async () => {
    const operation = vi.fn().mockResolvedValue('success')

    const result = await withRetry(operation)

    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and eventually succeed', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValue('success')

    const result = await withRetry(operation, { maxAttempts: 3, baseDelayMs: 10 })

    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('should fail after max attempts', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'))

    await expect(
      withRetry(operation, { maxAttempts: 2, baseDelayMs: 10 })
    ).rejects.toThrow(CaptainError)

    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('should not retry non-retryable errors', async () => {
    const nonRetryableError = new CaptainError(
      ErrorType.VALIDATION_ERROR,
      'Non-retryable error',
      { retryable: false }
    )
    const operation = vi.fn().mockRejectedValue(nonRetryableError)

    await expect(withRetry(operation)).rejects.toBe(nonRetryableError)
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should apply exponential backoff', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('success')

    const startTime = Date.now()
    await withRetry(operation, { 
      maxAttempts: 3, 
      baseDelayMs: 100, 
      backoffMultiplier: 2,
      jitterEnabled: false 
    })
    const endTime = Date.now()

    // Should have delays of ~100ms and ~200ms
    expect(endTime - startTime).toBeGreaterThan(250)
    expect(operation).toHaveBeenCalledTimes(3)
  })
})

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler

  beforeEach(() => {
    errorHandler = new ErrorHandler('test-context')
  })

  it('should handle external API errors', () => {
    const apiError = {
      code: 'rate_limit_exceeded',
      message: 'Rate limit exceeded'
    }

    const captainError = errorHandler.handleExternalApiError(apiError, 'OpenAI')

    expect(captainError.type).toBe(ErrorType.OPENAI_RATE_LIMIT)
    expect(captainError.retryable).toBe(true)
    expect(captainError.details.service).toBe('OpenAI')
  })

  it('should handle database errors', () => {
    const dbError = {
      message: 'UNIQUE constraint failed: table.column'
    }

    const captainError = errorHandler.handleDatabaseError(dbError, 'insert-operation')

    expect(captainError.type).toBe(ErrorType.DATABASE_CONSTRAINT_VIOLATION)
    expect(captainError.details.operation).toBe('insert-operation')
    expect(captainError.details.constraint).toBe('unique')
  })

  it('should handle storage errors', () => {
    const storageError = {
      message: 'NoSuchKey: The specified key does not exist'
    }

    const captainError = errorHandler.handleStorageError(storageError, 'get-object')

    expect(captainError.type).toBe(ErrorType.METADATA_RETRIEVAL_FAILED)
    expect(captainError.severity).toBe(ErrorSeverity.LOW)
    expect(captainError.details.operation).toBe('get-object')
  })

  it('should handle validation errors', () => {
    const captainError = errorHandler.handleValidationError(
      'email',
      'invalid-email',
      'must be valid email format'
    )

    expect(captainError.type).toBe(ErrorType.VALIDATION_ERROR)
    expect(captainError.details.field).toBe('email')
    expect(captainError.details.constraint).toBe('must be valid email format')
    expect(captainError.recoveryStrategy).toBe(RecoveryStrategy.USER_INTERVENTION)
  })

  it('should create error response with fallback', () => {
    const error = new CaptainError(
      ErrorType.IMAGE_GENERATION_FAILED,
      'Image generation failed',
      { fallbackAvailable: true }
    )

    const fallback = {
      response: 'Fallback response',
      imageUrl: '/fallback-image.png'
    }

    const errorResponse = errorHandler.createErrorResponseWithFallback(error, fallback)

    expect(errorResponse.error.code).toBe(ErrorType.IMAGE_GENERATION_FAILED)
    expect(errorResponse.fallback).toEqual(fallback)
  })
})

describe('handleUnexpectedError', () => {
  it('should handle CaptainError instances', () => {
    const originalError = new CaptainError(ErrorType.TIMEOUT_ERROR, 'Timeout')
    const result = handleUnexpectedError(originalError, 'test-context')

    expect(result).toBe(originalError)
  })

  it('should convert regular errors to CaptainError', () => {
    const originalError = new Error('Unexpected error')
    const result = handleUnexpectedError(originalError, 'test-context')

    expect(result).toBeInstanceOf(CaptainError)
    expect(result.type).toBe(ErrorType.INTERNAL_ERROR)
    expect(result.severity).toBe(ErrorSeverity.HIGH)
    expect(result.details.context).toBe('test-context')
    expect(result.cause).toBe(originalError)
  })
})

describe('isRetryableError', () => {
  it('should identify retryable CaptainError', () => {
    const retryableError = new CaptainError(
      ErrorType.OPENAI_API_ERROR,
      'API error',
      { retryable: true }
    )
    const nonRetryableError = new CaptainError(
      ErrorType.VALIDATION_ERROR,
      'Validation error',
      { retryable: false }
    )

    expect(isRetryableError(retryableError)).toBe(true)
    expect(isRetryableError(nonRetryableError)).toBe(false)
  })

  it('should identify retryable patterns in regular errors', () => {
    const timeoutError = new Error('Connection timeout')
    const rateLimitError = new Error('Rate limit exceeded')
    const validationError = new Error('Invalid input format')

    expect(isRetryableError(timeoutError)).toBe(true)
    expect(isRetryableError(rateLimitError)).toBe(true)
    expect(isRetryableError(validationError)).toBe(false)
  })
})

describe('extractErrorDetails', () => {
  it('should extract details from CaptainError', () => {
    const error = new CaptainError(
      ErrorType.OPENAI_API_ERROR,
      'API error',
      {
        severity: ErrorSeverity.HIGH,
        details: { customField: 'value' }
      }
    )

    const details = extractErrorDetails(error)

    expect(details.type).toBe(ErrorType.OPENAI_API_ERROR)
    expect(details.severity).toBe(ErrorSeverity.HIGH)
    expect(details.details.customField).toBe('value')
    expect(details.timestamp).toBeDefined()
  })

  it('should extract details from regular errors', () => {
    const error = new Error('Regular error')
    error.name = 'CustomError'

    const details = extractErrorDetails(error)

    expect(details.name).toBe('CustomError')
    expect(details.message).toBe('Regular error')
    expect(details.timestamp).toBeDefined()
  })
})

describe('Error Type Classifications', () => {
  it('should classify user input errors correctly', () => {
    const validationError = new CaptainError(ErrorType.VALIDATION_ERROR, 'Test')
    const jsonError = new CaptainError(ErrorType.INVALID_JSON, 'Test')

    expect(validationError.severity).toBe(ErrorSeverity.LOW)
    expect(validationError.recoveryStrategy).toBe(RecoveryStrategy.USER_INTERVENTION)
    expect(jsonError.retryable).toBe(false)
  })

  it('should classify external service errors correctly', () => {
    const apiError = new CaptainError(ErrorType.OPENAI_API_ERROR, 'Test')
    const rateLimitError = new CaptainError(ErrorType.OPENAI_RATE_LIMIT, 'Test')

    expect(apiError.severity).toBe(ErrorSeverity.HIGH)
    expect(apiError.retryable).toBe(true)
    expect(rateLimitError.recoveryStrategy).toBe(RecoveryStrategy.RETRY)
  })

  it('should classify system errors correctly', () => {
    const internalError = new CaptainError(ErrorType.INTERNAL_ERROR, 'Test')
    const timeoutError = new CaptainError(ErrorType.TIMEOUT_ERROR, 'Test')

    expect(internalError.severity).toBe(ErrorSeverity.HIGH)
    expect(timeoutError.retryable).toBe(true)
  })
})

describe('User Messages', () => {
  it('should generate appropriate user messages for different error types', () => {
    const validationError = new CaptainError(ErrorType.VALIDATION_ERROR, 'Test')
    const rateLimitError = new CaptainError(ErrorType.RATE_LIMIT_EXCEEDED, 'Test')
    const systemError = new CaptainError(ErrorType.INTERNAL_ERROR, 'Test')

    expect(validationError.userMessage).toContain('Guerreiro')
    expect(validationError.userMessage).toContain('disciplina')
    
    expect(rateLimitError.userMessage).toContain('paciência')
    expect(rateLimitError.userMessage).toContain('cave mode')
    
    expect(systemError.userMessage).toContain('adversidade')
    expect(systemError.userMessage).toContain('guerreiro')
  })

  it('should maintain Captain persona in all error messages', () => {
    const errorTypes = [
      ErrorType.VALIDATION_ERROR,
      ErrorType.OPENAI_API_ERROR,
      ErrorType.SEMANTIC_SEARCH_FAILED,
      ErrorType.IMAGE_GENERATION_FAILED,
      ErrorType.INTERNAL_ERROR
    ]

    errorTypes.forEach(errorType => {
      const error = new CaptainError(errorType, 'Test')
      expect(error.userMessage.toLowerCase()).toMatch(/guerreiro|caverna|disciplina|ação|obstáculo/)
    })
  })
})