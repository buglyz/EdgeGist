import mammoth from 'mammoth'

export class DocxConverter {
  async convertToHtml(docxBuffer: ArrayBuffer): Promise<string> {
    try {
      // Validate buffer
      if (!docxBuffer || docxBuffer.byteLength === 0) {
        throw new Error('文件为空或无效')
      }

      // Check if it's a valid ZIP file (DOCX is a ZIP archive)
      const view = new Uint8Array(docxBuffer)
      const isValidZip = view[0] === 0x50 && view[1] === 0x4B // PK header

      if (!isValidZip) {
        throw new Error('文件格式错误：不是有效的 DOCX 文件（缺少 ZIP 头）')
      }

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

    // Provide helpful error messages
    let helpText = '请确保文件是有效的 .docx 格式（Microsoft Word 2007 或更高版本）。'

    if (errorMessage.includes('Corrupted zip') || errorMessage.includes('ZIP')) {
      helpText = `
        <strong>可能的原因：</strong>
        <ul>
          <li>文件已损坏或不完整</li>
          <li>这不是一个真正的 DOCX 文件（可能只是重命名了扩展名）</li>
          <li>文件使用了不兼容的格式（如 .doc 老格式）</li>
          <li>上传过程中文件被截断</li>
        </ul>
        <strong>解决方法：</strong>
        <ul>
          <li>使用 Microsoft Word 打开文件，另存为 .docx 格式</li>
          <li>检查文件大小是否正常</li>
          <li>尝试重新上传文件</li>
          <li>如果是 .doc 格式，请转换为 .docx</li>
        </ul>
      `
    } else if (errorMessage.includes('empty') || errorMessage.includes('空')) {
      helpText = '文件内容为空，请检查上传的文件。'
    }

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
      max-width: 700px;
      margin: 0 auto;
      background: white;
      padding: 2rem;
      border-radius: 8px;
      border-left: 4px solid #dc2626;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .docx-error h2 {
      color: #dc2626;
      margin-top: 0;
    }
    .docx-error p {
      color: #6b7077;
      line-height: 1.6;
      margin: 0.5rem 0;
    }
    .docx-error ul {
      color: #6b7077;
      line-height: 1.8;
      margin: 0.5rem 0;
      padding-left: 1.5rem;
    }
    .docx-error li {
      margin: 0.3rem 0;
    }
    .docx-error code {
      background: #f7f5f1;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-size: 0.9em;
      color: #dc2626;
      word-break: break-word;
    }
    .docx-error strong {
      color: #1e2227;
    }
    .docx-error .download-hint {
      margin-top: 1.5rem;
      padding: 1rem;
      background: #fef3c7;
      border-radius: 6px;
      border-left: 3px solid #f59e0b;
    }
  </style>
</head>
<body>
  <div class="docx-error">
    <h2>📄 无法预览文档</h2>
    <p>抱歉，无法转换此 DOCX 文件为预览格式。</p>
    <p><strong>错误信息：</strong> <code>${this.escapeHtml(errorMessage)}</code></p>
    <div style="margin: 1rem 0;">
      ${helpText}
    </div>
    <div class="download-hint">
      <strong>💡 提示：</strong> 您仍然可以下载原始文件到本地，使用 Microsoft Word 或 WPS 打开查看完整内容。
    </div>
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
