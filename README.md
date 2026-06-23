# EdgeGist

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/icons/edgegist-dark-192.png">
    <img src="public/icons/edgegist-192.png" alt="EdgeGist app icon" width="96" height="96">
  </picture>
</p>

[简体中文](README.zh-CN.md)

**EdgeGist** 是运行在 Cloudflare Workers 上的 GitHub Gist 兼容 API 服务，支持论文写作和代码版本控制。

## ✨ 核心特性

- 🔗 **GitHub Gist 兼容** - 支持现有 Gist 客户端和工具
- 📄 **学术写作优化** - Markdown/LaTeX 预览，字数统计，标签管理
- 💾 **混合存储** - 小文件存 D1，大文件/二进制文件存 R2
- 📝 **DOCX 预览** - 服务端转换 Word 文档为 HTML
- 🏷️ **标签系统** - 灵活分类和搜索
- 📊 **智能统计** - 字数、行数、语言检测（支持中英文）
- ⚡ **边缘计算** - 低延迟，全球部署

## 🚀 快速部署

### 前置要求

- Bun 或 Node.js 22+
- Cloudflare 账号
- Wrangler CLI

### 1. 克隆仓库

```bash
git clone https://github.com/buglyz/EdgeGist.git
cd EdgeGist
bun install
```

### 2. 创建 D1 数据库

```bash
wrangler d1 create edge-gist
```

记录返回的 `database_id`。

### 3. 创建 R2 存储桶（推荐）

```bash
wrangler r2 bucket create edgegist-files
```

R2 用于存储大文件和二进制文件（如 DOCX），**强烈推荐配置**。

### 4. 配置 wrangler.jsonc

复制示例配置：

```bash
cp wrangler.example.jsonc wrangler.jsonc
```

编辑 `wrangler.jsonc`：

```jsonc
{
  "name": "edge-gist",
  "compatibility_date": "2024-01-01",
  "main": "./dist/_worker.js",
  
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS"
  },
  
  "vars": {
    "EDGEGIST_OWNER_USERNAME": "your-username",
    "EDGEGIST_OWNER_PASSWORD": "your-password",
    "EDGEGIST_OWNER_TOKEN": "your-secret-token",
    "EDGEGIST_BASE_URL": "https://your-worker.workers.dev",
    "EDGEGIST_HISTORY_MAX_VERSIONS": "100",
    "EDGEGIST_STORAGE_THRESHOLD_KB": "100"
  },
  
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "edge-gist",
      "database_id": "your-database-uuid-here"
    }
  ],
  
  "r2_buckets": [
    {
      "binding": "R2_BUCKET",
      "bucket_name": "edgegist-files"
    }
  ]
}
```

**重要配置说明**：

| 配置项 | 必填 | 说明 |
|--------|------|------|
| `EDGEGIST_OWNER_USERNAME` | ✅ | 管理员用户名 |
| `EDGEGIST_OWNER_PASSWORD` | ✅ | 管理员密码 |
| `EDGEGIST_OWNER_TOKEN` | ✅ | API 访问令牌 |
| `EDGEGIST_BASE_URL` | ✅ | 公开访问 URL |
| `EDGEGIST_STORAGE_THRESHOLD_KB` | ⚠️ | 文件大小阈值（KB），超过存 R2 |
| `d1_databases[0].database_id` | ✅ | D1 数据库 UUID |
| `r2_buckets[0].bucket_name` | ⚠️ | R2 存储桶名称（强烈推荐） |

### 5. 运行数据库迁移

```bash
wrangler d1 migrations apply edge-gist --remote
```

### 6. 构建和部署

```bash
bun run build
wrangler deploy
```

### 7. 访问应用

```
https://your-worker.workers.dev/<owner-username>
```

## 📋 R2 存储配置详解

### 为什么需要 R2？

- ✅ 存储大文件（>100KB）
- ✅ 存储二进制文件（DOCX、PDF、图片等）
- ✅ 突破 D1 的 500MB/10GB 限制
- ✅ 自动清理机制

### 不配置 R2 的影响

- ❌ 无法上传 DOCX 文件
- ❌ 无法预览 Word 文档
- ❌ 大文件会被拒绝
- ❌ D1 存储很快用完

### R2 绑定步骤

**方法 1: wrangler.jsonc 配置（推荐）**

```jsonc
{
  "r2_buckets": [
    {
      "binding": "R2_BUCKET",        // 固定值，不要改
      "bucket_name": "edgegist-files" // 你的 R2 桶名
    }
  ]
}
```

**方法 2: Cloudflare Dashboard**

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 选择你的 Worker (`edge-gist`)
4. 点击 **Settings** → **Variables**
5. 滚动到 **R2 Bucket Bindings**
6. 点击 **Add binding**
7. 填写：
   - Variable name: `R2_BUCKET`
   - R2 bucket: `edgegist-files`
8. 点击 **Save**

### R2 费用说明

Cloudflare R2 定价（截至 2024）：

- **存储**: $0.015/GB/月
- **A 类操作**（写入）: $4.50/百万次
- **B 类操作**（读取）: $0.36/百万次
- **出站流量**: **免费** 🎉

**个人使用估算**：
- 1GB 文件 + 1000 次读写/月 ≈ $0.02/月
- 10GB 文件 + 10000 次读写/月 ≈ $0.20/月

## 🔧 本地开发

```bash
# 安装依赖
bun install

# 准备本地环境
bun run dev:prepare

# 启动开发服务器
bun run dev
```

访问 `http://127.0.0.1:8787/<owner-username>`

## 📚 使用文档

### API 使用

EdgeGist 兼容 GitHub Gist API，将客户端 base URL 改为你的 Worker 地址即可：

```bash
# 列出 gists
curl https://your-worker.workers.dev/gists

# 创建 gist
curl -X POST https://your-worker.workers.dev/gists \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"files":{"hello.txt":{"content":"Hello World"}}}'

# 标签管理
curl -X PUT https://your-worker.workers.dev/gists/{id}/tags \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"tags":["论文","机器学习"]}'
```

### Web UI

访问 `https://your-worker.workers.dev/<owner-username>` 使用图形界面：

- 📝 创建和编辑 gists
- 👁️ Markdown/LaTeX 实时预览
- 🏷️ 标签管理
- 📊 统计信息
- 📄 DOCX 文档预览
- 📜 版本历史

## 🎓 学术写作功能

### Markdown + LaTeX 预览

支持数学公式：
- 行内公式：`$E = mc^2$`
- 块级公式：`$$\int_0^\infty e^{-x} dx$$`

### 智能统计

- **字数统计**：中文按字符，英文按单词
- **行数统计**：代码行数
- **语言检测**：自动识别 40+ 编程语言
- **分类推断**：论文/代码/文档/数据

### 标签系统

```bash
# 添加标签
PUT /gists/{id}/tags
{"tags": ["论文", "机器学习", "CVPR2024"]}

# 搜索标签
GET /tags/论文/gists
```

## 🛠️ 高级配置

### 自定义域名

在 `wrangler.jsonc` 添加：

```jsonc
{
  "routes": [
    { "pattern": "gist.yourdomain.com", "custom_domain": true }
  ]
}
```

或在 Cloudflare Dashboard 手动添加。

### Cloudflare Turnstile（可选）

防止滥用登录：

```jsonc
{
  "vars": {
    "EDGEGIST_TURNSTILE_SITE_KEY": "your-site-key",
    "EDGEGIST_TURNSTILE_SECRET_KEY": "your-secret-key"
  }
}
```

### Cron Worker（R2 清理，可选）

```jsonc
{
  "triggers": {
    "crons": ["0 2 * * *"]  // 每天凌晨 2 点
  }
}
```

## 📖 完整文档

项目根目录包含详细文档：

- **WEBUI_REDESIGN_PLAN.md** - UI 设计方案
- **WEBUI_IMPLEMENTATION_GUIDE.md** - 前端实施指南
- **CODE_REVIEW_REPORT.md** - 代码审查报告
- **PERFORMANCE_OPTIMIZATION.md** - 性能优化建议
- **MIGRATION_FIX.md** - 数据库迁移说明

## 🤝 社区

- 👥 Telegram 群组：[折腾啥](https://t.me/zhetengsha_group)
- 📢 Telegram 频道：[折腾啥](https://t.me/zhetengsha)
- 🐛 问题反馈：[GitHub Issues](https://github.com/buglyz/EdgeGist/issues)

## 📄 许可证

MIT License

## 🙏 致谢

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [marked.js](https://marked.js.org/)
- [KaTeX](https://katex.org/)
- [mammoth.js](https://github.com/mwilliamson/mammoth.js)
