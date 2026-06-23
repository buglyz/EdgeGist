# EdgeGist R2 + DOCX 预览功能实施说明

## 已完成的工作

### 后端实现 ✅

1. **环境配置** (`src/env.ts`)
   - 添加 R2Bucket 类型定义
   - 添加 R2_BUCKET 绑定
   - 添加 EDGEGIST_STORAGE_THRESHOLD_KB 配置

2. **存储管理器** (`src/storage/storage-manager.ts`)
   - 智能存储决策（D1 vs R2）
   - R2 操作封装
   - 支持 30+ 种二进制文件格式

3. **数据库迁移** (`migrations/0002_add_r2_storage.sql`)
   - 添加 storage_type, r2_key, r2_etag 列
   - 创建索引

4. **Repository 层改造** (`src/gists/repository.ts`)
   - 集成 StorageManager
   - 更新所有 CRUD 操作
   - 实现 R2 清理逻辑

5. **DOCX 转换服务** (`src/docx/docx-converter.ts`)
   - 使用 mammoth.js 转换
   - XSS 防护
   - 美观的 HTML 输出

6. **API 路由** (`src/gists/routes.ts`)
   - `/gists/:gistId/files/:filename/preview`
   - `/:owner/:gistId/files/:filename/preview`

7. **配置文件**
   - `package.json`: 添加 mammoth 依赖
   - `wrangler.example.jsonc`: R2 配置

## 前端集成指南

由于 `src/app/App.tsx` 文件较大（7000+ 行），需要手动集成 DOCX 预览功能。

### 步骤 1: 添加 DOCX 预览组件

在 `src/app/App.tsx` 中添加以下组件（建议放在文件开头的组件定义区域）：

```typescript
function DocxPreview({ gistId, filename }: { gistId: string; filename: string }) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setLoading(false)
  }, [gistId, filename])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">加载预览中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-800 font-semibold mb-2">预览失败</div>
        <div className="text-red-600 text-sm">{error}</div>
      </div>
    )
  }

  const previewUrl = `/gists/${gistId}/files/${encodeURIComponent(filename)}/preview`

  return (
    <div className="docx-preview-wrapper">
      <iframe
        src={previewUrl}
        className="w-full border-0"
        style={{ minHeight: '600px', height: 'calc(100vh - 200px)' }}
        title={`Preview of ${filename}`}
        sandbox="allow-same-origin"
      />
    </div>
  )
}
```

### 步骤 2: 添加 DOCX 文件检测函数

```typescript
function isDocxFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.docx')
}
```

### 步骤 3: 修改文件渲染逻辑

找到文件内容渲染的地方（通常在 activeFile 使用的位置），添加 DOCX 检测：

```typescript
// 示例：在文件显示组件中
{activeFile && (
  isDocxFile(activeFile.filename) ? (
    <DocxPreview gistId={detail.id} filename={activeFile.filename} />
  ) : (
    // 现有的代码高亮逻辑
    <CodeBlock file={activeFile} />
  )
)}
```

### 步骤 4: 更新文件图标（可选）

在文件列表中，为 DOCX 文件添加特殊图标：

```typescript
function getFileIcon(filename: string) {
  if (filename.endsWith('.docx')) {
    return <FileTextIcon className="w-4 h-4" />
  }
  // 其他文件类型图标...
}
```

## 部署步骤

### 1. 安装依赖

```bash
cd C:/Users/liu/AppData/Local/Temp/edgegist
bun install
```

### 2. 创建 R2 Bucket

```bash
wrangler r2 bucket create edgegist-files
```

### 3. 运行数据库迁移

```bash
# 本地测试
wrangler d1 migrations apply edge-gist --local

# 生产环境
wrangler d1 migrations apply edge-gist --remote
```

### 4. 更新 wrangler.toml

复制 `wrangler.example.jsonc` 为 `wrangler.toml` 并填写：
- D1 database_id
- R2 bucket 配置
- 其他环境变量

### 5. 构建项目

```bash
bun run build
```

### 6. 部署

```bash
wrangler deploy
```

## 测试

### 手动测试清单

- [ ] 上传小文本文件（< 100KB）→ 应存储在 D1
- [ ] 上传大文本文件（> 100KB）→ 应存储在 R2
- [ ] 上传 DOCX 文件 → 应存储在 R2
- [ ] 访问 DOCX 预览 URL → 应显示 HTML 渲染
- [ ] 下载原始 DOCX 文件 → 应可正常打开
- [ ] 删除包含 R2 文件的 gist → 验证 R2 对象被清理
- [ ] 更新文件 → 验证旧 R2 对象被清理

## 问题排查

### R2 未配置

**错误**: `R2 bucket not configured`

**解决**: 确保 `wrangler.toml` 中有 R2 bucket 绑定

### DOCX 转换失败

**错误**: `Failed to generate preview`

**解决**: 
1. 检查文件是否真的是 DOCX 格式
2. 检查文件大小（mammoth.js 可能无法处理超大文件）
3. 查看 Workers 日志获取详细错误

### 文件内容为空

**问题**: 从 R2 读取的内容为空

**原因**: 可能是存储时编码问题

**解决**: 检查 StorageManager 的 store/retrieve 方法

## 架构说明

### 混合存储策略

```
文件上传 → StorageManager.shouldUseR2()
           ├─ 小文本文件（< 100KB）→ D1（content 列）
           └─ 大文件/二进制文件 → R2（storage_type='r2'）
```

### DOCX 预览流程

```
用户点击预览
  ↓
前端请求 /gists/:id/files/:filename/preview
  ↓
后端从 R2 检索 DOCX 原始文件
  ↓
mammoth.js 转换为 HTML
  ↓
返回完整的 HTML 页面（带样式）
  ↓
前端在 iframe 中显示
```

## 性能优化建议

1. **缓存 DOCX 转换结果**: 将转换后的 HTML 也存到 R2，避免重复转换
2. **懒加载预览**: 只在用户点击"预览"按钮时才加载
3. **限制文件大小**: 对超大 DOCX（> 10MB）显示警告或拒绝预览
4. **Worker 超时保护**: 设置转换超时（10 秒）

## 扩展功能

基于当前架构，可以轻松添加：

1. **PDF 预览**: 使用 `pdf-lib` 或 `pdf.js`
2. **图片预览**: 直接从 R2 返回图片 URL
3. **Excel 预览**: 使用 `xlsx` 库
4. **Markdown 渲染**: 使用 `marked` 库
5. **代码高亮**: 现有的 Shiki 集成

## 注意事项

1. **DOCX 文件必须存储在 R2**: 二进制文件自动走 R2，无需额外配置
2. **向后兼容**: 现有 D1 中的文件无需迁移，会自动识别为 `storage_type='inline'`
3. **R2 最终一致性**: 上传后立即读取可能失败，已在 StorageManager 中处理
4. **事务安全**: R2 操作先于 D1，失败时会回滚

## 贡献

欢迎提交 PR 来完善此功能！

主要改进方向：
- 前端 UI 完善
- 更多文档格式支持
- 性能优化
- 测试覆盖

---

**实施状态**: 后端完成 ✅ | 前端需手动集成 ⚠️
