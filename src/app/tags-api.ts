/**
 * API Client Extensions for Tags and Metadata
 * Extends the existing ApiClient with academic writing features
 */

export interface GistTag {
  id: string
  gistId: string
  tag: string
  createdAt: string
}

export interface GistMetadata {
  gistId: string
  wordCount: number
  lineCount: number
  fileCount: number
  totalSize: number
  primaryLanguage: string | null
  status: 'draft' | 'review' | 'completed'
  category: 'paper' | 'code' | 'document' | 'data' | 'experiment' | 'note' | 'other' | null
  lastStatsUpdate: string | null
}

export interface PopularTag {
  tag: string
  count: number
}

export class TagsAndMetadataApi {
  constructor(private baseUrl: string, private getAuthToken: () => string | null) {}

  // Tags operations
  async getTags(gistId: string): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/gists/${gistId}/tags`)
    if (!response.ok) throw new Error('Failed to fetch tags')
    return response.json()
  }

  async setTags(gistId: string, tags: string[]): Promise<{ tags: string[] }> {
    const token = this.getAuthToken()
    if (!token) throw new Error('Authentication required')

    const response = await fetch(`${this.baseUrl}/gists/${gistId}/tags`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ tags }),
    })

    if (!response.ok) throw new Error('Failed to set tags')
    return response.json()
  }

  async addTag(gistId: string, tag: string): Promise<GistTag> {
    const token = this.getAuthToken()
    if (!token) throw new Error('Authentication required')

    const response = await fetch(`${this.baseUrl}/gists/${gistId}/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ tag }),
    })

    if (!response.ok) throw new Error('Failed to add tag')
    return response.json()
  }

  async removeTag(gistId: string, tag: string): Promise<void> {
    const token = this.getAuthToken()
    if (!token) throw new Error('Authentication required')

    const response = await fetch(`${this.baseUrl}/gists/${gistId}/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) throw new Error('Failed to remove tag')
  }

  async getPopularTags(limit: number = 20): Promise<PopularTag[]> {
    const response = await fetch(`${this.baseUrl}/tags?limit=${limit}`)
    if (!response.ok) throw new Error('Failed to fetch popular tags')
    return response.json()
  }

  async searchByTag(tag: string): Promise<{ gistIds: string[] }> {
    const response = await fetch(`${this.baseUrl}/tags/${encodeURIComponent(tag)}/gists`)
    if (!response.ok) throw new Error('Failed to search by tag')
    return response.json()
  }

  // Metadata operations
  async getMetadata(gistId: string): Promise<GistMetadata | null> {
    const response = await fetch(`${this.baseUrl}/gists/${gistId}/metadata`)
    if (response.status === 404) return null
    if (!response.ok) throw new Error('Failed to fetch metadata')
    return response.json()
  }

  async updateStatus(
    gistId: string,
    status: 'draft' | 'review' | 'completed'
  ): Promise<{ status: string }> {
    const token = this.getAuthToken()
    if (!token) throw new Error('Authentication required')

    const response = await fetch(`${this.baseUrl}/gists/${gistId}/metadata/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    })

    if (!response.ok) throw new Error('Failed to update status')
    return response.json()
  }

  async updateCategory(
    gistId: string,
    category: 'paper' | 'code' | 'document' | 'data' | 'experiment' | 'note' | 'other'
  ): Promise<{ category: string }> {
    const token = this.getAuthToken()
    if (!token) throw new Error('Authentication required')

    const response = await fetch(`${this.baseUrl}/gists/${gistId}/metadata/category`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ category }),
    })

    if (!response.ok) throw new Error('Failed to update category')
    return response.json()
  }

  async recalculateStats(gistId: string): Promise<GistMetadata> {
    const token = this.getAuthToken()
    if (!token) throw new Error('Authentication required')

    const response = await fetch(`${this.baseUrl}/gists/${gistId}/metadata/recalculate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) throw new Error('Failed to recalculate statistics')
    return response.json()
  }
}

// Helper function to format numbers
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

// Helper function to get status badge color
export function getStatusColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'review':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}

// Helper function to get category emoji
export function getCategoryEmoji(category: string | null): string {
  switch (category) {
    case 'paper':
      return '📄'
    case 'code':
      return '💻'
    case 'document':
      return '📝'
    case 'data':
      return '📊'
    case 'experiment':
      return '🔬'
    case 'note':
      return '📓'
    default:
      return '📁'
  }
}

// Helper function to translate category to Chinese
export function getCategoryLabel(category: string | null): string {
  switch (category) {
    case 'paper':
      return '论文'
    case 'code':
      return '代码'
    case 'document':
      return '文档'
    case 'data':
      return '数据'
    case 'experiment':
      return '实验'
    case 'note':
      return '笔记'
    default:
      return '其他'
  }
}

// Helper function to translate status to Chinese
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return '草稿'
    case 'review':
      return '审阅中'
    case 'completed':
      return '已完成'
    default:
      return status
  }
}
