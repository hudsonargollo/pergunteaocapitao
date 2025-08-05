/**
 * Input Component Tests
 * 
 * Tests for the reusable Input component including:
 * - Basic input functionality
 * - Different input types
 * - Validation states
 * - Accessibility features
 * - Form integration
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../input'

describe('Input Component', () => {
  describe('Basic Rendering', () => {
    it('should render input element', () => {
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('should render with placeholder', () => {
      render(<Input placeholder="Enter your message..." />)
      
      const input = screen.getByPlaceholderText('Enter your message...')
      expect(input).toBeInTheDocument()
    })

    it('should render with default value', () => {
      render(<Input defaultValue="Default text" />)
      
      const input = screen.getByDisplayValue('Default text')
      expect(input).toBeInTheDocument()
    })

    it('should render with controlled value', () => {
      render(<Input value="Controlled text" onChange={() => {}} />)
      
      const input = screen.getByDisplayValue('Controlled text')
      expect(input).toBeInTheDocument()
    })
  })

  describe('Input Types', () => {
    it('should render text input by default', () => {
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'text')
    })

    it('should render email input', () => {
      render(<Input type="email" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'email')
    })

    it('should render password input', () => {
      render(<Input type="password" />)
      
      const input = screen.getByLabelText(/password/i) || screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'password')
    })

    it('should render number input', () => {
      render(<Input type="number" />)
      
      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('type', 'number')
    })

    it('should render search input', () => {
      render(<Input type="search" />)
      
      const input = screen.getByRole('searchbox')
      expect(input).toHaveAttribute('type', 'search')
    })

    it('should render tel input', () => {
      render(<Input type="tel" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'tel')
    })

    it('should render url input', () => {
      render(<Input type="url" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'url')
    })
  })

  describe('States', () => {
    it('should handle disabled state', () => {
      render(<Input disabled />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
      expect(input).toHaveClass('disabled:cursor-not-allowed')
    })

    it('should handle readonly state', () => {
      render(<Input readOnly value="Read only text" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('readonly')
    })

    it('should handle required state', () => {
      render(<Input required />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('required')
    })

    it('should show focus styles', async () => {
      const user = userEvent.setup()
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      await user.click(input)
      
      expect(input).toHaveFocus()
      expect(input).toHaveClass('focus-visible:ring-2')
    })
  })

  describe('User Interaction', () => {
    it('should handle text input', async () => {
      const user = userEvent.setup()
      render(<Input />)
      
      const input = screen.getByRole('textbox') as HTMLInputElement
      await user.type(input, 'Hello World')
      
      expect(input.value).toBe('Hello World')
    })

    it('should handle onChange events', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()
      
      render(<Input onChange={handleChange} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      
      expect(handleChange).toHaveBeenCalledTimes(4) // One for each character
    })

    it('should handle onFocus events', async () => {
      const user = userEvent.setup()
      const handleFocus = vi.fn()
      
      render(<Input onFocus={handleFocus} />)
      
      const input = screen.getByRole('textbox')
      await user.click(input)
      
      expect(handleFocus).toHaveBeenCalledTimes(1)
    })

    it('should handle onBlur events', async () => {
      const user = userEvent.setup()
      const handleBlur = vi.fn()
      
      render(<Input onBlur={handleBlur} />)
      
      const input = screen.getByRole('textbox')
      await user.click(input)
      await user.tab() // Move focus away
      
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })

    it('should handle keyboard events', async () => {
      const user = userEvent.setup()
      const handleKeyDown = vi.fn()
      
      render(<Input onKeyDown={handleKeyDown} />)
      
      const input = screen.getByRole('textbox')
      await user.click(input)
      await user.keyboard('{Enter}')
      
      expect(handleKeyDown).toHaveBeenCalled()
    })
  })

  describe('Validation', () => {
    it('should handle invalid state with aria-invalid', () => {
      render(<Input aria-invalid="true" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('should handle validation with aria-describedby', () => {
      render(
        <div>
          <Input aria-describedby="error-message" />
          <div id="error-message">This field is required</div>
        </div>
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby', 'error-message')
    })

    it('should handle pattern validation', () => {
      render(<Input pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('pattern', '[0-9]{3}-[0-9]{3}-[0-9]{4}')
    })

    it('should handle min/max length validation', () => {
      render(<Input minLength={3} maxLength={10} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('minlength', '3')
      expect(input).toHaveAttribute('maxlength', '10')
    })
  })

  describe('Accessibility', () => {
    it('should have proper input role', () => {
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('should support aria-label', () => {
      render(<Input aria-label="Search query" />)
      
      const input = screen.getByLabelText('Search query')
      expect(input).toBeInTheDocument()
    })

    it('should support aria-labelledby', () => {
      render(
        <div>
          <label id="input-label">Username</label>
          <Input aria-labelledby="input-label" />
        </div>
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-labelledby', 'input-label')
    })

    it('should be focusable by default', () => {
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      input.focus()
      expect(input).toHaveFocus()
    })

    it('should not be focusable when disabled', () => {
      render(<Input disabled />)
      
      const input = screen.getByRole('textbox')
      input.focus()
      expect(input).not.toHaveFocus()
    })

    it('should support tab navigation', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <Input placeholder="First input" />
          <Input placeholder="Second input" />
        </div>
      )
      
      const firstInput = screen.getByPlaceholderText('First input')
      const secondInput = screen.getByPlaceholderText('Second input')
      
      firstInput.focus()
      expect(firstInput).toHaveFocus()
      
      await user.tab()
      expect(secondInput).toHaveFocus()
    })
  })

  describe('Form Integration', () => {
    it('should work with form submission', () => {
      const handleSubmit = vi.fn((e) => {
        e.preventDefault()
        const formData = new FormData(e.target as HTMLFormElement)
        return formData.get('username')
      })
      
      render(
        <form onSubmit={handleSubmit}>
          <Input name="username" defaultValue="testuser" />
          <button type="submit">Submit</button>
        </form>
      )
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      expect(handleSubmit).toHaveBeenCalled()
    })

    it('should work with form validation', async () => {
      const user = userEvent.setup()
      render(
        <form>
          <Input required name="email" type="email" />
          <button type="submit">Submit</button>
        </form>
      )
      
      const input = screen.getByRole('textbox')
      const button = screen.getByRole('button')
      
      // Try to submit without filling required field
      fireEvent.click(button)
      
      // Input should be invalid
      expect(input).toBeInvalid()
      
      // Fill with valid email
      await user.type(input, 'test@example.com')
      expect(input).toBeValid()
    })

    it('should handle form reset', () => {
      render(
        <form>
          <Input defaultValue="initial" />
          <button type="reset">Reset</button>
        </form>
      )
      
      const input = screen.getByRole('textbox') as HTMLInputElement
      const resetButton = screen.getByRole('button')
      
      // Change the value
      fireEvent.change(input, { target: { value: 'changed' } })
      expect(input.value).toBe('changed')
      
      // Reset the form
      fireEvent.click(resetButton)
      expect(input.value).toBe('initial')
    })
  })

  describe('Custom Props', () => {
    it('should accept custom className', () => {
      render(<Input className="custom-input-class" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-input-class')
    })

    it('should accept custom data attributes', () => {
      render(<Input data-testid="custom-input" />)
      
      const input = screen.getByTestId('custom-input')
      expect(input).toBeInTheDocument()
    })

    it('should forward ref correctly', () => {
      const ref = vi.fn()
      render(<Input ref={ref} />)
      
      expect(ref).toHaveBeenCalled()
    })

    it('should accept custom id', () => {
      render(<Input id="custom-input-id" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('id', 'custom-input-id')
    })
  })

  describe('Styling', () => {
    it('should have consistent base styles', () => {
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass(
        'flex',
        'h-10',
        'w-full',
        'rounded-md',
        'border',
        'px-3',
        'py-2'
      )
    })

    it('should have proper focus styles', () => {
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('focus-visible:ring-2')
    })

    it('should have proper disabled styles', () => {
      render(<Input disabled />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50')
    })
  })
})