import { useEffect, useState, useMemo } from 'react'
import { marked } from 'marked'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

/**
 * Markdown Preview Component with KaTeX support
 * Supports:
 * - Standard Markdown
 * - Inline math: $...$
 * - Display math: $$...$$
 * - Code blocks with syntax highlighting
 */
export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  const [html, setHtml] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      setError(null)

      // Configure marked
      marked.setOptions({
        breaks: true,
        gfm: true,
      })

      // Process math formulas before markdown parsing
      let processedContent = content

      // Process display math ($$...$$)
      processedContent = processedContent.replace(
        /\$\$([^$]+?)\$\$/g,
        (_, math) => {
          try {
            return katex.renderToString(math.trim(), {
              displayMode: true,
              throwOnError: false,
              output: 'html',
            })
          } catch (e) {
            return `<div class="math-error">Math Error: ${e instanceof Error ? e.message : 'Unknown error'}</div>`
          }
        }
      )

      // Process inline math ($...$)
      processedContent = processedContent.replace(
        /\$([^$\n]+?)\$/g,
        (_, math) => {
          try {
            return katex.renderToString(math.trim(), {
              displayMode: false,
              throwOnError: false,
              output: 'html',
            })
          } catch (e) {
            return `<span class="math-error">Math Error: ${e instanceof Error ? e.message : 'Unknown error'}</span>`
          }
        }
      )

      // Parse markdown
      const rendered = marked.parse(processedContent, { async: false }) as string
      setHtml(rendered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to render markdown')
      console.error('Markdown preview error:', e)
    }
  }, [content])

  if (error) {
    return (
      <div className={`p-4 border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800 rounded ${className}`}>
        <p className="text-red-700 dark:text-red-300 text-sm">
          <strong>Preview Error:</strong> {error}
        </p>
      </div>
    )
  }

  return (
    <div
      className={`prose prose-sm max-w-none dark:prose-invert ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        // Custom prose styles for better academic paper rendering
        '--tw-prose-body': 'rgb(23 23 23)',
        '--tw-prose-headings': 'rgb(17 24 39)',
        '--tw-prose-links': 'rgb(37 99 235)',
        '--tw-prose-bold': 'rgb(17 24 39)',
        '--tw-prose-code': 'rgb(88 28 135)',
        '--tw-prose-pre-bg': 'rgb(249 250 251)',
        '--tw-prose-th-borders': 'rgb(209 213 219)',
      } as React.CSSProperties}
    />
  )
}

/**
 * Markdown Editor with live preview toggle
 */
interface MarkdownEditorProps {
  content: string
  filename: string
  onContentChange?: (content: string) => void
  readOnly?: boolean
}

export function MarkdownEditor({
  content,
  filename,
  onContentChange,
  readOnly = false
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('preview')

  const isMarkdown = useMemo(() => {
    const ext = filename.toLowerCase().split('.').pop()
    return ext === 'md' || ext === 'markdown'
  }, [filename])

  if (!isMarkdown) {
    return null
  }

  return (
    <div className="markdown-editor">
      {/* Mode toggle */}
      <div className="flex gap-2 mb-3 border-b pb-2">
        <button
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            mode === 'edit'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
          onClick={() => setMode('edit')}
          disabled={readOnly}
        >
          📝 编辑
        </button>
        <button
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            mode === 'preview'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
          onClick={() => setMode('preview')}
        >
          👁️ 预览
        </button>
        <button
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            mode === 'split'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
          onClick={() => setMode('split')}
          disabled={readOnly}
        >
          ⚡ 分屏
        </button>
      </div>

      {/* Content area */}
      <div className={`grid ${mode === 'split' ? 'grid-cols-2 gap-4' : 'grid-cols-1'}`}>
        {(mode === 'edit' || mode === 'split') && (
          <div className="editor-pane">
            <textarea
              className="w-full h-[600px] p-4 border rounded font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              value={content}
              onChange={(e) => onContentChange?.(e.target.value)}
              readOnly={readOnly}
              placeholder="# 开始编写 Markdown..."
            />
          </div>
        )}

        {(mode === 'preview' || mode === 'split') && (
          <div className="preview-pane border rounded p-4 bg-white dark:bg-gray-900 overflow-auto max-h-[600px]">
            <MarkdownPreview content={content} />
          </div>
        )}
      </div>

      {/* Help text */}
      <div className="mt-2 text-xs text-muted-foreground">
        <p>支持 Markdown 和 LaTeX 数学公式：</p>
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          <li>行内公式：<code>$E = mc^2$</code></li>
          <li>块级公式：<code>$$\int_0^\infty e^{'{-x}'} dx$$</code></li>
        </ul>
      </div>
    </div>
  )
}
