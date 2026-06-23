/**
 * R2 Cleanup Cron Worker
 *
 * Purpose: Retry failed R2 deletions from the cleanup queue
 * Schedule: Run daily or hourly depending on traffic
 *
 * Usage in wrangler.toml:
 * [triggers]
 * crons = ["0 2 * * *"]  # Daily at 2 AM
 */

import type { R2Bucket, D1Database } from './env'

interface Env {
  DB: D1Database
  R2_BUCKET: R2Bucket
}

interface CleanupQueueItem {
  id: string
  r2_key: string
  gist_id: string | null
  reason: string
  created_at: string
  retry_count: number
  last_retry_at: string | null
}

const MAX_RETRIES = 5
const BATCH_SIZE = 100

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('R2 cleanup cron started', { scheduledTime: event.scheduledTime })

    const stats = {
      processed: 0,
      deleted: 0,
      failed: 0,
      maxRetriesReached: 0,
    }

    try {
      // Fetch items to retry
      const items = await env.DB.prepare(
        `SELECT id, r2_key, gist_id, reason, created_at, retry_count, last_retry_at
         FROM r2_cleanup_queue
         WHERE retry_count < ?
         ORDER BY created_at ASC
         LIMIT ?`
      )
        .bind(MAX_RETRIES, BATCH_SIZE)
        .all<CleanupQueueItem>()

      if (!items.results || items.results.length === 0) {
        console.log('R2 cleanup queue is empty')
        return
      }

      console.log(`Processing ${items.results.length} R2 cleanup items`)

      // Process each item
      for (const item of items.results) {
        stats.processed++

        try {
          // Attempt deletion
          await env.R2_BUCKET.delete(item.r2_key)
          stats.deleted++

          // Remove from queue on success
          await env.DB.prepare('DELETE FROM r2_cleanup_queue WHERE id = ?')
            .bind(item.id)
            .run()

          console.log('R2 object deleted successfully', { r2_key: item.r2_key })
        } catch (error) {
          stats.failed++
          const newRetryCount = item.retry_count + 1

          if (newRetryCount >= MAX_RETRIES) {
            stats.maxRetriesReached++
            console.error('R2 cleanup max retries reached, removing from queue', {
              r2_key: item.r2_key,
              retry_count: newRetryCount,
              error: error instanceof Error ? error.message : String(error),
            })

            // Remove from queue after max retries
            await env.DB.prepare('DELETE FROM r2_cleanup_queue WHERE id = ?')
              .bind(item.id)
              .run()
          } else {
            console.warn('R2 cleanup retry failed, will retry later', {
              r2_key: item.r2_key,
              retry_count: newRetryCount,
              error: error instanceof Error ? error.message : String(error),
            })

            // Update retry count
            await env.DB.prepare(
              `UPDATE r2_cleanup_queue
               SET retry_count = ?, last_retry_at = datetime('now')
               WHERE id = ?`
            )
              .bind(newRetryCount, item.id)
              .run()
          }
        }
      }

      console.log('R2 cleanup cron completed', stats)
    } catch (error) {
      console.error('R2 cleanup cron failed', {
        error: error instanceof Error ? error.message : String(error),
        stats,
      })
    }
  },
}
