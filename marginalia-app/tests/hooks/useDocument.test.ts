import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDocument } from '@/hooks/useDocument'
import { setApiBaseUrl } from '@/services/api'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
  setApiBaseUrl('http://localhost:5279')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useDocument', () => {
  describe('deleteDocument', () => {
    it('clears document state after successful deletion', async () => {
      // First, load a document
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'doc-1',
            userId: 'user-1',
            filename: 'test.docx',
            source: 'Local',
            content: 'Test content',
            title: 'Test Document',
            status: 'Draft',
            suggestions: [],
            createdAt: '2026-03-29T10:00:00Z',
            updatedAt: '2026-03-29T10:00:00Z',
          }),
      })

      const { result } = renderHook(() => useDocument())

      await act(async () => {
        await result.current.loadDocument('doc-1')
      })

      expect(result.current.document).not.toBeNull()

      // Now delete the document
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.reject(new Error('no body')),
      })

      await act(async () => {
        await result.current.deleteDocument()
      })

      expect(result.current.document).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('throws error when no document is loaded', async () => {
      const { result } = renderHook(() => useDocument())

      await expect(
        act(async () => {
          await result.current.deleteDocument()
        })
      ).rejects.toThrow('No document loaded')
    })

    it('preserves document and rejects on deletion failure', async () => {
      // First, load a document
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'doc-1',
            userId: 'user-1',
            filename: 'test.docx',
            source: 'Local',
            content: 'Test content',
            title: 'Test Document',
            status: 'Draft',
            suggestions: [],
            createdAt: '2026-03-29T10:00:00Z',
            updatedAt: '2026-03-29T10:00:00Z',
          }),
      })

      const { result } = renderHook(() => useDocument())

      await act(async () => {
        await result.current.loadDocument('doc-1')
      })

      // Simulate deletion failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('no body')),
      })

      let didThrow = false
      try {
        await act(async () => {
          await result.current.deleteDocument()
        })
      } catch {
        didThrow = true
      }

      expect(didThrow).toBe(true)
      expect(result.current.document).not.toBeNull()
      expect(result.current.document?.id).toBe('doc-1')
    })
  })
})
