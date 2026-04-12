import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog'

describe('DeleteConfirmationDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    isDeleting: false,
    documentTitle: 'Chapter One',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders dialog title when open', () => {
      render(<DeleteConfirmationDialog {...defaultProps} />)

      expect(screen.getByText('Delete Manuscript')).toBeInTheDocument()
    })

    it('renders document title in description', () => {
      render(<DeleteConfirmationDialog {...defaultProps} />)

      expect(screen.getByText(/Chapter One/)).toBeInTheDocument()
    })

    it('renders cancel and delete buttons', () => {
      render(<DeleteConfirmationDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      render(<DeleteConfirmationDialog {...defaultProps} open={false} />)

      expect(screen.queryByText('Delete Manuscript')).not.toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onConfirm when delete button is clicked', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      render(<DeleteConfirmationDialog {...defaultProps} onConfirm={onConfirm} />)

      await user.click(screen.getByRole('button', { name: /^delete$/i }))

      expect(onConfirm).toHaveBeenCalledOnce()
    })

    it('calls onOpenChange with false when cancel is clicked', async () => {
      const user = userEvent.setup()
      const onOpenChange = vi.fn()
      render(<DeleteConfirmationDialog {...defaultProps} onOpenChange={onOpenChange} />)

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('disables buttons while deleting', () => {
      render(<DeleteConfirmationDialog {...defaultProps} isDeleting={true} />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled()
    })

    it('shows deleting text while in progress', () => {
      render(<DeleteConfirmationDialog {...defaultProps} isDeleting={true} />)

      expect(screen.getByText('Deleting…')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<DeleteConfirmationDialog {...defaultProps} />)

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
