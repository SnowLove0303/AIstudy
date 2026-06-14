# AIstudy 项目索引

## 当前约束

- 项目根目录：`F:\AIAPP\Xiangmu\AIstudy`
- 唯一发布目录：`release`
- 唯一运行入口：`release\win-unpacked\AIstudy.exe`
- 旧 `release-*` 旁路目录已清理，不再作为测试或交付入口。
- 旧代码锁和 Claude 内容沙箱已移除，不再作为系统保护层。

## 核心入口

```text
electron/main.ts      Electron 主进程、IPC、数据读写、AI/端口桥接
electron/preload.ts   window.aistudy API 暴露
src/main.tsx          React 主界面和业务状态
src/domain/types.ts   课程、知识点文档、目录和笔记共享类型
src/domain/course.ts  课程创建与课程数据规范化
src/domain/mindMap.ts 导图目录、分支导图、笔记派生和分支 HTML
src/domain/html.ts    共享 HTML 转义
src/styles.css        全局样式
src/updateLog.ts      用户可见版本记录
tools/course-library-logic-check.mjs 课程库核心逻辑检查
docs/course-library-core-logic.md     课程库核心逻辑基准
docs/system-feature-relations.md  功能关系和变更守则
```

## 共享业务边界

课程库和开发平台共用底层工作区代码：

- 列表页：创建、分类、继续进入。
- 工作区：知识点、知识笔记、思维导图。
- 目录：从 Mind Elixir 数据生成，人工折叠状态按库保存。
- 编辑器：Canvas Editor 和兼容 HTML 内容共存。
- 导图：主导图、分支导图和目录定位共用同一套工具函数。

区分方式只应是库类型和数据源：

```text
课程库      courses.json
开发平台    developer-documents.json
```

## 本机数据

```text
C:\Users\52882\AppData\Roaming\aistudy\data\courses.json
C:\Users\52882\AppData\Roaming\aistudy\data\developer-documents.json
C:\Users\52882\AppData\Roaming\aistudy\data\mysql.json
C:\Users\52882\AppData\Roaming\aistudy\data\mimo.json
C:\Users\52882\AppData\Roaming\aistudy\data\claude-course-sessions.json
```

## 常用命令

```bash
npm run dev
npm run lint
npm run check:course-logic
npm run check:system
npm run build
npm run pack
npm run dist
```

`npm run pack` 固定输出到：

```text
release\win-unpacked\AIstudy.exe
```

`npm run dist` 生成自动更新所需的 NSIS 安装包、`latest.yml` 和 blockmap。推送 `v*` 标签后，`.github/workflows/release.yml` 会在 GitHub Releases 发布这些文件。

不要再创建 `release-fixed`、`release-local-electron`、`release-mindmap-*`、`release-chatgpt-*` 等旁路目录。

## 发布流程

1. 结束正在运行的 `release\win-unpacked\AIstudy.exe`。
2. 执行 `npm run check:system`。
3. 执行 `npm run lint`。
4. 执行 `npm run pack`。
5. 从 `release\win-unpacked\AIstudy.exe` 启动验证。
6. 正式发版时打标签并推送，例如 `git tag v1.2.162 && git push origin v1.2.162`。
7. 确认 GitHub Releases 生成安装包和 `latest.yml`。
8. 确认 `src/updateLog.ts` 最新版本可在更新管理中看到。

自动更新源必须对 B 设备匿名可见。若源码仓库是私有仓库，正式安装包应发布到公开 Release 仓库，再把 `package.json` 的 `build.publish.repo` 改为该公开仓库。

## 功能关系文档

系统功能关系以 `docs/system-feature-relations.md` 为准。新增或修改功能前先确认：

- 变更属于哪个模块。
- 写入的是哪个 collection、哪个节点或哪个本机配置。
- 是否同时影响课程库和开发平台。
- 是否同时影响知识点、知识笔记和思维导图。
- 是否涉及 AI 写回、端口登录态或 MySQL/JSON 双写。

## 关键验证点

- 创建课程和创建开发需求都能进入各自工作区。
- 新建库默认有根节点和开篇节点，知识点、知识笔记、思维导图均不空白。
- 思维导图目录点击父级和叶子节点都能打开对应分支。
- 主导图默认缩放保持可读，不把整图压到过小。
- 知识点格式修改不会改变当前滚动位置。
- AI 聊天只显示真实回复，不混入推荐问题和输入框内容。
