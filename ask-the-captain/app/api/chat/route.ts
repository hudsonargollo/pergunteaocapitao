import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { EnhancedSemanticSearchService } from '@/lib/enhanced-semantic-search'
import { ResponseGenerator } from '@/lib/response-generator'
import { ImageStorageService } from '@/lib/image-storage'
import { EmbeddingService } from '@/lib/embedding-service'
import { VectorizeClient } from '@/lib/vectorize'
import { R2Client } from '@/lib/r2'
import { D1Client } from '@/lib/d1'
import { OpenAIClient } from '@/lib/openai'
import { CaptainError, ErrorType, ErrorHandler, withRetry, handleUnexpectedError } from '@/lib/error-handling'
import { fallbackOrchestrator } from '@/lib/fallback-systems'
import { cacheManager } from '@/lib/cache-manager'
import { edgeMemoryManager, performanceMonitor, withTimeout } from '@/lib/edge-optimization'
import { metricsCollector, createRequestMetric } from '@/lib/performance-monitoring'
import { withChatMonitoring, type MonitoringContext } from '@/lib/monitoring-middleware'
import type { ChatRequest, ChatResponse } from '@/types'

interface RequestBody {
  message: string
  conversationId?: string
}

interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: object
    timestamp: string
  }
  fallback?: {
    response?: string
    imageUrl?: string
  }
}

/**
 * POST /api/chat - Main conversation endpoint
 * 
 * Flow:
 * 1. Receive user query
 * 2. Generate embedding for query
 * 3. Perform semantic search via Vectorize
 * 4. Construct system prompt with persona + context
 * 5. Generate AI response via OpenAI
 * 6. Trigger contextual image generation
 * 7. Return response with image URL
 */
async function chatHandler(request: NextRequest, context: MonitoringContext) {
  const startTime = context.startTime
  const requestId = context.requestId
  const errorHandler = new ErrorHandler('chat-api')
  let conversationId = ''
  let partialResponse = ''
  let partialResults: any[] = []
  let toneAnalysis: any = undefined
  let cacheHit = false
  
  // Track memory usage for this request
  const operationId = `chat_${requestId}`
  edgeMemoryManager.trackMemoryUsage(operationId, 1024 * 1024) // Initial 1MB estimate
  
  try {
    // Get Cloudflare environment bindings
    const { env } = await getCloudflareContext()
    
    if (!env.OPENAI_API_KEY) {
      throw new CaptainError(
        ErrorType.MISSING_API_KEY,
        'OpenAI API key not configured',
        { severity: 'critical' as any }
      )
    }

    // Parse and validate request body
    let body: RequestBody
    try {
      body = await request.json()
    } catch (error) {
      throw new CaptainError(
        ErrorType.INVALID_JSON,
        'Invalid JSON in request body',
        { cause: error as Error }
      )
    }

    const validation = validateChatRequest(body)
    if (!validation.valid) {
      throw errorHandler.handleValidationError('request', body, validation.message)
    }

    const { message, conversationId: requestConversationId } = body
    conversationId = requestConversationId || generateConversationId()

    // Check cache first for quick responses
    const cachedResponse = cacheManager.responses.get(message, conversationId)
    if (cachedResponse) {
      console.log('Returning cached response for query:', message.substring(0, 50))
      cacheHit = true
      
      const chatResponse: ChatResponse = {
        response: cachedResponse.response,
        imageUrl: cachedResponse.imageUrl || '',
        conversationId
      }

      // Record metrics and cleanup
      performanceMonitor.endRequest(requestId, startTime)
      performanceMonitor.recordCacheEvent(true)
      edgeMemoryManager.releaseMemory(operationId)

      const response = NextResponse.json(chatResponse)
      response.headers.set('X-Cache-Hit', 'true')
      response.headers.set('X-Processing-Time', '0')
      response.headers.set('X-Memory-Usage', '0')
      return response
    }

    // Initialize services with error handling
    const openaiClient = new OpenAIClient(env.OPENAI_API_KEY)
    const embeddingService = new EmbeddingService(env.OPENAI_API_KEY)
    const vectorizeClient = new VectorizeClient(env.VECTORIZE_INDEX)
    const r2Client = new R2Client(env.R2_BUCKET, 'ask-the-captain')
    const d1Client = new D1Client(env.DB)
    
    const semanticSearch = new EnhancedSemanticSearchService(
      embeddingService,
      vectorizeClient,
      {
        topK: 15,
        minScore: 0.65,
        maxResults: 6,
        contextWindowSize: 5000,
        fallbackEnabled: true,
        hybridSearch: true,
        keywordWeight: 0.3,
        sourceWeighting: true,
        freshnessFactor: 0.1,
        includeWhatsAppInsights: true
      }
    )
    
    const responseGenerator = new ResponseGenerator(env.OPENAI_API_KEY)
    const imageStorage = new ImageStorageService(r2Client, d1Client)

    // Step 1: Perform semantic search with retry, fallback, and timeout
    let searchContext
    try {
      searchContext = await withTimeout(
        withRetry(
          () => semanticSearch.search(message, {
            maxResults: 6,
            minScore: 0.65,
            hybridSearch: true,
            includeWhatsAppInsights: true
          }),
          { maxAttempts: 2, baseDelayMs: 500 },
          'semantic-search'
        ),
        12000, // 12 second timeout for enhanced search
        'Enhanced semantic search timed out'
      )
      partialResults = searchContext.results
      
      // Update memory usage estimate
      const searchMemoryUsage = JSON.stringify(searchContext).length
      edgeMemoryManager.trackMemoryUsage(`${operationId}_search`, searchMemoryUsage)
    } catch (searchError) {
      console.warn('Semantic search failed, using fallback:', searchError)
      const fallbackResults = await fallbackOrchestrator.handleSearchFailure(message)
      searchContext = {
        query: message,
        embedding: [],
        results: fallbackResults,
        totalResults: fallbackResults.length,
        searchTime: 0,
        fallbackUsed: true
      }
      partialResults = fallbackResults
    }

    // Step 2: Determine appropriate tone modifier
    const toneModifier = responseGenerator.determineToneModifier(message)

    // Step 3: Generate AI response with context, error handling, and timeout
    let responseResult
    try {
      responseResult = await withTimeout(
        withRetry(
          () => responseGenerator.generateResponse(
            message,
            searchContext.results,
            {
              toneModifier,
              temperature: 0.7,
              maxTokens: 1000,
              includeValidation: true
            }
          ),
          { maxAttempts: 2, baseDelayMs: 1000 },
          'response-generation'
        ),
        15000, // 15 second timeout
        'Response generation timed out'
      )
      partialResponse = responseResult.response
      toneAnalysis = responseResult.toneAnalysis
      
      // Update memory usage estimate
      const responseMemoryUsage = JSON.stringify(responseResult).length
      edgeMemoryManager.trackMemoryUsage(`${operationId}_response`, responseMemoryUsage)
    } catch (responseError) {
      console.warn('Response generation failed, using fallback:', responseError)
      
      // Handle the error and create fallback response
      const captainError = responseError instanceof CaptainError 
        ? responseError 
        : errorHandler.handleExternalApiError(responseError, 'OpenAI')
      
      return NextResponse.json(
        await createFallbackChatResponse(captainError, conversationId, message, partialResults),
        { status: 200 } // Return 200 with fallback content
      )
    }

    // Step 4: Generate contextual image with error handling
    let imageUrl = ''
    try {
      // Generate image using DALL-E 3 with retry and timeout
      const imagePrompt = buildImagePrompt(responseResult.response, toneAnalysis)
      const generatedImageUrl = await withTimeout(
        withRetry(
          () => openaiClient.generateImage(imagePrompt, {
            size: '1024x1024',
            quality: 'hd',
            style: 'vivid'
          }),
          { maxAttempts: 2, baseDelayMs: 2000 },
          'image-generation'
        ),
        20000, // 20 second timeout for image generation
        'Image generation timed out'
      )

      // Download and store the image with error handling
      if (generatedImageUrl) {
        try {
          const imageResponse = await fetch(generatedImageUrl)
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.status}`)
          }
          
          const imageBuffer = await imageResponse.arrayBuffer()
          
          const storeResult = await withRetry(
            () => imageStorage.storeImage({
              imageBuffer,
              promptParameters: {
                prompt: imagePrompt,
                toneAnalysis,
                responseContext: responseResult.response.substring(0, 500)
              },
              responseContext: responseResult.response.substring(0, 500),
              toneAnalysis
            }),
            { maxAttempts: 2, baseDelayMs: 1000 },
            'image-storage'
          )

          if (storeResult.success) {
            imageUrl = storeResult.data!.publicUrl
          } else {
            console.warn('Failed to store image, using temporary URL:', storeResult.error)
            imageUrl = generatedImageUrl
          }
        } catch (downloadError) {
          console.warn('Failed to download/store image:', downloadError)
          imageUrl = await fallbackOrchestrator.handleImageFailure(toneAnalysis)
        }
      }
    } catch (imageError) {
      console.warn('Image generation failed, using fallback:', imageError)
      imageUrl = await fallbackOrchestrator.handleImageFailure(toneAnalysis)
    }

    // Step 5: Cache the response for future use
    cacheManager.responses.set(
      message,
      responseResult.response,
      searchContext.results,
      toneAnalysis,
      imageUrl,
      conversationId,
      15 * 60 * 1000 // 15 minutes TTL
    )

    // Step 6: Prepare successful response
    const chatResponse: ChatResponse = {
      response: responseResult.response,
      imageUrl,
      conversationId
    }

    const processingTime = Date.now() - startTime
    const memoryStats = edgeMemoryManager.getMemoryStats()

    // Record performance metrics
    performanceMonitor.endRequest(requestId, startTime)
    performanceMonitor.recordCacheEvent(cacheHit)
    performanceMonitor.recordMemoryUsage(memoryStats.totalUsage)

    // Record detailed metrics
    const requestMetric = createRequestMetric(
      request,
      new Response(JSON.stringify(chatResponse), { status: 200 }),
      startTime,
      memoryStats.totalUsage,
      cacheHit
    )
    metricsCollector.recordRequest(requestMetric)

    // Cleanup memory
    edgeMemoryManager.releaseMemory(operationId)
    edgeMemoryManager.releaseMemory(`${operationId}_search`)
    edgeMemoryManager.releaseMemory(`${operationId}_response`)

    // Add performance headers with enhanced search metrics
    const response = NextResponse.json(chatResponse)
    response.headers.set('X-Processing-Time', processingTime.toString())
    response.headers.set('X-Search-Results', searchContext.results.length.toString())
    response.headers.set('X-Fallback-Used', searchContext.fallbackUsed.toString())
    response.headers.set('X-Hybrid-Search-Used', searchContext.hybridSearchUsed?.toString() || 'false')
    response.headers.set('X-Cache-Hit', cacheHit.toString())
    response.headers.set('X-Memory-Usage', memoryStats.totalUsage.toFixed(2))
    response.headers.set('X-Memory-Utilization', `${memoryStats.utilizationPercent.toFixed(1)}%`)
    response.headers.set('X-Search-Quality', searchContext.qualityMetrics?.averageScore?.toFixed(2) || '0')
    response.headers.set('X-Source-Diversity', searchContext.qualityMetrics?.diversityScore?.toFixed(2) || '0')

    return response

  } catch (error) {
    console.error('Chat API error:', error)
    
    // Record error metrics
    performanceMonitor.endRequest(requestId, startTime, true)
    const memoryStats = edgeMemoryManager.getMemoryStats()
    
    // Handle unexpected errors with comprehensive fallback
    const captainError = error instanceof CaptainError 
      ? error 
      : handleUnexpectedError(error, 'chat-api')
    
    const fallbackResponse = await fallbackOrchestrator.handleChatFlowFailure(
      captainError,
      {
        query: request.url.includes('message') ? 'unknown' : 'system error',
        conversationId: conversationId || generateConversationId(),
        partialResponse,
        partialResults,
        toneAnalysis
      }
    )

    const processingTime = Date.now() - startTime
    const errorResponse = errorHandler.createErrorResponseWithFallback(
      captainError,
      {
        response: fallbackResponse.response,
        imageUrl: fallbackResponse.imageUrl
      }
    )

    // Record detailed error metrics
    const statusCode = getStatusCodeForError(captainError)
    const requestMetric = createRequestMetric(
      request,
      new Response(JSON.stringify(errorResponse), { status: statusCode }),
      startTime,
      memoryStats.totalUsage,
      cacheHit,
      captainError.type
    )
    metricsCollector.recordRequest(requestMetric)

    // Add performance metadata
    errorResponse.error.details = {
      ...errorResponse.error.details,
      processingTime,
      memoryUsage: memoryStats.totalUsage,
      partialRecovery: !!partialResponse || !!partialResults.length
    }

    // Cleanup memory
    edgeMemoryManager.releaseMemory(operationId)
    edgeMemoryManager.releaseMemory(`${operationId}_search`)
    edgeMemoryManager.releaseMemory(`${operationId}_response`)

    // Return appropriate status code based on error type
    return NextResponse.json(errorResponse, { status: statusCode })
  }
}

/**
 * Validate chat request body
 */
function validateChatRequest(body: any): { valid: boolean; message: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Request body must be an object' }
  }

  if (!body.message || typeof body.message !== 'string') {
    return { valid: false, message: 'Message is required and must be a string' }
  }

  if (body.message.trim().length === 0) {
    return { valid: false, message: 'Message cannot be empty' }
  }

  if (body.message.length > 2000) {
    return { valid: false, message: 'Message is too long (max 2000 characters)' }
  }

  if (body.conversationId && typeof body.conversationId !== 'string') {
    return { valid: false, message: 'Conversation ID must be a string' }
  }

  return { valid: true, message: '' }
}

/**
 * Create standardized error response
 */
function createErrorResponse(
  code: string,
  message: string,
  details?: object
): ErrorResponse {
  return {
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Generate unique conversation ID
 */
function generateConversationId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 8)
  return `conv_${timestamp}_${randomPart}`
}

/**
 * Build image generation prompt based on response and tone analysis
 */
function buildImagePrompt(response: string, toneAnalysis: any): string {
  // Base character description
  const basePrompt = `A Pixar-style anthropomorphic wolf character named Capitão Caverna, athletic build with 6-head proportions, wearing a black hoodie with a red triangle logo, black sweatpants, and asymmetric sneakers (one red, one black). The character is in a natural cave interior with dramatic lighting.`

  // Contextual modifications based on tone analysis
  let contextualElements = ''
  
  switch (toneAnalysis.primary) {
    case 'supportive':
      contextualElements = 'The captain has an encouraging expression with open posture, warm cave lighting creating a welcoming atmosphere.'
      break
    case 'challenging':
      contextualElements = 'The captain has a firm, intense gaze with a confident stance, dramatic shadows emphasizing determination.'
      break
    case 'instructional':
      contextualElements = 'The captain is in a teaching pose with focused expression, clear lighting highlighting his authoritative presence.'
      break
    case 'motivational':
      contextualElements = 'The captain stands in a heroic pose with inspiring expression, dynamic lighting creating an empowering atmosphere.'
      break
    default:
      contextualElements = 'The captain has a confident, focused expression in a natural cave setting with balanced lighting.'
  }

  // Intensity modifications
  if (toneAnalysis.intensity === 'high') {
    contextualElements += ' The lighting is more dramatic and the pose more dynamic.'
  } else if (toneAnalysis.intensity === 'low') {
    contextualElements += ' The lighting is softer and the pose more relaxed.'
  }

  return `${basePrompt} ${contextualElements} High quality, detailed 3D rendering, consistent character design, professional lighting.`
}

/**
 * Create fallback chat response for errors
 */
async function createFallbackChatResponse(
  error: CaptainError,
  conversationId: string,
  query: string,
  partialResults: any[]
): Promise<any> {
  const fallbackResponse = await fallbackOrchestrator.handleChatFlowFailure(
    error,
    {
      query,
      conversationId,
      partialResults
    }
  )

  const errorHandler = new ErrorHandler('chat-api')
  return errorHandler.createErrorResponseWithFallback(
    error,
    {
      response: fallbackResponse.response,
      imageUrl: fallbackResponse.imageUrl
    }
  )
}

/**
 * Get appropriate HTTP status code for error type
 */
function getStatusCodeForError(error: CaptainError): number {
  switch (error.type) {
    case ErrorType.VALIDATION_ERROR:
    case ErrorType.INVALID_JSON:
    case ErrorType.MISSING_PARAMETER:
      return 400
    
    case ErrorType.UNAUTHORIZED:
    case ErrorType.INVALID_API_KEY:
      return 401
    
    case ErrorType.RATE_LIMIT_EXCEEDED:
    case ErrorType.OPENAI_RATE_LIMIT:
      return 429
    
    case ErrorType.MISSING_API_KEY:
    case ErrorType.INTERNAL_ERROR:
    case ErrorType.SERVICE_UNAVAILABLE:
      return 500
    
    case ErrorType.TIMEOUT_ERROR:
      return 504
    
    default:
      return 500
  }
}

// Export the monitored handler
export const POST = withChatMonitoring(chatHandler)

/**
 * Sanitize user input to prevent injection attacks
 */
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 2000) // Limit length
}