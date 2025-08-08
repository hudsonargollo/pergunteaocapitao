import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { OpenAIClient } from '@/lib/openai'
import { ImageStorageService } from '@/lib/image-storage'
import { R2Client } from '@/lib/r2'
import { D1Client } from '@/lib/d1'
import { CaptainError, ErrorType, ErrorHandler, withRetry, handleUnexpectedError } from '@/lib/error-handling'
import { fallbackOrchestrator } from '@/lib/fallback-systems'
import { cacheManager } from '@/lib/cache-manager'
import { edgeMemoryManager, performanceMonitor, withTimeout } from '@/lib/edge-optimization'
import { metricsCollector, createRequestMetric } from '@/lib/performance-monitoring'
import { withImageMonitoring, type MonitoringContext } from '@/lib/monitoring-middleware'
import type { ImageGenerationRequest, ImageGenerationResponse, ToneAnalysis } from '@/types'

interface RequestBody {
  responseContent: string
  tone?: string
  themes?: string[]
  promptParameters?: object
  customPrompt?: string
}

interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: object
    timestamp: string
  }
}

/**
 * POST /api/v1/images/generate - Dynamic image generation endpoint
 * 
 * Flow:
 * 1. Analyze response content and tone
 * 2. Select parameters from base prompts
 * 3. Generate image via DALL-E 3
 * 4. Store in R2 bucket
 * 5. Save metadata in D1
 * 6. Return public URL
 */
async function imageGenerationHandler(request: NextRequest, context: MonitoringContext) {
  const startTime = context.startTime
  const requestId = context.requestId
  const errorHandler = new ErrorHandler('image-generation-api')
  let cacheHit = false
  
  // Track memory usage for this request
  const operationId = `image_${requestId}`
  edgeMemoryManager.trackMemoryUsage(operationId, 512 * 1024) // Initial 512KB estimate
  
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

    const validation = validateImageGenerationRequest(body)
    if (!validation.valid) {
      throw errorHandler.handleValidationError('request', body, validation.message)
    }

    const { responseContent, tone, themes, promptParameters, customPrompt } = body

    // Initialize services
    const openaiClient = new OpenAIClient(env.OPENAI_API_KEY)
    const r2Client = new R2Client(env.R2_BUCKET, 'ask-the-captain')
    const d1Client = new D1Client(env.DB)
    const imageStorage = new ImageStorageService(r2Client, d1Client)

    // Step 1: Analyze tone if not provided
    let toneAnalysis: ToneAnalysis
    if (tone && themes) {
      // Use provided tone and themes
      toneAnalysis = {
        primary: tone as any,
        intensity: 'medium',
        themes: themes,
        visualParameters: {
          pose: 'confident stance',
          expression: 'focused determination',
          environment: 'cave interior',
          lighting: 'dramatic shadows'
        }
      }
    } else {
      // Analyze the response content
      toneAnalysis = await openaiClient.analyzeTone(responseContent)
    }

    // Step 2: Build image generation prompt
    const imagePrompt = customPrompt || buildCaptainImagePrompt(toneAnalysis, responseContent)

    // Check cache first for similar image prompts
    const cachedImage = cacheManager.images.get(imagePrompt, promptParameters)
    if (cachedImage) {
      console.log('Returning cached image for prompt:', imagePrompt.substring(0, 50))
      cacheHit = true
      
      const imageResponse: ImageGenerationResponse = {
        imageUrl: cachedImage.imageUrl,
        imageId: `cached_${Date.now()}`,
        promptParameters: cachedImage.promptParameters
      }

      // Record metrics and cleanup
      performanceMonitor.endRequest(requestId, startTime)
      performanceMonitor.recordCacheEvent(true)
      edgeMemoryManager.releaseMemory(operationId)

      const response = NextResponse.json(imageResponse)
      response.headers.set('X-Cache-Hit', 'true')
      response.headers.set('X-Processing-Time', '0')
      response.headers.set('X-Memory-Usage', '0')
      return response
    }

    // Step 3: Generate image using DALL-E 3 with retry logic and timeout
    let generatedImageUrl: string
    try {
      generatedImageUrl = await withTimeout(
        withRetry(
          () => openaiClient.generateImage(imagePrompt, {
            size: '1024x1024',
            quality: 'hd',
            style: 'vivid'
          }),
          { maxAttempts: 2, baseDelayMs: 2000 },
          'dall-e-generation'
        ),
        30000, // 30 second timeout for image generation
        'Image generation timed out'
      )

      if (!generatedImageUrl) {
        throw new CaptainError(
          ErrorType.IMAGE_GENERATION_FAILED,
          'No image URL returned from OpenAI'
        )
      }
    } catch (imageError) {
      const captainError = imageError instanceof CaptainError 
        ? imageError 
        : errorHandler.handleExternalApiError(imageError, 'DALL-E')
      
      // Return fallback image response
      const fallbackImageUrl = await fallbackOrchestrator.handleImageFailure(toneAnalysis)
      
      return NextResponse.json(
        errorHandler.createErrorResponseWithFallback(
          captainError,
          { imageUrl: fallbackImageUrl }
        ),
        { status: 200 } // Return 200 with fallback content
      )
    }

    // Step 4: Download and store the image with comprehensive error handling
    let imageBuffer: ArrayBuffer
    try {
      const imageResponse = await withRetry(
        async () => {
          const response = await fetch(generatedImageUrl)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          return response
        },
        { maxAttempts: 2, baseDelayMs: 1000 },
        'image-download'
      )
      
      imageBuffer = await imageResponse.arrayBuffer()
    } catch (downloadError) {
      console.warn('Failed to download generated image:', downloadError)
      
      const captainError = new CaptainError(
        ErrorType.IMAGE_DOWNLOAD_FAILED,
        'Failed to download generated image',
        { 
          details: { originalError: String(downloadError) },
          cause: downloadError as Error
        }
      )
      
      // Return the temporary OpenAI URL as fallback
      const fallbackResponse: ImageGenerationResponse = {
        imageUrl: generatedImageUrl,
        imageId: `temp_${Date.now()}`,
        promptParameters: {
          prompt: imagePrompt,
          toneAnalysis,
          temporary: true
        }
      }
      
      return NextResponse.json(
        errorHandler.createErrorResponseWithFallback(
          captainError,
          { imageUrl: fallbackResponse.imageUrl }
        ),
        { status: 200 }
      )
    }

    // Step 5: Store image with metadata and error handling
    const finalPromptParameters = {
      prompt: imagePrompt,
      toneAnalysis,
      responseContext: responseContent.substring(0, 500),
      customParameters: promptParameters,
      generationTimestamp: new Date().toISOString(),
      ...promptParameters
    }

    let storeResult
    try {
      storeResult = await withRetry(
        () => imageStorage.storeImage({
          imageBuffer,
          promptParameters: finalPromptParameters,
          responseContext: responseContent.substring(0, 500),
          toneAnalysis
        }),
        { maxAttempts: 2, baseDelayMs: 1000 },
        'image-storage'
      )

      if (!storeResult.success) {
        throw new Error(storeResult.error?.message || 'Storage operation failed')
      }
    } catch (storageError) {
      console.warn('Failed to store image permanently:', storageError)
      
      const captainError = errorHandler.handleStorageError(storageError, 'image-storage')
      
      // Return temporary URL as fallback
      const fallbackResponse: ImageGenerationResponse = {
        imageUrl: generatedImageUrl,
        imageId: `temp_${Date.now()}`,
        promptParameters: finalPromptParameters
      }
      
      return NextResponse.json(
        errorHandler.createErrorResponseWithFallback(
          captainError,
          { imageUrl: fallbackResponse.imageUrl }
        ),
        { status: 200 }
      )
    }

    // Step 6: Cache the generated image
    cacheManager.images.set(
      imagePrompt,
      storeResult.data!.publicUrl,
      storeResult.data!.imageId,
      finalPromptParameters,
      Date.now(),
      2 * 60 * 60 * 1000 // 2 hours TTL
    )

    // Step 7: Prepare successful response
    const imageResponse: ImageGenerationResponse = {
      imageUrl: storeResult.data!.publicUrl,
      imageId: storeResult.data!.imageId,
      promptParameters: finalPromptParameters
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
      new Response(JSON.stringify(imageResponse), { status: 200 }),
      startTime,
      memoryStats.totalUsage,
      cacheHit
    )
    metricsCollector.recordRequest(requestMetric)

    // Cleanup memory
    edgeMemoryManager.releaseMemory(operationId)

    // Add performance and metadata headers
    const response = NextResponse.json(imageResponse)
    response.headers.set('X-Processing-Time', processingTime.toString())
    response.headers.set('X-Image-ID', storeResult.data!.imageId)
    response.headers.set('X-Tone-Primary', toneAnalysis.primary)
    response.headers.set('X-Tone-Intensity', toneAnalysis.intensity)
    response.headers.set('X-Cache-Hit', cacheHit.toString())
    response.headers.set('X-Memory-Usage', memoryStats.totalUsage.toFixed(2))
    response.headers.set('X-Memory-Utilization', `${memoryStats.utilizationPercent.toFixed(1)}%`)

    return response

  } catch (error) {
    console.error('Image generation API error:', error)
    
    // Handle unexpected errors with comprehensive fallback
    const captainError = error instanceof CaptainError 
      ? error 
      : handleUnexpectedError(error, 'image-generation-api')
    
    const processingTime = Date.now() - startTime
    const fallbackImageUrl = await fallbackOrchestrator.handleImageFailure()
    
    const errorResponse = errorHandler.createErrorResponseWithFallback(
      captainError,
      { imageUrl: fallbackImageUrl }
    )

    // Add performance metadata
    errorResponse.error.details = {
      ...errorResponse.error.details,
      processingTime
    }

    // Return appropriate status code
    const statusCode = getStatusCodeForError(captainError)
    return NextResponse.json(errorResponse, { status: statusCode })
  }
}

/**
 * GET /api/v1/images/generate - Get image generation status or metadata
 */
async function getImageMetadataHandler(request: NextRequest, context: MonitoringContext) {
  try {
    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')

    if (!imageId) {
      return NextResponse.json(
        createErrorResponse('MISSING_PARAMETER', 'imageId parameter is required'),
        { status: 400 }
      )
    }

    // Get Cloudflare environment bindings
    const { env } = await getCloudflareContext()
    const d1Client = new D1Client(env.DB)
    const r2Client = new R2Client(env.R2_BUCKET, 'ask-the-captain')
    const imageStorage = new ImageStorageService(r2Client, d1Client)

    // Get image metadata
    const metadataResult = await imageStorage.getImageMetadata(imageId)
    
    if (!metadataResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'METADATA_RETRIEVAL_FAILED',
          'Failed to retrieve image metadata',
          { error: metadataResult.error?.message }
        ),
        { status: 500 }
      )
    }

    if (!metadataResult.data) {
      return NextResponse.json(
        createErrorResponse('IMAGE_NOT_FOUND', 'Image not found'),
        { status: 404 }
      )
    }

    const metadata = metadataResult.data
    const publicUrl = r2Client.getPublicUrl(metadata.r2_object_key)

    const response = {
      imageId: metadata.image_id,
      imageUrl: publicUrl,
      promptParameters: JSON.parse(metadata.prompt_parameters || '{}'),
      responseContext: metadata.response_context,
      toneAnalysis: metadata.tone_analysis ? JSON.parse(metadata.tone_analysis) : null,
      createdAt: metadata.created_at
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Image metadata retrieval error:', error)
    
    const captainError = error instanceof CaptainError 
      ? error 
      : handleUnexpectedError(error, 'image-metadata-retrieval')
    
    const errorHandler = new ErrorHandler('image-metadata-api')
    const errorResponse = errorHandler.createErrorResponseWithFallback(captainError)
    
    const statusCode = getStatusCodeForError(captainError)
    return NextResponse.json(errorResponse, { status: statusCode })
  }
}

/**
 * Validate image generation request body
 */
function validateImageGenerationRequest(body: any): { valid: boolean; message: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Request body must be an object' }
  }

  if (!body.responseContent || typeof body.responseContent !== 'string') {
    return { valid: false, message: 'responseContent is required and must be a string' }
  }

  if (body.responseContent.trim().length === 0) {
    return { valid: false, message: 'responseContent cannot be empty' }
  }

  if (body.responseContent.length > 5000) {
    return { valid: false, message: 'responseContent is too long (max 5000 characters)' }
  }

  if (body.tone && !['supportive', 'challenging', 'instructional', 'motivational'].includes(body.tone)) {
    return { valid: false, message: 'tone must be one of: supportive, challenging, instructional, motivational' }
  }

  if (body.themes && (!Array.isArray(body.themes) || body.themes.some((t: any) => typeof t !== 'string'))) {
    return { valid: false, message: 'themes must be an array of strings' }
  }

  if (body.customPrompt && typeof body.customPrompt !== 'string') {
    return { valid: false, message: 'customPrompt must be a string' }
  }

  if (body.customPrompt && body.customPrompt.length > 2000) {
    return { valid: false, message: 'customPrompt is too long (max 2000 characters)' }
  }

  return { valid: true, message: '' }
}

/**
 * Build Capitão Caverna image prompt based on tone analysis and content
 */
function buildCaptainImagePrompt(toneAnalysis: ToneAnalysis, responseContent: string): string {
  // Base character description (consistent across all images)
  const baseCharacter = `A Pixar-style anthropomorphic wolf character named Capitão Caverna, athletic build with 6-head proportions, wearing a black hoodie with a red triangle logo on the chest, black sweatpants, and asymmetric sneakers (one red, one black). The character has wolf features but stands upright like a human.`

  // Environment base
  const baseEnvironment = `Natural cave interior with stone walls and rocky formations, dramatic lighting creating depth and atmosphere.`

  // Tone-specific modifications
  let poseAndExpression = ''
  let lightingStyle = ''
  let atmosphereDetails = ''

  switch (toneAnalysis.primary) {
    case 'supportive':
      poseAndExpression = 'The captain has an encouraging, warm expression with open posture and slightly extended arms in a welcoming gesture.'
      lightingStyle = 'Warm, golden cave lighting creating a welcoming and safe atmosphere.'
      atmosphereDetails = 'The cave feels like a sanctuary with soft shadows and inviting warmth.'
      break

    case 'challenging':
      poseAndExpression = 'The captain has an intense, determined gaze with a firm stance, arms crossed or hands on hips, projecting authority and strength.'
      lightingStyle = 'Dramatic, high-contrast lighting with strong shadows emphasizing the captain\'s powerful presence.'
      atmosphereDetails = 'The cave environment feels intense and focused, with sharp contrasts and bold shadows.'
      break

    case 'instructional':
      poseAndExpression = 'The captain is in a teaching pose with one hand gesturing forward, focused and authoritative expression, ready to guide and instruct.'
      lightingStyle = 'Clear, balanced lighting that highlights the captain\'s face and gestures, creating focus and clarity.'
      atmosphereDetails = 'The cave setting feels like a place of learning and wisdom, with organized and purposeful lighting.'
      break

    case 'motivational':
      poseAndExpression = 'The captain stands in a heroic, inspiring pose with confident expression, perhaps with one fist raised or pointing forward with determination.'
      lightingStyle = 'Dynamic, uplifting lighting with rays of light streaming through the cave, creating an empowering atmosphere.'
      atmosphereDetails = 'The cave feels like a place of transformation and power, with inspiring light effects and energetic atmosphere.'
      break

    default:
      poseAndExpression = 'The captain has a confident, focused expression with a natural, balanced stance.'
      lightingStyle = 'Balanced cave lighting with natural shadows and depth.'
      atmosphereDetails = 'The cave environment feels authentic and grounded.'
  }

  // Intensity modifications
  if (toneAnalysis.intensity === 'high') {
    lightingStyle += ' The lighting is more dramatic and intense.'
    atmosphereDetails += ' The overall atmosphere is heightened and more dynamic.'
  } else if (toneAnalysis.intensity === 'low') {
    lightingStyle += ' The lighting is softer and more subtle.'
    atmosphereDetails += ' The overall atmosphere is calm and measured.'
  }

  // Theme-based additions
  let themeElements = ''
  if (toneAnalysis.themes && toneAnalysis.themes.length > 0) {
    const themeDescriptions = toneAnalysis.themes.map(theme => {
      switch (theme.toLowerCase()) {
        case 'discipline':
          return 'elements suggesting discipline and order'
        case 'action':
          return 'dynamic elements suggesting movement and action'
        case 'growth':
          return 'subtle elements suggesting progress and development'
        case 'focus':
          return 'elements emphasizing concentration and clarity'
        case 'strength':
          return 'elements highlighting power and resilience'
        case 'wisdom':
          return 'elements suggesting knowledge and experience'
        default:
          return `elements related to ${theme}`
      }
    })
    themeElements = ` The scene includes ${themeDescriptions.join(', ')}.`
  }

  // Quality and style specifications
  const qualitySpecs = `High quality, detailed 3D rendering, consistent character design, professional lighting, sharp focus, cinematic composition.`

  // Combine all elements
  const fullPrompt = `${baseCharacter} ${baseEnvironment} ${poseAndExpression} ${lightingStyle} ${atmosphereDetails}${themeElements} ${qualitySpecs}`

  return fullPrompt
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

/**
 * Sanitize input to prevent injection attacks
 */
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 5000) // Limit length
}

// Export the monitored handlers
export const POST = withImageMonitoring(imageGenerationHandler)
export const GET = withImageMonitoring(getImageMetadataHandler)