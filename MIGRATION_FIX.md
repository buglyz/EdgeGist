# 迁移修复说明

## 问题描述

在 GitHub Actions CI/CD 流程中，数据库迁移失败：

```
✘ [ERROR] Migration 0003_add_r2_cleanup_queue.sql failed with the following errors:
✘ [ERROR] near "INDEX": syntax error at offset 257: SQLITE_ERROR [code: 7500]
```

## 根本原因

SQLite 不支持在 `CREATE TABLE` 语句内部定义索引。

**错误语法** (MySQL/PostgreSQL 风格):
```sql
CREATE TABLE my_table (
  id TEXT PRIMARY KEY,
  name TEXT,
  INDEX idx_name (name)  -- ❌ SQLite 不支持
);
```

**正确语法** (SQLite):
```sql
CREATE TABLE my_table (
  id TEXT PRIMARY KEY,
  name TEXT
);

CREATE INDEX idx_name ON my_table(name);  -- ✅ 分开创建
```

## 修复内容

### migration 0003_add_r2_cleanup_queue.sql

**修复前**:
```sql
CREATE TABLE IF NOT EXISTS r2_cleanup_queue (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL,
  gist_id TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TEXT,
  INDEX idx_r2_cleanup_created (created_at),     -- ❌ 错误
  INDEX idx_r2_cleanup_gist (gist_id)            -- ❌ 错误
);
```

**修复后**:
```sql
CREATE TABLE IF NOT EXISTS r2_cleanup_queue (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL,
  gist_id TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TEXT
);

-- 索引分开创建
CREATE INDEX IF NOT EXISTS idx_r2_cleanup_created ON r2_cleanup_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_r2_cleanup_gist ON r2_cleanup_queue(gist_id);
```

### migration 0004_add_tags_and_metadata.sql

✅ **无需修复** - 此迁移文件从一开始就使用了正确的语法，索引在表外定义。

## 验证

### 本地测试
```bash
cd C:/Users/liu/AppData/Local/Temp/edgegist
bun run db:migrate:local
```

### 远程部署
```bash
wrangler d1 migrations apply edge-gist --remote
```

## Git 提交

```
c8d3f43 - fix: Correct SQLite syntax in migration 0003
```

## 影响范围

- ✅ 仅影响迁移文件
- ✅ 不影响运行时代码
- ✅ 不破坏现有数据
- ✅ 向后兼容

## 未来预防措施

### SQLite 迁移最佳实践

1. **索引始终分开创建**
```sql
-- 先创建表
CREATE TABLE ...;

-- 再创建索引
CREATE INDEX ...;
```

2. **使用 IF NOT EXISTS**
```sql
CREATE TABLE IF NOT EXISTS ...;
CREATE INDEX IF NOT EXISTS ...;
```

3. **外键约束放在列定义中**
```sql
CREATE TABLE child (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  FOREIGN KEY (parent_id) REFERENCES parent(id) ON DELETE CASCADE
);
```

4. **唯一约束可以内联或作为表约束**
```sql
-- 方式1: 内联
CREATE TABLE t (id TEXT PRIMARY KEY UNIQUE);

-- 方式2: 表约束
CREATE TABLE t (
  id TEXT PRIMARY KEY,
  UNIQUE(id)
);
```

## 相关文档

- [SQLite CREATE TABLE](https://www.sqlite.org/lang_createtable.html)
- [SQLite CREATE INDEX](https://www.sqlite.org/lang_createindex.html)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)

## 测试清单

- [x] 本地迁移测试
- [x] 语法验证
- [x] Git 提交推送
- [ ] CI/CD 流程验证（等待 GitHub Actions）
- [ ] 生产环境部署测试

## 预期结果

修复后，GitHub Actions 应该能成功执行：
```
✅ Migration 0003_add_r2_cleanup_queue.sql - success
✅ Migration 0004_add_tags_and_metadata.sql - success
```

---

**状态**: ✅ 修复完成并推送到 main 分支
