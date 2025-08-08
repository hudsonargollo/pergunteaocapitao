/**
 * Brand Assets Configuration for Capitão Caverna
 * Centralized management of all brand assets including images, logos, and visual elements
 */

export interface CaptainImageAsset {
  url: string
  alt: string
  context: string[]
  tone: 'supportive' | 'challenging' | 'instructional' | 'motivational' | 'default'
  description: string
}

export interface BrandAssets {
  captainImages: {
    [key: string]: CaptainImageAsset
  }
  logos: {
    main: string
    icon: string
    triangle: string
  }
  fallbackImages: {
    [key: string]: string
  }
}

/**
 * High-quality Captain Caverna reference images with contextual mapping
 */
export const BRAND_ASSETS: BrandAssets = {
  captainImages: {
    // Front-facing heroic pose - perfect for welcome messages and default state
    front: {
      url: '/reference1-capitao-caverna-front-20250422_0526_3D Cartoon Figure_remix_01jse9j3vrfkmasmwvaw81ps2f.webp',
      alt: 'Capitão Caverna em pose heroica frontal',
      context: ['welcome', 'introduction', 'default', 'confident'],
      tone: 'default',
      description: 'Pose heroica frontal com postura confiante e determinada'
    },
    
    // Right side profile - great for instructional content
    rightSide: {
      url: '/reference2-capitao-caverna-rightside-20250729_0403_Cartoon Wolf Character_remix_01k1afs0z4e86rk4s6ane7fa4q.webp',
      alt: 'Capitão Caverna perfil direito',
      context: ['instruction', 'guidance', 'teaching', 'explanation'],
      tone: 'instructional',
      description: 'Perfil direito ideal para conteúdo instrucional e orientações'
    },
    
    // Back view - perfect for contemplative or challenging moments
    back: {
      url: '/reference3-capitao-caverna-back-20250729_0331_Stylized Wolf Character_remix_01k1adz53ce20t8ej15dqaaax6.webp',
      alt: 'Capitão Caverna de costas',
      context: ['contemplation', 'challenge', 'reflection', 'serious'],
      tone: 'challenging',
      description: 'Vista de costas para momentos contemplativos e desafiadores'
    },
    
    // Left side profile - alternative instructional pose
    leftSide: {
      url: '/reference4-capitao-caverna-leftside-20250729_0423_Cartoon Wolf Character_remix.webp',
      alt: 'Capitão Caverna perfil esquerdo',
      context: ['instruction', 'guidance', 'alternative', 'teaching'],
      tone: 'instructional',
      description: 'Perfil esquerdo como alternativa para conteúdo instrucional'
    },
    
    // Smiling with smartphone - perfect for supportive, encouraging messages
    supportive: {
      url: '/reference5-capitao-caverna-smiling-holding-smartphone-20250422_0549_3D-Character-Studio-Portrait_remix_01jseaxfmzf0r96grrp29y0hdn.webp',
      alt: 'Capitão Caverna sorrindo com smartphone',
      context: ['support', 'encouragement', 'positive', 'technology', 'connection'],
      tone: 'supportive',
      description: 'Sorrindo com smartphone, ideal para mensagens de apoio e encorajamento'
    },
    
    // Winking and thumbs up - perfect for motivational and celebratory moments
    motivational: {
      url: '/reference6-capitao-caverna-winking-smiling-giving-thumbsup-20250422_0558_3D Wolf Character_remix_01jsebd7w4fertysatahzvgvx3.webp',
      alt: 'Capitão Caverna piscando e fazendo sinal de positivo',
      context: ['motivation', 'celebration', 'success', 'achievement', 'positive'],
      tone: 'motivational',
      description: 'Piscando e fazendo sinal de positivo para momentos motivacionais e celebratórios'
    }
  },
  
  logos: {
    main: '/modo-caverna-logo.svg',
    icon: '/cave-icon.svg',
    triangle: '/red-triangle-logo.svg'
  },
  
  fallbackImages: {
    default: '/reference1-capitao-caverna-front-20250422_0526_3D Cartoon Figure_remix_01jse9j3vrfkmasmwvaw81ps2f.webp',
    supportive: '/reference5-capitao-caverna-smiling-holding-smartphone-20250422_0549_3D-Character-Studio-Portrait_remix_01jseaxfmzf0r96grrp29y0hdn.webp',
    challenging: '/reference3-capitao-caverna-back-20250729_0331_Stylized Wolf Character_remix_01k1adz53ce20t8ej15dqaaax6.webp',
    instructional: '/reference2-capitao-caverna-rightside-20250729_0403_Cartoon Wolf Character_remix_01k1afs0z4e86rk4s6ane7fa4q.webp',
    motivational: '/reference6-capitao-caverna-winking-smiling-giving-thumbsup-20250422_0558_3D Wolf Character_remix_01jsebd7w4fertysatahzvgvx3.webp'
  }
}

/**
 * Get the most appropriate Captain image based on response context
 */
export function getCaptainImageForContext(
  tone: 'supportive' | 'challenging' | 'instructional' | 'motivational' | 'default',
  themes: string[] = [],
  content: string = ''
): CaptainImageAsset {
  const lowerContent = content.toLowerCase()
  
  // Check for specific contextual matches first
  for (const [key, asset] of Object.entries(BRAND_ASSETS.captainImages)) {
    // Direct tone match
    if (asset.tone === tone) {
      return asset
    }
    
    // Context keyword matching
    const hasContextMatch = asset.context.some(context => 
      lowerContent.includes(context) || themes.includes(context)
    )
    
    if (hasContextMatch) {
      return asset
    }
  }
  
  // Fallback to tone-based selection
  switch (tone) {
    case 'supportive':
      return BRAND_ASSETS.captainImages.supportive
    case 'challenging':
      return BRAND_ASSETS.captainImages.back
    case 'instructional':
      return BRAND_ASSETS.captainImages.rightSide
    case 'motivational':
      return BRAND_ASSETS.captainImages.motivational
    default:
      return BRAND_ASSETS.captainImages.front
  }
}

/**
 * Get fallback image URL for error states
 */
export function getFallbackImageUrl(context?: string): string {
  if (context && context in BRAND_ASSETS.fallbackImages) {
    return BRAND_ASSETS.fallbackImages[context as keyof typeof BRAND_ASSETS.fallbackImages]
  }
  return BRAND_ASSETS.fallbackImages.default
}

/**
 * Preload all brand assets for better performance
 */
export function preloadBrandAssets(): Promise<void[]> {
  const imageUrls = [
    ...Object.values(BRAND_ASSETS.captainImages).map(asset => asset.url),
    ...Object.values(BRAND_ASSETS.fallbackImages)
  ]
  
  const preloadPromises = imageUrls.map(url => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => reject(new Error(`Failed to preload image: ${url}`))
      img.src = url
    })
  })
  
  return Promise.all(preloadPromises)
}

/**
 * Cave-themed visual hierarchy configuration
 */
export const CAVE_TYPOGRAPHY = {
  headings: {
    h1: 'text-2xl md:text-3xl font-bold text-cave-white leading-tight',
    h2: 'text-xl md:text-2xl font-semibold text-cave-white leading-snug',
    h3: 'text-lg md:text-xl font-medium text-cave-off-white leading-normal',
    h4: 'text-base md:text-lg font-medium text-cave-off-white leading-normal'
  },
  body: {
    large: 'text-base md:text-lg text-cave-off-white leading-relaxed',
    normal: 'text-sm md:text-base text-cave-off-white leading-relaxed',
    small: 'text-xs md:text-sm text-cave-mist leading-normal'
  },
  interactive: {
    button: 'text-sm md:text-base font-medium text-cave-white',
    link: 'text-sm md:text-base text-cave-red hover:text-cave-ember transition-colors',
    input: 'text-sm md:text-base text-cave-white placeholder:text-cave-mist/60'
  }
}

/**
 * Cave-themed loading animations
 */
export const CAVE_ANIMATIONS = {
  // Ember glow pulse for loading states
  emberPulse: {
    animate: {
      opacity: [0.4, 1, 0.4],
      scale: [0.95, 1.05, 0.95]
    },
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  },
  
  // Cave crystal shimmer effect
  crystalShimmer: {
    animate: {
      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
    },
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "linear"
    }
  },
  
  // Torch flame flicker
  torchFlicker: {
    animate: {
      opacity: [0.8, 1, 0.9, 1, 0.85],
      scale: [0.98, 1.02, 0.99, 1.01, 0.97]
    },
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut"
    }
  },
  
  // Cave depth fade in
  caveDepthFade: {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 1.05 },
    transition: { duration: 0.4, ease: "easeOut" }
  }
}