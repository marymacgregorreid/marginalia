import { describe, expect, it } from 'vitest'
import {
  applyAcceptedSuggestions,
  getAcceptedSuggestionsCharacterCount,
  mergeAcceptedSuggestionsToParagraphs,
} from '@/lib/suggestionUtils'
import type { Paragraph, Suggestion } from '@/types'

const createSuggestion = (overrides?: Partial<Suggestion>): Suggestion => ({
  id: 'sug-1',
  userId: 'user-1',
  documentId: 'doc-1',
  paragraphId: 'p-1',
  rationale: 'rationale',
  proposedChange: '',
  status: 'Pending',
  ...overrides,
})

const makeParagraphs = (...texts: string[]): Paragraph[] =>
  texts.map((text, i) => ({ id: `p-${i + 1}`, text }))

describe('suggestionUtils', () => {
  it('returns original content when no suggestions are accepted', () => {
    const paragraphs = makeParagraphs('The quick brown fox')
    const suggestions = [
      createSuggestion({
        id: 'sug-pending',
        paragraphId: 'p-1',
        proposedChange: 'slow',
        status: 'Pending',
      }),
    ]

    expect(applyAcceptedSuggestions(paragraphs, suggestions)).toBe('The quick brown fox')
    expect(getAcceptedSuggestionsCharacterCount(paragraphs, suggestions)).toBe('The quick brown fox'.length)
  })

  it('applies a single accepted suggestion', () => {
    const paragraphs = makeParagraphs('Hello world')
    const suggestions = [
      createSuggestion({
        id: 'sug-accepted',
        paragraphId: 'p-1',
        proposedChange: 'Hello everyone',
        status: 'Accepted',
      }),
    ]

    expect(applyAcceptedSuggestions(paragraphs, suggestions)).toBe('Hello everyone')
    expect(getAcceptedSuggestionsCharacterCount(paragraphs, suggestions)).toBe(14)
  })

  it('applies multiple accepted suggestions without index shift issues', () => {
    const paragraphs = makeParagraphs('abc', 'def', 'ghi')
    const suggestions = [
      createSuggestion({
        id: 'sug-left',
        paragraphId: 'p-1',
        proposedChange: 'ABCD',
        status: 'Accepted',
      }),
      createSuggestion({
        id: 'sug-right',
        paragraphId: 'p-3',
        proposedChange: 'G',
        status: 'Accepted',
      }),
    ]

    expect(applyAcceptedSuggestions(paragraphs, suggestions)).toBe('ABCD\n\ndef\n\nG')
  })

  it('returns empty string for empty paragraphs array', () => {
    const paragraphs: Paragraph[] = []
    const suggestions = [
      createSuggestion({
        id: 'sug-orphan',
        paragraphId: 'p-99',
        proposedChange: 'replacement',
        status: 'Accepted',
      }),
    ]

    expect(applyAcceptedSuggestions(paragraphs, suggestions)).toBe('')
    expect(getAcceptedSuggestionsCharacterCount(paragraphs, suggestions)).toBe(0)
  })
})

describe('mergeAcceptedSuggestionsToParagraphs', () => {
  it('returns original paragraphs when no suggestions are accepted', () => {
    const paragraphs = makeParagraphs('First', 'Second')
    const suggestions = [
      createSuggestion({ paragraphId: 'p-1', proposedChange: 'Changed', status: 'Pending' }),
    ]

    const result = mergeAcceptedSuggestionsToParagraphs(paragraphs, suggestions)
    expect(result).toEqual(paragraphs)
  })

  it('merges only accepted suggestions into paragraph text', () => {
    const paragraphs = makeParagraphs('Original A', 'Original B', 'Original C')
    const suggestions = [
      createSuggestion({ id: 's1', paragraphId: 'p-1', proposedChange: 'Accepted A', status: 'Accepted' }),
      createSuggestion({ id: 's2', paragraphId: 'p-2', proposedChange: 'Pending B', status: 'Pending' }),
      createSuggestion({ id: 's3', paragraphId: 'p-3', proposedChange: 'Rejected C', status: 'Rejected' }),
    ]

    const result = mergeAcceptedSuggestionsToParagraphs(paragraphs, suggestions)
    expect(result[0].text).toBe('Accepted A')
    expect(result[1].text).toBe('Original B')
    expect(result[2].text).toBe('Original C')
  })

  it('uses userSteeringInput for Modified suggestions', () => {
    const paragraphs = makeParagraphs('Original')
    const suggestions = [
      createSuggestion({
        paragraphId: 'p-1',
        proposedChange: 'AI proposed',
        status: 'Modified',
        userSteeringInput: 'User version',
      }),
    ]

    const result = mergeAcceptedSuggestionsToParagraphs(paragraphs, suggestions)
    expect(result[0].text).toBe('User version')
  })

  it('falls back to proposedChange for Modified without userSteeringInput', () => {
    const paragraphs = makeParagraphs('Original')
    const suggestions = [
      createSuggestion({
        paragraphId: 'p-1',
        proposedChange: 'AI proposed',
        status: 'Modified',
      }),
    ]

    const result = mergeAcceptedSuggestionsToParagraphs(paragraphs, suggestions)
    expect(result[0].text).toBe('AI proposed')
  })

  it('preserves paragraph IDs after merge', () => {
    const paragraphs = makeParagraphs('A', 'B')
    const suggestions = [
      createSuggestion({ paragraphId: 'p-2', proposedChange: 'New B', status: 'Accepted' }),
    ]

    const result = mergeAcceptedSuggestionsToParagraphs(paragraphs, suggestions)
    expect(result[0].id).toBe('p-1')
    expect(result[1].id).toBe('p-2')
    expect(result[1].text).toBe('New B')
  })
})
