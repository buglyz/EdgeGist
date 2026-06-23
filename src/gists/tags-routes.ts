/**
 * Tags and Metadata API Routes
 * Provides academic writing and code management features
 */

import type { Context, Hono } from 'hono'
import type { AppEnv } from '../http/auth'
import { requireOwner } from '../http/auth'
import { badRequest, notFound } from '../http/errors'
import { TagsAndMetadataManager } from './tags-metadata'
import type { GistStatus, GistCategory } from './types'

export function registerTagsAndMetadataRoutes(app: Hono<AppEnv>, routePrefix: string = '') {
  const route = (path: string) => `${routePrefix}${path}`

  // Get tags for a gist
  app.get(route('/gists/:gistId/tags'), async (c) => {
    const gistId = c.req.param('gistId')
    const manager = new TagsAndMetadataManager(c.env.DB)
    const tags = await manager.getTags(gistId)
    return c.json(tags)
  })

  // Set tags for a gist (requires owner)
  app.put(route('/gists/:gistId/tags'), async (c) => {
    requireOwner(c)
    const gistId = c.req.param('gistId')
    const body = await c.req.json()

    if (!Array.isArray(body.tags)) {
      throw badRequest('tags must be an array')
    }

    const tags = body.tags.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0)

    const manager = new TagsAndMetadataManager(c.env.DB)
    await manager.setTags(gistId, tags)

    return c.json({ tags })
  })

  // Add a single tag
  app.post(route('/gists/:gistId/tags'), async (c) => {
    requireOwner(c)
    const gistId = c.req.param('gistId')
    const body = await c.req.json()

    if (!body.tag || typeof body.tag !== 'string') {
      throw badRequest('tag is required')
    }

    const manager = new TagsAndMetadataManager(c.env.DB)
    const tag = await manager.addTag(gistId, body.tag.trim())

    return c.json(tag, 201)
  })

  // Remove a single tag
  app.delete(route('/gists/:gistId/tags/:tag'), async (c) => {
    requireOwner(c)
    const gistId = c.req.param('gistId')
    const tag = c.req.param('tag')

    const manager = new TagsAndMetadataManager(c.env.DB)
    await manager.removeTag(gistId, tag)

    return c.body(null, 204)
  })

  // Get popular tags
  app.get(route('/tags'), async (c) => {
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
    const manager = new TagsAndMetadataManager(c.env.DB)
    const tags = await manager.getPopularTags(limit)
    return c.json(tags)
  })

  // Search gists by tag
  app.get(route('/tags/:tag/gists'), async (c) => {
    const tag = c.req.param('tag')
    const manager = new TagsAndMetadataManager(c.env.DB)
    const gistIds = await manager.searchByTag(tag)
    return c.json({ gistIds })
  })

  // Get metadata for a gist
  app.get(route('/gists/:gistId/metadata'), async (c) => {
    const gistId = c.req.param('gistId')
    const manager = new TagsAndMetadataManager(c.env.DB)
    const metadata = await manager.getMetadata(gistId)

    if (!metadata) {
      throw notFound()
    }

    return c.json(metadata)
  })

  // Update metadata status
  app.patch(route('/gists/:gistId/metadata/status'), async (c) => {
    requireOwner(c)
    const gistId = c.req.param('gistId')
    const body = await c.req.json()

    const validStatuses: GistStatus[] = ['draft', 'review', 'completed']
    if (!body.status || !validStatuses.includes(body.status)) {
      throw badRequest('Invalid status')
    }

    const manager = new TagsAndMetadataManager(c.env.DB)
    await manager.updateStatus(gistId, body.status)

    return c.json({ status: body.status })
  })

  // Update metadata category
  app.patch(route('/gists/:gistId/metadata/category'), async (c) => {
    requireOwner(c)
    const gistId = c.req.param('gistId')
    const body = await c.req.json()

    const validCategories: GistCategory[] = ['paper', 'code', 'document', 'data', 'experiment', 'note', 'other']
    if (!body.category || !validCategories.includes(body.category)) {
      throw badRequest('Invalid category')
    }

    const manager = new TagsAndMetadataManager(c.env.DB)
    await manager.updateCategory(gistId, body.category)

    return c.json({ category: body.category })
  })

  // Recalculate statistics for a gist
  app.post(route('/gists/:gistId/metadata/recalculate'), async (c) => {
    requireOwner(c)
    const gistId = c.req.param('gistId')

    // Get gist files
    const gist = await c.env.DB
      .prepare('SELECT id FROM gists WHERE id = ?')
      .bind(gistId)
      .first<{ id: string }>()

    if (!gist) {
      throw notFound()
    }

    const files = await c.env.DB
      .prepare('SELECT filename, content, size FROM gist_files WHERE gist_id = ?')
      .bind(gistId)
      .all<{ filename: string; content: string; size: number }>()

    const manager = new TagsAndMetadataManager(c.env.DB)
    await manager.updateStatistics(gistId, files.results || [])

    const metadata = await manager.getMetadata(gistId)
    return c.json(metadata)
  })
}
