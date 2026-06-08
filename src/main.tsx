import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import MindElixir, { SIDE, type MindElixirData, type MindElixirInstance, type NodeObj } from "mind-elixir";
import "mind-elixir/style.css";
import {
  Bell,
  BookOpen,
  Bold,
  Bot,
  Braces,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CirclePlay,
  Clock3,
  FileText,
  GitBranchPlus,
  GitFork,
  GraduationCap,
  Hand,
  Highlighter,
  Home,
  Keyboard,
  LibraryBig,
  Link2,
  LocateFixed,
  Maximize2,
  NotebookPen,
  PaintBucket,
  PackageCheck,
  Palette,
  PanelLeft,
  PanelRight,
  Plus,
  PlayCircle,
  Redo2,
  Rows3,
  Save,
  Search,
  Settings,
  Sparkles,
  StickyNote,
  Target,
  Tags,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  UsersRound
} from "lucide-react";
import { updateLog, type UpdateLogEntry } from "./updateLog";
import "./styles.css";

type ViewId = "dashboard" | "courses" | "plan" | "notes" | "practice" | "assistant" | "updates" | "settings";
type Tone = "teal" | "amber" | "blue" | "rose";

type Task = { title: string; meta: string; progress: number; tone: Tone };
type ScheduleItem = { time: string; title: string; tag: string };
type Course = {
  id: string;
  title: string;
  category: string;
  description: string;
  progress: number;
  createdAt: string;
  mindMap: MindElixirData;
  knowledgePoints: Record<string, string>;
};
type OutlineItem = {
  id: string;
  topic: string;
  depth: number;
  parentId: string;
};
type NoteEntry = {
  id: string;
  topic: string;
  depth: number;
  parentId: string;
  path: Array<{ id: string; topic: string; depth: number }>;
  note: string;
  tags: string[];
  childTopics: string[];
  isLeaf: boolean;
  order: number;
};
type CourseWorkspaceMode = "knowledge" | "notes" | "mindmap";
type AppSettings = {
  mindMapArrowPan: boolean;
};

const mascotUrl = `${import.meta.env.BASE_URL}mascot.png`;
const coursesStorageKey = "aistudy:courses:v1";
const settingsStorageKey = "aistudy:settings:v1";
const defaultSettings: AppSettings = {
  mindMapArrowPan: true
};
const textColors = ["#111827", "#0f766e", "#2563eb", "#b7791f", "#e11d48"];
const fillColors = ["#ffffff", "#def7ec", "#dbeafe", "#fef3c7", "#ffe4e6"];
const markColors = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecdd3"];
const fontSizes = ["16px", "20px", "24px", "28px"];
const panControlMin = 0;
const panControlMax = 1000;
const panControlCenter = 500;
const panControlScale = 4;

const navItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: "dashboard", label: "工作台", icon: Home },
  { id: "courses", label: "课程库", icon: LibraryBig },
  { id: "plan", label: "学习计划", icon: CalendarDays },
  { id: "notes", label: "知识笔记", icon: NotebookPen },
  { id: "practice", label: "练习中心", icon: Target },
  { id: "assistant", label: "AI 助教", icon: Bot },
  { id: "updates", label: "更新管理", icon: PackageCheck }
];

const focusTasks: Task[] = [];
const schedule: ScheduleItem[] = [];
const insights: string[] = [];

function createMindMap(title: string): MindElixirData {
  return MindElixir.new(title);
}

function createCourse(title: string, category: string, description: string): Course {
  return {
    id: crypto.randomUUID(),
    title,
    category,
    description,
    progress: 0,
    createdAt: new Date().toISOString(),
    mindMap: createMindMap(title),
    knowledgePoints: {}
  };
}

function loadCourses(): Course[] {
  try {
    const raw = localStorage.getItem(coursesStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Course[];
    return Array.isArray(parsed)
      ? parsed.map((course) => ({ ...course, knowledgePoints: course.knowledgePoints ?? {} }))
      : [];
  } catch {
    return [];
  }
}

function saveCourses(courses: Course[]) {
  localStorage.setItem(coursesStorageKey, JSON.stringify(courses));
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(settingsStorageKey);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
}

function scheduleIdleTask(task: () => void, timeout = 500) {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
    const idleId = idleWindow.requestIdleCallback(task, { timeout });
    return () => idleWindow.cancelIdleCallback?.(idleId);
  }

  const timeoutId = globalThis.setTimeout(task, Math.min(timeout, 250));
  return () => globalThis.clearTimeout(timeoutId);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMindMapText(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[color=(#[0-9a-fA-F]{3,6})\](.+?)\[\/color\]/g, '<span style="color:$1">$2</span>')
    .replace(/\[mark=(#[0-9a-fA-F]{3,6})\](.+?)\[\/mark\]/g, '<mark style="background:$1">$2</mark>');
}

function buildOutline(data: MindElixirData): OutlineItem[] {
  const items: OutlineItem[] = [];
  const walk = (nodes: NodeObj[] | undefined, depth: number, parentId: string) => {
    nodes?.forEach((node) => {
      items.push({ id: node.id, topic: node.topic, depth, parentId });
      walk(node.children, depth + 1, node.id);
    });
  };

  walk(data.nodeData.children, 0, data.nodeData.id);
  return items;
}

function normalizeTag(tag: NonNullable<NodeObj["tags"]>[number]) {
  return typeof tag === "string" ? tag : tag.text;
}

function buildNoteEntries(data: MindElixirData): NoteEntry[] {
  const entries: NoteEntry[] = [];
  let order = 1;
  const walk = (
    nodes: NodeObj[] | undefined,
    depth: number,
    parentId: string,
    parentPath: Array<{ id: string; topic: string; depth: number }>
  ) => {
    nodes?.forEach((node) => {
      const path = [...parentPath, { id: node.id, topic: node.topic, depth }];
      const childTopics = (node.children ?? []).map((child) => child.topic);
      entries.push({
        id: node.id,
        topic: node.topic,
        depth,
        parentId,
        path,
        note: node.note ?? "",
        tags: (node.tags ?? []).map(normalizeTag).filter(Boolean),
        childTopics,
        isLeaf: childTopics.length === 0,
        order
      });
      order += 1;
      walk(node.children, depth + 1, node.id, path);
    });
  };

  walk(data.nodeData.children, 0, data.nodeData.id, []);
  return entries;
}

function App() {
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [courses, setCourses] = useState<Course[]>(() => loadCourses());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const latestCoursesRef = useRef(courses);

  useEffect(() => {
    latestCoursesRef.current = courses;
    return scheduleIdleTask(() => saveCourses(courses), 650);
  }, [courses]);

  useEffect(() => {
    const flushCourses = () => saveCourses(latestCoursesRef.current);
    window.addEventListener("beforeunload", flushCourses);
    return () => window.removeEventListener("beforeunload", flushCourses);
  }, []);

  useEffect(() => {
    return scheduleIdleTask(() => saveSettings(settings), 250);
  }, [settings]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  const updateCourse = useCallback((courseId: string, patch: Partial<Course>) => {
    setCourses((current) =>
      current.map((course) => (course.id === courseId ? { ...course, ...patch } : course))
    );
  }, []);

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand">
          <img src={mascotUrl} alt="" />
          <div>
            <strong>AIstudy</strong>
            <span>Learning Studio</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeView === item.id ? "nav-item active" : "nav-item"}
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  if (item.id !== "courses") setSelectedCourseId(null);
                }}
              >
                <Icon size={18} strokeWidth={2.1} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="focus-card" aria-label="今日学习状态">
          <Sparkles size={18} />
          <div>
            <strong>今日专注</strong>
            <span>课程推进 0%</span>
          </div>
        </section>

        <button
          className={activeView === "settings" ? "nav-item settings active" : "nav-item settings"}
          onClick={() => {
            setActiveView("settings");
            setSelectedCourseId(null);
          }}
        >
          <Settings size={18} />
          <span>设置</span>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>
              {activeView === "courses"
                ? selectedCourse
                  ? selectedCourse.title
                  : "课程中心"
                : activeView === "updates"
                  ? "更新管理"
                  : activeView === "settings"
                    ? "设置"
                  : "学习工作台"}
            </h1>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={17} />
              <input aria-label="搜索课程、笔记或练习" placeholder="搜索课程、笔记或练习" />
            </label>
            <button className="icon-button" aria-label="通知">
              <Bell size={18} />
            </button>
          </div>
        </header>

        {activeView === "courses" ? (
          <CourseCenter
            courses={courses}
            selectedCourse={selectedCourse}
            onCreateCourse={(course) => {
              setCourses((current) => [course, ...current]);
              setSelectedCourseId(course.id);
            }}
            onSelectCourse={setSelectedCourseId}
            onBack={() => setSelectedCourseId(null)}
            onUpdateCourse={updateCourse}
            settings={settings}
          />
        ) : activeView === "updates" ? (
          <UpdateManager />
        ) : activeView === "settings" ? (
          <SettingsPanel
            settings={settings}
            onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))}
          />
        ) : (
          <Dashboard />
        )}
      </section>
    </main>
  );
}

function UpdateManager() {
  const sortedUpdates = [...updateLog].sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true })
  );
  const [openVersion, setOpenVersion] = useState(sortedUpdates[0]?.version ?? "");

  return (
    <section className="update-manager" aria-label="更新管理">
      {sortedUpdates.map((entry, index) => {
        const isOpen = openVersion === entry.version;
        return (
          <article className={isOpen ? "version-card open" : "version-card"} key={entry.version}>
            <button
              className="version-row"
              aria-expanded={isOpen}
              onClick={() => setOpenVersion(isOpen ? "" : entry.version)}
            >
              <div className="version-meta">
                <span className="version-number">v{entry.version}</span>
                <strong>{entry.title}</strong>
                {index === 0 && <span className="latest-badge">最新</span>}
              </div>
              <div className="version-side">
                <time>{entry.date}</time>
                <ChevronDown size={18} />
              </div>
            </button>

            {isOpen && (
              <div className="version-detail">
                <UpdateColumn title="功能更新" items={entry.featureUpdates} />
                <UpdateColumn title="修复说明" items={entry.fixes} />
                <UpdateColumn title="优化说明" items={entry.optimizations} />
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

function SettingsPanel({
  settings,
  onChange
}: {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
}) {
  return (
    <section className="settings-page" aria-label="设置">
      <article className="settings-section">
        <header className="settings-section-header">
          <div className="settings-icon">
            <Keyboard size={20} />
          </div>
          <div>
            <h2>快捷键设置</h2>
          </div>
        </header>

        <div className="shortcut-list">
          <div className="shortcut-row">
            <div>
              <strong>课程思维导图滑动</strong>
              <span>方向键控制画布上下左右平移</span>
            </div>
            <div className="shortcut-keys" aria-label="上下左右方向键">
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              <kbd>←</kbd>
              <kbd>→</kbd>
            </div>
            <label className="setting-switch">
              <input
                checked={settings.mindMapArrowPan}
                onChange={(event) => onChange({ mindMapArrowPan: event.target.checked })}
                type="checkbox"
              />
              <span />
            </label>
          </div>
        </div>
      </article>
    </section>
  );
}

function UpdateColumn({ title, items }: { title: string; items: UpdateLogEntry["featureUpdates"] }) {
  return (
    <section className="update-column">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function Dashboard() {
  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="status-pill">
            <GraduationCap size={15} />
            <span>暂无连续学习记录</span>
          </div>
          <h2>学习工作台已准备就绪。</h2>
          <div className="hero-actions">
            <button className="primary-button">
              <CirclePlay size={18} />
              <span>开始学习</span>
            </button>
            <button className="secondary-button">
              <FileText size={18} />
              <span>新建笔记</span>
            </button>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <img src={mascotUrl} alt="" />
        </div>
      </section>

      <section className="metrics" aria-label="学习概览">
        <article className="metric-card">
          <span>本周学习</span>
          <strong>0h</strong>
          <small>暂无记录</small>
        </article>
        <article className="metric-card">
          <span>课程完成</span>
          <strong>0 / 0</strong>
          <small>暂无课程</small>
        </article>
        <article className="metric-card">
          <span>练习正确率</span>
          <strong>0%</strong>
          <small>暂无练习</small>
        </article>
        <article className="metric-card highlight">
          <span>AI 总结</span>
          <strong>0 篇</strong>
          <small>暂无归档</small>
        </article>
      </section>

      <section className="content-grid">
        <section className="panel today-panel">
          <div className="panel-heading">
            <div>
              <h3>今日学习</h3>
            </div>
            <button className="text-button">
              全部
              <ChevronRight size={16} />
            </button>
          </div>
          <EmptyState title="暂无今日学习任务" />
        </section>

        <section className="panel assistant-panel">
          <div className="panel-heading">
            <div>
              <h3>AI 助教</h3>
            </div>
            <Bot size={22} />
          </div>
          <div className="assistant-input">
            <span>暂无学习数据</span>
            <button aria-label="发送">
              <ChevronRight size={18} />
            </button>
          </div>
        </section>

        <section className="panel schedule-panel">
          <div className="panel-heading">
            <div>
              <h3>时间安排</h3>
            </div>
            <Clock3 size={21} />
          </div>
          {schedule.length > 0 ? <div className="timeline" /> : <EmptyState title="暂无时间安排" />}
        </section>

        <section className="panel review-panel">
          <div className="panel-heading">
            <div>
              <h3>最近完成</h3>
            </div>
            <CheckCircle2 size={21} />
          </div>
          {insights.length > 0 ? <ul className="done-list" /> : <EmptyState title="暂无完成记录" />}
        </section>
      </section>

    </>
  );
}

function CourseCenter({
  courses,
  selectedCourse,
  onCreateCourse,
  onSelectCourse,
  onBack,
  onUpdateCourse,
  settings
}: {
  courses: Course[];
  selectedCourse: Course | null;
  onCreateCourse: (course: Course) => void;
  onSelectCourse: (courseId: string) => void;
  onBack: () => void;
  onUpdateCourse: (courseId: string, patch: Partial<Course>) => void;
  settings: AppSettings;
}) {
  if (selectedCourse) {
    return <CourseDetail course={selectedCourse} onBack={onBack} onUpdateCourse={onUpdateCourse} settings={settings} />;
  }

  return (
    <>
      <section className="course-hero">
        <div>
          <div className="status-pill">
            <LibraryBig size={15} />
            <span>已创建 {courses.length} 门课程</span>
          </div>
          <h2>课程与思维导图</h2>
        </div>
      </section>

      <CreateCoursePanel onCreateCourse={onCreateCourse} />

      <section className="course-toolbar" aria-label="课程筛选">
        <div className="filter-tabs">
          <button className="filter-tab active">全部</button>
        </div>
        <button className="text-button">
          管理分类
          <ChevronRight size={16} />
        </button>
      </section>

      <section className="course-layout">
        <div className="course-list">
          {courses.length > 0 ? (
            courses.map((course) => (
              <article className="course-card" key={course.id}>
                <div className="course-badge teal">
                  <BookOpen size={20} />
                </div>
                <div className="course-main">
                  <div className="course-title-row">
                    <div>
                      <span className="course-category">{course.category || "未分类"}</span>
                      <h3>{course.title}</h3>
                    </div>
                    <button className="icon-button compact" aria-label={`打开 ${course.title}`} onClick={() => onSelectCourse(course.id)}>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div className="course-progress">
                    <div>
                      <strong>{course.progress}%</strong>
                    </div>
                    <div className="progress-wrap" aria-label={`${course.title} 进度 ${course.progress}%`}>
                      <span className="teal" style={{ width: `${course.progress}%` }} />
                    </div>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="暂无课程" />
          )}
        </div>

        <aside className="course-side">
          <section className="panel continue-card">
            <div className="panel-heading">
              <div>
                <h3>继续学习</h3>
              </div>
              <CirclePlay size={21} />
            </div>
            <strong>{courses[0]?.title ?? "暂无继续学习课程"}</strong>
            <button className="primary-button" onClick={() => courses[0] && onSelectCourse(courses[0].id)} disabled={courses.length === 0}>
              <PlayCircle size={18} />
              <span>进入课程</span>
            </button>
          </section>

          <section className="panel course-stats">
            <div className="stat-row">
              <UsersRound size={18} />
              <div>
                <strong>{new Set(courses.map((course) => course.category).filter(Boolean)).size} 个学习方向</strong>
              </div>
            </div>
            <div className="stat-row">
              <Clock3 size={18} />
              <div>
                <strong>本周 0 节待学</strong>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </>
  );
}

function CreateCoursePanel({ onCreateCourse }: { onCreateCourse: (course: Course) => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("金融");

  const canCreate = title.trim().length > 0;

  return (
    <section className="panel create-course-panel">
      <div className="panel-heading">
        <div>
          <h3>创建课程</h3>
        </div>
        <Plus size={21} />
      </div>
      <div className="course-form">
        <label>
          <span>课程名称</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="金融市场基础知识" />
        </label>
        <label>
          <span>分类</span>
          <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="金融" />
        </label>
        <button
          className="primary-button"
          disabled={!canCreate}
          onClick={() => {
            if (!canCreate) return;
            onCreateCourse(createCourse(title.trim(), category.trim(), ""));
            setTitle("");
            setCategory("金融");
          }}
        >
          <Plus size={18} />
          <span>创建并编辑导图</span>
        </button>
      </div>
    </section>
  );
}

function CourseDetail({
  course,
  onBack,
  onUpdateCourse,
  settings
}: {
  course: Course;
  onBack: () => void;
  onUpdateCourse: (courseId: string, patch: Partial<Course>) => void;
  settings: AppSettings;
}) {
  const [workspaceMode, setWorkspaceMode] = useState<CourseWorkspaceMode>("knowledge");

  return (
    <>
      <section className="course-detail-header">
        <button className="secondary-button" onClick={onBack}>
          <ChevronLeft size={18} />
          <span>返回课程中心</span>
        </button>
        <div>
          <span className="course-category">{course.category || "未分类"}</span>
        </div>
        <button className="secondary-button">
          <Save size={18} />
          <span>自动保存</span>
        </button>
      </section>

      <section className="mindmap-shell">
        <div className="mindmap-toolbar">
          <div>
            <h3>课程工作区</h3>
          </div>
          <div className="workspace-switch" aria-label="课程功能切换">
            <button className={workspaceMode === "knowledge" ? "active" : ""} onClick={() => setWorkspaceMode("knowledge")}>
              知识点
            </button>
            <button className={workspaceMode === "notes" ? "active" : ""} onClick={() => setWorkspaceMode("notes")}>
              知识笔记
            </button>
            <button className={workspaceMode === "mindmap" ? "active" : ""} onClick={() => setWorkspaceMode("mindmap")}>
              思维导图
            </button>
          </div>
        </div>
        <MindMapEditor
          courseId={course.id}
          title={course.title}
          data={course.mindMap}
          mode={workspaceMode}
          knowledgePoints={course.knowledgePoints ?? {}}
          onChange={(mindMap) => onUpdateCourse(course.id, { mindMap })}
          onKnowledgeChange={(knowledgePoints) => onUpdateCourse(course.id, { knowledgePoints })}
          settings={settings}
        />
      </section>
    </>
  );
}

function MindMapEditor({
  courseId,
  title,
  data,
  mode,
  knowledgePoints,
  onChange,
  onKnowledgeChange,
  settings
}: {
  courseId: string;
  title: string;
  data: MindElixirData;
  mode: CourseWorkspaceMode;
  knowledgePoints: Record<string, string>;
  onChange: (data: MindElixirData) => void;
  onKnowledgeChange: (knowledgePoints: Record<string, string>) => void;
  settings: AppSettings;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outlineListRef = useRef<HTMLDivElement | null>(null);
  const mindRef = useRef<MindElixirInstance | null>(null);
  const canvasDragRef = useRef({ active: false, x: 0, y: 0 });
  const panControlRef = useRef({ x: panControlCenter, y: panControlCenter });
  const [outline, setOutline] = useState<OutlineItem[]>(() => buildOutline(data));
  const [noteEntries, setNoteEntries] = useState<NoteEntry[]>(() => buildNoteEntries(data));
  const [compactMode, setCompactMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState(data.nodeData.id);
  const [selectedNodeCount, setSelectedNodeCount] = useState(1);
  const [toolHint, setToolHint] = useState("");
  const [dragMode, setDragMode] = useState(false);
  const [expandedEdit, setExpandedEdit] = useState(false);
  const [draggingOutlineId, setDraggingOutlineId] = useState<string | null>(null);
  const [outlineDropTargetId, setOutlineDropTargetId] = useState<string | null>(null);
  const [outlineScroll, setOutlineScroll] = useState(0);
  const [panControl, setPanControl] = useState({ x: panControlCenter, y: panControlCenter });
  const [shouldMountMindMap, setShouldMountMindMap] = useState(mode === "mindmap");

  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (mode === "mindmap") {
      setShouldMountMindMap(true);
    }
  }, [mode]);

  useEffect(() => {
    setSelectedPageId(data.nodeData.id);
    setSelectedNodeId(data.nodeData.id);
    setSelectedNodeCount(1);
  }, [courseId, data.nodeData.id]);

  useEffect(() => {
    if (!shouldMountMindMap) return;
    if (!containerRef.current) return;

    const mind = new MindElixir({
      el: containerRef.current,
      direction: SIDE,
      editable: true,
      contextMenu: true,
      toolBar: true,
      keypress: true,
      allowUndo: true,
      draggable: true,
      overflowHidden: false,
      markdown: (text: string) => renderMindMapText(text)
    } as any);

    mind.init(data || createMindMap(title));
    mindRef.current = mind;
    const initialData = mind.getData();
    setOutline(buildOutline(initialData));
    setNoteEntries(buildNoteEntries(initialData));
    setSelectedNodeId(mind.nodeData.id);

    mind.bus.addListener("operation", () => {
      const nextData = mind.getData();
      setOutline(buildOutline(nextData));
      setNoteEntries(buildNoteEntries(nextData));
      onChangeRef.current(nextData);
    });
    mind.bus.addListener("selectNodes", (nodes) => {
      const nextSelectedId = nodes[0]?.id ?? null;
      setSelectedNodeId(nextSelectedId);
      setSelectedNodeCount(nodes.length || 0);
      if (nodes.length >= 2) setToolHint("");
    });

    return () => {
      onChangeRef.current(mind.getData());
      mind.destroy();
      mindRef.current = null;
    };
  }, [courseId, title, shouldMountMindMap]);

  const focusMindNode = (id: string) => {
    const mind = mindRef.current;
    if (!mind) return;
    if ((mind as MindElixirInstance & { isFocusMode?: boolean }).isFocusMode) {
      mind.cancelFocus();
    }
    requestAnimationFrame(() => {
      const topic = mind.findEle(id);
      if (!topic) return;
      mind.selectNode(topic);
      mind.focusNode(topic);
      mind.scrollIntoView(topic, true);
    });
  };

  const focusOutlineNode = (id: string) => {
    setSelectedNodeId(id);
    setSelectedPageId(id);
    setSelectedNodeCount(1);
    focusMindNode(id);
  };

  const focusRootMindMap = () => {
    const rootNodeId = mindRef.current?.nodeData.id ?? data.nodeData.id;
    setSelectedPageId(rootNodeId);
    setSelectedNodeId(rootNodeId);
    setSelectedNodeCount(1);
    const mind = mindRef.current;
    if (!mind) return;
    if ((mind as MindElixirInstance & { isFocusMode?: boolean }).isFocusMode) {
      mind.cancelFocus();
    }
    const rootNode = mind.findEle(rootNodeId);
    if (rootNode) {
      mind.selectNode(rootNode);
      mind.scrollIntoView(rootNode, true);
    }
    mind.toCenter();
    const nextData = mind.getData();
    setOutline(buildOutline(nextData));
    setNoteEntries(buildNoteEntries(nextData));
  };

  useEffect(() => {
    if (mode !== "mindmap") return;
    if (!shouldMountMindMap) return;
    if (selectedPageId === (mindRef.current?.nodeData.id ?? data.nodeData.id)) {
      focusRootMindMap();
      return;
    }
    focusMindNode(selectedPageId);
  }, [mode, shouldMountMindMap, selectedPageId]);

  const syncMindData = () => {
    const mind = mindRef.current;
    if (!mind) return;
    const nextData = mind.getData();
    setOutline(buildOutline(nextData));
    setNoteEntries(buildNoteEntries(nextData));
    onChangeRef.current(nextData);
  };

  const findNodeSiblings = (root: NodeObj, targetId: string): { siblings: NodeObj[]; index: number; parentId: string } | null => {
    const walk = (node: NodeObj): { siblings: NodeObj[]; index: number; parentId: string } | null => {
      const children = node.children ?? [];
      const index = children.findIndex((child) => child.id === targetId);
      if (index >= 0) {
        return { siblings: children, index, parentId: node.id };
      }
      for (const child of children) {
        const match = walk(child);
        if (match) return match;
      }
      return null;
    };

    return walk(root);
  };

  const reorderOutlineNode = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const mind = mindRef.current;
    if (!mind) return;
    if ((mind as MindElixirInstance & { isFocusMode?: boolean }).isFocusMode) {
      setToolHint("请先回到主思维导图后再调整章节顺序");
      return;
    }

    const nextData = JSON.parse(JSON.stringify(mind.getData())) as MindElixirData;
    const source = findNodeSiblings(nextData.nodeData, draggedId);
    const target = findNodeSiblings(nextData.nodeData, targetId);
    if (!source || !target) return;
    if (source.parentId !== target.parentId) {
      setToolHint("只支持同级章节上下排序");
      return;
    }

    const [draggedNode] = source.siblings.splice(source.index, 1);
    const targetIndex = source.index < target.index ? target.index - 1 : target.index;
    source.siblings.splice(targetIndex, 0, draggedNode);
    mind.refresh(nextData);
    setOutline(buildOutline(nextData));
    setNoteEntries(buildNoteEntries(nextData));
    setSelectedNodeId(draggedId);
    setSelectedNodeCount(1);
    setToolHint("章节顺序已同步");
    onChangeRef.current(nextData);
    requestAnimationFrame(() => {
      const node = mind.findEle(draggedId);
      if (node) mind.selectNode(node);
    });
  };

  const getActiveNode = () => {
    const mind = mindRef.current;
    if (!mind) return null;
    return mind.currentNode ?? mind.findEle(mind.nodeData.id);
  };

  const runWithActiveNode = async (operation: (mind: MindElixirInstance, node: NonNullable<MindElixirInstance["currentNode"]>) => void | Promise<void>) => {
    const mind = mindRef.current;
    const node = getActiveNode();
    if (!mind || !node) return;
    await operation(mind, node);
    syncMindData();
  };

  const replaceSelectedEditText = (format: (selectedText: string) => string) => {
    const input = document.getElementById("input-box");
    const selection = window.getSelection();
    if (!input || !selection || selection.rangeCount === 0 || !input.contains(selection.anchorNode)) {
      return false;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString();
    if (!selectedText) return false;

    range.deleteContents();
    const textNode = document.createTextNode(format(selectedText));
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    return true;
  };

  const updateActiveNodeStyle = async (patch: NonNullable<NodeObj["style"]>) => {
    await runWithActiveNode((mind, node) => {
      const nextStyle = { ...(node.nodeObj.style ?? {}), ...patch };
      return mind.reshapeNode(node, { style: nextStyle });
    });
  };

  const toggleBold = async () => {
    if (replaceSelectedEditText((text) => `**${text}**`)) return;
    const node = getActiveNode();
    const isBold = node?.nodeObj.style?.fontWeight === "800" || node?.nodeObj.style?.fontWeight === "bold";
    await updateActiveNodeStyle({ fontWeight: isBold ? "500" : "800" });
  };

  const applyTextColor = async (color: string) => {
    if (replaceSelectedEditText((text) => `[color=${color}]${text}[/color]`)) return;
    await updateActiveNodeStyle({ color });
  };

  const applyTextMark = async (color: string) => {
    if (replaceSelectedEditText((text) => `[mark=${color}]${text}[/mark]`)) return;
    await runWithActiveNode((mind, node) => {
      const tags = node.nodeObj.tags ?? [];
      const hasMarkTag = tags.some((tag) => (typeof tag === "string" ? tag : tag.text) === "标注");
      return mind.reshapeNode(node, {
        tags: hasMarkTag ? tags : [...tags, { text: "标注", style: { background: color, color: "#111827" } }]
      });
    });
  };

  const createRelationship = () => {
    const mind = mindRef.current;
    if (!mind || mind.currentNodes.length < 2) {
      setToolHint("关系线需要先 Ctrl 多选两个主题");
      return;
    }
    mind.createArrow(mind.currentNodes[0], mind.currentNodes[1], {
      bidirectional: false,
      style: { stroke: "#e86f6f", strokeWidth: 2, labelColor: "#647084" }
    });
    syncMindData();
  };

  const createSummary = () => {
    const mind = mindRef.current;
    if (!mind || mind.currentNodes.length < 2) {
      setToolHint("概要需要先 Ctrl 多选同一组主题");
      return;
    }
    mind.createSummary({ style: { stroke: "#0f766e", labelColor: "#0f766e" } });
    syncMindData();
  };

  const addNodeTag = async () => {
    await runWithActiveNode((mind, node) => {
      const tags = node.nodeObj.tags ?? [];
      const hasTag = tags.some((tag) => (typeof tag === "string" ? tag : tag.text) === "标签");
      return mind.reshapeNode(node, {
        tags: hasTag ? tags : [...tags, { text: "标签", style: { background: "#def7ec", color: "#0f766e" } }]
      });
    });
  };

  const addNodeNote = async () => {
    await runWithActiveNode((mind, node) => mind.reshapeNode(node, { note: node.nodeObj.note || "备注" }));
  };

  const clampPanControl = (value: number) => Math.min(panControlMax, Math.max(panControlMin, value));

  const updatePanControl = (nextValue: { x: number; y: number }) => {
    panControlRef.current = nextValue;
    setPanControl(nextValue);
  };

  const panCanvasBy = (dx: number, dy: number) => {
    const mind = mindRef.current;
    if (!mind) return;
    mind.move(dx, dy);
    updatePanControl({
      x: clampPanControl(panControlRef.current.x + dx / panControlScale),
      y: clampPanControl(panControlRef.current.y + dy / panControlScale)
    });
  };

  const slideCanvasTo = (axis: "x" | "y", value: number) => {
    const nextValue = clampPanControl(value);
    const currentValue = panControlRef.current[axis];
    const delta = (nextValue - currentValue) * panControlScale;
    if (axis === "x") {
      mindRef.current?.move(delta, 0);
      updatePanControl({ ...panControlRef.current, x: nextValue });
    } else {
      mindRef.current?.move(0, delta);
      updatePanControl({ ...panControlRef.current, y: nextValue });
    }
  };

  useEffect(() => {
    if (mode !== "mindmap") return;
    if (!settings.mindMapArrowPan) return;

    const handleArrowPan = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        target?.id === "input-box";

      if (isTextInput) return;

      const distance = event.shiftKey ? 260 : 120;
      const movement: Record<string, [number, number]> = {
        ArrowLeft: [-distance, 0],
        ArrowRight: [distance, 0],
        ArrowUp: [0, -distance],
        ArrowDown: [0, distance]
      };
      const delta = movement[event.key];
      if (!delta) return;

      event.preventDefault();
      panCanvasBy(delta[0], delta[1]);
    };

    window.addEventListener("keydown", handleArrowPan);
    return () => window.removeEventListener("keydown", handleArrowPan);
  }, [mode, settings.mindMapArrowPan]);

  const startCanvasDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragMode) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    canvasDragRef.current = {
      active: true,
      x: event.clientX,
      y: event.clientY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add("dragging");
  };

  const dragCanvas = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = canvasDragRef.current;
    if (!dragState.active) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    panCanvasBy(dx, dy);
    canvasDragRef.current = { active: true, x: event.clientX, y: event.clientY };
  };

  const stopCanvasDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasDragRef.current.active) return;
    event.preventDefault();
    event.stopPropagation();
    canvasDragRef.current.active = false;
    event.currentTarget.classList.remove("dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const updateOutlineScroll = () => {
    const list = outlineListRef.current;
    if (!list) return;
    const maxScroll = Math.max(list.scrollHeight - list.clientHeight, 1);
    setOutlineScroll(Math.round((list.scrollTop / maxScroll) * 1000));
  };

  const slideOutlineTo = (value: number) => {
    const list = outlineListRef.current;
    if (!list) return;
    const maxScroll = Math.max(list.scrollHeight - list.clientHeight, 0);
    if (maxScroll === 0) {
      list.scrollTop = 0;
      setOutlineScroll(0);
      return;
    }
    list.scrollTop = (maxScroll * value) / 1000;
    setOutlineScroll(value);
  };

  const scrollOutlineBy = (distance: number) => {
    const list = outlineListRef.current;
    if (!list) return;
    list.scrollBy({ top: distance, behavior: "smooth" });
    window.setTimeout(updateOutlineScroll, 180);
  };

  const rootNodeId = mindRef.current?.nodeData.id ?? data.nodeData.id;
  const activePageId = selectedPageId ?? rootNodeId;
  const activeEditNodeId = selectedNodeId ?? activePageId;
  const isRootSelected = activeEditNodeId === rootNodeId;
  const canUseMultiNodeTool = selectedNodeCount >= 2;
  const activeOutlineItem = outline.find((item) => item.id === activePageId);
  const activeTopic = activeOutlineItem?.topic ?? title;
  const activeKnowledge = knowledgePoints[activePageId] ?? "";

  return (
    <div className="mindmap-editor-layout">
      <aside className="mindmap-outline">
        <div className="outline-heading">
          <strong>目录</strong>
          <span>{outline.length}</span>
        </div>
        {outline.length > 0 ? (
          <div className="outline-scroll-area">
          <div className="outline-list" onScroll={updateOutlineScroll} ref={outlineListRef}>
            <button
              className={activePageId === rootNodeId ? "outline-item root active" : "outline-item root"}
              onClick={focusRootMindMap}
            >
              主思维导图
            </button>
            {outline.map((item) => (
              <button
                className={[
                  "outline-item",
                  activePageId === item.id ? "active" : "",
                  draggingOutlineId === item.id ? "dragging" : "",
                  outlineDropTargetId === item.id ? "drop-target" : ""
                ].filter(Boolean).join(" ")}
                draggable
                key={item.id}
                onDragEnd={() => {
                  setDraggingOutlineId(null);
                  setOutlineDropTargetId(null);
                }}
                onDragEnter={() => {
                  if (draggingOutlineId && draggingOutlineId !== item.id) {
                    setOutlineDropTargetId(item.id);
                  }
                }}
                onDragOver={(event) => {
                  if (!draggingOutlineId || draggingOutlineId === item.id) return;
                  event.preventDefault();
                }}
                onDragStart={(event) => {
                  setDraggingOutlineId(item.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", item.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const draggedId = event.dataTransfer.getData("text/plain") || draggingOutlineId;
                  setDraggingOutlineId(null);
                  setOutlineDropTargetId(null);
                  if (draggedId) reorderOutlineNode(draggedId, item.id);
                }}
                onClick={() => focusOutlineNode(item.id)}
                style={{ paddingLeft: `${12 + item.depth * 14}px` }}
              >
                {item.topic}
              </button>
            ))}
          </div>
          <div className="outline-scroll-control" aria-label="目录上下滑动">
            <button type="button" title="向上滑动目录" onClick={() => scrollOutlineBy(-128)}>
              <ChevronUp size={15} />
            </button>
            <input
              aria-label="目录上下滑动"
              max={1000}
              min={0}
              onChange={(event) => slideOutlineTo(Number(event.target.value))}
              type="range"
              value={outlineScroll}
            />
            <button type="button" title="向下滑动目录" onClick={() => scrollOutlineBy(128)}>
              <ChevronDown size={15} />
            </button>
          </div>
          </div>
        ) : (
          <div className="outline-empty">暂无分支</div>
        )}
      </aside>
      <div className="mindmap-stage">
        {mode === "knowledge" && (
          <KnowledgePanel
            nodeId={activePageId}
            topic={activeTopic}
            value={activeKnowledge}
            knowledgePoints={knowledgePoints}
            onKnowledgeChange={onKnowledgeChange}
          />
        )}

        {mode === "notes" && (
          <KnowledgeNotesPanel activeNodeId={activePageId} entries={noteEntries} rootNodeId={rootNodeId} title={title} />
        )}

        {shouldMountMindMap && (
          <div
            className={[
              "mindmap-mode-panel",
              mode === "mindmap" ? "active" : "",
              expandedEdit ? "expanded-edit" : ""
            ].filter(Boolean).join(" ")}
            aria-hidden={mode !== "mindmap"}
          >
          <div className="mindmap-format-bar" aria-label="导图排版工具">
            <div className="tool-row primary-tools">
              <div className="tool-group">
                <span>布局</span>
                <button title="双向布局" onClick={() => { mindRef.current?.initSide(); syncMindData(); }}>
                  <Rows3 size={16} />
                  <span>双向</span>
                </button>
                <button title="向右布局" onClick={() => { mindRef.current?.initRight(); syncMindData(); }}>
                  <PanelRight size={16} />
                  <span>向右</span>
                </button>
                <button title="向左布局" onClick={() => { mindRef.current?.initLeft(); syncMindData(); }}>
                  <PanelLeft size={16} />
                  <span>向左</span>
                </button>
                <button
                  className={compactMode ? "active" : ""}
                  title="紧凑排版"
                  onClick={() => {
                    const nextCompactMode = !compactMode;
                    mindRef.current?.changeCompact(nextCompactMode);
                    setCompactMode(nextCompactMode);
                    syncMindData();
                  }}
                >
                  <GitFork size={16} />
                  <span>紧凑</span>
                </button>
              </div>

              <div className="tool-group">
                <span>节点</span>
                <button title="添加子主题" onClick={() => runWithActiveNode((mind, node) => mind.addChild(node))}>
                  <GitBranchPlus size={16} />
                  <span>子主题</span>
                </button>
                <button title="添加同级主题" disabled={isRootSelected} onClick={() => runWithActiveNode((mind, node) => mind.insertSibling("after", node))}>
                  <Plus size={16} />
                  <span>同级</span>
                </button>
                <button title="插入父主题" disabled={isRootSelected} onClick={() => runWithActiveNode((mind, node) => mind.insertParent(node))}>
                  <GitFork size={16} />
                  <span>父级</span>
                </button>
                <button title="删除节点" disabled={isRootSelected} onClick={() => runWithActiveNode((mind, node) => mind.removeNodes([node]))}>
                  <Trash2 size={16} />
                  <span>删除</span>
                </button>
              </div>

              <div className="tool-group">
                <span>元素</span>
                <button className={canUseMultiNodeTool ? "" : "hinted"} title="多选两个主题后创建关系线" onClick={createRelationship}>
                  <Link2 size={16} />
                  <span>关系线</span>
                </button>
                <button className={canUseMultiNodeTool ? "" : "hinted"} title="多选同组主题后创建概要" onClick={createSummary}>
                  <Braces size={16} />
                  <span>概要</span>
                </button>
                <button title="标签" onClick={addNodeTag}>
                  <Tags size={16} />
                  <span>标签</span>
                </button>
                <button title="备注" onClick={addNodeNote}>
                  <StickyNote size={16} />
                  <span>备注</span>
                </button>
              </div>

              <div className="tool-group">
                <span>视图</span>
                <button title="适配视图" onClick={() => mindRef.current?.scaleFit()}>
                  <Maximize2 size={16} />
                  <span>适配</span>
                </button>
                <button title="居中显示" onClick={() => mindRef.current?.toCenter()}>
                  <LocateFixed size={16} />
                  <span>居中</span>
                </button>
                <button
                  className={expandedEdit ? "active" : ""}
                  title={expandedEdit ? "退出放大编辑" : "放大编辑"}
                  onClick={() => {
                    setExpandedEdit((current) => !current);
                    requestAnimationFrame(() => {
                      mindRef.current?.scaleFit();
                      mindRef.current?.toCenter();
                    });
                  }}
                >
                  <Maximize2 size={16} />
                  <span>{expandedEdit ? "退出" : "放大编辑"}</span>
                </button>
                <button
                  className={dragMode ? "active" : ""}
                  title="拖动画布"
                  onClick={() => {
                    setDragMode((current) => !current);
                    setToolHint(dragMode ? "" : "拖动已开启：按住空白区域移动画布");
                  }}
                >
                  <Hand size={16} />
                  <span>拖动</span>
                </button>
                <button title="放大" onClick={() => { const mind = mindRef.current; if (mind) mind.scale(Math.min(mind.scaleVal + 0.1, 2)); }}>
                  <ZoomIn size={16} />
                  <span>放大</span>
                </button>
                <button title="缩小" onClick={() => { const mind = mindRef.current; if (mind) mind.scale(Math.max(mind.scaleVal - 0.1, 0.3)); }}>
                  <ZoomOut size={16} />
                  <span>缩小</span>
                </button>
              </div>

              <div className="tool-group">
                <span>操作</span>
                <button title="撤销" onClick={() => { mindRef.current?.undo(); syncMindData(); }}>
                  <Undo2 size={16} />
                  <span>撤销</span>
                </button>
                <button title="重做" onClick={() => { mindRef.current?.redo(); syncMindData(); }}>
                  <Redo2 size={16} />
                  <span>重做</span>
                </button>
              </div>

              {toolHint && <span className="tool-hint">{toolHint}</span>}
            </div>

            <div className="tool-row format-tools">
              <div className="tool-group style-tools">
                <span>文本</span>
                <button title="加粗" onClick={toggleBold}>
                  <Bold size={16} />
                  <span>加粗</span>
                </button>
                <div className="swatch-set" aria-label="文字颜色">
                  <Palette size={15} />
                  {textColors.map((color) => (
                    <button
                      className="color-swatch"
                      key={color}
                      style={{ "--swatch-color": color } as React.CSSProperties}
                      title={`文字颜色 ${color}`}
                      onClick={() => applyTextColor(color)}
                    />
                  ))}
                </div>
                <div className="swatch-set" aria-label="背景色">
                  <PaintBucket size={15} />
                  {fillColors.map((color) => (
                    <button
                      className="color-swatch fill"
                      key={color}
                      style={{ "--swatch-color": color } as React.CSSProperties}
                      title={`背景色 ${color}`}
                      onClick={() => updateActiveNodeStyle({ background: color })}
                    />
                  ))}
                </div>
                <label className="font-size-select" title="字号">
                  <Type size={15} />
                  <select
                    onChange={(event) => updateActiveNodeStyle({ fontSize: event.target.value })}
                    defaultValue=""
                    aria-label="字号"
                  >
                    <option value="" disabled>
                      字号
                    </option>
                    {fontSizes.map((size) => (
                      <option key={size} value={size}>
                        {size.replace("px", "")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="tool-group annotation-tools">
                <span>标注</span>
                <button title="文本标注" onClick={() => applyTextMark(markColors[0])}>
                  <Highlighter size={16} />
                  <span>标注</span>
                </button>
                <div className="swatch-set" aria-label="标注颜色">
                  {markColors.map((color) => (
                    <button
                      className="color-swatch mark"
                      key={color}
                      style={{ "--swatch-color": color } as React.CSSProperties}
                      title={`标注颜色 ${color}`}
                      onClick={() => applyTextMark(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className={dragMode ? "mindmap-canvas-viewport drag-enabled" : "mindmap-canvas-viewport"}>
            <div className="mindmap-canvas" ref={containerRef} />
            {dragMode && (
              <div
                className="mindmap-pan-layer"
                aria-label="拖动画布"
                onPointerDown={startCanvasDrag}
                onPointerMove={dragCanvas}
                onPointerUp={stopCanvasDrag}
                onPointerCancel={stopCanvasDrag}
                onPointerLeave={stopCanvasDrag}
              />
            )}
            <div className="canvas-pan-control horizontal" aria-label="左右滑动画布">
              <button type="button" title="向左滑动" onClick={() => panCanvasBy(-160, 0)}>
                <ChevronLeft size={17} />
              </button>
              <input
                aria-label="左右滑动"
                max={panControlMax}
                min={panControlMin}
                onChange={(event) => slideCanvasTo("x", Number(event.target.value))}
                type="range"
                value={panControl.x}
              />
              <button type="button" title="向右滑动" onClick={() => panCanvasBy(160, 0)}>
                <ChevronRight size={17} />
              </button>
            </div>
            <div className="canvas-pan-control vertical" aria-label="上下滑动画布">
              <button type="button" title="向上滑动" onClick={() => panCanvasBy(0, -160)}>
                <ChevronUp size={17} />
              </button>
              <input
                aria-label="上下滑动"
                max={panControlMax}
                min={panControlMin}
                onChange={(event) => slideCanvasTo("y", Number(event.target.value))}
                type="range"
                value={panControl.y}
              />
              <button type="button" title="向下滑动" onClick={() => panCanvasBy(0, 160)}>
                <ChevronDown size={17} />
              </button>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgePanel({
  nodeId,
  topic,
  value,
  knowledgePoints,
  onKnowledgeChange
}: {
  nodeId: string;
  topic: string;
  value: string;
  knowledgePoints: Record<string, string>;
  onKnowledgeChange: (knowledgePoints: Record<string, string>) => void;
}) {
  const [draft, setDraft] = useState(value);
  const latestDraftRef = useRef(value);

  useEffect(() => {
    setDraft(value);
    latestDraftRef.current = value;
  }, [nodeId, value]);

  useEffect(() => {
    if (draft === value) return;
    latestDraftRef.current = draft;
    const timeoutId = window.setTimeout(() => {
      onKnowledgeChange({ ...knowledgePoints, [nodeId]: latestDraftRef.current });
    }, 360);

    return () => window.clearTimeout(timeoutId);
  }, [draft, knowledgePoints, nodeId, onKnowledgeChange, value]);

  const flushDraft = () => {
    if (latestDraftRef.current !== value) {
      onKnowledgeChange({ ...knowledgePoints, [nodeId]: latestDraftRef.current });
    }
  };

  return (
    <section className="knowledge-panel" aria-label="知识点">
      <header className="knowledge-header">
        <div>
          <span>知识点</span>
          <h3>{topic}</h3>
        </div>
        <small>自动保存</small>
      </header>
      <textarea
        value={draft}
        onBlur={flushDraft}
        onChange={(event) => {
          latestDraftRef.current = event.target.value;
          setDraft(event.target.value);
        }}
        placeholder="定义、重点、例子、易错点..."
      />
    </section>
  );
}

function KnowledgeNotesPanel({
  activeNodeId,
  entries,
  rootNodeId,
  title
}: {
  activeNodeId: string;
  entries: NoteEntry[];
  rootNodeId: string;
  title: string;
}) {
  const scopedEntries = useMemo(() => {
    if (activeNodeId === rootNodeId) return entries;
    return entries.filter((entry) => entry.id === activeNodeId || entry.path.some((pathItem) => pathItem.id === activeNodeId));
  }, [activeNodeId, entries, rootNodeId]);
  const leafPages = useMemo(() => {
    const leaves = scopedEntries.filter((entry) => entry.isLeaf);
    return leaves.length > 0 ? leaves : scopedEntries.slice(0, 1);
  }, [scopedEntries]);
  const [pageIndex, setPageIndex] = useState(0);
  const currentPageIndex = Math.min(pageIndex, Math.max(leafPages.length - 1, 0));
  const currentPage = leafPages[currentPageIndex];

  useEffect(() => {
    setPageIndex(0);
  }, [activeNodeId, leafPages.length]);

  return (
    <section className="knowledge-notes-panel" aria-label="知识笔记">
      <header className="knowledge-notes-header">
        <div>
          <span>知识笔记</span>
          <h3>{title}</h3>
        </div>
        <small>{leafPages.length > 0 ? `${currentPageIndex + 1} / ${leafPages.length}` : "0 / 0"}</small>
      </header>

      <div className="knowledge-notes-list">
        {currentPage ? (
          <>
            <div className="note-page-controls">
              <button type="button" disabled={currentPageIndex === 0} onClick={() => setPageIndex((index) => Math.max(index - 1, 0))}>
                <ChevronLeft size={16} />
                上一页
              </button>
              <strong>{currentPage.topic}</strong>
              <button
                type="button"
                disabled={currentPageIndex >= leafPages.length - 1}
                onClick={() => setPageIndex((index) => Math.min(index + 1, leafPages.length - 1))}
              >
                下一页
                <ChevronRight size={16} />
              </button>
            </div>

            <article className="knowledge-note-block note-page" key={currentPage.id}>
              <div className="note-path">
                {currentPage.path.map((pathItem, index) => (
                  <div
                    className={index === currentPage.path.length - 1 ? "note-path-title current" : "note-path-title"}
                    key={pathItem.id}
                    style={{ "--note-depth": pathItem.depth } as React.CSSProperties}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h4>{pathItem.topic}</h4>
                  </div>
                ))}
              </div>

              <div className="note-fixed-body">
                <section>
                  <strong>复习内容</strong>
                  <p>{currentPage.note || "待补充"}</p>
                </section>

                <section>
                  <strong>分支位置</strong>
                  <p>{currentPage.path.map((pathItem) => pathItem.topic).join(" / ")}</p>
                </section>

                {currentPage.tags.length > 0 && (
                  <section>
                    <strong>标签</strong>
                    <div className="note-tags">
                      {currentPage.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </article>
          </>
        ) : (
          <div className="outline-empty">暂无分支</div>
        )}
      </div>
    </section>
  );
}

function LegacyKnowledgeNotesPanel({ title, entries }: { title: string; entries: NoteEntry[] }) {
  return (
    <section className="knowledge-notes-panel" aria-label="知识笔记">
      <header className="knowledge-notes-header">
        <div>
          <span>知识笔记</span>
          <h3>{title}</h3>
        </div>
        <small>{entries.length} 个标题</small>
      </header>

      <div className="knowledge-notes-list">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <article
              className="knowledge-note-block"
              key={entry.id}
              style={{ "--note-depth": entry.depth } as React.CSSProperties}
            >
              <div className="note-title-row">
                <span>{String(entry.order).padStart(2, "0")}</span>
                <h4>{entry.topic}</h4>
              </div>

              <div className="note-fixed-body">
                <section>
                  <strong>复习内容</strong>
                  <p>{entry.note || "待补充"}</p>
                </section>

                <section>
                  <strong>分支结构</strong>
                  {entry.childTopics.length > 0 ? (
                    <ul>
                      {entry.childTopics.map((topic) => (
                        <li key={topic}>{topic}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>无下级分支</p>
                  )}
                </section>

                {entry.tags.length > 0 && (
                  <section>
                    <strong>标签</strong>
                    <div className="note-tags">
                      {entry.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="outline-empty">暂无分支</div>
        )}
      </div>
    </section>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="empty-state">
      <BookOpen size={22} />
      <strong>{title}</strong>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
