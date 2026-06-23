export type D1Result<T = unknown> = {
  results?: T[]
  success: boolean
  meta?: Record<string, unknown>
}

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(): Promise<T | null>
  all<T = unknown>(): Promise<D1Result<T>>
  run(): Promise<D1Result>
}

export type D1DatabaseLike = {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
}

export type R2Bucket = {
  get(key: string): Promise<R2Object | null>
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null, options?: R2PutOptions): Promise<R2Object>
  delete(key: string | string[]): Promise<void>
  head(key: string): Promise<R2Object | null>
  list(options?: R2ListOptions): Promise<R2Objects>
}

export type R2Object = {
  key: string
  version: string
  size: number
  etag: string
  httpEtag: string
  uploaded: Date
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
  range?: R2Range
  checksums: R2Checksums
  body?: ReadableStream
  bodyUsed: boolean
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  json<T>(): Promise<T>
  blob(): Promise<Blob>
}

export type R2PutOptions = {
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
  md5?: ArrayBuffer | string
  sha1?: ArrayBuffer | string
  sha256?: ArrayBuffer | string
  sha384?: ArrayBuffer | string
  sha512?: ArrayBuffer | string
}

export type R2HTTPMetadata = {
  contentType?: string
  contentLanguage?: string
  contentDisposition?: string
  contentEncoding?: string
  cacheControl?: string
  cacheExpiry?: Date
}

export type R2ListOptions = {
  limit?: number
  prefix?: string
  cursor?: string
  delimiter?: string
  startAfter?: string
  include?: ('httpMetadata' | 'customMetadata')[]
}

export type R2Objects = {
  objects: R2Object[]
  truncated: boolean
  cursor?: string
  delimitedPrefixes: string[]
}

export type R2Range = {
  offset: number
  length: number
}

export type R2Checksums = {
  md5?: ArrayBuffer
  sha1?: ArrayBuffer
  sha256?: ArrayBuffer
  sha384?: ArrayBuffer
  sha512?: ArrayBuffer
}

export type EdgeGistBindings = {
  DB: D1DatabaseLike
  R2_BUCKET?: R2Bucket
  EDGEGIST_OWNER_USERNAME?: string
  EDGEGIST_OWNER_PASSWORD?: string
  EDGEGIST_OWNER_TOKEN?: string
  EDGEGIST_BASE_URL?: string
  EDGEGIST_HISTORY_MAX_VERSIONS?: string
  EDGEGIST_TURNSTILE_SITE_KEY?: string
  EDGEGIST_TURNSTILE_SECRET_KEY?: string
  EDGEGIST_STORAGE_THRESHOLD_KB?: string
}

export type RetentionPolicy = {
  count: number
}

export type EdgeGistConfig = {
  ownerUsername: string
  ownerPassword: string
  ownerToken: string
  baseUrl: string
  retention: RetentionPolicy
  turnstile: TurnstileConfig | null
  storageThresholdBytes: number
}

export type TurnstileConfig = {
  siteKey: string
  secretKey: string
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export function getConfig(env: EdgeGistBindings, requestUrl?: string): EdgeGistConfig {
  const ownerUsername = env.EDGEGIST_OWNER_USERNAME?.trim()
  const ownerPassword = env.EDGEGIST_OWNER_PASSWORD?.trim()
  const ownerToken = env.EDGEGIST_OWNER_TOKEN?.trim()

  if (!ownerUsername) throw new ConfigError('EDGEGIST_OWNER_USERNAME is required')
  if (!ownerPassword) throw new ConfigError('EDGEGIST_OWNER_PASSWORD is required')
  if (!ownerToken) throw new ConfigError('EDGEGIST_OWNER_TOKEN is required')

  return {
    ownerUsername,
    ownerPassword,
    ownerToken,
    baseUrl: normalizeBaseUrl(env.EDGEGIST_BASE_URL, requestUrl),
    retention: parseRetentionPolicy(env),
    turnstile: parseTurnstileConfig(env, requestUrl),
    storageThresholdBytes: parseStorageThreshold(env),
  }
}

function parseTurnstileConfig(env: EdgeGistBindings, requestUrl?: string): TurnstileConfig | null {
  const siteKey = env.EDGEGIST_TURNSTILE_SITE_KEY?.trim() ?? ''
  const secretKey = env.EDGEGIST_TURNSTILE_SECRET_KEY?.trim() ?? ''
  if (isLocalDevelopmentUrl(requestUrl)) return null
  if (!siteKey && !secretKey) return null
  if (!siteKey || !secretKey) {
    throw new ConfigError('EDGEGIST_TURNSTILE_SITE_KEY and EDGEGIST_TURNSTILE_SECRET_KEY must be configured together')
  }
  return { siteKey, secretKey }
}

function isLocalDevelopmentUrl(requestUrl?: string): boolean {
  if (!requestUrl) return false
  try {
    const hostname = new URL(requestUrl).hostname.toLowerCase()
    return ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1'].includes(hostname)
  } catch {
    return false
  }
}

function normalizeBaseUrl(configuredBaseUrl?: string, requestUrl?: string): string {
  if (configuredBaseUrl?.trim()) return configuredBaseUrl.trim().replace(/\/+$/, '')
  if (requestUrl) {
    const url = new URL(requestUrl)
    return url.origin
  }
  return 'http://localhost'
}

export function parseRetentionPolicy(env: EdgeGistBindings): RetentionPolicy {
  const latest = parseNonNegativeInteger(env.EDGEGIST_HISTORY_MAX_VERSIONS)
  return { count: latest ?? 100 }
}

function parseStorageThreshold(env: EdgeGistBindings): number {
  const kb = parseNonNegativeInteger(env.EDGEGIST_STORAGE_THRESHOLD_KB)
  return (kb ?? 100) * 1024
}

function parseNonNegativeInteger(value?: string): number | null {
  if (value === undefined || value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ConfigError(`Invalid non-negative integer config value: ${value}`)
  }
  return parsed
}
