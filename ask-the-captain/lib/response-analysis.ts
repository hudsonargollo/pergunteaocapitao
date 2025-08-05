/**
 * Response Analysis Engine
 * 
 * Analyzes AI responses to extract tone, themes, and visual parameters
 * for contextual image generation of Capitão Caverna.
 */

import { ToneAnalysis } from '../types'

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

export interface BaseImageFrame {
  id: string
  name: string
  description: string
  pose: string
  expression: string
  environment: string
  lighting: string
  cameraAngle: string
  suitableFor: {
    tones: string[]
    themes: string[]
    intensity: string[]
  }
}

/**
 * Base image frames derived from base-image-prompts.md
 */
const BASE_IMAGE_FRAMES: BaseImageFrame[] = [
  {
    id: 'FRAME_01A',
    name: 'Heroic Welcome',
    description: 'Wide-angle shot in main chamber, heroic calm posture',
    pose: 'Center frame, standing still, chest expanded, feet planted firm and wide',
    expression: 'Confident but welcoming; half-smile, intense eyes, ears alert',
    environment: 'Main chamber with monumental rock arches, entrance glowing behind',
    lighting: 'Rim light from cave entrance, warm bounce from wall torches',
    cameraAngle: '35mm lens, medium distance, frontal symmetrical composition',
    suitableFor: {
      tones: ['supportive', 'motivational'],
      themes: ['welcome', 'introduction', 'guidance', 'strength'],
      intensity: ['low', 'medium']
    }
  },
  {
    id: 'FRAME_01B',
    name: 'Energetic Greeting',
    description: 'Mid-gesture presentation pose with confident energy',
    pose: 'Both arms lifted mid-gesture, right paw open in presentation, left fist curled',
    expression: 'Proud and energizing; slightly raised eyebrows and half-smirk',
    environment: 'Main chamber entrance with torchlight and frontal light beam',
    lighting: 'Warm torch glow contrasted by cold overhead daylight',
    cameraAngle: 'Medium frontal shot, 35mm lens, shallow depth of field',
    suitableFor: {
      tones: ['motivational', 'supportive'],
      themes: ['energy', 'enthusiasm', 'welcome', 'action'],
      intensity: ['medium', 'high']
    }
  },
  {
    id: 'FRAME_01C',
    name: 'Reassuring Approach',
    description: 'Walking toward viewer with solidarity and trust',
    pose: 'Mid-stride, right arm mid-gesture extending hand, left arm gently back',
    expression: 'Calm intensity; slightly softened gaze, subtle nod, no smile but reassuring',
    environment: 'Deeper cave near glowing alcove with soft ambient warmth',
    lighting: 'Warm red-orange glow from torch, faint cool fill light opposite',
    cameraAngle: 'Slow dolly-in from eye level, 45mm lens, shallow depth',
    suitableFor: {
      tones: ['supportive', 'instructional'],
      themes: ['trust', 'solidarity', 'guidance', 'calm'],
      intensity: ['low', 'medium']
    }
  },
  {
    id: 'FRAME_02A',
    name: 'Contemplative Depth',
    description: 'Silhouette at ledge overlooking cave abyss, symbolic depth',
    pose: 'Feet shoulder-width apart, arms relaxed but firm, facing abyss',
    expression: 'Not visible; focus on stoic silhouette and contemplative posture',
    environment: 'High ledge overlooking deep cavern with fog and shadows',
    lighting: 'Low cool light on left, warm flickering orange torchlight behind',
    cameraAngle: 'Wide establishing shot, 24mm lens, behind and above',
    suitableFor: {
      tones: ['instructional', 'challenging'],
      themes: ['depth', 'contemplation', 'mental', 'introspection', 'challenge'],
      intensity: ['medium', 'high']
    }
  }
]

/**
 * Analyzes response content to determine tone and themes
 */
export function analyzeResponseTone(responseContent: string): ToneAnalysis {
  const content = responseContent.toLowerCase()
  
  // Define tone indicators
  const toneIndicators = {
    supportive: [
      'bem-vindo', 'guerreiro', 'você consegue', 'estou aqui', 'juntos',
      'apoio', 'força', 'coragem', 'acredito', 'confiança'
    ],
    challenging: [
      'pare de', 'chega de', 'desculpas', 'ação', 'agora', 'basta',
      'responsabilidade', 'disciplina', 'foco', 'sem mimimi'
    ],
    instructional: [
      'primeiro', 'segundo', 'passo', 'como', 'faça', 'método',
      'processo', 'técnica', 'estratégia', 'protocolo'
    ],
    motivational: [
      'vamos', 'força', 'luta', 'batalha', 'vitória', 'conquista',
      'transformação', 'mudança', 'evolução', 'crescimento'
    ]
  }
  
  // Calculate tone scores
  const toneScores = {
    supportive: 0,
    challenging: 0,
    instructional: 0,
    motivational: 0
  }
  
  Object.entries(toneIndicators).forEach(([tone, indicators]) => {
    indicators.forEach(indicator => {
      const matches = (content.match(new RegExp(indicator, 'g')) || []).length
      toneScores[tone as keyof typeof toneScores] += matches
    })
  })
  
  // Determine primary tone
  const primaryTone = Object.entries(toneScores).reduce((a, b) => 
    toneScores[a[0] as keyof typeof toneScores] > toneScores[b[0] as keyof typeof toneScores] ? a : b
  )[0] as 'supportive' | 'challenging' | 'instructional' | 'motivational'
  
  // Determine intensity based on total score and specific words
  const totalScore = Object.values(toneScores).reduce((sum, score) => sum + score, 0)
  const hasIntenseWords = /(!|muito|extremamente|totalmente|completamente|urgente|crítico|chega|pare|basta|agora)/.test(content)
  
  let intensity: 'low' | 'medium' | 'high'
  if (totalScore >= 4 || hasIntenseWords) {
    intensity = 'high'
  } else if (totalScore >= 2) {
    intensity = 'medium'
  } else {
    intensity = 'low'
  }
  
  // Extract themes
  const themes = extractThemes(content)
  
  // Generate visual parameters based on tone
  const visualParameters = generateVisualParameters(primaryTone, intensity, themes)
  
  return {
    primary: primaryTone,
    intensity,
    themes,
    visualParameters
  }
}

/**
 * Extracts key themes from response content
 */
function extractThemes(content: string): string[] {
  const themeKeywords = {
    'action': ['ação', 'fazer', 'agir', 'executar', 'implementar', 'consegue'],
    'discipline': ['disciplina', 'rotina', 'hábito', 'consistência'],
    'focus': ['foco', 'concentração', 'atenção', 'prioridade'],
    'strength': ['força', 'poder', 'energia', 'vigor'],
    'transformation': ['transformação', 'mudança', 'evolução', 'crescimento', 'jornada'],
    'challenge': ['desafio', 'dificuldade', 'obstáculo', 'barreira'],
    'guidance': ['orientação', 'direção', 'caminho', 'guia', 'apoiar', 'estou aqui', 'juntos', 'método', 'passo'],
    'responsibility': ['responsabilidade', 'compromisso', 'dever'],
    'progress': ['progresso', 'avanço', 'desenvolvimento', 'melhoria'],
    'mindset': ['mentalidade', 'mente', 'pensamento', 'atitude'],
    'welcome': ['bem-vindo', 'guerreiro'],
    'energy': ['vamos', 'força', 'luta', 'batalha']
  }
  
  const foundThemes: string[] = []
  
  Object.entries(themeKeywords).forEach(([theme, keywords]) => {
    const hasTheme = keywords.some(keyword => content.includes(keyword))
    if (hasTheme) {
      foundThemes.push(theme)
    }
  })
  
  return foundThemes.length > 0 ? foundThemes : ['general']
}

/**
 * Generates visual parameters based on tone analysis
 */
function generateVisualParameters(
  tone: string, 
  intensity: string, 
  themes: string[]
): ToneAnalysis['visualParameters'] {
  const baseParameters = {
    supportive: {
      pose: 'open, welcoming stance',
      expression: 'warm, encouraging smile',
      environment: 'bright, inviting cave area',
      lighting: 'warm, soft illumination'
    },
    challenging: {
      pose: 'firm, authoritative stance',
      expression: 'intense, determined gaze',
      environment: 'dramatic cave setting',
      lighting: 'strong, contrasting shadows'
    },
    instructional: {
      pose: 'gesture-based, explanatory',
      expression: 'focused, attentive',
      environment: 'clear, well-lit space',
      lighting: 'even, clear illumination'
    },
    motivational: {
      pose: 'heroic, inspiring stance',
      expression: 'confident, energetic',
      environment: 'elevated, powerful setting',
      lighting: 'dramatic, uplifting'
    }
  }
  
  const base = baseParameters[tone as keyof typeof baseParameters] || baseParameters.supportive
  
  // Modify based on intensity
  if (intensity === 'high') {
    return {
      ...base,
      pose: base.pose.replace('stance', 'dynamic stance'),
      expression: base.expression.includes('smile') ? base.expression.replace('smile', 'intense expression') : base.expression,
      lighting: base.lighting.replace('soft', 'dramatic')
    }
  }
  
  return base
}

/**
 * Selects the most appropriate image frame based on tone analysis
 */
export function selectImageFrame(toneAnalysis: ToneAnalysis): BaseImageFrame {
  const { primary, intensity, themes } = toneAnalysis
  
  // Score each frame based on suitability
  const frameScores = BASE_IMAGE_FRAMES.map(frame => {
    let score = 0
    
    // Tone match
    if (frame.suitableFor.tones.includes(primary)) {
      score += 3
    }
    
    // Intensity match
    if (frame.suitableFor.intensity.includes(intensity)) {
      score += 2
    }
    
    // Theme matches
    themes.forEach(theme => {
      if (frame.suitableFor.themes.includes(theme)) {
        score += 1
      }
    })
    
    return { frame, score }
  })
  
  // Return the highest scoring frame
  const bestFrame = frameScores.reduce((best, current) => 
    current.score > best.score ? current : best
  )
  
  return bestFrame.frame
}

/**
 * Main function to analyze response and generate image parameters
 */
export function analyzeResponseForImageGeneration(responseContent: string): ResponseAnalysisResult {
  const toneAnalysis = analyzeResponseTone(responseContent)
  const selectedFrame = selectImageFrame(toneAnalysis)
  
  const promptParameters = {
    pose: selectedFrame.pose,
    expression: selectedFrame.expression,
    environment: selectedFrame.environment,
    lighting: selectedFrame.lighting,
    cameraAngle: selectedFrame.cameraAngle,
    emotionalContext: `${toneAnalysis.primary} tone with ${toneAnalysis.intensity} intensity`
  }
  
  return {
    tone: toneAnalysis,
    selectedFrame: selectedFrame.id,
    promptParameters
  }
}

/**
 * Generates a complete DALL-E prompt based on analysis results
 */
export function generateImagePrompt(analysisResult: ResponseAnalysisResult): string {
  const { promptParameters } = analysisResult
  
  // Base character and environment foundation (from base-image-prompts.md)
  const basePrompt = `
Ultra-high-resolution, physically-based render of a NATURAL CAVE interior rich in geological majesty.
Cathedral-scale granite & limestone architecture (#3C3C3C base, #8B4513 undertones) displays water-erosion striations, mineral veining, stalactites and smooth, time-worn floor paths (#4A4A4A).

CAPITÃO CAVERNA — CHARACTER FOUNDATION
Pixar-style stylised wolf (grey top-coat, cream muzzle/ears, warm beige tail tip).
Tall athletic hero ≈ 6 heads; long legs = 50% height; V-torso, narrow waist; digitigrade stance.
Crimson eyes, thick brows; four dark-charcoal fingers.
Wardrobe: fitted black hoodie + red △ wolf logo (#FF3333, black draw-strings), black sweatpants, asymmetric black-and-white sneakers.

SCENE COMPOSITION
POSE: ${promptParameters.pose}
EXPRESSION: ${promptParameters.expression}
ENVIRONMENT: ${promptParameters.environment}
LIGHTING: ${promptParameters.lighting}
CAMERA: ${promptParameters.cameraAngle}
EMOTIONAL CONTEXT: ${promptParameters.emotionalContext}

TECHNICAL SPECIFICATIONS
Output 4096 × 2304 px minimum; 8K UDIM maps; anisotropic ON; displacement + micro-roughness; NO grain/bloom.
Equilateral △ #FF3333 (45% hoodie width) with centered howling-wolf cut-out; matte print roughness 0.8.

NEGATIVE PROMPT
(cute, kawaii, plush, funko, chibi, mascot suit, fursuit, man in costume, wolf mask, toddler-proportions, five fingers, mirrored feet, subtitles, text, overlays)
`.trim()
  
  return basePrompt
}