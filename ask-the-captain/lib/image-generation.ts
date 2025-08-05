/**
 * Image Generation Pipeline
 * 
 * Handles the complete pipeline for generating contextual images of Capitão Caverna
 * based on AI response analysis and base character specifications.
 */

import { OpenAIClient } from './openai'
import { analyzeResponseForImageGeneration, generateImagePrompt } from './response-analysis'
import { ImageStorageService, createImageStorageService } from './image-storage'
import { CharacterReferenceManager, createCharacterReferenceManager } from './character-reference'
import { R2Client } from './r2'
import { D1Client } from './d1'
import type { 
  ImageGenerationRequest, 
  ImageGenerationResponse, 
  CloudflareEnv,
  ResponseAnalysisResult,
  StoreImageRequest,
  CharacterConsistencyOptions 
} from '../types'

export interface ImageGenerationOptions {
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
  characterConsistency?: CharacterConsistencyOptions
}

export interface ImageGenerationError {
  code: string
  message: string
  operation: string
  originalError?: Error
}

export class ImageGenerationPipeline {
  private openaiClient: OpenAIClient
  private imageStorage: ImageStorageService
  private characterReference: CharacterReferenceManager

  constructor(env: CloudflareEnv) {
    this.openaiClient = new OpenAIClient(env.OPENAI_API_KEY)
    
    // Create R2 and D1 clients
    const r2Client = new R2Client(env.R2_BUCKET, 'ask-the-captain-images')
    const d1Client = new D1Client(env.DB)
    
    // Create image storage service and character reference manager
    this.imageStorage = createImageStorageService(r2Client, d1Client)
    this.characterReference = createCharacterReferenceManager(env)
  }

  /**
   * Main pipeline function to generate contextual image from AI response
   */
  async generateContextualImage(
    responseContent: string,
    options: ImageGenerationOptions = {}
  ): Promise<ImageGenerationResponse> {
    try {
      // Step 1: Analyze response for tone, themes, and visual parameters
      const analysisResult = analyzeResponseForImageGeneration(responseContent)
      
      // Step 2: Enhance prompt with character consistency
      const enhancedPrompt = await this.generateCharacterConsistentPrompt(
        analysisResult,
        responseContent,
        options.characterConsistency
      )
      
      // Step 3: Generate image using DALL-E 3
      const imageUrl = await this.generateImage(enhancedPrompt, options)
      
      // Step 4: Download and store image in R2
      const storageResult = await this.storeGeneratedImage(
        imageUrl,
        analysisResult,
        responseContent
      )
      
      return {
        imageUrl: storageResult.data!.publicUrl,
        imageId: storageResult.data!.imageId,
        promptParameters: analysisResult.promptParameters
      }
    } catch (error) {
      throw this.createImageGenerationError(
        'GENERATION_PIPELINE_FAILED',
        'Failed to complete image generation pipeline',
        'generateContextualImage',
        error as Error
      )
    }
  }

  /**
   * Generate character-consistent prompt with reference images
   */
  private async generateCharacterConsistentPrompt(
    analysisResult: ResponseAnalysisResult,
    responseContent: string,
    consistencyOptions?: CharacterConsistencyOptions
  ): Promise<string> {
    const options = {
      useReferenceImages: true,
      enhancedPrompting: true,
      ...consistencyOptions
    }

    // Get base prompt from analysis
    const basePrompt = generateImagePrompt(analysisResult)
    
    if (!options.useReferenceImages && !options.enhancedPrompting) {
      return basePrompt
    }

    // Determine desired angle and expression from analysis
    const desiredAngle = this.extractDesiredAngle(analysisResult.promptParameters.cameraAngle)
    const desiredExpression = this.extractDesiredExpression(analysisResult.promptParameters.expression)
    
    // Select appropriate reference images
    const referenceImages = this.characterReference.selectReferenceImages(
      desiredAngle,
      desiredExpression,
      2 // Use up to 2 reference images
    )
    
    // Generate enhanced character description
    const characterDescription = this.characterReference.generateCharacterDescription(referenceImages)
    
    // Generate character seed for consistency
    const characterSeed = options.characterSeed || 
      this.characterReference.generateCharacterSeed(responseContent)
    
    // Combine base prompt with character consistency enhancements
    const enhancedPrompt = `
${characterDescription}

SCENE COMPOSITION (maintain character consistency):
${basePrompt}

CHARACTER CONSISTENCY REQUIREMENTS:
- EXACT match to reference character appearance
- Maintain all distinctive features: crimson eyes, grey fur, cream muzzle
- Preserve clothing details: black hoodie with red triangle logo, black pants, asymmetric sneakers
- Keep proportions consistent: 6 heads tall, 50% leg length, digitigrade stance
- Match the character's distinctive style and personality

REFERENCE CONTEXT:
Using reference images: ${referenceImages.map(ref => ref.name).join(', ')}
Character seed: ${characterSeed}

NEGATIVE PROMPTS:
(different character, wrong proportions, human features, incorrect clothing, missing logo, five fingers, wrong eye color, different species)
    `.trim()
    
    return enhancedPrompt
  }

  /**
   * Extract desired camera angle from prompt parameters
   */
  private extractDesiredAngle(cameraAngle: string): string | undefined {
    const angle = cameraAngle.toLowerCase()
    if (angle.includes('front') || angle.includes('forward')) return 'front'
    if (angle.includes('back') || angle.includes('behind')) return 'back'
    if (angle.includes('left')) return 'left'
    if (angle.includes('right')) return 'right'
    if (angle.includes('three-quarter') || angle.includes('3/4')) return 'three-quarter'
    return undefined
  }

  /**
   * Extract desired expression from prompt parameters
   */
  private extractDesiredExpression(expression: string): string | undefined {
    const expr = expression.toLowerCase()
    if (expr.includes('smil')) return 'smiling'
    if (expr.includes('wink')) return 'winking'
    if (expr.includes('focus') || expr.includes('determin')) return 'focused'
    if (expr.includes('neutral') || expr.includes('calm')) return 'neutral'
    return undefined
  }

  /**
   * Generate image using DALL-E 3 with base character specifications
   */
  async generateImage(
    prompt: string,
    options: ImageGenerationOptions = {}
  ): Promise<string> {
    const {
      size = '1024x1024',
      quality = 'hd',
      style = 'vivid'
    } = options

    try {
      const imageUrl = await this.openaiClient.generateImage(prompt, {
        model: 'dall-e-3',
        size,
        quality,
        style
      })

      if (!imageUrl) {
        throw new Error('No image URL returned from DALL-E')
      }

      return imageUrl
    } catch (error) {
      throw this.createImageGenerationError(
        'DALLE_GENERATION_FAILED',
        'Failed to generate image with DALL-E 3',
        'generateImage',
        error as Error
      )
    }
  }

  /**
   * Download image from DALL-E URL and store in R2 with metadata
   */
  private async storeGeneratedImage(
    imageUrl: string,
    analysisResult: ResponseAnalysisResult,
    responseContent: string
  ) {
    try {
      // Download image from DALL-E URL
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.statusText}`)
      }

      const imageBuffer = await imageResponse.arrayBuffer()

      // Prepare storage request
      const storeRequest: StoreImageRequest = {
        imageBuffer: imageBuffer,
        promptParameters: analysisResult.promptParameters,
        responseContext: responseContent.substring(0, 500), // Truncate for storage
        toneAnalysis: analysisResult.tone
      }

      // Store in R2 and D1
      const storageResult = await this.imageStorage.storeImage(storeRequest)
      
      if (!storageResult.success) {
        throw storageResult.error || new Error('Failed to store image')
      }

      return storageResult
    } catch (error) {
      throw this.createImageGenerationError(
        'IMAGE_STORAGE_FAILED',
        'Failed to store generated image',
        'storeGeneratedImage',
        error as Error
      )
    }
  }

  /**
   * Generate image with custom parameters (for testing or specific use cases)
   */
  async generateWithCustomParameters(
    basePrompt: string,
    customParameters: {
      pose?: string
      expression?: string
      environment?: string
      lighting?: string
      cameraAngle?: string
    },
    options: ImageGenerationOptions = {}
  ): Promise<ImageGenerationResponse> {
    try {
      // Build custom prompt
      const customPrompt = this.buildCustomPrompt(basePrompt, customParameters)
      
      // Generate image
      const imageUrl = await this.generateImage(customPrompt, options)
      
      // Create mock analysis result for storage
      const mockAnalysisResult: ResponseAnalysisResult = {
        tone: {
          primary: 'instructional',
          intensity: 'medium',
          themes: ['custom'],
          visualParameters: {
            pose: customParameters.pose || 'neutral stance',
            expression: customParameters.expression || 'focused',
            environment: customParameters.environment || 'cave interior',
            lighting: customParameters.lighting || 'natural'
          }
        },
        selectedFrame: 'CUSTOM',
        promptParameters: {
          pose: customParameters.pose || 'neutral stance',
          expression: customParameters.expression || 'focused',
          environment: customParameters.environment || 'cave interior',
          lighting: customParameters.lighting || 'natural',
          cameraAngle: customParameters.cameraAngle || 'medium shot',
          emotionalContext: 'custom generation'
        }
      }
      
      // Store image
      const storageResult = await this.storeGeneratedImage(
        imageUrl,
        mockAnalysisResult,
        'Custom image generation'
      )
      
      return {
        imageUrl: storageResult.data!.publicUrl,
        imageId: storageResult.data!.imageId,
        promptParameters: mockAnalysisResult.promptParameters
      }
    } catch (error) {
      throw this.createImageGenerationError(
        'CUSTOM_GENERATION_FAILED',
        'Failed to generate image with custom parameters',
        'generateWithCustomParameters',
        error as Error
      )
    }
  }

  /**
   * Build custom prompt with specific parameters
   */
  private buildCustomPrompt(
    basePrompt: string,
    parameters: {
      pose?: string
      expression?: string
      environment?: string
      lighting?: string
      cameraAngle?: string
    }
  ): string {
    let customPrompt = basePrompt

    if (parameters.pose) {
      customPrompt = customPrompt.replace(/POSE:.*$/m, `POSE: ${parameters.pose}`)
    }
    if (parameters.expression) {
      customPrompt = customPrompt.replace(/EXPRESSION:.*$/m, `EXPRESSION: ${parameters.expression}`)
    }
    if (parameters.environment) {
      customPrompt = customPrompt.replace(/ENVIRONMENT:.*$/m, `ENVIRONMENT: ${parameters.environment}`)
    }
    if (parameters.lighting) {
      customPrompt = customPrompt.replace(/LIGHTING:.*$/m, `LIGHTING: ${parameters.lighting}`)
    }
    if (parameters.cameraAngle) {
      customPrompt = customPrompt.replace(/CAMERA:.*$/m, `CAMERA: ${parameters.cameraAngle}`)
    }

    return customPrompt
  }

  /**
   * Generate fallback image for error cases
   */
  async generateFallbackImage(): Promise<ImageGenerationResponse> {
    const fallbackPrompt = `
Ultra-high-resolution render of Capitão Caverna in a natural cave interior.
Pixar-style stylised wolf (grey top-coat, cream muzzle/ears, warm beige tail tip).
Tall athletic hero ≈ 6 heads; long legs = 50% height; V-torso, narrow waist; digitigrade stance.
Crimson eyes, thick brows; four dark-charcoal fingers.
Black hoodie + red △ wolf logo (#FF3333), black sweatpants, asymmetric sneakers.

POSE: Standing confidently in center frame, neutral welcoming stance
EXPRESSION: Calm, focused, slightly encouraging
ENVIRONMENT: Main cave chamber with natural rock formations
LIGHTING: Warm torch light with soft shadows
CAMERA: Medium shot, eye level, centered composition

Technical: 4096 × 2304 px minimum, high detail, no text overlays.
NEGATIVE: (cute, kawaii, plush, five fingers, text, subtitles)
`.trim()

    try {
      return await this.generateWithCustomParameters(fallbackPrompt, {
        pose: 'Standing confidently, neutral welcoming stance',
        expression: 'Calm, focused, slightly encouraging',
        environment: 'Main cave chamber with natural rock formations',
        lighting: 'Warm torch light with soft shadows',
        cameraAngle: 'Medium shot, eye level, centered composition'
      })
    } catch (error) {
      throw this.createImageGenerationError(
        'FALLBACK_GENERATION_FAILED',
        'Failed to generate fallback image',
        'generateFallbackImage',
        error as Error
      )
    }
  }

  /**
   * Batch generate images for testing or pre-generation
   */
  async batchGenerateImages(
    responses: string[],
    options: ImageGenerationOptions = {}
  ): Promise<ImageGenerationResponse[]> {
    const results: ImageGenerationResponse[] = []
    const errors: ImageGenerationError[] = []

    for (const response of responses) {
      try {
        const result = await this.generateContextualImage(response, options)
        results.push(result)
      } catch (error) {
        errors.push(error as ImageGenerationError)
      }
    }

    if (errors.length > 0) {
      console.warn(`Batch generation completed with ${errors.length} errors:`, errors)
    }

    return results
  }

  /**
   * Create standardized error objects
   */
  private createImageGenerationError(
    code: string,
    message: string,
    operation: string,
    originalError?: Error
  ): ImageGenerationError {
    return {
      code,
      message,
      operation,
      originalError
    }
  }

  /**
   * Validate image generation request
   */
  validateRequest(request: ImageGenerationRequest): boolean {
    if (!request.responseContent || request.responseContent.trim().length === 0) {
      throw this.createImageGenerationError(
        'INVALID_REQUEST',
        'Response content is required',
        'validateRequest'
      )
    }

    if (request.responseContent.length > 5000) {
      throw this.createImageGenerationError(
        'INVALID_REQUEST',
        'Response content too long (max 5000 characters)',
        'validateRequest'
      )
    }

    return true
  }

  /**
   * Get generation statistics and health check
   */
  async getGenerationStats(): Promise<{
    totalGenerated: number
    recentGenerations: number
    averageGenerationTime: number
    errorRate: number
  }> {
    // This would typically query the database for statistics
    // For now, return mock data
    return {
      totalGenerated: 0,
      recentGenerations: 0,
      averageGenerationTime: 0,
      errorRate: 0
    }
  }
}

/**
 * Utility function to create image generation pipeline instance
 */
export function createImageGenerationPipeline(env: CloudflareEnv): ImageGenerationPipeline {
  return new ImageGenerationPipeline(env)
}

/**
 * Utility function for quick image generation with character consistency
 */
export async function generateCaptainImage(
  responseContent: string,
  env: CloudflareEnv,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResponse> {
  // Enable character consistency by default
  const defaultOptions: ImageGenerationOptions = {
    characterConsistency: {
      useReferenceImages: true,
      enhancedPrompting: true
    },
    ...options
  }
  
  const pipeline = createImageGenerationPipeline(env)
  return await pipeline.generateContextualImage(responseContent, defaultOptions)
}

/**
 * Generate image with specific reference images
 */
export async function generateCaptainImageWithReferences(
  responseContent: string,
  env: CloudflareEnv,
  referenceImageIds: string[],
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResponse> {
  const enhancedOptions: ImageGenerationOptions = {
    ...options,
    characterConsistency: {
      useReferenceImages: true,
      referenceImageIds,
      enhancedPrompting: true,
      ...options.characterConsistency
    }
  }
  
  const pipeline = createImageGenerationPipeline(env)
  return await pipeline.generateContextualImage(responseContent, enhancedOptions)
}