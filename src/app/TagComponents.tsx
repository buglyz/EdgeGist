import { useState, useEffect } from 'react'
import { X, Tag, Plus, RefreshCw } from 'lucide-react'
import type { GistMetadata, PopularTag } from './tags-api'
import {
  TagsAndMetadataApi,
  formatNumber,
  getStatusColor,
  getCategoryEmoji,
  getCategoryLabel,
  getStatusLabel
} from './tags-api'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'

interface TagEditorProps {
  gistId: string
  initialTags?: string[]
  apiBaseUrl: string
  getAuthToken: () => string | null
  onTagsChange?: (tags: string[]) => void
}

export function TagEditor({
  gistId,
  initialTags = [],
  apiBaseUrl,
  getAuthToken,
  onTagsChange
}: TagEditorProps) {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [api] = useState(() => new TagsAndMetadataApi(apiBaseUrl, getAuthToken))

  useEffect(() => {
    setTags(initialTags)
  }, [initialTags])

  const handleAddTag = async () => {
    const tag = inputValue.trim()
    if (!tag || tags.includes(tag)) {
      setInputValue('')
      return
    }

    setLoading(true)
    try {
      const newTags = [...tags, tag]
      await api.setTags(gistId, newTags)
      setTags(newTags)
      setInputValue('')
      onTagsChange?.(newTags)
    } catch (error) {
      console.error('Failed to add tag:', error)
      alert('添加标签失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTag = async (tagToRemove: string) => {
    setLoading(true)
    try {
      await api.removeTag(gistId, tagToRemove)
      const newTags = tags.filter(t => t !== tagToRemove)
      setTags(newTags)
      onTagsChange?.(newTags)
    } catch (error) {
      console.error('Failed to remove tag:', error)
      alert('删除标签失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="添加标签..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddTag()
            }
          }}
          disabled={loading}
          className="flex-1"
        />
        <Button
          size="sm"
          onClick={handleAddTag}
          disabled={loading || !inputValue.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <Badge
            key={tag}
            variant="secondary"
            className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80"
          >
            <Tag className="h-3 w-3" />
            <span>{tag}</span>
            <button
              onClick={() => handleRemoveTag(tag)}
              disabled={loading}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {tags.length === 0 && (
        <p className="text-xs text-muted-foreground">
          暂无标签。添加标签以便更好地组织和搜索。
        </p>
      )}
    </div>
  )
}

interface GistStatsPanelProps {
  gistId: string
  apiBaseUrl: string
  getAuthToken: () => string | null
}

export function GistStatsPanel({ gistId, apiBaseUrl, getAuthToken }: GistStatsPanelProps) {
  const [metadata, setMetadata] = useState<GistMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [api] = useState(() => new TagsAndMetadataApi(apiBaseUrl, getAuthToken))

  useEffect(() => {
    loadMetadata()
  }, [gistId])

  const loadMetadata = async () => {
    setLoading(true)
    try {
      const data = await api.getMetadata(gistId)
      setMetadata(data)
    } catch (error) {
      console.error('Failed to load metadata:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const data = await api.recalculateStats(gistId)
      setMetadata(data)
    } catch (error) {
      console.error('Failed to recalculate stats:', error)
      alert('刷新统计信息失败')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">📊 统计信息</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">加载中...</p>
        </CardContent>
      </Card>
    )
  }

  if (!metadata) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">📊 统计信息</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">暂无统计信息</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 w-full"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            计算统计
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">📊 统计信息</CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {metadata.wordCount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">字数:</span>
            <span className="font-medium">{formatNumber(metadata.wordCount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">行数:</span>
          <span className="font-medium">{formatNumber(metadata.lineCount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">文件:</span>
          <span className="font-medium">{metadata.fileCount}</span>
        </div>
        {metadata.primaryLanguage && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">语言:</span>
            <span className="font-medium">{metadata.primaryLanguage}</span>
          </div>
        )}
        {metadata.category && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">分类:</span>
            <span className="font-medium">
              {getCategoryEmoji(metadata.category)} {getCategoryLabel(metadata.category)}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">状态:</span>
          <Badge variant="outline" className={getStatusColor(metadata.status)}>
            {getStatusLabel(metadata.status)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

interface PopularTagsProps {
  apiBaseUrl: string
  onTagClick?: (tag: string) => void
}

export function PopularTags({ apiBaseUrl, onTagClick }: PopularTagsProps) {
  const [tags, setTags] = useState<PopularTag[]>([])
  const [loading, setLoading] = useState(true)
  const [api] = useState(() => new TagsAndMetadataApi(apiBaseUrl, () => null))

  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    try {
      const data = await api.getPopularTags(10)
      setTags(data)
    } catch (error) {
      console.error('Failed to load popular tags:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">🏷️ 热门标签</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">加载中...</p>
        </CardContent>
      </Card>
    )
  }

  if (tags.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">🏷️ 热门标签</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {tags.map(({ tag, count }) => (
            <Badge
              key={tag}
              variant="secondary"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={() => onTagClick?.(tag)}
            >
              {tag} <span className="ml-1 text-xs opacity-70">({count})</span>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
