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
  primary: 'supportive' | 'challenging' | 'instructional' | 'motivational'
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

// Cloudflare environment types
export interface CloudflareEnv {
  OPENAI_API_KEY: string
  DB: D1Database
  VECTORIZE_INDEX: VectorizeIndex
  R2_BUCKET: R2Bucket
  ASSETS: Fetcher
}