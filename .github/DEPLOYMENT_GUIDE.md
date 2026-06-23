# GitHub Actions 部署配置指南

本文档说明如何配置 GitHub Secrets 以实现自动部署。

## 必需的 Secrets

在你的 GitHub 仓库中配置以下 Secrets：

**Settings → Secrets and variables → Actions → New repository secret**

### 1. Cloudflare 认证

| Secret 名称 | 说明 | 如何获取 |
|------------|------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | [创建 Token](https://dash.cloudflare.com/profile/api-tokens) |

**API Token 权限要求**:
- Account: Cloudflare Workers Scripts (Edit)
- Account: D1 (Edit)
- Account: R2 (Edit) *(如果使用 R2)*

### 2. EdgeGist 配置

| Secret 名称 | 示例值 | 说明 |
|------------|--------|------|
| `OWNER_USERNAME` | `admin` | 管理员用户名 |
| `OWNER_PASSWORD` | `your-secure-password` | 管理员密码 |
| `OWNER_TOKEN` | `your-secret-token-here` | API 访问令牌 |
| `BASE_URL` | `https://gist.yourdomain.workers.dev` | Worker 公开访问 URL |
| `D1_DATABASE_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | D1 数据库 UUID |

### 3. R2 存储（可选但推荐）

| Secret 名称 | 示例值 | 说明 |
|------------|--------|------|
| `R2_BUCKET_NAME` | `edgegist-files` | R2 存储桶名称 |

**如果不配置 `R2_BUCKET_NAME`**：
- ❌ 无法上传大文件
- ❌ 无法预览 DOCX
- ❌ 仅限小文本文件

**配置后的优势**：
- ✅ 支持大文件存储
- ✅ DOCX 文档预览
- ✅ 二进制文件支持
- ✅ 突破 D1 存储限制

## 配置步骤

### Step 1: 创建 Cloudflare API Token

1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击 **Create Token**
3. 选择 **Create Custom Token**
4. 配置权限：
   ```
   Account: Cloudflare Workers Scripts - Edit
   Account: D1 - Edit
   Account: R2 Storage - Edit (如果使用 R2)
   ```
5. 点击 **Continue to summary**
6. 点击 **Create Token**
7. **复制 Token** 并保存到 GitHub Secrets

### Step 2: 获取 D1 Database ID

```bash
# 列出所有 D1 数据库
wrangler d1 list

# 输出示例
┌──────────────────────────────────────┬───────────┬─────────┐
│ uuid                                 │ name      │ version │
├──────────────────────────────────────┼───────────┼─────────┤
│ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │ edge-gist │ ...     │
└──────────────────────────────────────┴───────────┴─────────┘

# 复制 uuid 列的值
```

### Step 3: 创建 R2 存储桶（推荐）

```bash
# 创建 R2 存储桶
wrangler r2 bucket create edgegist-files

# 验证创建成功
wrangler r2 bucket list
```

### Step 4: 配置 GitHub Secrets

1. 进入你的 GitHub 仓库
2. 点击 **Settings**
3. 左侧菜单选择 **Secrets and variables** → **Actions**
4. 点击 **New repository secret**
5. 逐个添加以下 Secrets：

```
CLOUDFLARE_API_TOKEN = your-cloudflare-api-token
OWNER_USERNAME = admin
OWNER_PASSWORD = your-secure-password
OWNER_TOKEN = your-secret-token-here
BASE_URL = https://gist.yourdomain.workers.dev
D1_DATABASE_ID = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
R2_BUCKET_NAME = edgegist-files
```

### Step 5: 触发部署

**自动部署**（推荐）:
```bash
git add .
git commit -m "Configure deployment"
git push origin main
```

**手动触发**:
1. 进入 GitHub 仓库
2. 点击 **Actions** 标签
3. 选择 **Deploy** workflow
4. 点击 **Run workflow**

## 部署流程

GitHub Actions 会自动执行以下步骤：

1. ✅ 检出代码
2. ✅ 安装 Node.js 和 Bun
3. ✅ 安装依赖
4. ✅ 从 Secrets 生成 `wrangler.jsonc`
5. ✅ 如果配置了 `R2_BUCKET_NAME`，自动添加 R2 绑定
6. ✅ 构建项目
7. ✅ 应用数据库迁移
8. ✅ 部署到 Cloudflare Workers

## 验证部署

### 1. 检查 Actions 日志

在 GitHub Actions 页面查看部署日志：

```
✅ Generate wrangler.jsonc from Secrets
   Adding R2 bucket binding...  ← 如果看到这行，说明 R2 配置成功

✅ Build

✅ Apply D1 migrations
   Migration 0003_add_r2_cleanup_queue.sql - success
   Migration 0004_add_tags_and_metadata.sql - success

✅ Deploy to Cloudflare
   Published gist (xxx)
   https://gist.yourdomain.workers.dev
```

### 2. 测试访问

```bash
# 访问 Web UI
open https://gist.yourdomain.workers.dev/admin

# 测试 API
curl https://gist.yourdomain.workers.dev/gists

# 测试 R2（如果配置）
# 上传一个 .docx 文件，检查是否能预览
```

### 3. 验证 R2 绑定

在 Cloudflare Dashboard 检查：

1. 进入 **Workers & Pages**
2. 选择你的 Worker (`gist`)
3. 点击 **Settings** → **Variables**
4. 滚动到 **R2 Bucket Bindings**
5. 应该看到：
   ```
   R2_BUCKET → edgegist-files
   ```

## 常见问题

### Q: 部署失败，提示 API Token 无效

**A**: 检查 Token 权限是否包含：
- Workers Scripts: Edit
- D1: Edit
- R2: Edit (如果使用)

### Q: 数据库迁移失败

**A**: 检查 `D1_DATABASE_ID` 是否正确：
```bash
wrangler d1 list
```

### Q: R2 绑定没有生效

**A**: 确认：
1. `R2_BUCKET_NAME` Secret 已配置
2. R2 存储桶已创建（`wrangler r2 bucket list`）
3. API Token 有 R2 权限
4. 查看 Actions 日志是否显示 "Adding R2 bucket binding..."

### Q: 如何临时禁用 R2？

**A**: 删除 `R2_BUCKET_NAME` Secret 即可：
- Settings → Secrets → R2_BUCKET_NAME → Remove

### Q: 如何更新配置？

**A**: 更新对应的 Secret 值，然后重新触发部署：
- Actions → Deploy → Re-run jobs

## 安全建议

### 1. 使用强密码

```bash
# 生成安全的密码和 Token
openssl rand -base64 32
```

### 2. 定期轮换 Token

建议每 3-6 个月更新一次：
- Cloudflare API Token
- OWNER_TOKEN

### 3. 限制 API Token 权限

只授予必需的权限：
- ✅ Workers Scripts: Edit
- ✅ D1: Edit
- ✅ R2: Edit
- ❌ Account Settings: Read (不需要)

### 4. 使用环境特定的 Secrets

如果有多个环境（dev/staging/prod），使用 GitHub Environments 分离 Secrets。

## 本地开发 vs CI/CD

| 环境 | 配置文件 | 来源 |
|------|---------|------|
| **本地开发** | `wrangler.jsonc` | 手动编辑 |
| **CI/CD** | `wrangler.jsonc` | 从 Secrets 自动生成 |

**注意**：不要将本地的 `wrangler.jsonc` 提交到 Git！

`.gitignore` 已包含：
```gitignore
wrangler.jsonc
```

## 高级配置

### 自定义域名

在 Secrets 中设置 `BASE_URL` 为自定义域名：
```
BASE_URL = https://gist.yourdomain.com
```

然后在 Cloudflare Dashboard 添加自定义域名：
1. Workers & Pages → 你的 Worker
2. Settings → Domains & Routes
3. Add Custom Domain

### 多环境部署

使用 GitHub Environments 实现：

1. Settings → Environments → New environment
2. 创建 `production` 和 `staging` 环境
3. 为每个环境配置不同的 Secrets
4. 修改 workflow 使用环境变量

### 部署通知

添加部署成功/失败通知：

```yaml
- name: Notify on success
  if: success()
  run: |
    curl -X POST ${{ secrets.WEBHOOK_URL }} \
      -d "EdgeGist deployed successfully to ${{ secrets.BASE_URL }}"
```

## 参考资料

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [EdgeGist 完整文档](../README.md)

---

**配置完成后，每次推送到 main 分支都会自动部署！** 🚀
