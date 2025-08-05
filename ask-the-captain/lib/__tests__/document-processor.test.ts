// Unit tests for document processing utilities
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs/promises'
import { DocumentProcessor, processMarkdownFile, processPDFFile } from '../document-processor'
import type { DocumentChunk } from '@/types'

// Mock fs and pdf-parse
vi.mock('fs/promises')
vi.mock('pdf-parse', () => ({
  default: vi.fn()
}))

const mockFs = vi.mocked(fs)

// Get the mocked pdf-parse function
const mockPdfParse = vi.mocked((await import('pdf-parse')).default)

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor

  beforeEach(() => {
    processor = new DocumentProcessor()
    vi.clearAllMocks()
  })

  describe('processMarkdown', () => {
    it('should process markdown content with headers', async () => {
      const mockContent = `# Main Title

This is the introduction paragraph with some content.

## Section 1

This is section 1 content with multiple sentences. It contains important information about the methodology.

### Subsection 1.1

More detailed content in the subsection. This should be chunked appropriately.

## Section 2

Another section with different content. This section discusses different aspects of the methodology.`

      mockFs.readFile.mockResolvedValue(mockContent)

      const chunks = await processor.processMarkdown('test.md')

      expect(chunks).toHaveLength(4) // Should create multiple chunks based on sections
      expect(chunks[0].source).toBe('test')
      expect(chunks[0].metadata.title).toBe('Main Title')
      expect(chunks[0].content).toContain('This is the introduction')
    })

    it('should handle empty or invalid markdown files', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'))

      await expect(processor.processMarkdown('nonexistent.md')).rejects.toThrow('Failed to process markdown file')
    })

    it('should create chunks with proper metadata', async () => {
      const mockContent = `# Test Title

Content for testing chunk creation with proper metadata and token counting.`

      mockFs.readFile.mockResolvedValue(mockContent)

      const chunks = await processor.processMarkdown('test.md')

      expect(chunks[0]).toMatchObject({
        id: expect.stringContaining('test_chunk_'),
        source: 'test',
        metadata: {
          title: 'Test Title',
          chunk_index: expect.any(Number),
          token_count: expect.any(Number)
        }
      })
    })
  })

  describe('processPDF', () => {
    it('should process PDF content and extract module information', async () => {
      const mockPdfContent = 'This is extracted PDF content about Modo Caverna methodology.'
      
      mockFs.readFile.mockResolvedValue(Buffer.from('mock pdf data'))
      mockPdfParse.mockResolvedValue({ text: mockPdfContent })

      const chunks = await processor.processPDF('Modo-Caverna---Módulo-1---Aula-01---O-mapa-da-Caverna.pdf')

      expect(chunks).toHaveLength(1)
      expect(chunks[0].source).toBe('Modo-Caverna---Módulo-1---Aula-01---O-mapa-da-Caverna')
      expect(chunks[0].metadata.module).toBe('Módulo 1')
      expect(chunks[0].metadata.lesson).toBe('Aula 01')
      expect(chunks[0].metadata.title).toContain('O mapa da Caverna')
    })

    it('should handle PDF processing errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('PDF read error'))

      await expect(processor.processPDF('test.pdf')).rejects.toThrow('Failed to process PDF file')
    })

    it('should clean PDF text content', async () => {
      const messyPdfContent = `This   is    messy    PDF   content
      
      
      with    excessive    whitespace    and    artifacts    ���    that    need    cleaning.`
      
      mockFs.readFile.mockResolvedValue(Buffer.from('mock pdf data'))
      mockPdfParse.mockResolvedValue({ text: messyPdfContent })

      const chunks = await processor.processPDF('test.pdf')

      expect(chunks[0].content).not.toMatch(/\s{3,}/) // Should not have excessive whitespace
      expect(chunks[0].content).not.toContain('���') // Should not have artifacts
    })
  })

  describe('processDirectory', () => {
    it('should process all markdown and PDF files in directory', async () => {
      mockFs.readdir.mockResolvedValue(['test1.md', 'test2.pdf', 'ignored.txt'])
      mockFs.stat.mockImplementation((filePath) => 
        Promise.resolve({ isFile: () => true } as any)
      )
      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().endsWith('.md')) {
          return Promise.resolve('# Test Markdown\n\nContent here.')
        }
        return Promise.resolve(Buffer.from('mock pdf data'))
      })
      mockPdfParse.mockResolvedValue({ text: 'PDF content here.' })

      const chunks = await processor.processDirectory('test-dir')

      expect(chunks.length).toBeGreaterThan(0)
      expect(mockFs.readFile).toHaveBeenCalledTimes(2) // Only .md and .pdf files
    })
  })

  describe('chunk validation', () => {
    it('should validate chunk quality', () => {
      const goodChunk: DocumentChunk = {
        id: 'test_1',
        content: 'This is a good chunk with sufficient content and meaningful information about the methodology.',
        source: 'test',
        metadata: { chunk_index: 0, token_count: 20 }
      }

      const badChunk: DocumentChunk = {
        id: 'test_2',
        content: 'Too short',
        source: 'test',
        metadata: { chunk_index: 1, token_count: 2 }
      }

      expect(processor.validateChunk(goodChunk)).toBe(true)
      expect(processor.validateChunk(badChunk)).toBe(false)
    })

    it('should reject low-quality content', () => {
      const repetitiveChunk: DocumentChunk = {
        id: 'test_3',
        content: 'test test test test test test test test test test',
        source: 'test',
        metadata: { chunk_index: 0, token_count: 10 }
      }

      expect(processor.validateChunk(repetitiveChunk)).toBe(false)
    })
  })

  describe('semantic chunking', () => {
    it('should create chunks with appropriate overlap', async () => {
      const longContent = `# Long Document

${'This is a paragraph with meaningful content. '.repeat(50)}

${'Another paragraph with different content. '.repeat(50)}

${'Final paragraph with conclusion content. '.repeat(50)}`

      mockFs.readFile.mockResolvedValue(longContent)

      const chunks = await processor.processMarkdown('long-test.md')

      expect(chunks.length).toBeGreaterThan(1)
      
      // Check for overlap between consecutive chunks
      if (chunks.length > 1) {
        const firstChunkEnd = chunks[0].content.slice(-100)
        const secondChunkStart = chunks[1].content.slice(0, 200)
        
        // Should have some overlapping content
        expect(secondChunkStart).toContain(firstChunkEnd.split('.')[0])
      }
    })

    it('should preserve semantic boundaries', async () => {
      const structuredContent = `# Main Title

## Important Section

This section contains critical information that should not be split inappropriately.

### Subsection

More details here that belong together.

## Another Section

Different topic that can be in a separate chunk.`

      mockFs.readFile.mockResolvedValue(structuredContent)

      const chunks = await processor.processMarkdown('structured-test.md')

      // Each chunk should start with proper section headers or content
      chunks.forEach(chunk => {
        // Should not start with orphaned subsection content
        expect(chunk.content.trim()).not.toMatch(/^[^#\n]*\n###/)
      })
    })

    it('should handle complex nested headers correctly', async () => {
      const complexContent = `# Main Document

## Section 1

Content for section 1 with multiple paragraphs.

This is another paragraph in section 1.

### Subsection 1.1

Detailed content for subsection 1.1.

#### Sub-subsection 1.1.1

Very detailed content here.

### Subsection 1.2

More content for subsection 1.2.

## Section 2

Content for section 2.`

      mockFs.readFile.mockResolvedValue(complexContent)

      const chunks = await processor.processMarkdown('complex-test.md')

      // Should create multiple chunks based on semantic structure
      expect(chunks.length).toBeGreaterThan(1)
      
      // Each chunk should have proper metadata
      chunks.forEach(chunk => {
        expect(chunk.metadata).toHaveProperty('chunk_index')
        expect(chunk.metadata).toHaveProperty('token_count')
        expect(typeof chunk.metadata.token_count).toBe('number')
      })
    })

    it('should handle Portuguese content correctly', async () => {
      const portugueseContent = `# Modo Caverna

## Introdução

O Modo Caverna é uma metodologia de transformação pessoal baseada em disciplina e foco.

## Os Três Pilares

### Propósito

Definir claramente seus objetivos e motivações.

### Foco

Eliminar distrações e manter concentração.

### Progresso

Medir e acompanhar seu desenvolvimento.`

      mockFs.readFile.mockResolvedValue(portugueseContent)

      const chunks = await processor.processMarkdown('modo-caverna.md')

      expect(chunks.length).toBeGreaterThan(0)
      
      // Should preserve Portuguese characters and accents
      const combinedContent = chunks.map(c => c.content).join(' ')
      expect(combinedContent).toContain('metodologia')
      expect(combinedContent).toContain('Propósito')
      expect(combinedContent).toContain('concentração')
    })
  })

  describe('token estimation', () => {
    it('should estimate token count reasonably', () => {
      const processor = new DocumentProcessor()
      const testText = 'This is a test sentence with approximately twenty tokens in total.'
      
      // @ts-ignore - accessing private method for testing
      const tokenCount = processor.estimateTokenCount(testText)
      
      expect(tokenCount).toBeGreaterThan(10)
      expect(tokenCount).toBeLessThan(30)
    })
  })
})

describe('Utility functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should export processMarkdownFile utility', async () => {
    mockFs.readFile.mockResolvedValue('# Test\n\nContent here.')

    const chunks = await processMarkdownFile('test.md')

    expect(chunks).toHaveLength(1)
    expect(chunks[0].source).toBe('test')
  })

  it('should export processPDFFile utility', async () => {
    mockFs.readFile.mockResolvedValue(Buffer.from('mock pdf'))
    mockPdfParse.mockResolvedValue({ text: 'PDF content' })

    const chunks = await processPDFFile('test.pdf')

    expect(chunks).toHaveLength(1)
    expect(chunks[0].source).toBe('test')
  })
})