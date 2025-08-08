# AnimatedAIChat Component Documentation

## Overview

The `AnimatedAIChat` component is the core interactive interface for the "Ask the Captain" platform, providing an immersive chat experience with Capitão Caverna. It features advanced animations, performance optimizations, accessibility compliance, and comprehensive error handling while maintaining the Cavernous Tech aesthetic.

## Features

- **Advanced Animations**: Smooth framer-motion animations with reduced motion support
- **Performance Optimized**: Virtual scrolling, message caching, and API batching
- **Accessibility Compliant**: WCAG 2.1 AA compliance with full keyboard navigation
- **Error Resilience**: Comprehensive error handling with Captain persona messaging
- **Image Consistency**: Contextual Captain image generation with validation
- **Network Awareness**: Offline detection and graceful degradation

## Installation

```bash
npm install framer-motion lucide-react
```

## Basic Usage

```tsx
import { AnimatedAIChat } from '@/app/components/ui/animated-ai-chat'

export default function ChatPage() {
  return (
    <AnimatedAIChat
      initialMessage="Guerreiro, bem-vindo à caverna! Como posso te ajudar hoje?"
      onMessageSent={(message) => console.log('User sent:', message)}
      onResponseReceived={(response) => console.log('AI responded:', response)}
      className="h-screen"
    />
  )
}
```

## Props Interface

```typescript
interface AnimatedAIChatProps {
  /** Initial welcome message from the Captain */
  initialMessage?: string
  
  /** Callback fired when user sends a message */
  onMessageSent?: (message: string) => void
  
  /** Callback fired when AI responds */
  onResponseReceived?: (response: ChatResponse) => void
  
  /** Additional CSS classes */
  className?: string
}
```

## Core Interfaces

### ChatMessage

```typescript
interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  imageUrl?: string
  isTyping?: boolean
}
```

### ChatResponse

```typescript
interface ChatResponse {
  response: string
  imageUrl: string
  conversationId: string
}
```

### AnimationConfig

```typescript
interface AnimationConfig {
  messageEntry: {
    initial: { opacity: number; y: number; scale: number }
    animate: { opacity: number; y: number; scale: number }
    transition: { duration: number; ease: string }
  }
  typingIndicator: {
    animate: { scale: number[] }
    transition: { repeat: number; duration: number }
  }
  imageTransition: {
    initial: { opacity: number; scale: number }
    animate: { opacity: number; scale: number }
    exit: { opacity: number; scale: number }
    transition: { duration: number }
  }
  rippleEffect: {
    initial: { scale: number; opacity: number }
    animate: { scale: number; opacity: number }
    transition: { duration: number }
  }
}
```

## Performance Features

### Virtual Scrolling

The component automatically enables virtual scrolling for conversations with more than 50 messages:

```typescript
const { 
  visibleItems: virtualizedMessages,
  totalHeight: virtualScrollHeight,
  handleScroll: handleVirtualScroll,
  scrollToBottom: virtualScrollToBottom 
} = useVirtualScrolling(renderableMessages, 80, 600, 5)
```

### Message Caching

Efficient message rendering with memory management:

```typescript
const { 
  renderableMessages, 
  renderMode, 
  memoryStats, 
  shouldUseVirtualization 
} = useMessageMemoryManagement(chatState.messages, 50, true)
```

### API Batching

Optimized API calls with request batching:

```typescript
const { addRequest: batchAPIRequest } = useAPIBatching(
  async (requests) => { /* batch processing */ },
  3, // batch size
  200, // batch delay
  true // enable caching
)
```

## Animation System

### Reduced Motion Support

The component respects user motion preferences:

```typescript
const shouldReduceMotion = useReducedMotion()
const animationConfig = getAnimationConfig(shouldReduceMotion)
```

### Performance-Based Animation Adjustment

Animations adapt based on device performance:

```typescript
const deviceCapabilities = useDevicePerformance()
const animationSettings = useMemo(() => {
  if (!deviceCapabilities.isHighPerformance) {
    return {
      enableComplexAnimations: false,
      enableBlur: false,
      maxConcurrentAnimations: 5
    }
  }
  return defaultSettings
}, [deviceCapabilities])
```

## Error Handling

### Captain Persona Error Messages

Errors are presented in Capitão Caverna's voice:

```typescript
const errorHandler = new CaptainErrorHandler()

// Network error example
const errorMessage = errorHandler.getCaptainErrorMessage(error, 'chat')
// Returns: "Guerreiro, a conexão com a caverna está instável..."
```

### Comprehensive Recovery System

Multi-layered error recovery with fallbacks:

```typescript
// 1. Retry with exponential backoff
await errorHandler.withRetry(operation, { maxAttempts: 3 })

// 2. Recovery mechanisms
const recoveryResult = await recoveryMechanisms.executeRecovery('chat_completion', context)

// 3. Offline state management
if (offlineStateManager.isOffline()) {
  const offlineState = offlineStateManager.createOfflineErrorState(message)
}

// 4. Final fallback with Captain messaging
const fallbackMessage = errorHandler.getCaptainErrorMessage(error)
```

## Image Generation System

### Contextual Captain Images

Images are generated based on response context:

```typescript
const responseContext: ResponseContext = {
  content: responseContent,
  tone: analyzeResponseTone(responseContent),
  themes: extractThemes(responseContent),
  intensity: analyzeIntensity(responseContent)
}

await generateCaptainImage(responseContent, messageId)
```

### Image Consistency Validation

Ensures Captain character consistency:

```typescript
const {
  currentImageUrl: captainImageUrl,
  isValidating: isValidatingImage,
  validationResult,
  usedFallback: captainUsedFallback,
  loadCaptainImage,
  validateCurrentImage
} = useCaptainImageConsistency(fallbackImage, {
  enableValidation: true,
  maxRetries: 3,
  autoRetryOnFailure: true
})
```

## Accessibility Features

### ARIA Support

Full ARIA labeling and descriptions:

```tsx
<div
  role="article"
  aria-label={`Mensagem ${index + 1} de ${message.role === 'user' ? 'você' : 'Capitão Caverna'}`}
>
  <p 
    id={`message-${message.id}-content`}
    role="text"
  >
    {message.content}
  </p>
</div>
```

### Keyboard Navigation

Complete keyboard accessibility:

```tsx
<div
  tabIndex={0}
  role="group"
  aria-labelledby={`message-${message.id}-content`}
  onKeyDown={handleKeyboardNavigation}
>
```

### Screen Reader Announcements

Dynamic content announcements:

```typescript
const announceMessage = (content: string, role: 'user' | 'assistant') => {
  const announcement = role === 'user' 
    ? `Você disse: ${content}`
    : `Capitão Caverna respondeu: ${content}`
  
  // Announce to screen readers
  const announcer = document.createElement('div')
  announcer.setAttribute('aria-live', 'polite')
  announcer.setAttribute('aria-atomic', 'true')
  announcer.className = 'sr-only'
  announcer.textContent = announcement
  
  document.body.appendChild(announcer)
  setTimeout(() => document.body.removeChild(announcer), 1000)
}
```

## Styling and Theming

### Cave Theme Classes

The component uses Cavernous Tech design system classes:

```css
/* Glass morphism effects */
.cave-glass {
  background: rgba(28, 28, 28, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 51, 51, 0.2);
}

/* Cave button styling */
.cave-button {
  background: linear-gradient(135deg, #FF3333 0%, #CC2929 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Focus indicators */
.cave-focus {
  outline: none;
  ring: 2px solid rgba(255, 51, 51, 0.6);
  ring-offset: 2px;
  ring-offset-color: #0A0A0B;
}
```

### Typography System

Consistent typography using the cave theme:

```typescript
import { CAVE_TYPOGRAPHY } from '@/app/lib/brand-assets'

// Usage in component
<p className={cn(CAVE_TYPOGRAPHY.body.normal, "text-cave-off-white")}>
  {message.content}
</p>
```

## Performance Monitoring

### Built-in Performance Tracking

```typescript
const { metrics: performanceMetrics, isMonitoring } = useAnimationPerformance({
  targetFPS: 60,
  enableLogging: process.env.NODE_ENV === 'development',
  onPerformanceChange: (metrics) => {
    if (metrics.fps < 30 || !metrics.isOptimal) {
      console.warn('Animation performance degraded')
    }
  }
})
```

### Conversation Statistics

```typescript
const conversationStats = useMemo(() => ({
  messageCount: chatState.messages.length,
  memoryUsage: memoryStats.memoryUsage,
  cacheHitRate: getCacheStats().hitRate,
  virtualScrolling: {
    enabled: shouldUseVirtualization,
    visibleRange: visibleRange,
    totalHeight: virtualScrollHeight
  }
}), [/* dependencies */])
```

## Network Connectivity

### Offline Detection

```typescript
const {
  state: connectivityState,
  quality: networkQuality,
  isOnline,
  isOffline,
  checkConnectivity,
  getCaptainMessage: getCaptainConnectivityMessage
} = useNetworkConnectivity()
```

### Connectivity-Aware Messaging

```typescript
useEffect(() => {
  if (isOffline && !chatState.error) {
    const captainMessage = getCaptainConnectivityMessage()
    chatActions.setError(captainMessage.message)
  }
}, [connectivityState, isOffline])
```

## Testing

### Component Testing

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AnimatedAIChat } from './animated-ai-chat'

test('sends message and displays response', async () => {
  const onMessageSent = jest.fn()
  const onResponseReceived = jest.fn()
  
  render(
    <AnimatedAIChat
      onMessageSent={onMessageSent}
      onResponseReceived={onResponseReceived}
    />
  )
  
  const input = screen.getByRole('textbox')
  const sendButton = screen.getByRole('button', { name: /enviar/i })
  
  fireEvent.change(input, { target: { value: 'Test message' } })
  fireEvent.click(sendButton)
  
  expect(onMessageSent).toHaveBeenCalledWith('Test message')
  
  await waitFor(() => {
    expect(screen.getByText('Test message')).toBeInTheDocument()
  })
})
```

### Accessibility Testing

```typescript
import { axe, toHaveNoViolations } from 'jest-axe'

test('has no accessibility violations', async () => {
  const { container } = render(<AnimatedAIChat />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

## Troubleshooting

### Common Issues

#### 1. Animations Not Working

**Problem**: Animations appear choppy or don't work
**Solution**: Check if user has reduced motion enabled or device performance is low

```typescript
// Debug animation settings
console.log('Reduced motion:', shouldReduceMotion)
console.log('Device capabilities:', deviceCapabilities)
console.log('Animation settings:', animationSettings)
```

#### 2. Images Not Loading

**Problem**: Captain images fail to load
**Solution**: Check fallback system and image validation

```typescript
// Debug image loading
console.log('Captain image URL:', captainImageUrl)
console.log('Validation result:', validationResult)
console.log('Used fallback:', captainUsedFallback)
```

#### 3. Performance Issues

**Problem**: Component feels slow with large conversations
**Solution**: Verify virtual scrolling is enabled

```typescript
// Debug performance
console.log('Should use virtualization:', shouldUseVirtualization)
console.log('Visible range:', visibleRange)
console.log('Memory stats:', memoryStats)
```

#### 4. API Errors

**Problem**: Chat requests failing
**Solution**: Check error handling and recovery mechanisms

```typescript
// Debug API issues
console.log('Connectivity state:', connectivityState)
console.log('Network quality:', networkQuality)
console.log('Last error:', chatState.error)
```

### Performance Optimization Tips

1. **Enable Virtual Scrolling**: Automatically enabled for 50+ messages
2. **Use Message Caching**: Enabled by default for better performance
3. **Optimize Images**: Captain images are preloaded and cached
4. **Batch API Requests**: Multiple requests are automatically batched
5. **Monitor Performance**: Use built-in performance monitoring in development

### Customization Examples

#### Custom Error Messages

```typescript
const customErrorHandler = new CaptainErrorHandler()
customErrorHandler.getCaptainErrorMessage = (error, context) => {
  // Custom error message logic
  return "Guerreiro, algo inesperado aconteceu na caverna..."
}
```

#### Custom Animation Config

```typescript
const customAnimationConfig = {
  messageEntry: {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5, ease: "easeOut" }
  }
  // ... other animations
}
```

## Dependencies

- `react` (^18.0.0)
- `framer-motion` (^10.0.0)
- `lucide-react` (^0.263.0)
- Custom hooks and utilities from the project

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

This component is part of the "Ask the Captain" platform and follows the project's licensing terms.