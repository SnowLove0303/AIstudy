# AIstudy 系统说明

AIstudy 是一个基于 Electron、React、TypeScript 和 Vite 的 Windows 桌面学习系统，用于管理课程、思维导图、类 Word 知识点文档、复习笔记、流程图、AI 辅助编辑和信息搜集入口。

## 当前状态

- 当前版本：1.2.108
- 本地仓库：`F:\AIAPP\Xiangmu\AIstudy`
- 免安装包：`F:\AIAPP\Xiangmu\AIstudy\release\win-unpacked\AIstudy.exe`
- 格式重置备份包：`F:\AIAPP\Xiangmu\AIstudy\release-format-reset\win-unpacked\AIstudy.exe`
- Electron 用户数据：`C:\Users\52882\AppData\Roaming\aistudy`
- 本机数据目录：`C:\Users\52882\AppData\Roaming\aistudy\data`
- 主前端入口：`src/main.tsx`
- 主进程入口：`electron/main.ts`
- Preload 入口：`electron/preload.ts`
- 版本记录：`src/updateLog.ts`

## 功能总览

- 工作台：展示学习概览、今日学习、最近完成和 AI 助教入口。
- 课程中心：创建课程、设置分类、进入课程工作区。
- 课程工作区：包含知识点、知识笔记、思维导图三种模式。
- 知识点文档：嵌入 `@hufe921/canvas-editor` 类 Word 编辑内核，支持横向连续页、字体、字号、颜色、背景色、列表、表格、分页、打印、标题/正文、字间距、段间距、格式刷、上下知识点切换和 Ctrl+滚轮缩放。
- 兼容知识点：保留旧 HTML 富文本编辑器和流程图能力，用于兼容历史内容。
- 目录：由思维导图生成，支持层级折叠，人工折叠状态随课程保存。
- 思维导图：基于 `mind-elixir`，支持布局、节点、关系线、概要、标签、备注、格式刷、缩放、拖动和分支导图。
- 知识笔记：按导图叶子分支生成复习笔记。
- AI 聊天：知识点页面右下角的吉祥物按钮打开聊天窗口，支持 Claude 与 Mimo。
- MCP 页面：展示 Notion 导入、课程数据、MySQL 与备份状态。
- 信息搜集：新增侧边栏入口，包含端口管理和 AI日报两个顶部板块。
- 端口管理：为 Bilibili 与知乎打开独立 Chrome 登录窗口并检测固定 CDP 端口。
- AI日报：已有独立入口和 PowerShell 工作流脚本，页面入口暂为空白承载区。
- 更新管理：读取 `src/updateLog.ts`，当前最新记录为 1.2.108。

## 信息搜集

入口：侧边栏 `信息搜集`。

### 端口管理

端口管理由 Electron 主进程检测并打开 Chrome 登录窗口：

- Bilibili：`127.0.0.1:9222`
- 知乎：`127.0.0.1:9223`
- Chrome 优先路径：`E:\MorenAnzhuangLujing\Chrome\Chrome\Application\chrome.exe`
- 运行根目录优先：`E:\MorenAnzhuangLujing\Huangjingdajian\ChromeDidy`
- 备用运行根目录：`C:\Users\52882\AppData\Roaming\aistudy\ChromeDidy`
- Profile 目录：`chrome-profiles\aistudy-<platform>-<port>`

主进程会通过 CDP 查询：

- `/json/version`
- `/json`
- `/json/new?<loginUrl>`

### AI日报

AI日报页面入口已存在，当前为后续接入保留空白页。配套脚本：

```text
scripts\ai-daily-workflow.ps1
```

默认输出目录：

```text
E:\MorenAnzhuangLujing\Huangjingdajian\aistudy-ai-daily
```

脚本能力：

- 读取 Bilibili BV 或搜索关键词。
- 调用 `bilibili-all-in-one` 技能工作流下载和转录。
- 按句子拆分转录内容。
- 生成 Markdown、HTML 和 manifest。
- 输出 AI 日报结构化材料。

## 知识点文档

当前知识点主编辑能力已经升级为 Canvas Editor：

- 文档结构保存到 `knowledgeDocuments`。
- 兼容 HTML 保存到 `knowledgePoints`。
- 文档版本：`canvasKnowledgeDocumentVersion = 2`。
- 默认字距：`0`。
- 默认段距：`1.2`。
- 横向连续页，正文更像文档而不是幻灯片。
- 支持把当前思维导图分支插入到知识点文档。
- 支持隐藏父级知识点页，只在叶子或有内容节点间切换。
- 支持上一知识点、下一知识点导航。
- 支持格式调试日志。

相关文件：

```text
src\main.tsx
src\styles.css
tools\canvas-format-cdp-test.mjs
tools\knowledge-format-probe.html
```

## AI 聊天

AIstudy 的知识点聊天窗口面向当前课程和当前知识点工作：

- 从哪门课程进入聊天，就绑定哪门课程上下文。
- Claude 通道通过 The Muti Agent 的任务投递与任务追踪接口执行。
- Claude 写回时只允许更新当前课程的当前知识点。
- Mimo 普通问答走轻量请求，不附带知识点 HTML。
- Mimo 明确编辑知识点时才走重写请求并允许返回 `knowledgeHtml`。
- 聊天窗口不显示流式输出，只在任务完成后展示结果。
- “系统信息”按钮当前只发送 README 正文和简短当前课程/知识点边界。

Claude 任务桥接：

```text
http://127.0.0.1:18765
F:\AIAPP\Xiangmu\The Muti Agent\exe\The Muti Agent.exe
```

Mimo 配置：

```text
C:\Users\52882\AppData\Roaming\aistudy\data\mimo.json
```

## 数据存储

AIstudy 当前使用 JSON 与 MySQL 双路径：

- JSON 数据库：`C:\Users\52882\AppData\Roaming\aistudy\data\courses.json`
- MySQL 配置：`C:\Users\52882\AppData\Roaming\aistudy\data\mysql.json`
- Mimo 配置：`C:\Users\52882\AppData\Roaming\aistudy\data\mimo.json`
- Claude 课程会话绑定：`C:\Users\52882\AppData\Roaming\aistudy\data\claude-course-sessions.json`
- Claude 每课工作区：`C:\Users\52882\AppData\Roaming\aistudy\data\claude-course-sessions`
- 知识点格式调试日志：`C:\Users\52882\AppData\Roaming\aistudy\data\knowledge-format-debug.log`
- Notion 导入前备份：`courses.json.before-notion-import-*`

课程数据结构重点字段：

- `id`：课程 ID。
- `title`：课程标题。
- `category`：课程分类。
- `mindMap`：主思维导图。
- `knowledgePoints`：兼容 HTML 知识点内容，按节点 ID 存储。
- `knowledgeDocuments`：Canvas Editor 文档结构，按节点 ID 存储。
- `branchMindMaps`：分支导图。
- `notes`：知识笔记。
- `collapsedOutlineIds`：目录人工折叠状态。
- `hideParentKnowledgePages`：是否隐藏父级知识点页。

## MCP 与 Notion 导入

Notion 导入流程受以下文件约束：

```text
docs\mcp-notion-knowledge-import.md
mcp\aistudy-notion-knowledge-import.contract.json
```

写入课程知识点时必须满足：

- 来源可读。
- 课程精确匹配。
- 节点 ID 精确匹配。
- 写入前有备份。
- HTML 内容安全。
- 写入后可验证。

## Electron IPC

`window.aistudy` 当前暴露：

- `courses.load()`
- `courses.save(courses)`
- `courses.storageStatus()`
- `mcp.notionImportStatus()`
- `debug.appendKnowledgeFormatLog(entry)`
- `debug.knowledgeFormatLogPath()`
- `ai.chat(payload)`
- `ai.systemContext()`
- `ports.status()`
- `ports.openLoginWindow(platformId)`

主进程对应 handler：

- `courses:load`
- `courses:save`
- `courses:storage-status`
- `mcp:notion-import-status`
- `debug:knowledge-format-log`
- `debug:knowledge-format-log-path`
- `ai:chat`
- `ai:system-context`
- `ports:status`
- `ports:open-login-window`

## 项目结构

```text
AIstudy/
├── electron/
│   ├── main.ts
│   └── preload.ts
├── src/
│   ├── main.tsx
│   ├── styles.css
│   ├── updateLog.ts
│   └── vite-env.d.ts
├── docs/
│   └── mcp-notion-knowledge-import.md
├── mcp/
│   └── aistudy-notion-knowledge-import.contract.json
├── scripts/
│   └── ai-daily-workflow.ps1
├── tools/
│   ├── canvas-format-cdp-test.mjs
│   └── knowledge-format-probe.html
├── assets/
├── public/
├── dist/
├── dist-electron/
├── release/
├── release-format-reset/
├── package.json
├── README.md
└── PROJECT_INDEX.md
```

## 技术栈

- Electron 39
- React 19
- TypeScript 5
- Vite 7
- `@hufe921/canvas-editor`
- `mind-elixir`
- `lucide-react`
- `mysql2`
- `electron-builder`

## 开发命令

```bash
npm install
npm run dev
npm run lint
npm run build
npm run pack
npm run dist
```

## 打包流程

常规打包：

```bash
npm run pack
```

输出：

```text
release\win-unpacked\AIstudy.exe
```

如果打包报 `EBUSY: resource busy or locked, rmdir release\win-unpacked`，通常是旧版 AIstudy 正在运行。只结束以下路径的旧进程后再打包：

```text
F:\AIAPP\Xiangmu\AIstudy\release\win-unpacked\AIstudy.exe
```

## 验证流程

代码变更后优先执行：

```bash
npm run lint
npm run build
```

需要交付 exe 时再执行：

```bash
npm run pack
```

前端界面改动需要检查：

- 工作台中文显示正常。
- 课程中心创建课程正常。
- 课程工作区目录、知识点、知识笔记、思维导图可切换。
- Canvas 知识点排版工具对选区生效。
- AI 聊天窗口能打开、发送、完成后返回结果。
- 信息搜集端口管理能刷新并打开 Bilibili/知乎登录窗口。
- 更新管理能看到最新版本记录。

## 关键文件说明

- `electron/main.ts`：课程数据、MySQL、Mimo、Claude、端口管理、调试日志、MCP 与系统上下文。
- `electron/preload.ts`：暴露 `window.aistudy` API。
- `src/main.tsx`：主界面、课程工作区、Canvas 知识点编辑器、旧知识点编辑器、聊天窗口、信息搜集、目录和思维导图。
- `src/styles.css`：全部界面样式。
- `src/updateLog.ts`：用户可见版本日志，新增功能必须写入。
- `scripts/ai-daily-workflow.ps1`：AI日报生成工作流。
- `tools/canvas-format-cdp-test.mjs`：Canvas 知识点排版 CDP 自动验证脚本。
- `tools/knowledge-format-probe.html`：旧富文本排版验证页。

## 维护规则

- 每次用户可见更新都要在 `src/updateLog.ts` 新增版本记录。
- 更新日志保持 newest first。
- 每条版本记录都包含 `featureUpdates`、`fixes`、`optimizations`。
- UI 文案保持短标签、短状态、短空态。
- 不要回滚用户已有修改。
- 修改后做真实校验，不要编造测试结果。

## 常见排障

### 聊天任务一直转圈

检查：

- The Muti Agent 是否运行。
- `http://127.0.0.1:18765/api/health` 是否可访问。
- `/api/claude/tasks/:taskId` 是否已完成。
- Electron 主进程是否能读取任务结果日志。

### Mimo 响应慢

普通问答应走轻量请求路径，不应附带知识点 HTML。只有明确编辑、改写、更新当前知识点时才走重写请求。

### 中文出现乱码

优先检查：

- `src/main.tsx`
- `electron/main.ts`
- `src/updateLog.ts`
- 本机 `courses.json`

固定文案乱码一般在源码中，课程内容乱码一般在 `courses.json` 或 MySQL 数据中。

### 课程数据不一致

检查：

- `courses.json`
- `mysql.json`
- MySQL 是否连接成功。
- `courses.json.before-notion-import-*` 是否有最近备份。

### 端口管理不可用

检查：

- Chrome 是否存在于默认路径。
- 9222/9223 是否被占用。
- CDP 地址 `/json/version` 是否可访问。
- Profile 目录是否能创建。

## 给 AI 助手的最小上下文

当 AIstudy 聊天窗口需要把系统情况发给 Claude 或 Mimo 时，优先发送：

- 本 README。
- 当前课程 ID、课程标题。
- 当前知识点 ID、知识点标题。
- 当前操作边界：只处理当前课程当前知识点。
