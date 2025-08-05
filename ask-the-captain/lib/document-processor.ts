// Document processing utilities for knowledge base ingestion
import fs from 'fs/promises'
import path from 'path'
import pdfParse from 'pdf-parse'
import type { DocumentChunk } from '@/types'

export interface ProcessingOptions {
  chunkSize?: number
  chunkOverlap?: number
  preserveStructure?: boolean
}

export class DocumentProcessor {
  private readonly defaultOptions: Required<ProcessingOptions> = {
    chunkSize: 800, // tokens (roughly 600-1000 characters)
    chunkOverlap: 100, // tokens overlap between chunks
    preserveStructure: true
  }

  private options: Required<ProcessingOptions>

  constructor(options: ProcessingOptions = {}) {
    this.options = { ...this.defaultOptions, ...options }
  }

  /**
   * Process markdown file and return document chunks
   */
  async processMarkdown(filePath: string): Promise<DocumentChunk[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const fileName = path.basename(filePath, '.md')
      
      return this.chunkMarkdownContent(content, fileName)
    } catch (error) {
      throw new Error(`Failed to process markdown file ${filePath}: ${error}`)
    }
  }

  /**
   * Process PDF file and return document chunks
   */
  async processPDF(filePath: string): Promise<DocumentChunk[]> {
    try {
      const buffer = await fs.readFile(filePath)
      const pdfData = await pdfParse(buffer)
      const fileName = path.basename(filePath, '.pdf')
      
      return this.chunkPDFContent(pdfData.text, fileName, filePath)
    } catch (error) {
      throw new Error(`Failed to process PDF file ${filePath}: ${error}`)
    }
  }

  /**
   * Process all documents in a directory
   */
  async processDirectory(dirPath: string): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = []
    
    try {
      const files = await fs.readdir(dirPath)
      
      for (const file of files) {
        const filePath = path.join(dirPath, file)
        const stat = await fs.stat(filePath)
        
        if (stat.isFile()) {
          const ext = path.extname(file).toLowerCase()
          
          if (ext === '.md') {
            const markdownChunks = await this.processMarkdown(filePath)
            chunks.push(...markdownChunks)
          } else if (ext === '.pdf') {
            const pdfChunks = await this.processPDF(filePath)
            chunks.push(...pdfChunks)
          }
        }
      }
      
      return chunks
    } catch (error) {
      throw new Error(`Failed to process directory ${dirPath}: ${error}`)
    }
  }

  /**
   * Chunk markdown content with semantic boundaries
   */
  private chunkMarkdownContent(content: string, source: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    
    // Split by major sections (headers)
    const sections = this.splitByHeaders(content)
    
    for (const section of sections) {
      const sectionChunks = this.createSemanticChunks(
        section.content,
        source,
        section.title,
        section.level
      )
      chunks.push(...sectionChunks)
    }
    
    return chunks
  }

  /**
   * Chunk PDF content with semantic boundaries
   */
  private chunkPDFContent(content: string, source: string, filePath: string): DocumentChunk[] {
    // Extract module and lesson info from filename
    const moduleInfo = this.extractModuleInfo(filePath)
    
    // Clean and normalize PDF text
    const cleanContent = this.cleanPDFText(content)
    
    // Create chunks with PDF-specific metadata
    return this.createSemanticChunks(
      cleanContent,
      source,
      moduleInfo.title,
      1,
      {
        module: moduleInfo.module,
        lesson: moduleInfo.lesson,
        type: 'pdf'
      }
    )
  }

  /**
   * Split markdown content by headers
   */
  private splitByHeaders(content: string): Array<{ title: string; content: string; level: number }> {
    const sections: Array<{ title: string; content: string; level: number }> = []
    const lines = content.split('\n')
    
    let currentSection = { title: '', content: '', level: 0 }
    
    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
      
      if (headerMatch) {
        // Save previous section if it has content
        if (currentSection.content.trim()) {
          sections.push({ ...currentSection })
        }
        
        // Start new section
        currentSection = {
          title: headerMatch[2],
          content: line + '\n',
          level: headerMatch[1].length
        }
      } else {
        currentSection.content += line + '\n'
      }
    }
    
    // Add the last section
    if (currentSection.content.trim()) {
      sections.push(currentSection)
    }
    
    return sections
  }

  /**
   * Create semantic chunks from content
   */
  private createSemanticChunks(
    content: string,
    source: string,
    title?: string,
    level: number = 1,
    additionalMetadata: Record<string, any> = {}
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    const paragraphs = this.splitIntoParagraphs(content)
    
    let currentChunk = ''
    let chunkIndex = 0
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i]
      const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph
      
      // Check if adding this paragraph would exceed chunk size
      if (this.estimateTokenCount(potentialChunk) > this.options.chunkSize && currentChunk.length > 0) {
        // Create chunk with current content
        chunks.push(this.createChunk(
          currentChunk,
          source,
          chunkIndex++,
          title,
          additionalMetadata
        ))
        
        // Start new chunk with overlap
        const overlapContent = this.getOverlapContent(currentChunk)
        currentChunk = overlapContent + (overlapContent ? '\n\n' : '') + paragraph
      } else {
        currentChunk = potentialChunk
      }
    }
    
    // Add the final chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(
        currentChunk,
        source,
        chunkIndex,
        title,
        additionalMetadata
      ))
    }
    
    return chunks
  }

  /**
   * Split content into paragraphs while preserving structure
   */
  private splitIntoParagraphs(content: string): string[] {
    return content
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
  }

  /**
   * Create a document chunk with metadata
   */
  private createChunk(
    content: string,
    source: string,
    chunkIndex: number,
    title?: string,
    additionalMetadata: Record<string, any> = {}
  ): DocumentChunk {
    return {
      id: `${source}_chunk_${chunkIndex}`,
      content: content.trim(),
      source,
      metadata: {
        title,
        section: `chunk_${chunkIndex}`,
        ...additionalMetadata
      }
    }
  }

  /**
   * Get overlap content from the end of current chunk
   */
  private getOverlapContent(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim())
    const overlapTokens = this.options.chunkOverlap
    
    let overlapContent = ''
    let tokenCount = 0
    
    // Take sentences from the end until we reach overlap size
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i].trim()
      const sentenceTokens = this.estimateTokenCount(sentence)
      
      if (tokenCount + sentenceTokens <= overlapTokens) {
        overlapContent = sentence + '. ' + overlapContent
        tokenCount += sentenceTokens
      } else {
        break
      }
    }
    
    return overlapContent.trim()
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for Portuguese/English
    return Math.ceil(text.length / 4)
  }

  /**
   * Extract module information from PDF filename
   */
  private extractModuleInfo(filePath: string): { module: string; lesson: string; title: string } {
    const fileName = path.basename(filePath, '.pdf')
    
    // Parse filename patterns like "Modo-Caverna---Módulo-1---Aula-01---O-mapa-da-Caverna"
    const moduleMatch = fileName.match(/Módulo-(\d+|Bônus)/)
    const lessonMatch = fileName.match(/Aula-(\d+)/)
    const titleMatch = fileName.match(/Aula-\d+---(.+)$/) || fileName.match(/Módulo-\d+---(.+)$/)
    
    return {
      module: moduleMatch ? `Módulo ${moduleMatch[1]}` : 'Unknown Module',
      lesson: lessonMatch ? `Aula ${lessonMatch[1]}` : 'Unknown Lesson',
      title: titleMatch ? titleMatch[1].replace(/-/g, ' ') : fileName
    }
  }

  /**
   * Clean PDF text content
   */
  private cleanPDFText(text: string): string {
    return text
      // Remove excessive whitespace (3+ spaces become single space)
      .replace(/\s{3,}/g, ' ')
      // Remove excessive line breaks
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Remove page numbers and headers/footers (common patterns)
      .replace(/^\d+\s*$/gm, '')
      // Remove common PDF artifacts and non-printable characters
      .replace(/[^\w\s\-.,!?;:()\[\]"'áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]/g, ' ')
      // Normalize remaining whitespace
      .replace(/\s+/g, ' ')
      // Normalize line breaks
      .replace(/\n\s*\n/g, '\n\n')
      .trim()
  }

  /**
   * Validate chunk quality
   */
  validateChunk(chunk: DocumentChunk): boolean {
    const minLength = 50 // Minimum characters
    const maxLength = this.options.chunkSize * 6 // Maximum characters (rough token conversion)
    
    return (
      chunk.content.length >= minLength &&
      chunk.content.length <= maxLength &&
      chunk.content.trim().length > 0 &&
      !this.isLowQualityContent(chunk.content)
    )
  }

  /**
   * Check if content is low quality (headers only, repetitive, etc.)
   */
  private isLowQualityContent(content: string): boolean {
    const words = content.split(/\s+/)
    
    // Too short
    if (words.length < 10) return true
    
    // Only headers/titles (mostly capitalized)
    const capitalizedWords = words.filter(word => /^[A-Z]/.test(word))
    if (capitalizedWords.length / words.length > 0.8) return true
    
    // Repetitive content
    const uniqueWords = new Set(words.map(w => w.toLowerCase()))
    if (uniqueWords.size / words.length < 0.3) return true
    
    return false
  }
}

// Export utility functions for direct use
export async function processMarkdownFile(filePath: string, options?: ProcessingOptions): Promise<DocumentChunk[]> {
  const processor = new DocumentProcessor(options)
  return processor.processMarkdown(filePath)
}

export async function processPDFFile(filePath: string, options?: ProcessingOptions): Promise<DocumentChunk[]> {
  const processor = new DocumentProcessor(options)
  return processor.processPDF(filePath)
}

export async function processAllDocuments(
  markdownPath: string,
  pdfDirectory: string,
  options?: ProcessingOptions
): Promise<DocumentChunk[]> {
  const processor = new DocumentProcessor(options)
  const chunks: DocumentChunk[] = []
  
  // Process markdown file
  if (markdownPath) {
    const markdownChunks = await processor.processMarkdown(markdownPath)
    chunks.push(...markdownChunks)
  }
  
  // Process PDF directory
  if (pdfDirectory) {
    const pdfChunks = await processor.processDirectory(pdfDirectory)
    chunks.push(...pdfChunks)
  }
  
  // Filter out low-quality chunks
  return chunks.filter(chunk => processor.validateChunk(chunk))
}