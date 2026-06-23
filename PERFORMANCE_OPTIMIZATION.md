# EdgeGist 性能优化计划

## 🎯 优化目标
- 减少重复计算和 API 调用
- 降低内存使用
- 提升响应速度
- 优化数据库查询

## 📊 当前性能瓶颈分析

### 1. DOCX 转换性能 ⚠️ **High Impact**

**问题**:
- 每次预览都重新转换 DOCX
- mammoth.js 转换可能需要 2-5 秒（1-3MB 文件）
- 浪费 CPU 时间和用户等待

**影响**:
- 用户体验差（每次点击都等待）
- Workers CPU 使用高
- 可能超出 10ms (Free) / 30s (Paid) CPU 限制

**优化方案**: 缓存转换结果到 R2

```typescript
// src/gists/routes.ts - 预览路由
const cacheKey = `previews/${gistId}/${filename}/${file.r2_etag || 'inline'}.html`

// 1. 尝试从缓存读取
try {
  const cached = await r2.get(cacheKey)
  if (cached) {
    console.log('DOCX preview cache hit', { gistId, filename })
    return c.html(await cached.text())
  }
} catch (error) {
  console.warn('Cache read failed, will regenerate', { cacheKey })
}

// 2. 转换
const html = await converter.convertToHtml(docxBuffer)

// 3. 异步存储缓存（不阻塞响应）
c.executionCtx.waitUntil(
  r2.put(cacheKey, html, {
    httpMetadata: { contentType: 'text/html; charset=utf-8' },
    customMetadata: { gistId, filename, generatedAt: new Date().toISOString() },
  }).catch(error => {
    console.error('Failed to cache preview', { cacheKey, error })
  })
)

return c.html(html)
```

**预期收益**:
- 首次预览：无变化（仍需转换）
- 后续预览：~95% 时间减少（从 2-5s → 50-100ms）
- CPU 使用降低 95%
- 更好的并发处理能力

**实施优先级**: 🔴 **立即实施**

---

### 2. TextEncoder 重复实例化 ⚠️ **Low Impact, Easy Fix**

**问题**:
```typescript
// 多处代码
const size = new TextEncoder().encode(content).length
```
每次调用都创建新的 TextEncoder 实例

**影响**: 轻微（V8 可能已优化），但违反最佳实践

**优化方案**:
```typescript
// src/storage/storage-manager.ts 顶部
const TEXT_ENCODER = new TextEncoder()

// 使用处
const size = TEXT_ENCODER.encode(content).length
```

**预期收益**: 轻微性能提升 + 代码质量改进

**实施优先级**: 🟡 **本次实施**

---

### 3. 批量 R2 操作效率 ⚠️ **Medium Impact**

**问题**:
```typescript
// src/gists/repository.ts:listVersions
for (const file of versionFiles) {
  const content = await this.storageManager.retrieve(...)
  // 每个文件一次 R2 请求 - 串行执行
}
```

**影响**:
- 历史列表加载慢（10 个文件 = 10 次 R2 请求）
- 无法利用并发优势
- 用户等待时间长

**优化方案**: 并行检索
```typescript
const hydratedFiles = await Promise.all(
  versionFiles.map(async (file) => {
    const content = await this.storageManager.retrieve(
      file.storage_type as StorageType,
      file.content,
      file.r2_key
    )
    return { ...file, content }
  })
)
```

**预期收益**:
- 10 个文件：从 ~500ms → ~50ms（10x 提速）
- 更好的用户体验

**实施优先级**: 🟡 **本次实施**

---

### 4. 数据库查询优化 ⚠️ **Medium Impact**

**当前问题**: 某些查询可能扫描全表

**优化方向**:

#### A. 添加复合索引
```sql
-- migrations/0004_add_performance_indexes.sql

-- 加速按 owner + visibility + updated_at 排序的列表查询
CREATE INDEX IF NOT EXISTS idx_gists_owner_public_updated 
  ON gists(owner_id, public, updated_at DESC);

-- 加速 starred gists 查询
CREATE INDEX IF NOT EXISTS idx_gists_starred_at 
  ON gists(starred_at DESC) 
  WHERE starred_at IS NOT NULL;

-- 加速文件内容搜索
CREATE INDEX IF NOT EXISTS idx_gist_files_content_search 
  ON gist_files(gist_id, filename, content);
```

#### B. 查询优化
```typescript
// 避免 SELECT *，只查询需要的列
// 坏
const rows = await db.prepare('SELECT * FROM gists WHERE ...')

// 好
const rows = await db.prepare(
  'SELECT id, owner_id, description, public, created_at, updated_at FROM gists WHERE ...'
)
```

**预期收益**: 10-30% 查询速度提升

**实施优先级**: 🟢 **推荐实施**

---

### 5. 内存优化 ⚠️ **Low Impact, Future**

**潜在问题**: 
- 大文件内容在内存中完整加载
- 版本历史可能加载大量数据

**优化方向**:
- 流式处理大文件
- 分页加载版本历史
- 限制单次加载的文件数量

**实施优先级**: 🔵 **长期规划**

---

## 📋 立即实施清单

### 优先级 1 (本次实施)

1. ✅ **TextEncoder 单例化**
   - 位置: `storage-manager.ts`, `routes.ts`, `service.ts`
   - 时间: 5 分钟
   - 风险: 无

2. ✅ **并行 R2 检索**
   - 位置: `repository.ts:listVersions`, `repository.ts:getVersion`
   - 时间: 15 分钟
   - 风险: 低（Promise.all 需要错误处理）

3. ✅ **DOCX 预览缓存**
   - 位置: `routes.ts` - 两个预览路由
   - 时间: 20 分钟
   - 风险: 低（缓存失败不影响功能）

### 优先级 2 (推荐)

4. ⏸️ **数据库索引优化**
   - 新增迁移文件
   - 时间: 10 分钟
   - 风险: 低（索引创建是增量的）

5. ⏸️ **查询列优化**
   - 多个文件
   - 时间: 1 小时
   - 风险: 中（需要仔细测试）

---

## 🧪 性能测试建议

### 测试场景

1. **DOCX 预览性能**
   ```bash
   # 首次预览（冷启动）
   time curl https://your-worker.workers.dev/gists/xxx/files/test.docx/preview
   
   # 第二次预览（缓存命中）
   time curl https://your-worker.workers.dev/gists/xxx/files/test.docx/preview
   ```
   
   **预期**:
   - 首次: 2-5s
   - 缓存: 50-100ms

2. **版本历史加载**
   ```bash
   # 带 10 个文件的版本
   time curl -H "Authorization: Bearer TOKEN" \
     https://your-worker.workers.dev/gists/xxx/commits
   ```
   
   **预期**:
   - 优化前: 500-800ms
   - 优化后: 50-150ms

3. **并发压力测试**
   ```bash
   # 使用 wrk 或 apache bench
   wrk -t4 -c100 -d30s https://your-worker.workers.dev/gists/xxx
   ```

---

## 📈 预期收益总结

| 优化项 | CPU 节省 | 响应时间改善 | 用户体验影响 |
|--------|----------|--------------|--------------|
| DOCX 缓存 | 95% | 95% (2-5s → 50-100ms) | 🔥 极大 |
| 并行 R2 | 0% | 90% (500ms → 50ms) | 🔥 显著 |
| TextEncoder | <1% | <1% | - |
| DB 索引 | 10% | 15-30% | 🟢 明显 |

**总体预期**: 
- 预览响应时间：**减少 90-95%**
- 历史加载速度：**提升 10 倍**
- Workers CPU 使用：**降低 80-90%**

---

## ⚠️ 注意事项

### 缓存失效策略

DOCX 预览缓存需要在以下情况失效：
1. ✅ 文件内容更新 - 已处理（使用 r2_etag 在 key 中）
2. ✅ 文件删除 - 自动处理（R2 清理队列）
3. ⚠️ DOCX 转换逻辑更新 - 需要手动清理缓存

**缓存版本化**建议：
```typescript
const PREVIEW_CACHE_VERSION = 'v1'
const cacheKey = `previews/${PREVIEW_CACHE_VERSION}/${gistId}/...`
```

升级时递增版本号，旧缓存自然过期。

### 并发限制

Promise.all 可能触发大量并发 R2 请求，考虑添加限制：
```typescript
// 分批处理，每批最多 10 个
const batches = chunk(versionFiles, 10)
for (const batch of batches) {
  const results = await Promise.all(batch.map(...))
  // 处理结果
}
```

---

## 🎓 性能优化原则

1. **先测量，后优化**: 确认瓶颈再动手
2. **缓存第一**: 避免重复计算
3. **并行优先**: 利用异步特性
4. **数据库友好**: 索引 + 精确查询
5. **渐进增强**: 缓存失败不影响功能

---

**下一步**: 实施优先级 1 的 3 项优化
