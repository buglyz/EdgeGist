import type { R2Bucket } from '../env'

export type StorageType = 'inline' | 'r2'

export type StoredFileMetadata = {
  storageType: StorageType
  content: string
  r2Key: string | null
  r2Etag: string | null
  size: number
}

export class StorageManager {
  constructor(
    private readonly r2: R2Bucket | undefined,
    private readonly thresholdBytes: number,
  ) {}

  shouldUseR2(content: string, filename: string): boolean {
    if (!this.r2) return false

    const bytes = new TextEncoder().encode(content).length
    if (bytes >= this.thresholdBytes) return true

    if (this.isBinaryFile(filename)) return true

    return false
  }

  private isBinaryFile(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase()
    const binaryExtensions = [
      'docx',
      'doc',
      'pdf',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'svg',
      'ico',
      'bmp',
      'zip',
      'tar',
      'gz',
      'bz2',
      '7z',
      'rar',
      'exe',
      'dll',
      'so',
      'dylib',
      'wasm',
    ]
    return binaryExtensions.includes(ext || '')
  }

  async store(gistId: string, filename: string, content: string): Promise<StoredFileMetadata> {
    const size = new TextEncoder().encode(content).length

    if (!this.shouldUseR2(content, filename)) {
      return {
        storageType: 'inline',
        content,
        r2Key: null,
        r2Etag: null,
        size,
      }
    }

    const r2Key = this.generateR2Key(gistId, filename)
    const result = await this.r2!.put(r2Key, content, {
      httpMetadata: {
        contentType: this.inferMimeType(filename),
      },
      customMetadata: {
        gistId,
        filename,
      },
    })

    return {
      storageType: 'r2',
      content: '',
      r2Key,
      r2Etag: result.etag,
      size,
    }
  }

  async retrieve(storageType: StorageType, inlineContent: string, r2Key: string | null): Promise<string> {
    if (storageType === 'inline') {
      return inlineContent
    }

    if (!r2Key) {
      throw new Error('R2 key missing for r2 storage type')
    }

    if (!this.r2) {
      throw new Error('R2 bucket not configured')
    }

    const object = await this.r2.get(r2Key)
    if (!object) {
      throw new Error(`R2 object not found: ${r2Key}`)
    }

    return await object.text()
  }

  async delete(storageType: StorageType, r2Key: string | null): Promise<void> {
    if (storageType === 'r2' && r2Key && this.r2) {
      await this.r2.delete(r2Key)
    }
  }

  private generateR2Key(gistId: string, filename: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    return `gists/${gistId}/${timestamp}-${random}/${filename}`
  }

  private inferMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      pdf: 'application/pdf',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
      bmp: 'image/bmp',
      zip: 'application/zip',
      tar: 'application/x-tar',
      gz: 'application/gzip',
      bz2: 'application/x-bzip2',
      '7z': 'application/x-7z-compressed',
      rar: 'application/x-rar-compressed',
      json: 'application/json',
      md: 'text/markdown',
      txt: 'text/plain',
      html: 'text/html',
      htm: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      mjs: 'application/javascript',
      ts: 'application/typescript',
      jsx: 'application/javascript',
      tsx: 'application/typescript',
      xml: 'application/xml',
      yaml: 'text/yaml',
      yml: 'text/yaml',
    }
    return mimeTypes[ext || ''] || 'application/octet-stream'
  }
}
