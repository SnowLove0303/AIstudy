# AIstudy

AIstudy 是一个基于 Electron + React + TypeScript + Vite 构建的 Windows 桌面学习系统。

## 版本

当前版本：`1.1.0`

## 功能特性

### 核心功能
- 现代化桌面应用，侧边栏导航
- 工作台仪表盘（零数据状态）
- 课程中心：本地创建、管理课程
- 课程工作区：知识点、知识笔记、思维导图三种模式

### 思维导图编辑器
- 基于 `mind-lixir` 的思维导图编辑
- 布局控制：双向、向右、向左、紧凑模式
- 节点操作：添加子主题、同级主题、父主题、删除节点
- 元素功能：关系线、概要、标签、备注
- 视图控制：适配视图、居中、拖动模式、缩放
- 操作：撤销、重做
- 文本格式：加粗、文字颜色、背景色、字号、标注
- 画布交互：无限画布、拖动模式、方向键平移、滑动条控件
- 快捷键：Delete/Backspace 删除分支

### 目录面板
- 目录支持拖动调整宽度（180-500px）
- 目录项支持自动换行显示
- 目录层级序号：章节标题不加序号，子标题按层级显示（一、二、三...）
- 目录标题分级显示：章节标题加粗大字体，子标题按层级递减
- 目录缩进优化：每级缩进22px，末级标题额外增加16px

### 其他功能
- 知识点面板：防抖自动保存
- 知识笔记面板：根据导图叶子分支生成复习笔记
- 设置页面：快捷键设置
- 更新管理：版本折叠列表显示

## 项目结构

```text
electron/                Electron 主进程与 preload
  main.ts               创建窗口、加载页面、外链处理
  preload.ts            暴露基础 aistudy 信息
src/
  main.tsx              React 主应用、全部业务组件和状态逻辑
  styles.css            全局 UI、课程、导图、工具栏、滑动控件样式
  updateLog.ts          更新管理模块的数据源
  vite-env.d.ts         Vite 类型声明
assets/                 应用图标和吉祥物源文件
public/                 前端公开资源，包含 mascot.png
dist/                   Vite 构建后的 renderer 产物
dist-electron/          Electron TypeScript 构建产物
release/                electron-builder 本地打包输出
package.json            脚本、依赖、electron-builder 配置
```

## 本地存储

- 课程数据：`aistudy:courses:v1`
- 设置数据：`aistudy:settings:v1`

## 开发命令

```bash
npm install          # 安装依赖
npm run dev          # 启动开发服务器并打开 Electron
npm run lint         # 运行 TypeScript 类型检查
npm run build        # 构建 Electron 主进程和前端
npm run pack         # 构建并输出免安装目录
npm run dist         # 构建 Windows NSIS 安装包
```

## 打包输出

打包后的免安装程序位置：

```text
release/win-unpacked/AIstudy.exe
```

桌面快捷方式指向：

```text
C:\Users\52882\Desktop\AIstudy.lnk
```

## 技术栈

- Electron 39.2.7
- React 19.2.1
- TypeScript 5.9.3
- Vite 7.2.6
- mind-lixir 5.12.2
- lucide-react 0.561.0
- electron-builder 26.0.12

## 仓库

- 本地仓库：`F:\AIAPP\Xiangmu\AIstudy`
- GitHub：https://github.com/SnowLove0303/AIstudy
