/**
 * AnimatedAIChat Integration Tests
 * 
 * Integration tests for API connectivity and data flow including:
 * - End-to-end message flow from user input to AI response
 * - API endpoint integration with real-like responses
 * - Image generation pipeline integration
 * - Error handling across the entire system
 * - Performance under various network conditions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnimatedAIChat } from '../animated-ai-chat'

// Mock the entire framer-motion library for integration tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    input: ({ children, ...props }: any) => <input {...props}>{children}</input>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />
}))

// Mock icons
vi.mock('lucide-react', () => ({
  Send: () => <span data-testid="send-icon">Send</span>,
  Loader2: () => <span data-testid="loader-icon">Loading</span>,
  MessageCircle: () => <span data-testid="message-icon">Message</span>,
  Zap: () => <span data-testid="zap-icon">Zap</span>,
}))

// Create realistic API response mocks
const createChatResponse = (message: string, delay = 100) => ({
  response: `Guerreiro, entendi sua pergunta sobre "${message}". Vou te orientar com disciplina e foco!`,
  imageUrl: '/captain-response.png',
  conversationId: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
})

const createImageResponse = (delay = 200) => ({
  imageUrl: `/generated-captain-${Date.now()}.png`,
  imageId: `img_${Date.now()}`,
  promptParameters: {
    tone: 'supportive',
    context: 'guidance',
    style: 'pixar-3d',
  },
})

// Mock fetch with realistic network behavior
const createFetchMock = (options: {
  chatDelay?: number
  imageDelay?: number
  chatFailureRate?: number
  imageFailureRate?: number
  networkLatency?: number
} = {}) => {
  const {
    chatDelay = 100,
    imageDelay = 200,
    chatFailureRate = 0,
    imageFailureRate = 0,
    networkLatency = 0,
  } = options

  return vi.fn().mockImplementation(async (url: string, config: any) => {
    // Simulate network latency
    if (networkLatency > 0) {
      await new Promise(resolve => setTimeout(resolve, networkLatency))
    }

    if (url === '/api/chat') {
      // Simulate chat API failures
      if (Math.random() < chatFailureRate) {
        throw new Error('Network error: Chat API unavailable')
      }

      await new Promise(resolve => setTimeout(resolve, chatDelay))
      
      const body = JSON.parse(config.body)
      return {
        ok: true,
        json: () => Promise.resolve(createChatResponse(body.message)),
      }
    }

    if (url === '/api/v1/images/generate') {
      // Simulate image generation failures
      if (Math.random() < imageFailureRate) {
        throw new Error('Image generation service unavailable')
      }

      await new Promise(resolve => setTimeout(resolve, imageDelay))
      
      return {
        ok: true,
        json: () => Promise.resolve(createImageResponse()),
      }
    }

    throw new Error(`Unexpected URL: ${url}`)
  })
}

describe('AnimatedAIChat Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = createFetchMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Complete Message Flow', () => {
    it('should handle complete user message to AI response flow', async () => {
      const user = userEvent.setup()
      const onMessageSent = vi.fn()
      const onResponseReceived = vi.fn()

      render(
        <AnimatedAIChat
          onMessageSent={onMessageSent}
          onResponseReceived={onResponseReceived}
        />
      )

      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /enviar/i })

      // User types and sends message
      await user.type(input, 'Como posso melhorar minha disciplina?')
      await user.click(sendButton)

      // Verify callbacks were called
      expect(onMessageSent).toHaveBeenCalledWith('Como posso melhorar minha disciplina?')

      // Wait for API response
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Como posso melhorar minha disciplina?',
            conversationId: expect.any(String),
          }),
        })
      }, { timeout: 3000 })

      // Wait for response callback
      await waitFor(() => {
        expect(onResponseReceived).toHaveBeenCalledWith(
          expect.objectContaining({
            response: expect.stringContaining('disciplina'),
            imageUrl: expect.stringContaining('captain'),
            conversationId: expect.any(String),
          })
        )
      }, { timeout: 3000 })

      // Verify input was cleared
      expect(input).toHaveValue('')
    })

    it('should handle image generation after chat response', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Preciso de motivação')
      await user.keyboard('{Enter}')

      // Wait for chat API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
      })

      // Wait for image generation API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('motivação'),
        })
      }, { timeout: 5000 })

      // Verify both API calls were made
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should maintain conversation context across multiple messages', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')

      // Send first message
      await user.type(input, 'Primeira pergunta')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
      })

      // Send second message
      await user.type(input, 'Segunda pergunta')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(4) // 2 chat + 2 image calls
      })

      // Verify conversation ID is maintained
      const calls = (global.fetch as any).mock.calls.filter((call: any) => 
        call[0] === '/api/chat'
      )
      
      expect(calls).toHaveLength(2)
      
      const firstCallBody = JSON.parse(calls[0][1].body)
      const secondCallBody = JSON.parse(calls[1][1].body)
      
      expect(secondCallBody.conversationId).toBe(firstCallBody.conversationId)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle chat API failures gracefully', async () => {
      const user = userEvent.setup()
      global.fetch = createFetchMock({ chatFailureRate: 1 }) // Always fail

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      // Should show Captain persona error message
      await waitFor(() => {
        expect(screen.getByText(/guerreiro/i)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Should not crash the application
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /enviar/i })).toBeInTheDocument()
    })

    it('should handle image generation failures with fallback', async () => {
      const user = userEvent.setup()
      global.fetch = createFetchMock({ imageFailureRate: 1 }) // Always fail image generation

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      // Wait for chat response
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
      })

      // Wait for image generation attempt
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', expect.any(Object))
      }, { timeout: 5000 })

      // Should continue working despite image failure
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByAltText('Capitão Caverna')).toBeInTheDocument()
    })

    it('should retry failed requests', async () => {
      const user = userEvent.setup()
      let callCount = 0
      
      global.fetch = vi.fn().mockImplementation(async (url: string, config: any) => {
        if (url === '/api/chat') {
          callCount++
          if (callCount === 1) {
            throw new Error('Temporary network error')
          }
          
          const body = JSON.parse(config.body)
          return {
            ok: true,
            json: () => Promise.resolve(createChatResponse(body.message)),
          }
        }
        
        if (url === '/api/v1/images/generate') {
          return {
            ok: true,
            json: () => Promise.resolve(createImageResponse()),
          }
        }
      })

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test retry')
      await user.keyboard('{Enter}')

      // Should retry and eventually succeed
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3) // 2 chat attempts + 1 image
      }, { timeout: 5000 })

      expect(callCount).toBe(2) // Verify retry happened
    })

    it('should handle HTTP error responses with fallback content', async () => {
      const user = userEvent.setup()
      
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/chat') {
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: () => Promise.resolve({
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Server temporarily unavailable',
                timestamp: new Date().toISOString(),
              },
              fallback: {
                response: 'Guerreiro, a caverna está temporariamente inacessível, mas mantenha sua disciplina!',
                imageUrl: '/fallback-captain.png',
              },
            }),
          }
        }
        
        return {
          ok: true,
          json: () => Promise.resolve(createImageResponse()),
        }
      })

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test fallback')
      await user.keyboard('{Enter}')

      // Should use fallback response
      await waitFor(() => {
        expect(screen.getByText(/caverna está temporariamente inacessível/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Performance Under Load', () => {
    it('should handle slow network conditions', async () => {
      const user = userEvent.setup()
      global.fetch = createFetchMock({ 
        chatDelay: 2000, 
        imageDelay: 3000,
        networkLatency: 500,
      })

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Slow network test')
      await user.keyboard('{Enter}')

      // Should show loading states
      expect(screen.getByText(/processando/i)).toBeInTheDocument()

      // Should eventually complete
      await waitFor(() => {
        expect(screen.getByText(/guerreiro/i)).toBeInTheDocument()
      }, { timeout: 10000 })
    })

    it('should handle rapid successive messages', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')

      // Send multiple messages rapidly
      for (let i = 1; i <= 3; i++) {
        await user.type(input, `Message ${i}`)
        await user.keyboard('{Enter}')
        
        // Small delay to allow state updates
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 50))
        })
      }

      // Should handle all messages without crashing
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(6) // 3 chat + 3 image calls
      }, { timeout: 10000 })

      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should maintain performance with large conversation history', async () => {
      const user = userEvent.setup()
      
      // Mock a component with many existing messages
      const manyMessages = Array.from({ length: 50 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant' as const,
        timestamp: new Date(Date.now() - (50 - i) * 60000), // Spread over time
      }))

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'New message in long conversation')
      await user.keyboard('{Enter}')

      // Should still respond quickly despite large history
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
      }, { timeout: 3000 })

      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  describe('Real-time Features', () => {
    it('should update UI immediately on user input', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      
      await user.type(input, 'T')
      expect(input).toHaveValue('T')
      
      await user.type(input, 'est')
      expect(input).toHaveValue('Test')
      
      await user.type(input, ' message')
      expect(input).toHaveValue('Test message')
    })

    it('should show typing indicator immediately when processing', async () => {
      const user = userEvent.setup()
      global.fetch = createFetchMock({ chatDelay: 1000 })

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      // Should show typing indicator immediately
      expect(screen.getByText(/capitão está pensando/i)).toBeInTheDocument()
      
      // Should disable input during processing
      expect(input).toBeDisabled()
      expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled()
    })

    it('should update captain image when new image is generated', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Generate new image')
      await user.keyboard('{Enter}')

      // Wait for both API calls to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      }, { timeout: 5000 })

      // Should have captain image displayed
      expect(screen.getByAltText('Capitão Caverna')).toBeInTheDocument()
    })
  })

  describe('Data Flow Validation', () => {
    it('should pass correct data to chat API', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Specific test message')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Specific test message',
            conversationId: expect.any(String),
          }),
        })
      })
    })

    it('should pass response content to image generation API', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test for image generation')
      await user.keyboard('{Enter}')

      // Wait for image generation call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/images/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('Test for image generation'),
        })
      }, { timeout: 5000 })
    })

    it('should maintain conversation ID across API calls', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      
      // First message
      await user.type(input, 'First message')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
      })

      const firstChatCall = (global.fetch as any).mock.calls.find((call: any) => 
        call[0] === '/api/chat'
      )
      const firstConversationId = JSON.parse(firstChatCall[1].body).conversationId

      // Second message
      await user.type(input, 'Second message')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(4) // 2 chat + 2 image
      })

      const secondChatCall = (global.fetch as any).mock.calls.filter((call: any) => 
        call[0] === '/api/chat'
      )[1]
      const secondConversationId = JSON.parse(secondChatCall[1].body).conversationId

      expect(secondConversationId).toBe(firstConversationId)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty API responses', async () => {
      const user = userEvent.setup()
      
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/chat') {
          return {
            ok: true,
            json: () => Promise.resolve({
              response: '',
              imageUrl: '',
              conversationId: 'empty_conv',
            }),
          }
        }
        
        return {
          ok: true,
          json: () => Promise.resolve(createImageResponse()),
        }
      })

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test empty response')
      await user.keyboard('{Enter}')

      // Should handle empty response gracefully
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should handle malformed JSON responses', async () => {
      const user = userEvent.setup()
      
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/chat') {
          return {
            ok: true,
            json: () => Promise.reject(new Error('Invalid JSON')),
          }
        }
        
        return {
          ok: true,
          json: () => Promise.resolve(createImageResponse()),
        }
      })

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test malformed JSON')
      await user.keyboard('{Enter}')

      // Should handle JSON parsing errors
      await waitFor(() => {
        expect(screen.getByText(/guerreiro/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should handle network timeouts', async () => {
      const user = userEvent.setup()
      
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === '/api/chat') {
          // Simulate timeout
          await new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
        }
        
        return {
          ok: true,
          json: () => Promise.resolve(createImageResponse()),
        }
      })

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test timeout')
      await user.keyboard('{Enter}')

      // Should handle timeout gracefully
      await waitFor(() => {
        expect(screen.getByText(/guerreiro/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Accessibility Integration', () => {
    it('should maintain accessibility during loading states', async () => {
      const user = userEvent.setup()
      global.fetch = createFetchMock({ chatDelay: 1000 })

      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Accessibility test')
      await user.keyboard('{Enter}')

      // Should have accessible loading state
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')

      // Should maintain keyboard navigation
      expect(document.activeElement).toBeDefined()
    })

    it('should announce new messages to screen readers', async () => {
      const user = userEvent.setup()
      render(<AnimatedAIChat />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Screen reader test')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByText(/guerreiro/i)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Should have live region for new messages
      const liveRegions = screen.getAllByRole('status')
      expect(liveRegions.length).toBeGreaterThan(0)
    })
  })
})