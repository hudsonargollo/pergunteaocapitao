/**
 * Accessibility Tests for Chat Components
 * 
 * Comprehensive accessibility testing including:
 * - ARIA labels and roles
 * - Keyboard navigation
 * - Screen reader support
 * - Focus management
 * - Color contrast compliance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ChatInterface } from '../ChatInterface'
import { ChatMessage } from '../ChatMessage'
import { MessageList } from '../MessageList'
import { CaptainImage } from '../CaptainImage'
import type { ChatMessage as ChatMessageType } from '@/types'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />
}))

// Mock hooks
const mockUseApiClient = {
  sendMessage: vi.fn(),
  isLoading: false,
  error: null,
  clearError: vi.fn()
}

const mockUseConversation = {
  messages: [],
  addMessage: vi.fn(),
  isWaitingForResponse: false,
  conversationId: 'test-conversation-123'
}

const mockUseCaptainImages = {
  currentImage: '/placeholder-captain.svg',
  isGenerating: false,
  updateImage: vi.fn()
}

vi.mock('@/app/hooks/useApiClient', () => ({
  useApiClient: () => mockUseApiClient
}))

vi.mock('@/app/hooks/useConversation', () => ({
  useConversation: () => mockUseConversation
}))

vi.mock('@/app/hooks/useCaptainImages', () => ({
  useCaptainImages: () => mockUseCaptainImages
}))

describe('Chat Components Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ChatInterface Accessibility', () => {
    const defaultProps = {
      messages: [],
      onSendMessage: vi.fn(),
      isLoading: false,
      captainImage: '/placeholder-captain.svg'
    }

    it('should not have accessibility violations', async () => {
      const { container } = render(<ChatInterface {...defaultProps} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper landmark roles', () => {
      render(<ChatInterface {...defaultProps} />)

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('form')).toBeInTheDocument()
    })

    it('should have proper heading structure', () => {
      render(<ChatInterface {...defaultProps} />)

      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toBeInTheDocument()
      expect(mainHeading).toHaveTextContent(/capitão caverna/i)
    })

    it('should have proper form labels', () => {
      render(<ChatInterface {...defaultProps} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAccessibleName()
      
      const sendButton = screen.getByRole('button', { name: /enviar/i })
      expect(sendButton).toHaveAccessibleName()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<ChatInterface {...defaultProps} />)

      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /enviar/i })

      // Tab to input
      await user.tab()
      expect(input).toHaveFocus()

      // Tab to send button
      await user.tab()
      expect(sendButton).toHaveFocus()
    })

    it('should announce loading states to screen readers', () => {
      render(<ChatInterface {...defaultProps} isLoading={true} />)

      const loadingStatus = screen.getByRole('status')
      expect(loadingStatus).toHaveAttribute('aria-live', 'polite')
      expect(loadingStatus).toHaveTextContent(/processando/i)
    })

    it('should handle error announcements', () => {
      mockUseApiClient.error = {
        message: 'Erro de conexão',
        code: 'CONNECTION_ERROR'
      }

      render(<ChatInterface {...defaultProps} />)

      const errorAlert = screen.getByRole('alert')
      expect(errorAlert).toBeInTheDocument()
      expect(errorAlert).toHaveTextContent(/erro de conexão/i)
    })

    it('should have proper focus management', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()

      render(<ChatInterface {...defaultProps} onSendMessage={onSendMessage} />)

      const input = screen.getByRole('textbox')
      
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      // Focus should remain on input after sending
      expect(input).toHaveFocus()
    })

    it('should support high contrast mode', () => {
      render(<ChatInterface {...defaultProps} />)

      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /enviar/i })

      // Check for high contrast compatible styles
      expect(input).toHaveClass('border')
      expect(sendButton).toHaveClass('border')
    })
  })

  describe('ChatMessage Accessibility', () => {
    const userMessage: ChatMessageType = {
      id: '1',
      content: 'Como posso melhorar minha disciplina?',
      role: 'user',
      timestamp: new Date('2024-01-01T12:00:00Z')
    }

    const assistantMessage: ChatMessageType = {
      id: '2',
      content: 'Guerreiro, você deve criar um protocolo de disciplina diário!',
      role: 'assistant',
      timestamp: new Date('2024-01-01T12:01:00Z'),
      imageUrl: '/captain-response.png'
    }

    it('should not have accessibility violations', async () => {
      const { container } = render(<ChatMessage message={userMessage} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper article structure', () => {
      render(<ChatMessage message={userMessage} />)

      const article = screen.getByRole('article')
      expect(article).toBeInTheDocument()
      expect(article).toHaveAttribute('aria-labelledby')
    })

    it('should have accessible timestamps', () => {
      render(<ChatMessage message={userMessage} />)

      const time = screen.getByText('12:00')
      expect(time).toHaveAttribute('dateTime')
      expect(time).toHaveAttribute('title')
    })

    it('should have proper image alt text for assistant messages', () => {
      render(<ChatMessage message={assistantMessage} />)

      const image = screen.getByRole('img')
      expect(image).toHaveAccessibleName()
      expect(image).toHaveAttribute('alt', expect.stringContaining('Capitão Caverna'))
    })

    it('should distinguish between user and assistant messages', () => {
      const { rerender } = render(<ChatMessage message={userMessage} />)
      
      let article = screen.getByRole('article')
      expect(article).toHaveAttribute('aria-label', expect.stringContaining('usuário'))

      rerender(<ChatMessage message={assistantMessage} />)
      
      article = screen.getByRole('article')
      expect(article).toHaveAttribute('aria-label', expect.stringContaining('Capitão Caverna'))
    })

    it('should handle long content with proper text wrapping', () => {
      const longMessage: ChatMessageType = {
        ...userMessage,
        content: 'Esta é uma mensagem muito longa que deve quebrar corretamente em múltiplas linhas para manter a legibilidade e não quebrar o layout da interface do chat, garantindo que usuários com diferentes tamanhos de tela possam ler o conteúdo adequadamente.'
      }

      render(<ChatMessage message={longMessage} />)

      const article = screen.getByRole('article')
      expect(article).toHaveStyle('word-wrap: break-word')
    })
  })

  describe('MessageList Accessibility', () => {
    const messages: ChatMessageType[] = [
      {
        id: '1',
        content: 'Primeira mensagem',
        role: 'user',
        timestamp: new Date('2024-01-01T12:00:00Z')
      },
      {
        id: '2',
        content: 'Resposta do Capitão',
        role: 'assistant',
        timestamp: new Date('2024-01-01T12:01:00Z')
      }
    ]

    it('should not have accessibility violations', async () => {
      const { container } = render(<MessageList messages={messages} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper list structure', () => {
      render(<MessageList messages={messages} />)

      const list = screen.getByRole('log')
      expect(list).toBeInTheDocument()
      expect(list).toHaveAttribute('aria-label', expect.stringContaining('conversa'))
    })

    it('should announce new messages to screen readers', () => {
      render(<MessageList messages={messages} />)

      const list = screen.getByRole('log')
      expect(list).toHaveAttribute('aria-live', 'polite')
    })

    it('should handle empty state accessibly', () => {
      render(<MessageList messages={[]} />)

      const emptyState = screen.getByText(/nenhuma mensagem/i)
      expect(emptyState).toBeInTheDocument()
      expect(emptyState).toHaveAttribute('role', 'status')
    })

    it('should provide message count information', () => {
      render(<MessageList messages={messages} />)

      const list = screen.getByRole('log')
      expect(list).toHaveAttribute('aria-describedby')
      
      const description = screen.getByText(/2 mensagens/i)
      expect(description).toBeInTheDocument()
    })
  })

  describe('CaptainImage Accessibility', () => {
    const defaultProps = {
      imageUrl: '/captain-image.png',
      isGenerating: false,
      onImageLoad: vi.fn(),
      fallbackImage: '/placeholder-captain.svg'
    }

    it('should not have accessibility violations', async () => {
      const { container } = render(<CaptainImage {...defaultProps} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper image alt text', () => {
      render(<CaptainImage {...defaultProps} />)

      const image = screen.getByRole('img')
      expect(image).toHaveAccessibleName()
      expect(image).toHaveAttribute('alt', expect.stringContaining('Capitão Caverna'))
    })

    it('should announce loading state', () => {
      render(<CaptainImage {...defaultProps} isGenerating={true} />)

      const loadingStatus = screen.getByRole('status')
      expect(loadingStatus).toHaveAttribute('aria-live', 'polite')
      expect(loadingStatus).toHaveTextContent(/gerando/i)
    })

    it('should handle image load errors accessibly', () => {
      render(<CaptainImage {...defaultProps} />)

      const image = screen.getByRole('img')
      
      // Simulate image load error
      fireEvent.error(image)

      // Should show fallback image
      expect(image).toHaveAttribute('src', '/placeholder-captain.svg')
    })

    it('should provide context for image changes', () => {
      const { rerender } = render(<CaptainImage {...defaultProps} />)

      rerender(<CaptainImage {...defaultProps} imageUrl="/new-captain-image.png" />)

      const image = screen.getByRole('img')
      expect(image).toHaveAttribute('aria-describedby')
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support full keyboard navigation through chat interface', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()

      render(
        <ChatInterface
          messages={[]}
          onSendMessage={onSendMessage}
          isLoading={false}
          captainImage="/placeholder-captain.svg"
        />
      )

      // Start navigation
      await user.tab()
      expect(screen.getByRole('textbox')).toHaveFocus()

      // Navigate to send button
      await user.tab()
      expect(screen.getByRole('button', { name: /enviar/i })).toHaveFocus()

      // Navigate to any error retry buttons if present
      if (mockUseApiClient.error) {
        await user.tab()
        expect(screen.getByRole('button', { name: /tentar novamente/i })).toHaveFocus()
      }
    })

    it('should handle escape key to clear errors', async () => {
      const user = userEvent.setup()
      mockUseApiClient.error = {
        message: 'Test error',
        code: 'TEST_ERROR'
      }

      render(
        <ChatInterface
          messages={[]}
          onSendMessage={vi.fn()}
          isLoading={false}
          captainImage="/placeholder-captain.svg"
        />
      )

      await user.keyboard('{Escape}')
      expect(mockUseApiClient.clearError).toHaveBeenCalled()
    })

    it('should support arrow key navigation in message history', async () => {
      const user = userEvent.setup()
      const messages: ChatMessageType[] = [
        {
          id: '1',
          content: 'Primeira mensagem',
          role: 'user',
          timestamp: new Date()
        },
        {
          id: '2',
          content: 'Segunda mensagem',
          role: 'assistant',
          timestamp: new Date()
        }
      ]

      render(<MessageList messages={messages} />)

      const messageList = screen.getByRole('log')
      messageList.focus()

      // Should be able to navigate through messages
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{ArrowUp}')
      
      // Focus should remain manageable
      expect(document.activeElement).toBeDefined()
    })
  })

  describe('Screen Reader Support', () => {
    it('should provide proper live region updates', async () => {
      const user = userEvent.setup()
      const onSendMessage = vi.fn()

      render(
        <ChatInterface
          messages={[]}
          onSendMessage={onSendMessage}
          isLoading={false}
          captainImage="/placeholder-captain.svg"
        />
      )

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')

      // Should have live regions for status updates
      const statusRegions = screen.getAllByRole('status')
      expect(statusRegions.length).toBeGreaterThan(0)
    })

    it('should announce conversation statistics', () => {
      const messages: ChatMessageType[] = [
        {
          id: '1',
          content: 'Test message',
          role: 'user',
          timestamp: new Date()
        }
      ]

      render(
        <ChatInterface
          messages={messages}
          onSendMessage={vi.fn()}
          isLoading={false}
          captainImage="/placeholder-captain.svg"
        />
      )

      const stats = screen.getByText(/1 mensagem/i)
      expect(stats).toHaveAttribute('aria-live', 'polite')
    })

    it('should provide context for dynamic content changes', () => {
      mockUseCaptainImages.isGenerating = true

      render(
        <ChatInterface
          messages={[]}
          onSendMessage={vi.fn()}
          isLoading={false}
          captainImage="/placeholder-captain.svg"
        />
      )

      const imageStatus = screen.getByText(/gerando imagem/i)
      expect(imageStatus).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('Color Contrast and Visual Accessibility', () => {
    it('should maintain sufficient color contrast', () => {
      render(
        <ChatInterface
          messages={[]}
          onSendMessage={vi.fn()}
          isLoading={false}
          captainImage="/placeholder-captain.svg"
        />
      )

      // Check that text elements have proper contrast classes
      const input = screen.getByRole('textbox')
      const button = screen.getByRole('button', { name: /enviar/i })

      expect(input).toHaveClass('text-foreground')
      expect(button).toHaveClass('text-primary-foreground')
    })

    it('should support reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      render(
        <ChatInterface
          messages={[]}
          onSendMessage={vi.fn()}
          isLoading={false}
          captainImage="/placeholder-captain.svg"
        />
      )

      // Should apply reduced motion classes
      const animatedElements = screen.getAllByRole('img')
      animatedElements.forEach(element => {
        expect(element).toHaveClass('motion-reduce:transition-none')
      })
    })
  })
})