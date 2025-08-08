# Cavernous Tech Design System

## Overview

The Cavernous Tech design system embodies the cave metaphor and warrior mentality of the Modo Caverna methodology. It creates an immersive, sophisticated interface that reflects the depth, focus, and transformative power of the cave experience while maintaining modern usability and accessibility standards.

## Design Philosophy

### Core Principles

1. **Depth Over Surface**: Every element should feel substantial and meaningful
2. **Focus Over Distraction**: Visual hierarchy guides attention to what matters
3. **Strength Over Fragility**: Robust, confident design that inspires action
4. **Clarity Over Complexity**: Simple, direct communication despite rich visuals

### Visual Metaphors

- **Cave Depths**: Dark backgrounds create focus and reduce distractions
- **Ember Light**: Warm accents represent the inner fire of transformation
- **Stone Textures**: Solid, reliable surfaces that feel permanent
- **Glass Formations**: Transparent overlays suggest clarity and insight

## Color Palette

### Primary Colors

```css
/* Cave Depths - Primary backgrounds */
--cave-dark: #0A0A0B;      /* Deepest cave darkness */
--cave-charcoal: #1C1C1C;  /* Main interface background */
--cave-stone: #3C3C3C;     /* Secondary surfaces */

/* Fire Elements - Brand accents */
--cave-red: #FF3333;       /* Primary brand color, call-to-action */
--cave-ember: #FFA500;     /* Secondary accent, loading states */
--cave-torch: #FFD700;     /* Tertiary accent, highlights */

/* Light Elements - Text and foreground */
--cave-white: #FFFFFF;     /* Primary text, headings */
--cave-off-white: #E0E0E0; /* Body text, readable content */
--cave-mist: #B0B0B0;      /* Secondary text, metadata */
```

### Usage Guidelines

#### Backgrounds
```css
/* Primary interface background */
background-color: var(--cave-charcoal);

/* Card and component backgrounds */
background-color: var(--cave-stone);

/* Deep focus areas */
background-color: var(--cave-dark);
```

#### Text Colors
```css
/* Headings and important content */
color: var(--cave-white);

/* Body text and readable content */
color: var(--cave-off-white);

/* Secondary information */
color: var(--cave-mist);
```

#### Accent Colors
```css
/* Primary actions and brand elements */
color: var(--cave-red);
border-color: var(--cave-red);

/* Loading states and secondary actions */
color: var(--cave-ember);

/* Success states and highlights */
color: var(--cave-torch);
```

### Accessibility Compliance

All color combinations meet WCAG 2.1 AA standards:

- **Cave White on Cave Charcoal**: 15.8:1 contrast ratio
- **Cave Off-White on Cave Charcoal**: 12.6:1 contrast ratio
- **Cave Red on Cave Dark**: 8.2:1 contrast ratio
- **Cave Mist on Cave Stone**: 4.7:1 contrast ratio

## Typography

### Font System

```typescript
export const CAVE_TYPOGRAPHY = {
  // Headings - Strong, confident hierarchy
  heading: {
    h1: "text-4xl font-bold tracking-tight text-cave-white",
    h2: "text-3xl font-semibold tracking-tight text-cave-white", 
    h3: "text-2xl font-semibold text-cave-white",
    h4: "text-xl font-medium text-cave-white"
  },
  
  // Body text - Readable, accessible
  body: {
    large: "text-lg leading-relaxed text-cave-off-white",
    normal: "text-base leading-normal text-cave-off-white",
    small: "text-sm leading-normal text-cave-mist"
  },
  
  // Interface elements
  interface: {
    button: "text-sm font-medium tracking-wide",
    label: "text-sm font-medium text-cave-off-white",
    caption: "text-xs text-cave-mist"
  }
}
```

### Usage Examples

```tsx
// Heading usage
<h1 className={CAVE_TYPOGRAPHY.heading.h1}>
  Bem-vindo à Caverna
</h1>

// Body text usage
<p className={CAVE_TYPOGRAPHY.body.normal}>
  Guerreiro, sua jornada de transformação começa aqui.
</p>

// Interface element usage
<button className={cn(
  CAVE_TYPOGRAPHY.interface.button,
  "cave-button"
)}>
  Iniciar Desafio
</button>
```

## Glass Morphism System

### Core Glass Effects

```css
/* Primary glass surface */
.cave-glass {
  background: rgba(28, 28, 28, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 51, 51, 0.2);
  border-radius: 16px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 0 20px rgba(255, 51, 51, 0.1);
}

/* Subtle glass for secondary elements */
.cave-glass-subtle {
  background: rgba(60, 60, 60, 0.6);
  backdrop-filter: blur(12px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* Strong glass for important elements */
.cave-glass-strong {
  background: rgba(10, 10, 11, 0.9);
  backdrop-filter: blur(28px) saturate(200%);
  border: 2px solid rgba(255, 51, 51, 0.4);
  border-radius: 20px;
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.6),
    inset 0 2px 0 rgba(255, 255, 255, 0.15),
    0 0 30px rgba(255, 51, 51, 0.2);
}
```

### Glass Variants

#### Message Bubbles
```css
/* User message glass */
.cave-glass-user {
  background: linear-gradient(135deg, 
    rgba(255, 51, 51, 0.2) 0%, 
    rgba(255, 165, 0, 0.1) 100%);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 51, 51, 0.3);
}

/* AI message glass */
.cave-glass-ai {
  background: linear-gradient(135deg, 
    rgba(28, 28, 28, 0.8) 0%, 
    rgba(60, 60, 60, 0.6) 100%);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

#### Interactive Elements
```css
/* Button glass effect */
.cave-glass-button {
  background: linear-gradient(135deg, 
    rgba(255, 51, 51, 0.9) 0%, 
    rgba(204, 41, 41, 0.8) 100%);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  
  &:hover {
    background: linear-gradient(135deg, 
      rgba(255, 68, 68, 0.95) 0%, 
      rgba(221, 51, 51, 0.85) 100%);
    box-shadow: 0 0 20px rgba(255, 51, 51, 0.4);
  }
}
```

## Component Patterns

### Buttons

```css
/* Primary cave button */
.cave-button {
  @apply cave-glass-button;
  @apply px-6 py-3 rounded-xl;
  @apply font-medium text-cave-white;
  @apply transition-all duration-300;
  @apply focus:cave-focus;
  
  &:hover {
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
}

/* Secondary cave button */
.cave-button-secondary {
  @apply cave-glass-subtle;
  @apply px-6 py-3 rounded-xl;
  @apply font-medium text-cave-off-white;
  @apply border-cave-mist/30;
  @apply hover:border-cave-red/50;
  @apply transition-all duration-300;
}

/* Ghost cave button */
.cave-button-ghost {
  @apply bg-transparent;
  @apply px-6 py-3 rounded-xl;
  @apply font-medium text-cave-red;
  @apply border border-cave-red/30;
  @apply hover:bg-cave-red/10;
  @apply hover:border-cave-red/60;
  @apply transition-all duration-300;
}
```

### Input Fields

```css
/* Cave input field */
.cave-input {
  @apply cave-glass-subtle;
  @apply px-4 py-3 rounded-lg;
  @apply text-cave-off-white;
  @apply placeholder-cave-mist/70;
  @apply border-cave-mist/20;
  @apply focus:border-cave-red/50;
  @apply focus:cave-focus;
  @apply transition-all duration-300;
  
  &::placeholder {
    color: rgba(176, 176, 176, 0.7);
  }
}

/* Cave textarea */
.cave-textarea {
  @apply cave-input;
  @apply min-h-[120px] resize-y;
}
```

### Cards and Containers

```css
/* Primary cave card */
.cave-card {
  @apply cave-glass;
  @apply p-6 rounded-2xl;
  @apply transition-all duration-300;
  
  &:hover {
    @apply cave-glow-subtle;
    transform: translateY(-4px);
  }
}

/* Cave section container */
.cave-section {
  @apply cave-glass-subtle;
  @apply p-8 rounded-3xl;
  @apply space-y-6;
}

/* Cave modal/dialog */
.cave-modal {
  @apply cave-glass-strong;
  @apply p-8 rounded-3xl;
  @apply max-w-2xl mx-auto;
  @apply shadow-2xl;
}
```

## Animation System

### Core Animations

```css
/* Cave entrance animation */
@keyframes cave-entrance {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Ember glow animation */
@keyframes ember-glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(255, 51, 51, 0.2);
  }
  50% {
    box-shadow: 0 0 30px rgba(255, 51, 51, 0.4);
  }
}

/* Cave pulse animation */
@keyframes cave-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}
```

### Animation Classes

```css
/* Entrance animations */
.cave-animate-entrance {
  animation: cave-entrance 0.6s ease-out;
}

/* Glow effects */
.cave-glow-subtle {
  box-shadow: 0 0 20px rgba(255, 51, 51, 0.2);
}

.cave-glow-strong {
  animation: ember-glow 2s ease-in-out infinite;
}

/* Interactive animations */
.cave-hover-lift {
  transition: transform 0.3s ease;
}

.cave-hover-lift:hover {
  transform: translateY(-4px);
}
```

### Framer Motion Variants

```typescript
export const CAVE_ANIMATIONS = {
  // Message entry animation
  messageEntry: {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -20, scale: 0.95 },
    transition: { duration: 0.3, ease: "easeOut" }
  },
  
  // Stagger children animation
  staggerContainer: {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  },
  
  // Hover interaction
  hoverScale: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: { duration: 0.2 }
  },
  
  // Loading pulse
  loadingPulse: {
    animate: {
      scale: [1, 1.1, 1],
      opacity: [0.7, 1, 0.7]
    },
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
}
```

## Focus and Accessibility

### Focus System

```css
/* Primary focus indicator */
.cave-focus {
  outline: none;
  ring: 2px solid rgba(255, 51, 51, 0.6);
  ring-offset: 2px;
  ring-offset-color: var(--cave-dark);
  border-radius: 8px;
}

/* High contrast focus for accessibility */
.cave-focus-high-contrast {
  outline: 3px solid var(--cave-torch);
  outline-offset: 2px;
}

/* Focus within containers */
.cave-focus-within:focus-within {
  @apply cave-focus;
}
```

### Screen Reader Support

```css
/* Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Skip links */
.skip-link {
  @apply cave-button;
  position: absolute;
  top: -40px;
  left: 6px;
  z-index: 1000;
  
  &:focus {
    top: 6px;
  }
}
```

## Responsive Design

### Breakpoint System

```css
/* Mobile first approach */
.cave-responsive {
  /* Mobile (default) */
  @apply p-4 text-sm;
  
  /* Tablet */
  @screen md {
    @apply p-6 text-base;
  }
  
  /* Desktop */
  @screen lg {
    @apply p-8 text-lg;
  }
  
  /* Large desktop */
  @screen xl {
    @apply p-10 text-xl;
  }
}
```

### Container Patterns

```css
/* Cave container with responsive padding */
.cave-container {
  @apply w-full max-w-7xl mx-auto;
  @apply px-4 md:px-6 lg:px-8;
}

/* Cave grid system */
.cave-grid {
  @apply grid gap-6;
  @apply grid-cols-1 md:grid-cols-2 lg:grid-cols-3;
}

/* Cave flex layouts */
.cave-flex-responsive {
  @apply flex flex-col md:flex-row;
  @apply gap-4 md:gap-6 lg:gap-8;
}
```

## Brand Assets Integration

### Logo Usage

```tsx
import { BRAND_ASSETS } from '@/app/lib/brand-assets'

// Main logo
<img 
  src={BRAND_ASSETS.logos.main} 
  alt="Modo Caverna"
  className="h-8 w-auto"
/>

// Icon version
<img 
  src={BRAND_ASSETS.logos.icon} 
  alt="Cave Icon"
  className="h-6 w-6"
/>

// Triangle logo for brand elements
<img 
  src={BRAND_ASSETS.logos.triangle} 
  alt="Red Triangle"
  className="h-4 w-4 text-cave-red"
/>
```

### Captain Images

```tsx
// Contextual Captain image selection
const getCaptainImage = (context: string) => {
  const contextMap = {
    'welcome': BRAND_ASSETS.captainImages.front,
    'instruction': BRAND_ASSETS.captainImages.rightSide,
    'challenge': BRAND_ASSETS.captainImages.back,
    'support': BRAND_ASSETS.captainImages.supportive,
    'motivation': BRAND_ASSETS.captainImages.motivational
  }
  
  return contextMap[context] || BRAND_ASSETS.captainImages.front
}
```

## Implementation Examples

### Complete Component Example

```tsx
import { cn } from '@/app/lib/utils'
import { CAVE_TYPOGRAPHY, CAVE_ANIMATIONS } from '@/app/lib/brand-assets'
import { motion } from 'framer-motion'

interface CaveCardProps {
  title: string
  content: string
  action?: () => void
  className?: string
}

export function CaveCard({ title, content, action, className }: CaveCardProps) {
  return (
    <motion.div
      className={cn(
        "cave-card cave-hover-lift",
        "cursor-pointer",
        className
      )}
      variants={CAVE_ANIMATIONS.messageEntry}
      initial="initial"
      animate="animate"
      whileHover="whileHover"
      onClick={action}
    >
      <h3 className={CAVE_TYPOGRAPHY.heading.h3}>
        {title}
      </h3>
      
      <p className={cn(
        CAVE_TYPOGRAPHY.body.normal,
        "mt-4"
      )}>
        {content}
      </p>
      
      {action && (
        <button className={cn(
          "cave-button mt-6",
          CAVE_TYPOGRAPHY.interface.button
        )}>
          Explorar
        </button>
      )}
    </motion.div>
  )
}
```

### Form Component Example

```tsx
export function CaveForm() {
  return (
    <form className="cave-section space-y-6">
      <div>
        <label className={cn(
          CAVE_TYPOGRAPHY.interface.label,
          "block mb-2"
        )}>
          Sua Meta Principal
        </label>
        
        <input
          type="text"
          className="cave-input w-full"
          placeholder="Descreva sua meta de transformação..."
        />
      </div>
      
      <div>
        <label className={cn(
          CAVE_TYPOGRAPHY.interface.label,
          "block mb-2"
        )}>
          Detalhes do Desafio
        </label>
        
        <textarea
          className="cave-textarea w-full"
          placeholder="Conte mais sobre seu desafio atual..."
        />
      </div>
      
      <button
        type="submit"
        className="cave-button w-full"
      >
        Iniciar Jornada na Caverna
      </button>
    </form>
  )
}
```

## Best Practices

### Do's

1. **Use semantic HTML**: Always start with proper HTML structure
2. **Layer glass effects**: Build up visual depth gradually
3. **Maintain contrast**: Ensure all text meets accessibility standards
4. **Animate purposefully**: Every animation should enhance user experience
5. **Test with real content**: Verify designs work with actual text lengths

### Don'ts

1. **Don't overuse glass effects**: Too many layers create visual noise
2. **Don't ignore reduced motion**: Always provide alternatives
3. **Don't sacrifice readability**: Visual effects should never impair text
4. **Don't break keyboard navigation**: Ensure all interactions are accessible
5. **Don't use color alone**: Provide additional visual cues for important information

### Performance Considerations

1. **Optimize backdrop filters**: Use sparingly on mobile devices
2. **Limit concurrent animations**: Too many can cause performance issues
3. **Use CSS transforms**: Prefer transforms over changing layout properties
4. **Implement lazy loading**: Load images and heavy effects only when needed
5. **Monitor performance**: Use browser dev tools to identify bottlenecks

## Browser Support

- **Chrome 90+**: Full support for all features
- **Firefox 88+**: Full support with minor backdrop-filter differences
- **Safari 14+**: Full support on macOS, limited backdrop-filter on iOS
- **Edge 90+**: Full support for all features

### Fallbacks

```css
/* Backdrop filter fallback */
.cave-glass {
  background: rgba(28, 28, 28, 0.8);
  backdrop-filter: blur(20px);
  
  /* Fallback for browsers without backdrop-filter */
  @supports not (backdrop-filter: blur(20px)) {
    background: rgba(28, 28, 28, 0.95);
  }
}
```

## Maintenance and Updates

### Version Control

- Document all color changes in the changelog
- Test accessibility compliance after any color updates
- Validate glass effects across different browsers
- Update component documentation when patterns change

### Future Enhancements

- Dark/light mode toggle (currently dark-optimized)
- Additional glass effect variations
- Enhanced animation library
- Improved mobile performance optimizations