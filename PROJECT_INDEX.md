# AIstudy 项目索引

## 基本信息

- **项目名称**：AIstudy
- **当前版本**：V1.1.0
- **仓库地址**：https://github.com/SnowLove0303/AIstudy
- **本地路径**：`F:\AIAPP\Xiangmu\AIstudy`
- **最后更新**：2026-06-09

## Git 配置

```bash
# 查看远程仓库
git remote -v

# 查看当前分支
git branch

# 查看状态
git status
```

## 快速操作

### 提交新内容

```bash
# 1. 添加所有更改
git add -A

# 2. 提交（替换为实际的提交信息）
git commit -m "描述你的更改"

# 3. 推送到 GitHub
git push origin main
```

### 拉取最新内容

```bash
# 拉取远程更新
git pull origin main
```

### 查看提交历史

```bash
# 查看最近 10 条提交
git log --oneline -10
```

## 项目结构

```
AIstudy/
├── electron/                # Electron 主进程
│   ├── main.ts             # 主进程入口
│   └── preload.ts          # 预加载脚本
├── src/                     # React 渲染进程
│   ├── main.tsx            # 主应用组件（所有业务逻辑）
│   ├── styles.css          # 全局样式
│   ├── updateLog.ts        # 更新日志数据
│   └── vite-env.d.ts       # Vite 类型声明
├── assets/                  # 应用图标和资源
├── public/                  # 前端公开资源
├── dist/                    # Vite 构建产物
├── dist-electron/           # Electron 构建产物
├── release/                 # 打包输出
│   └── win-unpacked/       # 免安装版本
├── node_modules/            # 依赖包
├── package.json             # 项目配置
├── tsconfig.json            # TypeScript 配置
├── vite.config.ts           # Vite 配置
└── README.md                # 项目说明
```

## 技术栈

- **Electron**：39.2.7
- **React**：19.2.1
- **TypeScript**：5.9.3
- **Vite**：7.2.6
- **mind-lixir**：5.12.2（思维导图）
- **lucide-react**：0.561.0（图标）

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查
npm run lint

# 构建项目
npm run build

# 打包为免安装版本
npm run pack

# 打包为安装程序
npm run dist
```

## Git LFS 配置

项目使用 Git LFS 管理大文件：

```bash
# 查看 LFS 追踪的文件
git lfs track

# 查看 LFS 状态
git lfs status
```

**LFS 追踪的文件类型**：
- `*.exe` - 可执行文件
- `*.asar` - Electron 应用包
- `node_modules/electron/dist/*` - Electron 分发文件

## 功能模块

### 已实现
- ✅ 工作台仪表盘
- ✅ 课程中心（创建、列表、详情）
- ✅ 思维导图编辑器
- ✅ 知识点面板
- ✅ 知识笔记面板
- ✅ 目录面板（拖动调整宽度、层级序号）
- ✅ 更新管理
- ✅ 设置页面

### 待实现
- 🚧 学习计划
- 🚧 练习中心
- 🚧 AI 助教

## 本地存储

数据存储在浏览器 localStorage 中：

- **课程数据**：`aistudy:courses:v1`
- **设置数据**：`aistudy:settings:v1`

## 常见问题

### Q: 如何同步最新代码？
```bash
git pull origin main
```

### Q: 如何提交更改？
```bash
git add -A
git commit -m "描述更改"
git push origin main
```

### Q: 如何查看文件差异？
```bash
# 查看所有更改
git diff

# 查看特定文件更改
git diff src/main.tsx
```

### Q: 如何撤销更改？
```bash
# 撤销工作区更改
git checkout -- <file>

# 撤销暂存区更改
git reset HEAD <file>
```

## 联系方式

- **GitHub**：https://github.com/SnowLove0303
- **项目仓库**：https://github.com/SnowLove0303/AIstudy

## 更新日志

查看 `src/updateLog.ts` 文件了解完整的版本更新历史。

---

**最后更新**：2026-06-09
**维护者**：SnowLove0303
