import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DocumentHeader } from '@/components/DocumentHeader'
import type { Document, Suggestion } from '@/types'

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

const createDocument = (overrides?: Partial<Document>): Document => ({
  id: 'doc-1',
  userId: 'user-1',
  filename: 'manuscript.docx',
  source: 'Local',
  paragraphs: [{ id: 'p-1', text: 'Hello world' }],
  title: 'My Manuscript',
  status: 'Draft',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  suggestions: [],
  ...overrides,
})

const createSuggestion = (overrides?: Partial<Suggestion>): Suggestion => ({
  id: 'sug-1',
  userId: 'user-1',
  documentId: 'doc-1',
  paragraphId: 'p-1',
  rationale: 'Improve wording',
  proposedChange: 'Hello everyone',
  status: 'Pending',
  ...overrides,
})

describe('DocumentHeader', () => {
  it('shows original and with-suggestions counts', () => {
    const document = createDocument()
    const suggestions = [createSuggestion({ status: 'Accepted' })]

    renderWithTooltip(<DocumentHeader document={document} suggestions={suggestions} />)

    expect(screen.getByText(/Original/)).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText(/With accepted/)).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
  })

  it('does not change with-suggestions count for pending suggestions', () => {
    const document = createDocument()
    const suggestions = [createSuggestion({ status: 'Pending' })]

    renderWithTooltip(<DocumentHeader document={document} suggestions={suggestions} />)

    expect(screen.getByText(/Original/)).toBeInTheDocument()
    expect(screen.getByText(/With accepted/)).toBeInTheDocument()
    expect(screen.getAllByText('11')).toHaveLength(2)
  })

  describe('action buttons', () => {
    it('shows Analyze button when onAnalyze is provided', () => {
      renderWithTooltip(
        <DocumentHeader
          document={createDocument()}
          suggestions={[]}
          onAnalyze={vi.fn()}
        />
      )

      expect(screen.getByRole('button', { name: /analyze manuscript/i })).toBeInTheDocument()
    })

    it('does not show Analyze button when onAnalyze is not provided', () => {
      renderWithTooltip(<DocumentHeader document={createDocument()} suggestions={[]} />)

      expect(screen.queryByRole('button', { name: /analyze manuscript/i })).not.toBeInTheDocument()
    })

    it('calls onAnalyze when Analyze button is clicked', async () => {
      const user = userEvent.setup()
      const onAnalyze = vi.fn()
      renderWithTooltip(
        <DocumentHeader
          document={createDocument()}
          suggestions={[]}
          onAnalyze={onAnalyze}
        />
      )

      await user.click(screen.getByRole('button', { name: /analyze manuscript/i }))

      expect(onAnalyze).toHaveBeenCalledOnce()
    })

    it('shows Delete button when onDelete is provided', () => {
      renderWithTooltip(
        <DocumentHeader
          document={createDocument()}
          suggestions={[]}
          onDelete={vi.fn()}
        />
      )

      expect(screen.getByRole('button', { name: /delete manuscript/i })).toBeInTheDocument()
    })

    it('does not show Delete button when onDelete is not provided', () => {
      renderWithTooltip(<DocumentHeader document={createDocument()} suggestions={[]} />)

      expect(screen.queryByRole('button', { name: /delete manuscript/i })).not.toBeInTheDocument()
    })

    it('calls onDelete when Delete button is clicked', async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()
      renderWithTooltip(
        <DocumentHeader
          document={createDocument()}
          suggestions={[]}
          onDelete={onDelete}
        />
      )

      await user.click(screen.getByRole('button', { name: /delete manuscript/i }))

      expect(onDelete).toHaveBeenCalledOnce()
    })
  })
})
