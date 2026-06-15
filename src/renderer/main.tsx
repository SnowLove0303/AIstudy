import React from "react";
import { createRoot } from "react-dom/client";
import {
  Bot,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Folder,
  GitBranch,
  Globe2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  X
} from "lucide-react";
import { AiAssistantPanel } from "./features/assistant/AiAssistantPanel";
import { ChromePortManager } from "./features/chromePorts/ChromePortManager";
import { MindMapCatalog } from "./features/mindmap/MindMapCatalog";
import {
  MindMapWorkspace,
  type WorkspaceEditorMode,
  type WorkspaceModeChangeRequest,
  type WorkspaceNodeSelectionRequest
} from "./features/mindmap/MindMapWorkspace";
import type { MindMapOutlineItem, MindMapSelectedNode } from "./features/mindmap/mindMapTypes";
import { drainBeforeCloseSaves } from "./lib/saveDrain";
import "./styles.css";

type Course = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

type CourseStore = {
  courses: Course[];
  activeCourseId: string | null;
};

declare global {
  interface Window {
    aistudyLifecycle?: {
      onBeforeClose: (callback: () => Promise<unknown> | unknown) => () => void;
    };
  }
}

type UpdateManagerInfo = {
  appVersion: string;
  repositoryUrl: string;
  repositoryWebUrl: string;
  branch: string;
  commit: string;
  dirty: boolean;
  canUseGit: boolean;
  updateIndexPath: string;
  releaseDir: string;
  installerPath: string;
};

type UpdateCheckResult = {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName: string;
  publishedAt: string;
  releaseUrl: string;
  notes: string[];
  assetName: string;
  assetSize: number;
  downloadUrl: string;
};

type UpdateDownloadResult = {
  filePath: string;
  fileName: string;
  fileSize: number;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-error-fallback" role="alert">
          <strong>应用运行异常</strong>
          <span>{this.state.error.message || "页面渲染失败"}</span>
          <button type="button" onClick={() => window.location.reload()}>
            重新载入
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

type CourseDialogMode = "create" | "edit";
type AppSection = "knowledge" | "assistant" | "chromePorts";

declare global {
  interface Window {
    aistudyCourses?: {
      load: () => Promise<CourseStore>;
      save: (store: CourseStore) => Promise<CourseStore>;
    };
    aistudyUpdates?: {
      loadInfo: () => Promise<UpdateManagerInfo>;
      check: () => Promise<UpdateCheckResult>;
      download: (downloadUrl: string) => Promise<UpdateDownloadResult>;
      install: (filePath: string) => Promise<boolean>;
      openReleasePage: (releaseUrl: string) => Promise<boolean>;
    };
  }
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatFileSize(size: number) {
  if (!size) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

async function loadCourseStore() {
  if (window.aistudyCourses) {
    return window.aistudyCourses.load();
  }
  throw new Error("课程服务不可用。");
}

async function saveCourseStore(store: CourseStore) {
  if (window.aistudyCourses) {
    return window.aistudyCourses.save(store);
  }
  throw new Error("课程服务不可用。");
}

async function loadUpdateInfo() {
  if (!window.aistudyUpdates) {
    throw new Error("更新服务不可用。");
  }
  return window.aistudyUpdates.loadInfo();
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [updateInfo, setUpdateInfo] = React.useState<UpdateManagerInfo | null>(null);
  const [checkResult, setCheckResult] = React.useState<UpdateCheckResult | null>(null);
  const [downloadResult, setDownloadResult] = React.useState<UpdateDownloadResult | null>(null);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");
  const [isChecking, setIsChecking] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [lastCheckedAt, setLastCheckedAt] = React.useState("");

  React.useEffect(() => {
    loadUpdateInfo()
      .then((info) => {
        setUpdateInfo(info);
        setError("");
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "更新服务初始化失败。");
      });
  }, []);

  const checkUpdate = React.useCallback(() => {
    if (!window.aistudyUpdates) return;
    setIsChecking(true);
    setStatus("正在检测更新...");
    setError("");
    setDownloadResult(null);

    window.aistudyUpdates.check()
      .then((result) => {
        setCheckResult(result);
        setLastCheckedAt(new Date().toLocaleString());
        setStatus(result.hasUpdate ? `检测到新版本 ${result.latestVersion}` : "当前已是最新版本。");
      })
      .catch((checkError: unknown) => {
        setCheckResult(null);
        setStatus("");
        setError(checkError instanceof Error ? checkError.message : "检测更新失败。");
      })
      .finally(() => setIsChecking(false));
  }, []);

  const downloadUpdate = React.useCallback(() => {
    if (!window.aistudyUpdates || !checkResult?.downloadUrl) return;
    setIsDownloading(true);
    setStatus("正在下载安装包...");
    setError("");

    window.aistudyUpdates.download(checkResult.downloadUrl)
      .then((result) => {
        setDownloadResult(result);
        setStatus("安装包下载完成，可以开始安装。");
      })
      .catch((downloadError: unknown) => {
        setError(downloadError instanceof Error ? downloadError.message : "下载更新失败。");
      })
      .finally(() => setIsDownloading(false));
  }, [checkResult]);

  const installUpdate = React.useCallback(() => {
    if (!window.aistudyUpdates || !downloadResult?.filePath) return;
    setStatus("正在启动安装程序...");
    void window.aistudyUpdates.install(downloadResult.filePath);
  }, [downloadResult]);

  const updateStateLabel = checkResult ? (checkResult.hasUpdate ? "发现新版本" : "已是最新") : "待检测";
  const updateStateClass = checkResult ? (checkResult.hasUpdate ? "available" : "latest") : "idle";
  const updateHeadline = checkResult
    ? (checkResult.hasUpdate ? `发现可更新版本 ${checkResult.latestVersion}` : "当前已是最新版本")
    : "检查是否有可用更新";
  const updateDescription = checkResult
    ? (checkResult.hasUpdate
      ? "新版本已准备好，你可以下载安装包并启动安装。"
      : `当前版本 ${updateInfo?.appVersion ?? checkResult.currentVersion} 已与线上版本一致。`)
    : "点击检测更新后，将自动对比线上发布版本。";
  const onlineVersion = checkResult?.latestVersion ?? "未检测";
  const downloadDescription = downloadResult
    ? `已下载 ${downloadResult.fileName}${downloadResult.fileSize ? `（${formatFileSize(downloadResult.fileSize)}）` : ""}`
    : (checkResult?.hasUpdate ? "获取最新安装包，下载完成后可安装。" : "检测到可更新版本后可用。");
  const installDescription = downloadResult ? "启动安装程序并退出当前应用。" : "安装包下载完成后可用。";

  return (
    <div className="settings-backdrop" role="presentation">
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-label="设置">
        <aside className="settings-nav">
          <div className="settings-title">
            <Settings size={18} />
            <span>设置</span>
          </div>
          <button className="settings-nav-item active" type="button">
            <GitBranch size={16} />
            <span>更新管理</span>
          </button>
        </aside>

        <main className="settings-content">
          <header className="settings-header">
            <div>
              <h2 className="settings-page-title">更新管理</h2>
            </div>
            <button className="icon-button" title="关闭" aria-label="关闭设置" type="button" onClick={onClose}>
              <X size={17} />
            </button>
          </header>

          <div className="update-panel">
            <section className={`windows-update-hero ${updateStateClass}`}>
              <div className="windows-update-main">
                <div className="windows-update-mark" aria-hidden="true">
                  <RefreshCw size={56} strokeWidth={1.9} />
                  <span>
                    <CheckCircle2 size={18} />
                  </span>
                </div>
                <div className="windows-update-copy">
                  <p className="section-kicker">版本状态</p>
                  <h3>{updateHeadline}</h3>
                  <p>{updateDescription}</p>
                  <p className="update-check-time">
                    {lastCheckedAt ? `上次检查时间：${lastCheckedAt}` : `当前版本：${updateInfo?.appVersion ?? "-"}`}
                  </p>
                </div>
              </div>
              <button className="primary-button update-check-button" type="button" onClick={checkUpdate} disabled={isChecking || isDownloading}>
                <RefreshCw size={15} />
                {isChecking ? "检测中" : "检测更新"}
              </button>
            </section>

            {status ? <p className="update-status">{status}</p> : null}
            {error ? <p className="status-message error">{error}</p> : null}

            {checkResult?.hasUpdate ? (
              <section className="release-card" aria-label="新版本更新内容">
                <div className="release-card-heading">
                  <div>
                    <p className="section-kicker">更新内容</p>
                    <h3>版本 {checkResult.latestVersion}</h3>
                  </div>
                  {checkResult.publishedAt ? <span>{formatDate(checkResult.publishedAt)}</span> : null}
                </div>

                <ol className="release-notes">
                  {checkResult.notes.map((note, index) => (
                    <li key={`${note}-${index}`}>{note}</li>
                  ))}
                </ol>

                {checkResult.assetName ? (
                  <p className="release-asset">
                    安装包：{checkResult.assetName}
                    {checkResult.assetSize ? `（${formatFileSize(checkResult.assetSize)}）` : ""}
                  </p>
                ) : (
                  <p className="release-asset warning">该版本未找到 Windows 安装包。</p>
                )}
              </section>
            ) : null}

            <section className="update-options" aria-label="更新选项">
              <p className="settings-section-label">更多选项</p>
              <button
                className="update-option-row"
                type="button"
                onClick={downloadUpdate}
                disabled={!checkResult?.hasUpdate || !checkResult.downloadUrl || isDownloading}
              >
                <span className="update-option-icon"><Download size={18} /></span>
                <span className="update-option-copy">
                  <strong>{isDownloading ? "正在下载更新" : "下载更新"}</strong>
                  <span>{downloadDescription}</span>
                </span>
                <span className="update-option-meta">{onlineVersion}</span>
              </button>
              <button className="update-option-row" type="button" onClick={installUpdate} disabled={!downloadResult}>
                <span className="update-option-icon"><CheckCircle2 size={18} /></span>
                <span className="update-option-copy">
                  <strong>安装更新</strong>
                  <span>{installDescription}</span>
                </span>
                <span className="update-option-meta">{downloadResult ? "可安装" : updateStateLabel}</span>
              </button>
              <button
                className="update-option-row"
                type="button"
                disabled={!checkResult?.releaseUrl}
                onClick={() => checkResult?.releaseUrl && void window.aistudyUpdates?.openReleasePage(checkResult.releaseUrl)}
              >
                <span className="update-option-icon"><ExternalLink size={18} /></span>
                <span className="update-option-copy">
                  <strong>查看发布页</strong>
                  <span>打开线上版本页面，查看完整发布说明。</span>
                </span>
                <span className="update-option-meta">{checkResult?.publishedAt ? formatDate(checkResult.publishedAt) : ""}</span>
              </button>
            </section>
          </div>
        </main>
      </section>
    </div>
  );
}

function App() {
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [activeCourseId, setActiveCourseId] = React.useState<string | null>(null);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [storageError, setStorageError] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [dialogMode, setDialogMode] = React.useState<CourseDialogMode | null>(null);
  const [editingCourseId, setEditingCourseId] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState("");
  const [draftDescription, setDraftDescription] = React.useState("");
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [mindMapOutline, setMindMapOutline] = React.useState<MindMapOutlineItem[]>([]);
  const [selectedMindMapNode, setSelectedMindMapNode] = React.useState<MindMapSelectedNode>({ id: null, title: "" });
  const [workspaceEditorMode, setWorkspaceEditorMode] = React.useState<WorkspaceEditorMode>("mindmap");
  const [modeChangeRequest, setModeChangeRequest] = React.useState<WorkspaceModeChangeRequest | null>(null);
  const [nodeSelectionRequest, setNodeSelectionRequest] = React.useState<WorkspaceNodeSelectionRequest | null>(null);
  const [activeSection, setActiveSection] = React.useState<AppSection>("knowledge");

  React.useEffect(() => {
    return window.aistudyLifecycle?.onBeforeClose(() => drainBeforeCloseSaves());
  }, []);

  React.useEffect(() => {
    let isCancelled = false;

    loadCourseStore()
      .then((store) => {
        if (isCancelled) return;
        setCourses(store.courses);
        setActiveCourseId(store.activeCourseId);
        setStorageError("");
      })
      .catch(() => {
        if (isCancelled) return;
        setStorageError("课程读取失败。");
      })
      .finally(() => {
        if (!isCancelled) {
          setIsHydrated(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!isHydrated) return;
    const store = { courses, activeCourseId };
    saveCourseStore(store)
      .then(() => setStorageError(""))
      .catch(() => setStorageError("课程数据保存失败，请稍后重试。"));
  }, [activeCourseId, courses, isHydrated]);

  React.useEffect(() => {
    if (activeCourseId && !courses.some((course) => course.id === activeCourseId)) {
      setActiveCourseId(courses[0]?.id ?? null);
    }
  }, [activeCourseId, courses]);

  React.useEffect(() => {
    setMindMapOutline([]);
    setSelectedMindMapNode({ id: null, title: "" });
    setWorkspaceEditorMode("mindmap");
    setModeChangeRequest(null);
    setNodeSelectionRequest(null);
  }, [activeCourseId]);

  const activeCourse = courses.find((course) => course.id === activeCourseId) ?? null;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleCourses = normalizedQuery
    ? courses.filter((course) => {
        const haystack = `${course.name} ${course.description}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : courses;

  function openCreateDialog() {
    setDialogMode("create");
    setEditingCourseId(null);
    setDraftName("");
    setDraftDescription("");
  }

  function openEditDialog(course: Course) {
    setDialogMode("edit");
    setEditingCourseId(course.id);
    setDraftName(course.name);
    setDraftDescription(course.description);
  }

  function closeDialog() {
    setDialogMode(null);
    setEditingCourseId(null);
    setDraftName("");
    setDraftDescription("");
  }

  function saveCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftName.trim();
    const description = draftDescription.trim();
    if (!name) return;

    if (dialogMode === "create") {
      const now = new Date().toISOString();
      const course: Course = {
        id: createId(),
        name,
        description,
        createdAt: now,
        updatedAt: now
      };
      setCourses((current) => [course, ...current]);
      setActiveCourseId(course.id);
      closeDialog();
      return;
    }

    if (dialogMode === "edit" && editingCourseId) {
      setCourses((current) =>
        current.map((course) =>
          course.id === editingCourseId
            ? {
                ...course,
                name,
                description,
                updatedAt: new Date().toISOString()
              }
            : course
        )
      );
      closeDialog();
    }
  }

  function deleteCourse(course: Course) {
    const confirmed = window.confirm(`确定删除课程「${course.name}」吗？删除后该课程会从列表中移除。`);
    if (!confirmed) return;
    setCourses((current) => current.filter((item) => item.id !== course.id));
    if (activeCourseId === course.id) {
      const nextCourse = courses.find((item) => item.id !== course.id);
      setActiveCourseId(nextCourse?.id ?? null);
    }
  }

  function requestWorkspaceMode(mode: WorkspaceEditorMode) {
    if (mode === workspaceEditorMode) return;
    setModeChangeRequest({ mode, nonce: Date.now() });
  }

  function selectCatalogNode(item: MindMapOutlineItem) {
    if (!item.nodeId) return;
    setNodeSelectionRequest({ nodeId: item.nodeId, nonce: Date.now() });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand" aria-label="AIstudy">
          <span>AI</span>
        </div>
        <nav className="nav-list" aria-label="主导航">
          <button
            className={activeSection === "knowledge" ? "nav-button active" : "nav-button"}
            title="知识库"
            aria-label="知识库"
            aria-current={activeSection === "knowledge" ? "page" : undefined}
            type="button"
            onClick={() => setActiveSection("knowledge")}
          >
            <Folder size={19} strokeWidth={1.9} />
          </button>
          <button
            className={activeSection === "chromePorts" ? "nav-button active" : "nav-button"}
            title="Chrome 端口管理"
            aria-label="Chrome 端口管理"
            aria-current={activeSection === "chromePorts" ? "page" : undefined}
            type="button"
            onClick={() => setActiveSection("chromePorts")}
          >
            <Globe2 size={19} strokeWidth={1.9} />
          </button>
          <button
            className={activeSection === "assistant" ? "nav-button active" : "nav-button"}
            title="AI 聊天助手"
            aria-label="AI 聊天助手"
            aria-current={activeSection === "assistant" ? "page" : undefined}
            type="button"
            onClick={() => setActiveSection("assistant")}
          >
            <Bot size={19} strokeWidth={1.9} />
          </button>
        </nav>
        <button className="nav-button settings-button" title="设置" aria-label="设置" type="button" onClick={() => setIsSettingsOpen(true)}>
          <Settings size={18} strokeWidth={1.9} />
        </button>
      </aside>

      {activeSection === "knowledge" ? (
      <main className="study-layout">
        <section className="library-pane" aria-label="课程列表">
          <div className="pane-heading">
            <div>
              <p className="section-kicker">知识库</p>
              <h1>知识库</h1>
            </div>
            <button className="icon-button primary-action" title="新建课程" aria-label="新建课程" type="button" onClick={openCreateDialog}>
              <Plus size={17} strokeWidth={2.1} />
            </button>
          </div>

          <label className="search-box" aria-label="搜索课程">
            <Search size={16} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索课程"
              aria-label="搜索课程"
            />
          </label>

          {courses.length === 0 ? (
            <div className="pane-empty-state">
              <strong>{isHydrated ? "暂无课程" : "正在读取课程"}</strong>
            </div>
          ) : visibleCourses.length === 0 ? (
            <div className="pane-empty-state">
              <strong>没有匹配课程</strong>
            </div>
          ) : (
            <div className="course-list" aria-label="课程">
              {visibleCourses.map((course) => (
                <article key={course.id} className={activeCourseId === course.id ? "course-card selected" : "course-card"}>
                  <button className="course-main" type="button" onClick={() => setActiveCourseId(course.id)}>
                    <span className="course-name">{course.name}</span>
                    <span className="course-meta">{course.description || "未填写描述"}</span>
                  </button>
                  <div className="course-actions" aria-label={`${course.name} 操作`}>
                    <button className="mini-button" type="button" title="重命名课程" aria-label={`重命名 ${course.name}`} onClick={() => openEditDialog(course)}>
                      <Edit3 size={14} />
                    </button>
                    <button className="mini-button danger" type="button" title="删除课程" aria-label={`删除 ${course.name}`} onClick={() => deleteCourse(course)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {storageError ? <p className="status-message error">{storageError}</p> : null}
        </section>

        <section className="canvas-pane" aria-label="学习工作台">
          <div className="canvas-toolbar">
            <div>
              <h2>{activeCourse ? activeCourse.name : "未选择课程"}</h2>
            </div>
            <div className="workspace-mode-switch" aria-label="编辑器切换">
              <button
                type="button"
                className={workspaceEditorMode === "mindmap" ? "active" : ""}
                onClick={() => requestWorkspaceMode("mindmap")}
                disabled={!activeCourse}
              >
                <GitBranch size={15} />
                <span>导图</span>
              </button>
              <button
                type="button"
                className={workspaceEditorMode === "word" ? "active" : ""}
                onClick={() => requestWorkspaceMode("word")}
                disabled={!activeCourse}
              >
                <FileText size={15} />
                <span>文档</span>
              </button>
            </div>
          </div>

          <div className="editor-mount">
            <MindMapWorkspace
              courseId={activeCourse?.id ?? null}
              courseName={activeCourse?.name ?? "New mind map"}
              editorMode={workspaceEditorMode}
              modeChangeRequest={modeChangeRequest}
              nodeSelectionRequest={nodeSelectionRequest}
              onEditorModeChange={setWorkspaceEditorMode}
              onOutlineChanged={setMindMapOutline}
              onNodeSelectedChanged={setSelectedMindMapNode}
            />
          </div>
        </section>

        <aside className="detail-pane" aria-label="目录">
          <div className="detail-heading">
            <div>
              <p className="section-kicker">导图</p>
              <h2>目录</h2>
            </div>
          </div>

          {activeCourse && mindMapOutline.length > 0 ? (
            <nav className="catalog-panel" aria-label="导图目录">
              <MindMapCatalog
                items={mindMapOutline}
                selectedNodeId={selectedMindMapNode.id}
                resetKey={activeCourseId ?? ""}
                onNodeSelect={selectCatalogNode}
              />
            </nav>
          ) : (
            <div className="detail-empty-state">
              <strong>{activeCourse ? "暂无目录" : "未选择课程"}</strong>
            </div>
          )}
        </aside>
      </main>
      ) : activeSection === "assistant" ? (
        <AiAssistantPanel
          courseTitle={activeCourse?.name ?? ""}
          nodeTitle={selectedMindMapNode.title}
          contextText={mindMapOutline.slice(0, 80).map((item) => `${"  ".repeat(Math.max(0, item.level))}${item.title}`).join("\n")}
        />
      ) : (
        <ChromePortManager />
      )}

      {dialogMode ? (
        <div className="modal-backdrop" role="presentation">
          <form className="course-dialog" onSubmit={saveCourse} aria-label={dialogMode === "create" ? "新建课程" : "编辑课程"}>
            <div className="dialog-heading">
              <div>
                <p className="section-kicker">课程管理</p>
                <h2>{dialogMode === "create" ? "新建课程" : "编辑课程"}</h2>
              </div>
              <button className="icon-button" title="关闭" aria-label="关闭" type="button" onClick={closeDialog}>
                <X size={17} />
              </button>
            </div>

            <label className="form-field">
              <span>课程名称</span>
              <input value={draftName} onChange={(event) => setDraftName(event.target.value)} autoFocus maxLength={40} placeholder="课程名称" />
            </label>

            <label className="form-field">
              <span>课程描述</span>
              <textarea
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                maxLength={120}
                placeholder="课程描述"
              />
            </label>

            <div className="dialog-actions">
              <button className="secondary-button" type="button" onClick={closeDialog}>
                取消
              </button>
              <button className="primary-button" type="submit" disabled={!draftName.trim()}>
                <Check size={16} />
                保存
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isSettingsOpen ? <SettingsDialog onClose={() => setIsSettingsOpen(false)} /> : null}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
