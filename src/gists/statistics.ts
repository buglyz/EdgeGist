/**
 * Statistics utilities for academic writing and code management
 * Provides word count, line count, and file type analysis
 */

export interface FileStatistics {
  wordCount: number
  lineCount: number
  characterCount: number
  characterCountNoSpaces: number
}

export interface GistStatistics {
  totalWordCount: number
  totalLineCount: number
  totalSize: number
  fileCount: number
  primaryLanguage: string | null
  filesByType: Record<string, number>
}

/**
 * Count words in text (supports English and Chinese)
 * English: split by spaces
 * Chinese: count characters (excluding punctuation)
 */
export function countWords(text: string): number {
  if (!text) return 0

  // Remove code blocks first
  const withoutCodeBlocks = text.replace(/```[\s\S]*?```/g, '')

  // Count Chinese characters (CJK Unified Ideographs)
  const chineseChars = (withoutCodeBlocks.match(/[一-龥]/g) || []).length

  // Count English words (split by spaces, filter empty)
  const englishWords = withoutCodeBlocks
    .replace(/[一-龥]/g, '') // Remove Chinese
    .split(/\s+/)
    .filter(word => word.trim().length > 0 && /\w/.test(word))
    .length

  return chineseChars + englishWords
}

/**
 * Count lines in text
 */
export function countLines(text: string): number {
  if (!text) return 0
  return text.split('\n').length
}

/**
 * Calculate statistics for a single file
 */
export function calculateFileStatistics(content: string): FileStatistics {
  const lines = content.split('\n')
  const characterCount = content.length
  const characterCountNoSpaces = content.replace(/\s/g, '').length

  return {
    wordCount: countWords(content),
    lineCount: lines.length,
    characterCount,
    characterCountNoSpaces,
  }
}

/**
 * Detect primary language from file extensions
 */
export function detectPrimaryLanguage(files: Array<{ filename: string }>): string | null {
  const languageCounts: Record<string, number> = {}

  for (const file of files) {
    const ext = file.filename.split('.').pop()?.toLowerCase()
    if (!ext) continue

    const language = extensionToLanguage(ext)
    if (language) {
      languageCounts[language] = (languageCounts[language] || 0) + 1
    }
  }

  // Find most common language
  let maxCount = 0
  let primaryLanguage: string | null = null

  for (const [lang, count] of Object.entries(languageCounts)) {
    if (count > maxCount) {
      maxCount = count
      primaryLanguage = lang
    }
  }

  return primaryLanguage
}

/**
 * Map file extension to language/category
 */
function extensionToLanguage(ext: string): string | null {
  const languageMap: Record<string, string> = {
    // Documents
    'md': 'Markdown',
    'tex': 'LaTeX',
    'txt': 'Text',
    'bib': 'BibTeX',
    'rst': 'reStructuredText',

    // Programming languages
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'jsx': 'React',
    'tsx': 'React',
    'py': 'Python',
    'java': 'Java',
    'cpp': 'C++',
    'c': 'C',
    'go': 'Go',
    'rs': 'Rust',
    'rb': 'Ruby',
    'php': 'PHP',
    'swift': 'Swift',
    'kt': 'Kotlin',
    'scala': 'Scala',
    'r': 'R',
    'jl': 'Julia',

    // Web
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'sass': 'Sass',
    'vue': 'Vue',

    // Data
    'json': 'JSON',
    'yaml': 'YAML',
    'yml': 'YAML',
    'xml': 'XML',
    'csv': 'CSV',
    'sql': 'SQL',

    // Config
    'toml': 'TOML',
    'ini': 'INI',
    'conf': 'Config',

    // Shell
    'sh': 'Shell',
    'bash': 'Bash',
    'zsh': 'Zsh',
    'fish': 'Fish',
  }

  return languageMap[ext] || null
}

/**
 * Calculate statistics for entire gist
 */
export function calculateGistStatistics(
  files: Array<{ filename: string; content: string; size: number }>
): GistStatistics {
  let totalWordCount = 0
  let totalLineCount = 0
  let totalSize = 0
  const filesByType: Record<string, number> = {}

  for (const file of files) {
    const stats = calculateFileStatistics(file.content)
    totalWordCount += stats.wordCount
    totalLineCount += stats.lineCount
    totalSize += file.size

    const ext = file.filename.split('.').pop()?.toLowerCase()
    if (ext) {
      filesByType[ext] = (filesByType[ext] || 0) + 1
    }
  }

  return {
    totalWordCount,
    totalLineCount,
    totalSize,
    fileCount: files.length,
    primaryLanguage: detectPrimaryLanguage(files),
    filesByType,
  }
}

/**
 * Infer category from file types
 */
export function inferCategory(files: Array<{ filename: string }>): string {
  const extensions = files.map(f => f.filename.split('.').pop()?.toLowerCase()).filter(Boolean)

  // Academic papers
  if (extensions.some(ext => ['tex', 'bib'].includes(ext!))) {
    return 'paper'
  }

  // Markdown documents
  if (extensions.some(ext => ['md', 'markdown'].includes(ext!))) {
    return 'document'
  }

  // Code
  const codeExtensions = ['js', 'ts', 'py', 'java', 'cpp', 'go', 'rs', 'rb', 'php']
  if (extensions.some(ext => codeExtensions.includes(ext!))) {
    return 'code'
  }

  // Data/Config
  if (extensions.some(ext => ['json', 'yaml', 'yml', 'csv', 'sql'].includes(ext!))) {
    return 'data'
  }

  return 'other'
}
