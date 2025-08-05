// OpenAI API integration for embeddings, chat completions, and image generation
import OpenAI from 'openai'
import type { ToneAnalysis, PersonaPrompt } from '@/types'

export class OpenAIClient {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey
    })
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    })

    return response.data[0].embedding
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      encoding_format: 'float'
    })

    return response.data.map(item => item.embedding)
  }

  async generateChatResponse(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: {
      model?: string
      temperature?: number
      maxTokens?: number
    } = {}
  ): Promise<string> {
    const {
      model = 'gpt-4o-mini',
      temperature = 0.7,
      maxTokens = 1000
    } = options

    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    })

    return response.choices[0]?.message?.content || ''
  }

  async generateImage(
    prompt: string,
    options: {
      model?: string
      size?: '1024x1024' | '1792x1024' | '1024x1792'
      quality?: 'standard' | 'hd'
      style?: 'vivid' | 'natural'
    } = {}
  ): Promise<string> {
    const {
      model = 'dall-e-3',
      size = '1024x1024',
      quality = 'hd',
      style = 'vivid'
    } = options

    const response = await this.client.images.generate({
      model,
      prompt,
      size,
      quality,
      style,
      n: 1
    })

    return response.data?.[0]?.url || ''
  }

  async analyzeTone(content: string): Promise<ToneAnalysis> {
    const analysisPrompt = `
    Analyze the tone and themes of this response from Capitão Caverna:
    
    "${content}"
    
    Return a JSON object with:
    - primary: one of 'supportive', 'challenging', 'instructional', 'motivational'
    - intensity: one of 'low', 'medium', 'high'
    - themes: array of key themes (max 3)
    - visualParameters: object with pose, expression, environment, lighting suggestions
    
    Focus on the Captain's warrior mentor persona.
    `

    const response = await this.generateChatResponse([
      { role: 'system', content: 'You are an expert at analyzing tone and themes for character visualization.' },
      { role: 'user', content: analysisPrompt }
    ], {
      temperature: 0.3,
      maxTokens: 300
    })

    try {
      return JSON.parse(response)
    } catch (error) {
      // Fallback tone analysis
      return {
        primary: 'instructional',
        intensity: 'medium',
        themes: ['discipline', 'action', 'growth'],
        visualParameters: {
          pose: 'confident stance',
          expression: 'focused determination',
          environment: 'cave interior',
          lighting: 'dramatic shadows'
        }
      }
    }
  }

  buildPersonaPrompt(context: string): PersonaPrompt {
    const systemPrompt = `
    You are Capitão Caverna, the uncompromising mentor from the Modo Caverna methodology. 
    You embody the philosophy: Purpose > Focus > Progress.
    
    Your role:
    - Direct, firm, and action-oriented guidance
    - Treat the user as a "warrior who has finally awakened"
    - No room for victimhood or excuses
    - Every response must guide toward taking responsibility and definitive steps
    
    Context from knowledge base:
    ${context}
    
    Respond based ONLY on the provided context. If the context doesn't contain relevant information, 
    acknowledge this while maintaining your character.
    `

    return {
      systemPrompt,
      contextualModifiers: {
        supportive: 'Acknowledge their progress while pushing for more action',
        challenging: 'Directly confront their excuses and demand accountability',
        instructional: 'Provide clear, actionable steps from the methodology',
        motivational: 'Inspire through the warrior mindset and cave philosophy'
      },
      prohibitedLanguage: [
        'motivational platitudes',
        'it\'s okay',
        'don\'t worry',
        'everything happens for a reason',
        'victim language'
      ],
      requiredElements: [
        'action-oriented guidance',
        'personal responsibility',
        'reference to cave methodology when relevant',
        'warrior mindset'
      ]
    }
  }
}