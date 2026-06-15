# MySQL 课程管理表

## 目标

课程管理功能使用 MySQL 作为正式数据源，课程的新增、选择、搜索、重命名、删除都以专用课程表为准。前端继续通过 Electron preload 暴露的 `aistudyCourses.load/save` 调用，不直接连接数据库。

## 连接配置

主进程按以下优先级读取连接配置：

1. 环境变量。
2. `mysql.config.json`，可放在应用可执行文件同级目录。
3. `mysql.config.json`，可放在 Electron `userData` 目录。
4. 默认值。

支持的配置项：

| 字段 | 环境变量 | 默认值 |
| --- | --- | --- |
| `host` | `AISTUDY_MYSQL_HOST` | `127.0.0.1` |
| `port` | `AISTUDY_MYSQL_PORT` | `3306` |
| `user` | `AISTUDY_MYSQL_USER` | `root` |
| `password` | `AISTUDY_MYSQL_PASSWORD` | 空字符串 |
| `database` | `AISTUDY_MYSQL_DATABASE` | `aistudy` |
| `courseTable` | `AISTUDY_MYSQL_COURSE_TABLE` | `course_management_courses` |
| `mindMapTable` | `AISTUDY_MYSQL_MIND_MAP_TABLE` | `mind_maps` |
| `mindMapSnapshotTable` | `AISTUDY_MYSQL_MIND_MAP_SNAPSHOT_TABLE` | `mind_map_snapshots` |
| `mindMapNodeTable` | `AISTUDY_MYSQL_MIND_MAP_NODE_TABLE` | `mind_map_nodes` |
| `knowledgeDocumentTable` | `AISTUDY_MYSQL_KNOWLEDGE_DOCUMENT_TABLE` | `knowledge_documents` |
| `knowledgeDocumentSnapshotTable` | `AISTUDY_MYSQL_KNOWLEDGE_DOCUMENT_SNAPSHOT_TABLE` | `knowledge_document_snapshots` |

`mysql.config.json` 示例：

```json
{
  "host": "127.0.0.1",
  "port": 3306,
  "user": "root",
  "password": "",
  "database": "aistudy",
  "courseTable": "course_management_courses",
  "mindMapTable": "mind_maps",
  "mindMapSnapshotTable": "mind_map_snapshots",
  "mindMapNodeTable": "mind_map_nodes",
  "knowledgeDocumentTable": "knowledge_documents",
  "knowledgeDocumentSnapshotTable": "knowledge_document_snapshots"
}
```

## 建表规则

应用首次读取或保存课程时，会尝试创建数据库和课程表。若数据库已存在但当前账号无建库权限，应用会继续使用已配置数据库并尝试建表。

```sql
CREATE TABLE IF NOT EXISTS `course_management_courses` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_updated_at` (`updated_at`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 写入策略

- Electron 主进程负责所有 MySQL 操作，渲染层不持有数据库凭据。
- `courses:load` 从课程表读取全部课程，按 `updated_at` 倒序返回。
- `courses:save` 使用事务整体同步课程列表，保留当前前端的保存接口。
- 删除课程会从课程表移除对应行；后续接入节点、边、文档后，需要扩展联动删除。

## UI 约束

- 不在界面展示数据库名、表名、文件路径、环境变量、调试说明。
- 连接失败时只显示面向用户的业务失败提示，技术细节留在主进程日志和开发文档。
- 不再把 `userData`、`localStorage`、测试说明、接入说明放到产品界面。
