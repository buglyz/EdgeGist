import type { D1Database } from '../env'
import type { GistTag, GistMetadata, GistStatus, GistCategory } from './types'
import { calculateGistStatistics, inferCategory } from './statistics'
import { createId } from '../id'

export class TagsAndMetadataManager {
  constructor(private readonly db: D1Database) {}

  // Tags operations
  async addTag(gistId: string, tag: string): Promise<GistTag> {
    const id = createId(20)
    const now = new Date().toISOString()

    await this.db
      .prepare('INSERT INTO gist_tags (id, gist_id, tag, created_at) VALUES (?, ?, ?, ?)')
      .bind(id, gistId, tag, now)
      .run()

    return { id, gistId, tag, createdAt: now }
  }

  async removeTag(gistId: string, tag: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM gist_tags WHERE gist_id = ? AND tag = ?')
      .bind(gistId, tag)
      .run()
  }

  async getTags(gistId: string): Promise<string[]> {
    const result = await this.db
      .prepare('SELECT tag FROM gist_tags WHERE gist_id = ? ORDER BY created_at ASC')
      .bind(gistId)
      .all<{ tag: string }>()

    return (result.results || []).map(row => row.tag)
  }

  async setTags(gistId: string, tags: string[]): Promise<void> {
    // Delete existing tags
    await this.db
      .prepare('DELETE FROM gist_tags WHERE gist_id = ?')
      .bind(gistId)
      .run()

    // Insert new tags
    if (tags.length === 0) return

    const now = new Date().toISOString()
    const statements = tags.map(tag => {
      const id = createId(20)
      return this.db
        .prepare('INSERT INTO gist_tags (id, gist_id, tag, created_at) VALUES (?, ?, ?, ?)')
        .bind(id, gistId, tag, now)
    })

    await this.db.batch(statements)
  }

  async getPopularTags(limit: number = 20): Promise<Array<{ tag: string; count: number }>> {
    const result = await this.db
      .prepare(
        `SELECT tag, COUNT(*) as count
         FROM gist_tags
         GROUP BY tag
         ORDER BY count DESC, tag ASC
         LIMIT ?`
      )
      .bind(limit)
      .all<{ tag: string; count: number }>()

    return result.results || []
  }

  async searchByTag(tag: string): Promise<string[]> {
    const result = await this.db
      .prepare('SELECT gist_id FROM gist_tags WHERE tag = ? ORDER BY created_at DESC')
      .bind(tag)
      .all<{ gist_id: string }>()

    return (result.results || []).map(row => row.gist_id)
  }

  // Metadata operations
  async getMetadata(gistId: string): Promise<GistMetadata | null> {
    const result = await this.db
      .prepare(
        `SELECT gist_id, word_count, line_count, file_count, total_size,
                primary_language, status, category, last_stats_update
         FROM gist_metadata
         WHERE gist_id = ?`
      )
      .bind(gistId)
      .first<{
        gist_id: string
        word_count: number
        line_count: number
        file_count: number
        total_size: number
        primary_language: string | null
        status: GistStatus
        category: GistCategory | null
        last_stats_update: string | null
      }>()

    if (!result) return null

    return {
      gistId: result.gist_id,
      wordCount: result.word_count,
      lineCount: result.line_count,
      fileCount: result.file_count,
      totalSize: result.total_size,
      primaryLanguage: result.primary_language,
      status: result.status,
      category: result.category,
      lastStatsUpdate: result.last_stats_update,
    }
  }

  async updateMetadata(gistId: string, metadata: Partial<GistMetadata>): Promise<void> {
    const existing = await this.getMetadata(gistId)

    if (existing) {
      // Update existing
      const updates: string[] = []
      const values: any[] = []

      if (metadata.wordCount !== undefined) {
        updates.push('word_count = ?')
        values.push(metadata.wordCount)
      }
      if (metadata.lineCount !== undefined) {
        updates.push('line_count = ?')
        values.push(metadata.lineCount)
      }
      if (metadata.fileCount !== undefined) {
        updates.push('file_count = ?')
        values.push(metadata.fileCount)
      }
      if (metadata.totalSize !== undefined) {
        updates.push('total_size = ?')
        values.push(metadata.totalSize)
      }
      if (metadata.primaryLanguage !== undefined) {
        updates.push('primary_language = ?')
        values.push(metadata.primaryLanguage)
      }
      if (metadata.status !== undefined) {
        updates.push('status = ?')
        values.push(metadata.status)
      }
      if (metadata.category !== undefined) {
        updates.push('category = ?')
        values.push(metadata.category)
      }
      if (metadata.lastStatsUpdate !== undefined) {
        updates.push('last_stats_update = ?')
        values.push(metadata.lastStatsUpdate)
      }

      if (updates.length > 0) {
        values.push(gistId)
        await this.db
          .prepare(`UPDATE gist_metadata SET ${updates.join(', ')} WHERE gist_id = ?`)
          .bind(...values)
          .run()
      }
    } else {
      // Insert new
      await this.db
        .prepare(
          `INSERT INTO gist_metadata
           (gist_id, word_count, line_count, file_count, total_size,
            primary_language, status, category, last_stats_update)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          gistId,
          metadata.wordCount || 0,
          metadata.lineCount || 0,
          metadata.fileCount || 0,
          metadata.totalSize || 0,
          metadata.primaryLanguage || null,
          metadata.status || 'draft',
          metadata.category || null,
          metadata.lastStatsUpdate || null
        )
        .run()
    }
  }

  async updateStatistics(
    gistId: string,
    files: Array<{ filename: string; content: string; size: number }>
  ): Promise<void> {
    const stats = calculateGistStatistics(files)
    const category = inferCategory(files)

    await this.updateMetadata(gistId, {
      wordCount: stats.totalWordCount,
      lineCount: stats.totalLineCount,
      fileCount: stats.fileCount,
      totalSize: stats.totalSize,
      primaryLanguage: stats.primaryLanguage,
      category,
      lastStatsUpdate: new Date().toISOString(),
    })
  }

  async updateStatus(gistId: string, status: GistStatus): Promise<void> {
    await this.updateMetadata(gistId, { status })
  }

  async updateCategory(gistId: string, category: GistCategory): Promise<void> {
    await this.updateMetadata(gistId, { category })
  }

  async deleteMetadata(gistId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM gist_metadata WHERE gist_id = ?')
      .bind(gistId)
      .run()
  }

  // Batch operations
  async getMultipleMetadata(gistIds: string[]): Promise<Map<string, GistMetadata>> {
    if (gistIds.length === 0) return new Map()

    const placeholders = gistIds.map(() => '?').join(',')
    const result = await this.db
      .prepare(
        `SELECT gist_id, word_count, line_count, file_count, total_size,
                primary_language, status, category, last_stats_update
         FROM gist_metadata
         WHERE gist_id IN (${placeholders})`
      )
      .bind(...gistIds)
      .all<{
        gist_id: string
        word_count: number
        line_count: number
        file_count: number
        total_size: number
        primary_language: string | null
        status: GistStatus
        category: GistCategory | null
        last_stats_update: string | null
      }>()

    const map = new Map<string, GistMetadata>()
    for (const row of result.results || []) {
      map.set(row.gist_id, {
        gistId: row.gist_id,
        wordCount: row.word_count,
        lineCount: row.line_count,
        fileCount: row.file_count,
        totalSize: row.total_size,
        primaryLanguage: row.primary_language,
        status: row.status,
        category: row.category,
        lastStatsUpdate: row.last_stats_update,
      })
    }

    return map
  }

  async getMultipleTags(gistIds: string[]): Promise<Map<string, string[]>> {
    if (gistIds.length === 0) return new Map()

    const placeholders = gistIds.map(() => '?').join(',')
    const result = await this.db
      .prepare(
        `SELECT gist_id, tag
         FROM gist_tags
         WHERE gist_id IN (${placeholders})
         ORDER BY gist_id, created_at ASC`
      )
      .bind(...gistIds)
      .all<{ gist_id: string; tag: string }>()

    const map = new Map<string, string[]>()
    for (const row of result.results || []) {
      const tags = map.get(row.gist_id) || []
      tags.push(row.tag)
      map.set(row.gist_id, tags)
    }

    return map
  }
}
