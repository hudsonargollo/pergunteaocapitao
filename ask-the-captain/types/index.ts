// Core application types for Ask the Captain

export interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  imageUrl?: string
}

export interface ChatRequest {
  message: string
  conversationId?: string
}

export interface ChatResponse {
  response: string
  imageUrl: string
  conversationId: string
}

export interface ImageGenerationRequest {
  responseContent: string
  tone: string
  themes: string[]
}

export interface ImageGenerationResponse {
  imageUrl: string
  imageId: string
  promptParameters: object
}

export interface DocumentChunk {
  id: string
  content: string
  source: string
  metadata: {
    title?: string
    section?: string
    page?: number
    enhanced?: boolean
    [key: string]: any
  }
}

export interface EmbeddingVector {
  id: string
  values: number[]
  metadata: {
    content: string
    source: string
    title?: string
    section?: string
    chunk_index: number
    token_count: number
  }
}

export interface SearchResult {
  content: string
  score: number
  metadata: {
    source: string
    section?: string
    title?: string
    chunk_index?: number
  }
}

export interface ToneAnalysis {
  primary: 'supportive' | 'challenging' | 'instructional' | 'motivational' | 'neutral'
  intensity: 'low' | 'medium' | 'high'
  themes: string[]
  visualParameters: {
    pose: string
    expression: string
    environment: string
    lighting: string
  }
}

export interface ResponseAnalysisResult {
  tone: ToneAnalysis
  selectedFrame: string
  promptParameters: {
    pose: string
    expression: string
    environment: string
    lighting: string
    cameraAngle: string
    emotionalContext: string
  }
}

export interface PersonaPrompt {
  systemPrompt: string
  contextualModifiers: {
    supportive: string
    challenging: string
    instructional: string
    motivational: string
  }
  prohibitedLanguage: string[]
  requiredElements: string[]
}

// Database types
export interface GeneratedImage {
  image_id: string
  r2_object_key: string
  prompt_parameters: string // JSON
  response_context?: string
  tone_analysis?: string
  created_at: string
}

export interface Conversation {
  id: string
  user_id?: string // nullable for MVP
  message: string
  response: string
  image_id?: string
  embedding_query?: string
  search_results?: string // JSON
  created_at: string
}

// Image storage types
export interface ImageStorageMetadata {
  imageId: string
  promptParameters?: object
  toneAnalysis?: object
  responseContext?: string
  uploadedAt?: string
  size?: number
}

export interface StoreImageRequest {
  imageBuffer: ArrayBuffer
  promptParameters: object
  responseContext?: string
  toneAnalysis?: ToneAnalysis
}

export interface CharacterConsistencyOptions {
  useReferenceImages: boolean
  referenceImageIds?: string[]
  enhancedPrompting: boolean
  characterSeed?: string
}

// Character System Types
export interface PhysicalTraits {
  species: string
  style: string
  build: string
  height: string
  proportions: {
    headToBodyRatio: string
    legLength: string
    kneePosition: string
    armReach: string
    torsoShape: string
  }
  stance: string
  furColors: {
    primary: string
    muzzle: string
    innerEars: string
    tailTip: string
    handFur: string
    fingerPads: string
  }
  eyes: {
    color: string
    shape: string
    eyebrows: string
  }
  hands: {
    digitCount: string
    fingerOrder: string
    restrictions: string[]
  }
}

export interface ClothingSpecification {
  hoodie: {
    color: string
    fit: string
    logo: {
      shape: string
      color: string
      size: string
      design: string
      finish: string
    }
    drawstrings: string
  }
  pants: {
    type: string
    color: string
    fit: string
  }
  shoes: {
    type: string
    asymmetry: string
    colors: string
  }
}

export interface EnvironmentSpecification {
  setting: string
  architecture: {
    walls: string
    ceiling: string
    floor: string
    scale: string
  }
  lighting: {
    key: string
    practical: string
    rim: string
    volumetrics: string
  }
  atmosphere: {
    humidity: string
    temperature: string
    acoustics: string
    naturalElements: string[]
  }
  technicalSpecs: {
    resolution: string
    rendering: string
    continuity: string[]
  }
}

export interface ContextualVariation {
  pose: string
  expression: string
  lighting: string
  cameraAngle: string
  emotionalContext: string
  gestureDetails?: string
  environmentFocus?: string
}

export interface CharacterConsistencyValidation {
  physicalTraitsMatch: boolean
  clothingAccurate: boolean
  proportionsCorrect: boolean
  brandElementsPresent: boolean
  qualityScore: number
  issues: string[]
  recommendations: string[]
}

// Contextual Image Generation Types
export interface ResponseToneAnalysis {
  primaryTone: 'supportive' | 'challenging' | 'instructional' | 'motivational' | 'neutral'
  intensity: 'low' | 'medium' | 'high'
  themes: string[]
  emotionalMarkers: string[]
  actionWords: string[]
  contextualHints: string[]
}

export interface ImageGenerationContext {
  responseContent: string
  toneAnalysis: ResponseToneAnalysis
  selectedVariation: ContextualVariation
  characterPrompt: string
  negativePrompts: string[]
  technicalSpecs: {
    resolution: string
    quality: 'standard' | 'hd'
    style: 'vivid' | 'natural'
  }
}

export interface PromptConstructionOptions {
  enhanceCharacterConsistency: boolean
  includeEnvironmentDetails: boolean
  addTechnicalSpecs: boolean
  customSeed?: string
  overridePose?: string
  overrideExpression?: string
}

// Fallback Image System Types
export interface FallbackImage {
  id: string
  name: string
  description: string
  tone: string
  context: string
  url: string
  localPath?: string
  isDefault: boolean
  quality: 'high' | 'medium' | 'low'
  lastValidated?: Date
}

export interface FallbackSelectionCriteria {
  primaryTone: string
  intensity: 'low' | 'medium' | 'high'
  themes: string[]
  fallbackReason: 'generation_failed' | 'validation_failed' | 'timeout' | 'rate_limited' | 'network_error'
  preferHighQuality: boolean
}

export interface FallbackImageValidation {
  imageExists: boolean
  characterConsistent: boolean
  contextAppropriate: boolean
  qualityAcceptable: boolean
  recommendedAlternatives: string[]
}

export interface ImageUploadResult {
  imageId: string
  r2ObjectKey: string
  publicUrl: string
  size: number
  etag?: string
  uploadedAt: string
}

export interface ImageStorageError {
  code: string
  message: string
  operation: string
  originalError?: Error
}

// Error handling types
export interface ErrorResponse {
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

// Cloudflare environment types are now generated in cloudflare-env.d.ts
// Use the generated CloudflareEnv interface instead