# Character Consistency Guide

This guide explains how to use the enhanced character consistency system to ensure Capitão Caverna appears consistently across all generated images.

## Overview

The character consistency system uses multiple techniques to maintain visual consistency:

1. **Reference Image Analysis** - Uses your reference images to understand character features
2. **Enhanced Prompting** - Detailed character descriptions based on references
3. **Smart Reference Selection** - Automatically selects best references for each scenario
4. **Character Seeds** - Consistent generation parameters

## Quick Start

### Basic Usage (Recommended)

```typescript
import { generateCaptainImage } from './lib/image-generation'

// Generate with automatic character consistency (default)
const result = await generateCaptainImage(
  'Bem-vindo ao Modo Caverna, guerreiro!',
  env
)
```

### Advanced Usage

```typescript
import { generateCaptainImage } from './lib/image-generation'

// Generate with specific consistency options
const result = await generateCaptainImage(
  'Chega de desculpas! É hora de agir.',
  env,
  {
    characterConsistency: {
      useReferenceImages: true,
      enhancedPrompting: true,
      characterSeed: 'custom-seed-123'
    },
    quality: 'hd',
    size: '1024x1024'
  }
)
```

### Using Specific Reference Images

```typescript
import { generateCaptainImageWithReferences } from './lib/image-generation'

// Generate using specific reference images
const result = await generateCaptainImageWithReferences(
  'Vamos à luta, guerreiro!',
  env,
  ['ref-front-winking-thumbsup', 'ref-front-neutral'],
  { quality: 'hd' }
)
```

## Available Reference Images

Your reference images are automatically cataloged:

| ID | Name | Angle | Expression | Description |
|----|------|-------|------------|-------------|
| `ref-front-neutral` | Front View - Neutral | front | neutral | Standard front-facing pose |
| `ref-right-neutral` | Right Side - Neutral | right | neutral | Right profile view |
| `ref-back-neutral` | Back View - Neutral | back | neutral | Back view showing hoodie |
| `ref-left-neutral` | Left Side - Neutral | left | neutral | Left profile view |
| `ref-front-smiling-phone` | Front - Smiling with Phone | front | smiling | Holding smartphone |
| `ref-front-winking-thumbsup` | Front - Winking Thumbs Up | front | winking | Confident gesture |

## Character Reference Manager

For advanced control, use the Character Reference Manager directly:

```typescript
import { createCharacterReferenceManager } from './lib/character-reference'

const referenceManager = createCharacterReferenceManager(env)

// Get all available references
const allRefs = referenceManager.getAllReferences()

// Select best references for specific needs
const frontRefs = referenceManager.selectReferenceImages('front', 'smiling', 2)

// Generate enhanced character description
const description = referenceManager.generateCharacterDescription(frontRefs)

// Create consistent character seed
const seed = referenceManager.generateCharacterSeed('response content')
```

## How It Works

### 1. Reference Selection

The system automatically selects the best reference images based on:
- **Camera angle** from the response analysis (front, back, left, right)
- **Expression** from the tone analysis (neutral, smiling, winking, focused)
- **Fallback priority** (front view and neutral expression preferred)

### 2. Enhanced Prompting

Each generation includes:
- **Exact character specifications** from reference analysis
- **Critical feature requirements** (crimson eyes, grey fur, etc.)
- **Clothing details** (black hoodie with red triangle logo)
- **Proportional requirements** (6 heads tall, digitigrade stance)
- **Negative prompts** to avoid inconsistencies

### 3. Character Seeds

Consistent seeds ensure similar poses and compositions for similar content while maintaining variety.

## Best Practices

### For Consistent Results
- Use the default character consistency settings (enabled by default)
- Let the system auto-select references based on response analysis
- Use consistent response content for similar poses

### For Specific Scenarios
- Use `generateCaptainImageWithReferences()` for specific poses
- Specify reference IDs that match your desired angle/expression
- Combine multiple references for complex poses

### For Testing
- Use the test script: `npm run test:character-consistency`
- Check reference selection with different response types
- Verify character description generation

## Troubleshooting

### Images Don't Look Like Capitão Caverna
1. Ensure `useReferenceImages: true` (default)
2. Check that reference images are accessible
3. Verify character description includes all critical features
4. Try using specific reference IDs for problematic scenarios

### Inconsistent Appearance
1. Use character seeds for similar content
2. Select references with similar angles/expressions
3. Enable enhanced prompting (default)
4. Check that negative prompts are working

### Performance Issues
1. Limit reference images to 2 per generation (default)
2. Use standard quality for faster generation
3. Cache character descriptions for repeated use

## API Reference

### ImageGenerationOptions

```typescript
interface ImageGenerationOptions {
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
  characterConsistency?: CharacterConsistencyOptions
}
```

### CharacterConsistencyOptions

```typescript
interface CharacterConsistencyOptions {
  useReferenceImages: boolean      // Enable reference-based consistency
  referenceImageIds?: string[]     // Specific reference IDs to use
  enhancedPrompting: boolean       // Enhanced character descriptions
  characterSeed?: string           // Custom seed for consistency
}
```

### ReferenceImage

```typescript
interface ReferenceImage {
  id: string                       // Unique identifier
  name: string                     // Human-readable name
  description: string              // Detailed description
  angle: 'front' | 'back' | 'left' | 'right' | 'three-quarter'
  expression: 'neutral' | 'smiling' | 'winking' | 'focused' | 'determined'
  pose: string                     // Pose description
  filePath: string                 // Path to reference image
  publicUrl?: string               // Public URL (if uploaded)
}
```

## Examples

### Different Response Tones

```typescript
// Supportive tone - likely selects smiling references
await generateCaptainImage('Bem-vindo, guerreiro! Você consegue!', env)

// Challenging tone - likely selects focused/determined references  
await generateCaptainImage('Chega de desculpas! É hora de agir!', env)

// Instructional tone - likely selects neutral references
await generateCaptainImage('Primeiro passo: defina seus objetivos.', env)
```

### Specific Scenarios

```typescript
// For welcome messages - use smiling references
await generateCaptainImageWithReferences(
  'Bem-vindo ao Modo Caverna!',
  env,
  ['ref-front-smiling-phone', 'ref-front-winking-thumbsup']
)

// For serious guidance - use neutral/focused references
await generateCaptainImageWithReferences(
  'Disciplina é a chave do sucesso.',
  env,
  ['ref-front-neutral', 'ref-right-neutral']
)
```

This system ensures that Capitão Caverna maintains his distinctive appearance while adapting to different emotional contexts and poses based on the conversation content.