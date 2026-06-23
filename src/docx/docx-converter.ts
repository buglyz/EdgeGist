import mammoth from 'mammoth'

export class DocxConverter {
  async convertToHtml(docxBuffer: ArrayBuffer): Promise<string> {
    try {
      const result = await mammoth.convertToHtml({ arrayBuffer: docxBuffer })
      const html = this.sanitizeHtml(result.value)

      if (result.messages.length > 0) {
        console.warn('DOCX conversion warnings:', result.messages)
      }

      return this.wrapInContainer(html)
    } catch (error) {
      console.error('DOCX conversion error:', error)
      return this.generateErrorHtml(error)
    }
  }

  private sanitizeHtml(html: string): string {
    return html
      // Remove script tags (all variants)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove event handlers (with and without quotes)
      .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:text\/html/gi, '')
      // Remove dangerous tags
      .replace(/<iframe\b[^>]*>/gi, '')
      .replace(/<embed\b[^>]*>/gi, '')
      .replace(/<object\b[^>]*>/gi, '')
      .replace(/<applet\b[^>]*>/gi, '')
      .replace(/<base\b[^>]*>/gi, '')
      .replace(/<link\b[^>]*>/gi, '')
      .replace(/<meta\b[^>]*>/gi, '')
      // Remove SVG script tags
      .replace(/<svg[^>]*>[\s\S]*?<script[\s\S]*?<\/script>[\s\S]*?<\/svg>/gi, '')
      // Remove form elements
      .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, '')
  }

  private wrapInContainer(html: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1e2227;
      background: #f7f5f1;
      margin: 0;
      padding: 2rem;
    }
    .docx-preview-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 3rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .docx-preview-container img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 1rem 0;
    }
    .docx-preview-container p {
      margin: 0.5rem 0;
    }
    .docx-preview-container h1,
    .docx-preview-container h2,
    .docx-preview-container h3,
    .docx-preview-container h4,
    .docx-preview-container h5,
    .docx-preview-container h6 {
      margin: 1.5rem 0 0.5rem;
      font-weight: 600;
    }
    .docx-preview-container table {
      border-collapse: collapse;
      width: 100%;
      margin: 1rem 0;
    }
    .docx-preview-container table td,
    .docx-preview-container table th {
      border: 1px solid #e7e3da;
      padding: 0.5rem;
    }
    .docx-preview-container ul,
    .docx-preview-container ol {
      margin: 0.5rem 0;
      padding-left: 2rem;
    }
  </style>
</head>
<body>
  <div class="docx-preview-container">
    ${html}
  </div>
</body>
</html>
    `.trim()
  }

  private generateErrorHtml(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f7f5f1;
      margin: 0;
      padding: 2rem;
    }
    .docx-error {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      padding: 2rem;
      border-radius: 8px;
      border-left: 4px solid #dc2626;
    }
    .docx-error h2 {
      color: #dc2626;
      margin-top: 0;
    }
    .docx-error p {
      color: #6b7077;
      line-height: 1.6;
    }
    .docx-error code {
      background: #f7f5f1;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="docx-error">
    <h2>无法预览文档</h2>
    <p>抱歉，无法转换此 DOCX 文件为预览格式。</p>
    <p><strong>错误信息：</strong> <code>${this.escapeHtml(errorMessage)}</code></p>
    <p>请下载原始文件查看完整内容。</p>
  </div>
</body>
</html>
    `.trim()
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return text.replace(/[&<>"']/g, (char) => map[char])
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
}
