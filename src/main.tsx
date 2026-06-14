import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import MindElixir, { SIDE, type MindElixirData, type MindElixirInstance, type NodeObj } from "mind-elixir";
import "mind-elixir/style.css";
import CanvasEditor, {
  getElementListByHTML,
  EditorMode,
  ListStyle,
  ListType,
  PageMode,
  PaperDirection,
  RowFlex,
  TitleLevel,
  WordBreak,
  type IEditorData,
  type IElement,
  type IEditorOption,
  type IRange,
  type IRangeStyle
} from "@hufe921/canvas-editor";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
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
  Download,
  ExternalLink,
  FileText,
  GitBranchPlus,
  GitFork,
  GraduationCap,
  Hand,
  Highlighter,
  Home,
  IndentDecrease,
  IndentIncrease,
  Keyboard,
  LibraryBig,
  Link2,
  List,
  ListOrdered,
  LocateFixed,
  Maximize2,
  NotebookPen,
  PaintBucket,
  PackageCheck,
  Paintbrush,
  Palette,
  PanelLeft,
  PanelRight,
  Plus,
  PlayCircle,
  Printer,
  Redo2,
  RotateCcw,
  Rows3,
  Search,
  Settings,
  Sparkles,
  StickyNote,
  Target,
  Tags,
  Table,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  UsersRound
} from "lucide-react";
import { updateLog, type UpdateLogEntry } from "./updateLog";
import { createCourse, normalizeCourses } from "./domain/course";
import {
  createBranchMindMapStatePatch,
  createCollapsedOutlineStatePatch,
  createHideParentKnowledgePagesPatch,
  createKnowledgeDocumentStatePatch,
  createKnowledgePointStatePatch,
  createMindMapStatePatch,
  createOutlineSyncStatePatch
} from "./domain/courseState";
import { escapeHtml } from "./domain/html";
import {
  applyNumberedOutlineSnapshot,
  buildNoteEntries,
  buildOutline,
  cloneMindData,
  createBranchMindMapFromNode,
  createMindMap,
  findMindMapNode,
  getOutlineAncestorIds,
  getOutlineParentIds,
  getVisibleOutline,
  isBranchMindMapFresh,
  readableMindMapDefaultScale,
  reconcileFreshBranchMindMaps,
  renderKnowledgeBranchHtml,
  updateMindMapBranch
} from "./domain/mindMap";
import type { Course, CourseWorkspaceMode, KnowledgeCanvasDocument, NoteEntry, OutlineItem } from "./domain/types";
import "./styles.css";

type ViewId =
  | "dashboard"
  | "courses"
  | "developer"
  | "plan"
  | "notes"
  | "practice"
  | "assistant"
  | "mcp"
  | "updates"
  | "information"
  | "settings";
type Tone = "teal" | "amber" | "blue" | "rose";

type Task = { title: string; meta: string; progress: number; tone: Tone };
type ScheduleItem = { time: string; title: string; tag: string };
type CourseCenterLabels = {
  centerTitle: string;
  detailBackLabel: string;
  heroTitle: string;
  statusCountSuffix: string;
  createTitle: string;
  titleLabel: string;
  titlePlaceholder: string;
  categoryLabel: string;
  categoryPlaceholder: string;
  defaultCategory: string;
  createButton: string;
  emptyTitle: string;
  categoryFallback: string;
  manageCategory: string;
  continueTitle: string;
  continueFallback: string;
  enterButton: string;
  statsCategorySuffix: string;
  weeklyMeta: string;
  switchKnowledge: string;
  switchNotes: string;
  switchMindmap: string;
  initialBranchTitle: string;
};
type CourseCollectionId = "courses" | "developer";
type CourseCollectionApi = {
  load: () => Promise<unknown>;
  save: (items: unknown) => Promise<void>;
};
type CourseCollectionConfig = {
  id: CourseCollectionId;
  viewId: Extract<ViewId, "courses" | "developer">;
  navLabel: string;
  icon: typeof Home;
  storageKey: string;
  payloadKey: "courses" | "documents";
  labels: CourseCenterLabels;
  getApi: () => CourseCollectionApi | undefined;
};
type KnowledgeFormatBrush = {
  inlineStyles: Record<string, string>;
  blockStyles: Record<string, string>;
  reusable?: boolean;
};
type CanvasKnowledgeFormatBrush = {
  styles: Partial<Pick<IElement, "font" | "size" | "bold" | "italic" | "underline" | "strikeout" | "color" | "highlight" | "rowFlex" | "rowMargin" | "letterSpacing" | "level" | "listType" | "listStyle">>;
  reusable: boolean;
};
type KnowledgeStylePatch = Record<string, string | null | undefined>;
type MindFormatBrush = NonNullable<NodeObj["style"]>;
type KnowledgeHistoryState = {
  canUndo: boolean;
  canRedo: boolean;
};
type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
type AiChatResult = {
  ok?: boolean;
  reply?: string;
  applied?: boolean;
  updatedKnowledgeHtml?: string;
  error?: string;
};
type AiChatProvider = "claude" | "mimo" | "doubao" | "chatgpt";
type SystemContextInfo = {
  app?: Record<string, unknown>;
  paths?: Record<string, unknown>;
  storage?: Record<string, unknown>;
  ai?: Record<string, unknown>;
  docs?: {
    readme?: string;
    projectIndex?: string;
    updateLog?: string;
    readmeContent?: string;
  };
};
type FlowchartNodeKind = "start" | "process" | "decision" | "end";
type FlowchartNode = {
  id: string;
  label: string;
  kind: FlowchartNodeKind;
  x: number;
  y: number;
};
type FlowchartEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
};
type KnowledgeFlowchart = {
  title: string;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
};
type FlowchartEditorState = {
  blockId: string;
  data: KnowledgeFlowchart;
  selectedNodeId: string;
};
type AppSettings = {
  mindMapArrowPan: boolean;
};
type McpNotionImportStatus = {
  contractPath: string;
  contractReady: boolean;
  guidePath: string;
  guideReady: boolean;
  notionCachePath: string;
  notionCacheReady: boolean;
  jsonDatabasePath: string;
  jsonDatabaseReady: boolean;
  mysqlConnected: boolean;
  latestBackupPath: string | null;
  latestBackupReady: boolean;
};
type McpStatusItem = {
  key: string;
  title: string;
  meta: string;
  ready: boolean;
  detail: string;
};
type McpLogEntry = {
  id: string;
  time: string;
  title: string;
  detail: string;
  level: "run" | "ok" | "warn";
};
type ManagedPortPlatformId = "bilibili" | "zhihu" | "doubao" | "chatgpt";
type ManagedPortStatus = {
  id: ManagedPortPlatformId;
  label: string;
  port: number;
  loginUrl: string;
  hostKeyword: string;
  source: string;
  kind?: "cdp";
  endpointLabel?: string;
  loginActionLabel?: string;
  startActionLabel?: string;
  canStartService?: boolean;
  cdpUrl: string;
  profileDir: string;
  profileReady: boolean;
  ready: boolean;
  activeTitle: string;
  activeUrl: string;
  browser: string;
  lastCheckedAt: string;
  error?: string;
};
type OpenManagedLoginWindowResult = {
  opened: boolean;
  message: string;
  status: ManagedPortStatus;
};
type StartManagedPortServiceResult = {
  started: boolean;
  message: string;
  status: ManagedPortStatus;
};
type AiDailySource = "bilibili" | "zhihu";
type AiDailySection = {
  index?: number;
  title?: string;
  text?: string;
};
type AiDailyManifest = {
  source?: AiDailySource;
  bvid?: string;
  zhihuUrl?: string;
  sourceId?: string;
  query?: string;
  title?: string;
  author?: string;
  sourceUrl?: string;
  generatedAt?: string;
  summary?: string;
  runDirectory?: string;
  transcriptPath?: string;
  cleanTranscriptPath?: string;
  markdownPath?: string;
  htmlPath?: string;
  chunkCount?: number;
  sections?: AiDailySection[];
  highlights?: string[];
  qualityNotes?: string[];
};
type AiDailyRunResult = {
  ok: boolean;
  message: string;
  stdout: string;
  stderr: string;
  manifest: AiDailyManifest | null;
};
type AiDailyAutoTask = {
  id: string;
  source: AiDailySource;
  target: string;
  time: string;
  enabled: boolean;
  lastRunDate?: string;
};
type McpPhaseItem = {
  key: string;
  title: string;
  meta: string;
  ready: boolean;
  progress: number;
  icon: React.ReactNode;
};
type AppUpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "error";
type AppUpdateStatus = {
  phase: AppUpdatePhase;
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  canCheck: boolean;
  canDownload: boolean;
  canInstall: boolean;
  isPackaged: boolean;
  source: string;
  releasePageUrl: string;
  message: string;
  error?: string;
  releaseName?: string;
  releaseDate?: string;
  downloadPercent?: number;
  downloadedFile?: string;
};
type AppReleaseCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};
type AppReleaseStatus = {
  version: string;
  tagName: string;
  repository: string;
  branch: string;
  commit: string;
  releaseUrl: string;
  canPublish: boolean;
  message: string;
  checks: AppReleaseCheck[];
};
type AppReleasePublishResult = {
  ok: boolean;
  message: string;
  releaseUrl?: string;
  status?: AppReleaseStatus;
};

const mascotUrl = `${import.meta.env.BASE_URL}mascot.png`;
const coursesStorageKey = "aistudy:courses:v1";
const developerDocumentsStorageKey = "aistudy:developer-documents:v1";
const settingsStorageKey = "aistudy:settings:v1";
const aiDailyTasksStorageKey = "aistudy:ai-daily-tasks:v1";
const courseSaveStatusEvent = "aistudy:course-save-status";
const knowledgeFontFamilies = [
  { label: "微软雅黑", value: "Microsoft YaHei" },
  { label: "宋体", value: "SimSun" },
  { label: "黑体", value: "SimHei" },
  { label: "楷体", value: "KaiTi" },
  { label: "Arial", value: "Arial" },
  { label: "Times", value: "Times New Roman" }
];
const knowledgeFontSizes = ["12px", "14px", "16px", "18px", "20px", "22px", "24px", "28px", "32px", "36px"];
const knowledgeTextColorSwatches = [
  { label: "默认黑", value: "#111827" },
  { label: "灰色", value: "#64748b" },
  { label: "红色", value: "#dc2626" },
  { label: "橙色", value: "#ea580c" },
  { label: "黄色", value: "#ca8a04" },
  { label: "绿色", value: "#16a34a" },
  { label: "青色", value: "#0d9488" },
  { label: "蓝色", value: "#2563eb" },
  { label: "紫色", value: "#7c3aed" },
  { label: "玫红", value: "#db2777" }
];
const knowledgeHistoryLimit = 80;
const knowledgeZoomStorageKey = "aistudy:knowledge-zoom:v1";
const knowledgeFormatDebugStorageKey = "aistudy:knowledge-format-debug:v1";
const knowledgeZoomMin = 0.7;
const knowledgeZoomMax = 1.8;
const knowledgeZoomStep = 0.1;
const knowledgeParagraphPresets = [
  {
    label: "标题一",
    value: "heading1",
    styles: {
      fontFamily: "SimHei",
      fontSize: "28px",
      fontWeight: "800",
      textAlign: "center",
      textIndent: "0"
    }
  },
  {
    label: "标题二",
    value: "heading2",
    styles: {
      fontFamily: "SimHei",
      fontSize: "24px",
      fontWeight: "800",
      textAlign: "left",
      textIndent: "0"
    }
  },
  {
    label: "标题三",
    value: "heading3",
    styles: {
      fontFamily: "SimHei",
      fontSize: "20px",
      fontWeight: "800",
      textAlign: "left",
      textIndent: "0"
    }
  },
  {
    label: "正文",
    value: "body",
    styles: {
      fontFamily: "SimSun",
      fontSize: "16px",
      fontWeight: "400",
      textAlign: "justify",
      textIndent: "2em"
    }
  }
] as const;

type CourseSaveStatus = "saving" | "saved" | "error";

const pendingCollectionSaves: Record<CourseCollectionId, Course[] | null> = {
  courses: null,
  developer: null
};
const collectionSaveInFlight: Record<CourseCollectionId, boolean> = {
  courses: false,
  developer: false
};

function emitCourseSaveStatus(status: CourseSaveStatus) {
  window.dispatchEvent(new CustomEvent(courseSaveStatusEvent, { detail: status }));
}
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
  { id: "plan", label: "学习计划", icon: CalendarDays },
  { id: "notes", label: "知识笔记", icon: NotebookPen },
  { id: "practice", label: "练习中心", icon: Target },
  { id: "assistant", label: "AI 助教", icon: Bot },
  { id: "mcp", label: "MCP", icon: Braces },
  { id: "updates", label: "更新管理", icon: PackageCheck },
  { id: "information", label: "信息搜集", icon: Search }
];

const courseCenterLabels: CourseCenterLabels = {
  centerTitle: "课程中心",
  detailBackLabel: "返回课程中心",
  heroTitle: "课程与思维导图",
  statusCountSuffix: "门课程",
  createTitle: "创建课程",
  titleLabel: "课程名称",
  titlePlaceholder: "金融市场基础知识",
  categoryLabel: "分类",
  categoryPlaceholder: "金融",
  defaultCategory: "金融",
  createButton: "创建并编辑导图",
  emptyTitle: "暂无课程",
  categoryFallback: "未分类",
  manageCategory: "管理分类",
  continueTitle: "继续学习",
  continueFallback: "暂无继续学习课程",
  enterButton: "进入课程",
  statsCategorySuffix: "个学习方向",
  weeklyMeta: "本周 0 节待学",
  switchKnowledge: "知识点",
  switchNotes: "知识笔记",
  switchMindmap: "思维导图",
  initialBranchTitle: "开篇"
};

const developerCenterLabels: CourseCenterLabels = {
  centerTitle: "开发平台",
  detailBackLabel: "返回开发平台",
  heroTitle: "需求文档与结构导图",
  statusCountSuffix: "份需求文档",
  createTitle: "创建需求文档",
  titleLabel: "需求名称",
  titlePlaceholder: "AIstudy 开发需求",
  categoryLabel: "项目",
  categoryPlaceholder: "AIstudy",
  defaultCategory: "AIstudy",
  createButton: "创建并编辑需求",
  emptyTitle: "暂无需求文档",
  categoryFallback: "未归属项目",
  manageCategory: "管理项目",
  continueTitle: "继续编写",
  continueFallback: "暂无继续编写需求",
  enterButton: "进入需求",
  statsCategorySuffix: "个项目方向",
  weeklyMeta: "本周 0 项待写",
  switchKnowledge: "需求内容",
  switchNotes: "需求笔记",
  switchMindmap: "结构导图",
  initialBranchTitle: "需求概述"
};

const courseCollectionIndex: Record<CourseCollectionId, CourseCollectionConfig> = {
  courses: {
    id: "courses",
    viewId: "courses",
    navLabel: "课程库",
    icon: LibraryBig,
    storageKey: coursesStorageKey,
    payloadKey: "courses",
    labels: courseCenterLabels,
    getApi: () => window.aistudy?.courses
  },
  developer: {
    id: "developer",
    viewId: "developer",
    navLabel: "开发平台",
    icon: FileText,
    storageKey: developerDocumentsStorageKey,
    payloadKey: "documents",
    labels: developerCenterLabels,
    getApi: () => window.aistudy?.developerDocuments
  }
};

const courseCollectionNavItems = Object.values(courseCollectionIndex).map((collection) => ({
  id: collection.viewId,
  label: collection.navLabel,
  icon: collection.icon
}));

const allNavItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  navItems[0],
  ...courseCollectionNavItems,
  ...navItems.slice(1)
];

function getCourseCollectionByView(viewId: ViewId) {
  return Object.values(courseCollectionIndex).find((collection) => collection.viewId === viewId) ?? null;
}

const focusTasks: Task[] = [];
const schedule: ScheduleItem[] = [];
const insights: string[] = [];

function loadCourseCollection(collection: CourseCollectionConfig): Course[] {
  try {
    const raw = localStorage.getItem(collection.storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Course[];
    return normalizeCourses(parsed, collection.labels.initialBranchTitle);
  } catch {
    return [];
  }
}

function readPersistedCourseCollectionPayload(value: unknown, collection: CourseCollectionConfig): Course[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return normalizeCourses(value, collection.labels.initialBranchTitle);
  if (typeof value === "object" && collection.payloadKey in value) {
    return normalizeCourses((value as Record<string, unknown>)[collection.payloadKey], collection.labels.initialBranchTitle);
  }
  return null;
}

async function loadPersistedCourseCollection(collection: CourseCollectionConfig): Promise<Course[] | null> {
  const api = collection.getApi();
  if (!api) return null;
  const payload = await api.load();
  return readPersistedCourseCollectionPayload(payload, collection);
}

async function drainCourseCollectionSaveQueue(collection: CourseCollectionConfig) {
  if (collectionSaveInFlight[collection.id]) return;
  collectionSaveInFlight[collection.id] = true;

  while (pendingCollectionSaves[collection.id]) {
    const itemsToSave = pendingCollectionSaves[collection.id];
    pendingCollectionSaves[collection.id] = null;
    emitCourseSaveStatus("saving");

    try {
      await collection.getApi()?.save(itemsToSave);
      emitCourseSaveStatus("saved");
    } catch (error) {
      console.error(`Failed to save ${collection.id} database`, error);
      emitCourseSaveStatus("error");
    }
  }

  collectionSaveInFlight[collection.id] = false;
}

function saveCourseCollection(collection: CourseCollectionConfig, items: Course[]) {
  const snapshot = normalizeCourses(
    JSON.parse(JSON.stringify(items)) as Course[],
    collection.labels.initialBranchTitle
  );
  localStorage.setItem(collection.storageKey, JSON.stringify(snapshot));

  if (!collection.getApi()?.save) {
    emitCourseSaveStatus("saved");
    return;
  }

  pendingCollectionSaves[collection.id] = snapshot;
  void drainCourseCollectionSaveQueue(collection);
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

function loadAiDailyAutoTasks(): AiDailyAutoTask[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(aiDailyTasksStorageKey) || "[]") as AiDailyAutoTask[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((task) =>
        task &&
        (task.source === "bilibili" || task.source === "zhihu") &&
        typeof task.target === "string" &&
        /^\d{2}:\d{2}$/.test(task.time)
      )
      .map((task) => ({
        ...task,
        enabled: Boolean(task.enabled)
      }));
  } catch {
    return [];
  }
}

function saveAiDailyAutoTasks(tasks: AiDailyAutoTask[]) {
  localStorage.setItem(aiDailyTasksStorageKey, JSON.stringify(tasks));
}

function clampKnowledgeZoom(value: number) {
  return Math.min(knowledgeZoomMax, Math.max(knowledgeZoomMin, value));
}

function loadKnowledgeZoom() {
  const raw = Number(localStorage.getItem(knowledgeZoomStorageKey));
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return clampKnowledgeZoom(raw);
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

function renderMindMapText(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[color=(#[0-9a-fA-F]{3,6})\](.+?)\[\/color\]/g, '<span style="color:$1">$2</span>')
    .replace(/\[mark=(#[0-9a-fA-F]{3,6})\](.+?)\[\/mark\]/g, '<mark style="background:$1">$2</mark>');
}

function hasKnowledgeContent(rawHtml: string | undefined) {
  if (!rawHtml) return false;
  const container = document.createElement("div");
  container.innerHTML = rawHtml;
  const text = (container.textContent ?? "").replace(/\u00a0/g, " ").trim();
  if (text.length > 0) return true;
  return Boolean(container.querySelector("img, svg, canvas, table, ul, ol, li, .knowledge-flowchart, .knowledge-branch-map"));
}

function hasCanvasElementContent(value: unknown): boolean {
  if (typeof value === "string") return value.replace(/\u00a0/g, " ").trim().length > 0;
  if (Array.isArray(value)) return value.some(hasCanvasElementContent);
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some(hasCanvasElementContent);
}

function hasKnowledgeDocumentContent(document: KnowledgeCanvasDocument | null | undefined) {
  if (!document) return false;
  if (hasKnowledgeContent(document.html)) return true;
  return hasCanvasElementContent(document.data?.main);
}

function createDefaultFlowchart(): KnowledgeFlowchart {
  const startId = crypto.randomUUID();
  const processId = crypto.randomUUID();
  const endId = crypto.randomUUID();
  return {
    title: "流程图",
    nodes: [
      { id: startId, label: "开始", kind: "start", x: 80, y: 90 },
      { id: processId, label: "处理步骤", kind: "process", x: 280, y: 90 },
      { id: endId, label: "结束", kind: "end", x: 500, y: 90 }
    ],
    edges: [
      { id: crypto.randomUUID(), from: startId, to: processId, label: "" },
      { id: crypto.randomUUID(), from: processId, to: endId, label: "" }
    ]
  };
}

function normalizeFlowchartData(value: Partial<KnowledgeFlowchart> | null | undefined): KnowledgeFlowchart {
  const fallback = createDefaultFlowchart();
  const nodes = Array.isArray(value?.nodes)
    ? value.nodes
        .filter((node): node is FlowchartNode => Boolean(node?.id))
        .map((node) => ({
          id: node.id,
          label: node.label || "节点",
          kind: ["start", "process", "decision", "end"].includes(node.kind) ? node.kind : "process",
          x: Number.isFinite(node.x) ? node.x : 120,
          y: Number.isFinite(node.y) ? node.y : 120
        }))
    : fallback.nodes;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(value?.edges)
    ? value.edges
        .filter((edge): edge is FlowchartEdge => Boolean(edge?.id && nodeIds.has(edge.from) && nodeIds.has(edge.to)))
        .map((edge) => ({ id: edge.id, from: edge.from, to: edge.to, label: edge.label || "" }))
    : fallback.edges;

  return {
    title: value?.title || fallback.title,
    nodes: nodes.length > 0 ? nodes : fallback.nodes,
    edges
  };
}

function getFlowchartBounds(data: KnowledgeFlowchart) {
  const maxX = Math.max(620, ...data.nodes.map((node) => node.x + 160));
  const maxY = Math.max(260, ...data.nodes.map((node) => node.y + 110));
  return { width: maxX, height: maxY };
}

function getFlowchartNodeCenter(node: FlowchartNode) {
  return { x: node.x + 64, y: node.y + 28 };
}

function renderFlowchartNodeSvg(node: FlowchartNode) {
  const label = escapeHtml(node.label);
  if (node.kind === "decision") {
    const points = `${node.x + 64},${node.y} ${node.x + 128},${node.y + 28} ${node.x + 64},${node.y + 56} ${node.x},${node.y + 28}`;
    return `<polygon points="${points}" class="flowchart-node-shape decision" /><text x="${node.x + 64}" y="${node.y + 32}" text-anchor="middle">${label}</text>`;
  }

  const rx = node.kind === "process" ? 8 : 28;
  return `<rect x="${node.x}" y="${node.y}" width="128" height="56" rx="${rx}" class="flowchart-node-shape ${node.kind}" /><text x="${node.x + 64}" y="${node.y + 32}" text-anchor="middle">${label}</text>`;
}

function renderFlowchartSvg(data: KnowledgeFlowchart) {
  const normalizedData = normalizeFlowchartData(data);
  const bounds = getFlowchartBounds(normalizedData);
  const nodeMap = new Map(normalizedData.nodes.map((node) => [node.id, node]));
  const edges = normalizedData.edges
    .map((edge) => {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (!from || !to) return "";
      const start = getFlowchartNodeCenter(from);
      const end = getFlowchartNodeCenter(to);
      const labelX = (start.x + end.x) / 2;
      const labelY = (start.y + end.y) / 2 - 8;
      return [
        `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" class="flowchart-edge-line" marker-end="url(#flowchart-arrow)" />`,
        edge.label ? `<text x="${labelX}" y="${labelY}" class="flowchart-edge-label" text-anchor="middle">${escapeHtml(edge.label)}</text>` : ""
      ].join("");
    })
    .join("");
  const nodes = normalizedData.nodes.map(renderFlowchartNodeSvg).join("");

  return [
    `<svg viewBox="0 0 ${bounds.width} ${bounds.height}" role="img" aria-label="${escapeHtml(normalizedData.title)}">`,
    "<defs>",
    '<marker id="flowchart-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">',
    '<path d="M0,0 L0,6 L8,3 z" />',
    "</marker>",
    "</defs>",
    edges,
    nodes,
    "</svg>"
  ].join("");
}

function renderKnowledgeFlowchartHtml(data: KnowledgeFlowchart, blockId: string = crypto.randomUUID()) {
  const normalizedData = normalizeFlowchartData(data);
  const encodedData = encodeURIComponent(JSON.stringify(normalizedData));
  return [
    `<section class="knowledge-flowchart" contenteditable="false" data-flowchart-id="${escapeHtml(blockId)}" data-flowchart="${encodedData}">`,
    '<div class="flowchart-heading">',
    `<strong>${escapeHtml(normalizedData.title)}</strong>`,
    '<div><button class="flowchart-edit" type="button">编辑</button><button class="flowchart-delete" type="button">删除</button></div>',
    "</div>",
    `<div class="flowchart-preview">${renderFlowchartSvg(normalizedData)}</div>`,
    "</section>",
    "<p><br></p>"
  ].join("");
}

function parseKnowledgeFlowchart(element: Element): KnowledgeFlowchart {
  try {
    const encoded = element.getAttribute("data-flowchart");
    if (!encoded) return createDefaultFlowchart();
    return normalizeFlowchartData(JSON.parse(decodeURIComponent(encoded)) as KnowledgeFlowchart);
  } catch {
    return createDefaultFlowchart();
  }
}

function useCourseCollectionStore(collection: CourseCollectionConfig) {
  const [items, setItems] = useState<Course[]>(() => loadCourseCollection(collection));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [storeReady, setStoreReady] = useState(false);
  const latestItemsRef = useRef(items);
  const hasLocalMutationRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    loadPersistedCourseCollection(collection)
      .then((persistedItems) => {
        if (cancelled) return;
        if (hasLocalMutationRef.current) return;
        const localItems = loadCourseCollection(collection);

        if (persistedItems && persistedItems.length > 0) {
          latestItemsRef.current = persistedItems;
          setItems(persistedItems);
        } else if (localItems.length > 0) {
          latestItemsRef.current = localItems;
          void collection.getApi()?.save(localItems);
        }
      })
      .catch((error) => {
        console.error(`Failed to load ${collection.id} database`, error);
      })
      .finally(() => {
        if (!cancelled) setStoreReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [collection]);

  useEffect(() => {
    latestItemsRef.current = items;
    if (!storeReady) return;
    return scheduleIdleTask(() => saveCourseCollection(collection, items), 650);
  }, [collection, storeReady, items]);

  useEffect(() => {
    const flushItems = () => saveCourseCollection(collection, latestItemsRef.current);
    window.addEventListener("beforeunload", flushItems);
    return () => window.removeEventListener("beforeunload", flushItems);
  }, [collection]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const createItem = useCallback((item: Course) => {
    hasLocalMutationRef.current = true;
    setItems((current) => {
      const nextItems = [item, ...current];
      latestItemsRef.current = nextItems;
      saveCourseCollection(collection, nextItems);
      return nextItems;
    });
    setSelectedId(item.id);
  }, [collection]);

  const updateItem = useCallback((itemId: string, patch: Partial<Course> | ((item: Course) => Partial<Course>)) => {
    hasLocalMutationRef.current = true;
    setItems((current) => {
      const nextItems = current.map((item) =>
        item.id === itemId
          ? { ...item, ...(typeof patch === "function" ? patch(item) : patch) }
          : item
      );
      latestItemsRef.current = nextItems;
      saveCourseCollection(collection, nextItems);
      return nextItems;
    });
  }, [collection]);

  return {
    items,
    selectedItem,
    setSelectedId,
    clearSelection: () => setSelectedId(null),
    createItem,
    updateItem
  };
}

function App() {
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const courseStore = useCourseCollectionStore(courseCollectionIndex.courses);
  const developerStore = useCourseCollectionStore(courseCollectionIndex.developer);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const activeCourseCollection = getCourseCollectionByView(activeView);
  const activeCourseStore = activeCourseCollection?.id === "courses"
    ? courseStore
    : activeCourseCollection?.id === "developer"
      ? developerStore
      : null;

  useEffect(() => {
    return scheduleIdleTask(() => saveSettings(settings), 250);
  }, [settings]);

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="sidebar">
        <div className="brand">
          <img src={mascotUrl} alt="" />
          <div>
            <strong>AIstudy</strong>
            <span>Learning Studio</span>
          </div>
        </div>

        <nav className="nav-list">
          {allNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeView === item.id ? "nav-item active" : "nav-item"}
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  if (item.id !== courseCollectionIndex.courses.viewId) courseStore.clearSelection();
                  if (item.id !== courseCollectionIndex.developer.viewId) developerStore.clearSelection();
                }}
              >
                <Icon size={18} strokeWidth={2.1} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="focus-card" aria-label="focus">
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
            courseStore.clearSelection();
            developerStore.clearSelection();
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
              {activeCourseCollection && activeCourseStore
                ? activeCourseStore.selectedItem
                  ? activeCourseStore.selectedItem.title
                  : activeCourseCollection.labels.centerTitle
                : activeView === "updates"
                  ? "更新管理"
                : activeView === "mcp"
                    ? "MCP"
                  : activeView === "information"
                    ? "信息搜集"
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

        {activeCourseCollection && activeCourseStore ? (
          <CourseCenter
            courses={activeCourseStore.items}
            selectedCourse={activeCourseStore.selectedItem}
            onCreateCourse={activeCourseStore.createItem}
            onSelectCourse={activeCourseStore.setSelectedId}
            onBack={activeCourseStore.clearSelection}
            onUpdateCourse={activeCourseStore.updateItem}
            settings={settings}
            labels={activeCourseCollection.labels}
          />
        ) : activeView === "updates" ? (
          <UpdateManager />
        ) : activeView === "mcp" ? (
          <McpPanel />
        ) : activeView === "information" ? (
          <InformationCollectionPage />
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

function InformationCollectionPage() {
  const [activeInformationTab, setActiveInformationTab] = useState<"ports" | "aiDaily">("ports");
  const [ports, setPorts] = useState<ManagedPortStatus[]>([]);
  const [isLoadingPorts, setIsLoadingPorts] = useState(false);
  const [openingPortId, setOpeningPortId] = useState<ManagedPortPlatformId | null>(null);
  const [startingPortId, setStartingPortId] = useState<ManagedPortPlatformId | null>(null);
  const [portMessage, setPortMessage] = useState("");
  const [aiDailySource, setAiDailySource] = useState<AiDailySource>("bilibili");
  const [aiDailyBvid, setAiDailyBvid] = useState("BV1fPJ76wEYA");
  const [aiDailyZhihuUrl, setAiDailyZhihuUrl] = useState("");
  const [aiDailyQuery, setAiDailyQuery] = useState("");
  const [aiDailyEngine, setAiDailyEngine] = useState<"auto" | "whisper" | "funasr">("auto");
  const [aiDailyForceTranscribe, setAiDailyForceTranscribe] = useState(false);
  const [isRunningAiDaily, setIsRunningAiDaily] = useState(false);
  const [isLoadingAiDaily, setIsLoadingAiDaily] = useState(false);
  const [aiDailyMessage, setAiDailyMessage] = useState("");
  const [aiDailyManifest, setAiDailyManifest] = useState<AiDailyManifest | null>(null);
  const [aiDailyRunResult, setAiDailyRunResult] = useState<AiDailyRunResult | null>(null);
  const [aiDailyTasks, setAiDailyTasks] = useState<AiDailyAutoTask[]>(() => loadAiDailyAutoTasks());
  const [aiDailyTaskSource, setAiDailyTaskSource] = useState<AiDailySource>("bilibili");
  const [aiDailyTaskTarget, setAiDailyTaskTarget] = useState("");
  const [aiDailyTaskTime, setAiDailyTaskTime] = useState("09:00");

  const loadPortStatuses = useCallback(async () => {
    setIsLoadingPorts(true);
    try {
      const result = await window.aistudy?.ports?.status?.();
      if (!Array.isArray(result)) {
        throw new Error("端口接口未就绪");
      }
      setPorts((result as ManagedPortStatus[]).sort((a, b) => a.port - b.port));
      setPortMessage("");
    } catch (error) {
      setPortMessage(error instanceof Error ? error.message : "端口状态读取失败");
    } finally {
      setIsLoadingPorts(false);
    }
  }, []);

  useEffect(() => {
    if (activeInformationTab === "ports") {
      void loadPortStatuses();
    }
  }, [activeInformationTab, loadPortStatuses]);

  const loadAiDailyManifest = useCallback(async () => {
    setIsLoadingAiDaily(true);
    try {
      const result = await window.aistudy?.aiDaily?.latest?.();
      setAiDailyManifest(result && typeof result === "object" ? result as AiDailyManifest : null);
      setAiDailyMessage("");
    } catch (error) {
      setAiDailyMessage(error instanceof Error ? error.message : "日报状态读取失败");
    } finally {
      setIsLoadingAiDaily(false);
    }
  }, []);

  useEffect(() => {
    if (activeInformationTab === "aiDaily") {
      void loadAiDailyManifest();
    }
  }, [activeInformationTab, loadAiDailyManifest]);

  const openLoginWindow = async (platformId: ManagedPortPlatformId) => {
    setOpeningPortId(platformId);
    try {
      const result = await window.aistudy?.ports?.openLoginWindow?.(platformId);
      if (!result || typeof result !== "object") {
        throw new Error("登录窗口接口未就绪");
      }

      const payload = result as OpenManagedLoginWindowResult;
      setPorts((current) => {
        const next = current.some((port) => port.id === payload.status.id)
          ? current.map((port) => (port.id === payload.status.id ? payload.status : port))
          : [...current, payload.status];
        return next.sort((a, b) => a.port - b.port);
      });
      setPortMessage(payload.message);
    } catch (error) {
      setPortMessage(error instanceof Error ? error.message : "登录窗口打开失败");
    } finally {
      setOpeningPortId(null);
    }
  };

  const startPortService = async (platformId: ManagedPortPlatformId) => {
    setStartingPortId(platformId);
    try {
      const result = await window.aistudy?.ports?.startService?.(platformId);
      if (!result || typeof result !== "object") {
        throw new Error("端口启动接口未就绪");
      }

      const payload = result as StartManagedPortServiceResult;
      setPorts((current) => {
        const next = current.some((port) => port.id === payload.status.id)
          ? current.map((port) => (port.id === payload.status.id ? payload.status : port))
          : [...current, payload.status];
        return next.sort((a, b) => a.port - b.port);
      });
      setPortMessage(payload.message);
    } catch (error) {
      setPortMessage(error instanceof Error ? error.message : "端口启动失败");
    } finally {
      setStartingPortId(null);
    }
  };

  useEffect(() => {
    saveAiDailyAutoTasks(aiDailyTasks);
  }, [aiDailyTasks]);

  const addAiDailyTask = () => {
    const target = aiDailyTaskTarget.trim();
    if (!target) return;
    setAiDailyTasks((current) => [
      {
        id: crypto.randomUUID(),
        source: aiDailyTaskSource,
        target,
        time: aiDailyTaskTime,
        enabled: true
      },
      ...current
    ]);
    setAiDailyTaskTarget("");
  };

  const toggleAiDailyTask = (taskId: string) => {
    setAiDailyTasks((current) =>
      current.map((task) => task.id === taskId ? { ...task, enabled: !task.enabled } : task)
    );
  };

  const removeAiDailyTask = (taskId: string) => {
    setAiDailyTasks((current) => current.filter((task) => task.id !== taskId));
  };

  const runAiDailyWorkflow = async (task?: AiDailyAutoTask) => {
    const source = task?.source ?? aiDailySource;
    const target = task?.target.trim() ?? (source === "zhihu" ? aiDailyZhihuUrl.trim() : aiDailyBvid.trim());
    setIsRunningAiDaily(true);
    setAiDailyRunResult(null);
    try {
      const result = await window.aistudy?.aiDaily?.run?.({
        source,
        bvid: source === "bilibili" ? target : aiDailyBvid,
        zhihuUrl: source === "zhihu" ? target : aiDailyZhihuUrl,
        query: aiDailyQuery,
        engine: aiDailyEngine,
        forceTranscribe: aiDailyForceTranscribe
      });
      if (!result || typeof result !== "object") {
        throw new Error("AI日报接口未就绪");
      }
      const payload = result as AiDailyRunResult;
      setAiDailyRunResult(payload);
      setAiDailyManifest(payload.manifest);
      setAiDailyMessage(task ? `自动任务已执行：${payload.message}` : payload.message);
    } catch (error) {
      setAiDailyMessage(error instanceof Error ? error.message : "AI日报生成失败");
    } finally {
      setIsRunningAiDaily(false);
    }
  };

  useEffect(() => {
    if (activeInformationTab !== "aiDaily") return undefined;
    const timer = window.setInterval(() => {
      if (isRunningAiDaily) return;
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const dueTask = aiDailyTasks.find((task) => task.enabled && task.time === currentTime && task.lastRunDate !== today);
      if (!dueTask) return;
      setAiDailyTasks((current) =>
        current.map((task) => task.id === dueTask.id ? { ...task, lastRunDate: today } : task)
      );
      void runAiDailyWorkflow(dueTask);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [activeInformationTab, aiDailyTasks, isRunningAiDaily]);

  const openAiDailyArtifact = async (filePath?: string) => {
    if (!filePath) return;
    try {
      await window.aistudy?.aiDaily?.openArtifact?.(filePath);
      setAiDailyMessage("文件已打开");
    } catch (error) {
      setAiDailyMessage(error instanceof Error ? error.message : "文件打开失败");
    }
  };

  const aiDailyHighlights = Array.isArray(aiDailyManifest?.highlights) ? aiDailyManifest.highlights : [];
  const aiDailySummary = aiDailyManifest?.summary || aiDailyHighlights[0] || "";
  const aiDailyManifestSource = aiDailyManifest?.source === "zhihu" ? "zhihu" : "bilibili";
  const aiDailySourceLabel = aiDailyManifestSource === "zhihu" ? "知乎文章" : "Bilibili";
  const aiDailyCurrentTarget = aiDailySource === "zhihu" ? aiDailyZhihuUrl.trim() : aiDailyBvid.trim();
  const aiDailyMetaRows = [
    [aiDailyManifestSource === "zhihu" ? "文章标题" : "视频标题", aiDailyManifest?.title],
    [aiDailyManifestSource === "zhihu" ? "作者" : "UP主", aiDailyManifest?.author],
    [aiDailyManifestSource === "zhihu" ? "知乎链接" : "BV号", aiDailyManifestSource === "zhihu" ? aiDailyManifest?.zhihuUrl : aiDailyManifest?.bvid],
    ["生成时间", aiDailyManifest?.generatedAt]
  ].filter(([, value]) => Boolean(value));

  return (
    <section className="information-collection-page" aria-label="信息搜集">
      <nav className="information-top-nav" aria-label="信息搜集导航">
        <button
          className={activeInformationTab === "ports" ? "active" : ""}
          type="button"
          aria-current={activeInformationTab === "ports" ? "page" : undefined}
          onClick={() => setActiveInformationTab("ports")}
        >
          端口管理
        </button>
        <button
          className={activeInformationTab === "aiDaily" ? "active" : ""}
          type="button"
          aria-current={activeInformationTab === "aiDaily" ? "page" : undefined}
          onClick={() => setActiveInformationTab("aiDaily")}
        >
          AI日报
        </button>
      </nav>
      {activeInformationTab === "ports" ? (
        <section className="information-panel port-management-panel" aria-label="端口管理">
          <header className="port-management-header">
            <div className="port-management-title">
              <Sparkles size={18} />
              <strong>平台登录窗口</strong>
              <span>{isLoadingPorts ? "检测中" : `${ports.length} 个端口`}</span>
            </div>
            <button className="secondary-button port-refresh-button" type="button" onClick={() => void loadPortStatuses()} disabled={isLoadingPorts}>
              <RotateCcw size={16} />
              <span>{isLoadingPorts ? "检测中" : "刷新"}</span>
            </button>
          </header>

          {portMessage && <p className="port-status-message">{portMessage}</p>}

          <div className="port-card-grid">
            {ports.map((port) => (
              <article className={port.ready ? "port-card ready" : "port-card"} key={port.id}>
                <header className="port-card-header">
                  <div className="port-card-title">
                    {port.ready ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}
                    <div>
                      <strong>{port.label}</strong>
                      <span>{port.source}</span>
                    </div>
                  </div>
                  <span className={port.ready ? "port-status-badge ready" : "port-status-badge"}>
                    {port.ready ? "已连接" : "未启动"}
                  </span>
                </header>

                <div className="port-detail-list">
                  <div className="port-row">
                    <span>端口</span>
                    <code>{port.port}</code>
                  </div>
                  <div className="port-row">
                    <span>{port.endpointLabel || "CDP"}</span>
                    <code title={port.cdpUrl}>{port.cdpUrl}</code>
                  </div>
                  <div className="port-row">
                    <span>Profile</span>
                    <code title={port.profileDir}>{port.profileReady ? "已创建" : "待创建"}</code>
                  </div>
                  <div className="port-row">
                    <span>当前页</span>
                    <code title={port.activeUrl || port.error || ""}>
                      {port.activeTitle || (port.ready ? "Chrome 已连接" : "等待登录窗口")}
                    </code>
                  </div>
                </div>

                <div className="port-card-actions">
                  {port.canStartService ? (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void startPortService(port.id)}
                      disabled={startingPortId === port.id}
                    >
                      {startingPortId === port.id ? <Clock3 size={16} /> : <RotateCcw size={16} />}
                      <span>{startingPortId === port.id ? "启动中" : (port.startActionLabel || "启动服务")}</span>
                    </button>
                  ) : null}
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void openLoginWindow(port.id)}
                    disabled={openingPortId === port.id}
                  >
                    {openingPortId === port.id ? <Clock3 size={16} /> : <Link2 size={16} />}
                    <span>{openingPortId === port.id ? "打开中" : (port.loginActionLabel || "打开登录窗口")}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="information-panel ai-daily-panel" aria-label="AI日报">
          <header className="ai-daily-header">
            <div className="ai-daily-title">
              <FileText size={18} />
              <strong>视频日报</strong>
              <span>{isRunningAiDaily ? "生成中" : aiDailyManifest ? "已生成" : "未生成"}</span>
            </div>
            <button className="secondary-button port-refresh-button" type="button" onClick={() => void loadAiDailyManifest()} disabled={isLoadingAiDaily || isRunningAiDaily}>
              <RotateCcw size={16} />
              <span>{isLoadingAiDaily ? "读取中" : "刷新"}</span>
            </button>
          </header>

          {aiDailyMessage && (
            <p className={aiDailyRunResult?.ok === false ? "ai-daily-message error" : "ai-daily-message"}>
              {aiDailyMessage}
            </p>
          )}

          <div className="ai-daily-layout">
            <div className="ai-daily-side">
              <details className="ai-daily-fold ai-daily-settings" open>
              <summary>
                <span>生成设置</span>
                <small>{aiDailyCurrentTarget || "待填写"}</small>
              </summary>
              <form
                className="ai-daily-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runAiDailyWorkflow();
                }}
              >
                <label>
                  <span>来源</span>
                  <select value={aiDailySource} onChange={(event) => setAiDailySource(event.target.value as AiDailySource)}>
                    <option value="bilibili">Bilibili 视频</option>
                    <option value="zhihu">知乎文章</option>
                  </select>
                </label>
                {aiDailySource === "zhihu" ? (
                  <label>
                    <span>知乎链接</span>
                    <input value={aiDailyZhihuUrl} onChange={(event) => setAiDailyZhihuUrl(event.target.value)} placeholder="https://zhuanlan.zhihu.com/p/..." />
                  </label>
                ) : (
                  <label>
                    <span>BV号</span>
                    <input value={aiDailyBvid} onChange={(event) => setAiDailyBvid(event.target.value)} placeholder="BV1fPJ76wEYA" />
                  </label>
                )}
                <label>
                  <span>搜索词</span>
                  <input value={aiDailyQuery} onChange={(event) => setAiDailyQuery(event.target.value)} placeholder="可选" />
                </label>
                <label>
                  <span>转录</span>
                  <select value={aiDailyEngine} onChange={(event) => setAiDailyEngine(event.target.value as "auto" | "whisper" | "funasr")}>
                    <option value="auto">自动</option>
                    <option value="whisper">Whisper</option>
                    <option value="funasr">FunASR</option>
                  </select>
                </label>
                <label className="ai-daily-check">
                  <input
                    type="checkbox"
                    checked={aiDailyForceTranscribe}
                    onChange={(event) => setAiDailyForceTranscribe(event.target.checked)}
                  />
                  <span>重新转录</span>
                </label>
                <button className="primary-button ai-daily-run-button" type="submit" disabled={isRunningAiDaily || !aiDailyCurrentTarget}>
                  {isRunningAiDaily ? <Clock3 size={16} /> : <PlayCircle size={16} />}
                  <span>{isRunningAiDaily ? "生成中" : "生成日报"}</span>
                </button>
              </form>
              </details>

              <section className="ai-daily-task-panel" aria-label="自动日报任务">
                <header className="ai-daily-task-header">
                  <div>
                    <strong>自动日报任务</strong>
                    <span>{aiDailyTasks.filter((task) => task.enabled).length} 个启用</span>
                  </div>
                  <Clock3 size={18} />
                </header>

                <div className="ai-daily-task-form">
                  <select value={aiDailyTaskSource} onChange={(event) => setAiDailyTaskSource(event.target.value as AiDailySource)} aria-label="任务渠道">
                    <option value="bilibili">Bilibili</option>
                    <option value="zhihu">知乎</option>
                  </select>
                  <input
                    value={aiDailyTaskTarget}
                    onChange={(event) => setAiDailyTaskTarget(event.target.value)}
                    placeholder={aiDailyTaskSource === "zhihu" ? "知乎文章链接" : "BV号"}
                    aria-label="任务目标"
                  />
                  <input value={aiDailyTaskTime} onChange={(event) => setAiDailyTaskTime(event.target.value)} type="time" aria-label="执行时间" />
                  <button className="secondary-button" type="button" onClick={addAiDailyTask} disabled={!aiDailyTaskTarget.trim()}>
                    <Plus size={16} />
                    <span>添加</span>
                  </button>
                </div>

                <div className="ai-daily-task-list">
                  {aiDailyTasks.length > 0 ? (
                    aiDailyTasks.map((task) => (
                      <article className={task.enabled ? "ai-daily-task-row enabled" : "ai-daily-task-row"} key={task.id}>
                        <label className="ai-daily-task-toggle">
                          <input type="checkbox" checked={task.enabled} onChange={() => toggleAiDailyTask(task.id)} />
                          <span>{task.enabled ? "启用" : "暂停"}</span>
                        </label>
                        <div>
                          <strong>{task.source === "zhihu" ? "知乎" : "Bilibili"} · {task.time}</strong>
                          <span title={task.target}>{task.target}</span>
                        </div>
                        <button className="icon-button compact" type="button" aria-label="删除任务" onClick={() => removeAiDailyTask(task.id)}>
                          <Trash2 size={16} />
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="ai-daily-empty compact">暂无自动任务</div>
                  )}
                </div>
              </section>
            </div>

            <section className="ai-daily-result" aria-label="最近日报">
              <header className="ai-daily-result-header">
                <div>
                  <strong>{aiDailyManifest?.title || "暂无日报"}</strong>
                  <span>
                    {aiDailyManifest?.generatedAt || "等待生成"}
                    {aiDailyManifest?.chunkCount ? ` · ${aiDailyManifest.chunkCount} 个分段` : ""}
                  </span>
                </div>
                {aiDailyRunResult?.ok && <CheckCircle2 size={18} />}
              </header>

              {aiDailyManifest ? (
                <div className="ai-daily-fold-list">
                  <article className="ai-daily-brief-card">
                    <div className="ai-daily-brief-section">
                      <div className="ai-daily-brief-heading">
                        <span>基本信息</span>
                        <small>{aiDailyManifestSource === "zhihu" ? "知乎" : (aiDailyManifest.bvid || aiDailySourceLabel)}</small>
                      </div>
                      <div className="ai-daily-meta-grid">
                        {aiDailyMetaRows.map(([label, value]) => (
                          <div className="ai-daily-meta-row" key={label}>
                            <span>{label}</span>
                            <strong>{value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="ai-daily-brief-section">
                      <div className="ai-daily-brief-heading">
                        <span>内容摘要</span>
                        <small>{aiDailySummary ? "已整理" : "待生成"}</small>
                      </div>
                      {aiDailySummary ? (
                        <p className="ai-daily-paragraph">{aiDailySummary}</p>
                      ) : (
                        <div className="ai-daily-empty compact">暂无摘要</div>
                      )}
                    </div>

                    <details className="ai-daily-detail-fold">
                      <summary>
                        <span>详情</span>
                        <small>{aiDailyHighlights.length} 条重点</small>
                      </summary>
                      {aiDailyHighlights.length ? (
                        <ol className="ai-daily-highlights">
                          {aiDailyHighlights.map((item, index) => (
                            <li key={`${index}-${item}`}>{item}</li>
                          ))}
                        </ol>
                      ) : (
                        <div className="ai-daily-empty compact">暂无重点</div>
                      )}
                    </details>
                  </article>
                </div>
              ) : (
                <div className="ai-daily-empty">暂无产物</div>
              )}

              <div className="ai-daily-artifacts">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void openAiDailyArtifact(aiDailyManifest?.markdownPath)}
                  disabled={!aiDailyManifest?.markdownPath}
                >
                  <FileText size={16} />
                  <span>Markdown</span>
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void openAiDailyArtifact(aiDailyManifest?.htmlPath)}
                  disabled={!aiDailyManifest?.htmlPath}
                >
                  <Link2 size={16} />
                  <span>HTML</span>
                </button>
              </div>

              {(aiDailyRunResult?.stdout || aiDailyRunResult?.stderr) && (
                <details className="ai-daily-log">
                  <summary>运行日志</summary>
                  <pre>{`${aiDailyRunResult.stdout || ""}${aiDailyRunResult.stderr ? `\n${aiDailyRunResult.stderr}` : ""}`.slice(-4000)}</pre>
                </details>
              )}
            </section>
          </div>
        </section>
      )}
    </section>
  );
}

function UpdateManager() {
  const sortedUpdates = [...updateLog].sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true })
  );
  const latestEntry = sortedUpdates[0];
  const historyEntries = sortedUpdates.slice(1);
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [releaseStatus, setReleaseStatus] = useState<AppReleaseStatus | null>(null);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [publishResult, setPublishResult] = useState<AppReleasePublishResult | null>(null);

  const normalizeUpdateStatus = (value: unknown): AppUpdateStatus | null => {
    if (!value || typeof value !== "object") return null;
    const status = value as Partial<AppUpdateStatus>;
    if (typeof status.phase !== "string" || typeof status.currentVersion !== "string") return null;
    return {
      phase: status.phase as AppUpdatePhase,
      currentVersion: status.currentVersion,
      latestVersion: typeof status.latestVersion === "string" ? status.latestVersion : null,
      updateAvailable: Boolean(status.updateAvailable),
      canCheck: Boolean(status.canCheck),
      canDownload: Boolean(status.canDownload),
      canInstall: Boolean(status.canInstall),
      isPackaged: Boolean(status.isPackaged),
      source: typeof status.source === "string" ? status.source : "GitHub Releases",
      releasePageUrl: typeof status.releasePageUrl === "string" ? status.releasePageUrl : "",
      message: typeof status.message === "string" ? status.message : "等待检查更新",
      error: typeof status.error === "string" ? status.error : undefined,
      releaseName: typeof status.releaseName === "string" ? status.releaseName : undefined,
      releaseDate: typeof status.releaseDate === "string" ? status.releaseDate : undefined,
      downloadPercent: typeof status.downloadPercent === "number" ? status.downloadPercent : undefined,
      downloadedFile: typeof status.downloadedFile === "string" ? status.downloadedFile : undefined
    };
  };

  const applyUpdateStatus = (value: unknown) => {
    const nextStatus = normalizeUpdateStatus(value);
    if (nextStatus) setUpdateStatus(nextStatus);
  };

  const normalizeReleaseStatus = (value: unknown): AppReleaseStatus | null => {
    if (!value || typeof value !== "object") return null;
    const status = value as Partial<AppReleaseStatus>;
    if (typeof status.version !== "string" || !Array.isArray(status.checks)) return null;
    return {
      version: status.version,
      tagName: typeof status.tagName === "string" ? status.tagName : `v${status.version}`,
      repository: typeof status.repository === "string" ? status.repository : "",
      branch: typeof status.branch === "string" ? status.branch : "未知",
      commit: typeof status.commit === "string" ? status.commit : "未知",
      releaseUrl: typeof status.releaseUrl === "string" ? status.releaseUrl : "",
      canPublish: Boolean(status.canPublish),
      message: typeof status.message === "string" ? status.message : "等待检查",
      checks: status.checks
        .filter((item): item is AppReleaseCheck => Boolean(item && typeof item === "object"))
        .map((item) => ({
          key: typeof item.key === "string" ? item.key : item.label,
          label: typeof item.label === "string" ? item.label : "检查项",
          ok: Boolean(item.ok),
          detail: typeof item.detail === "string" ? item.detail : ""
        }))
    };
  };

  const applyReleaseStatus = (value: unknown) => {
    const nextStatus = normalizeReleaseStatus(value);
    if (nextStatus) setReleaseStatus(nextStatus);
  };

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = window.aistudy?.updates?.onStatus?.((status) => {
      if (!cancelled) applyUpdateStatus(status);
    });
    void window.aistudy?.updates?.status?.().then((status) => {
      if (!cancelled) applyUpdateStatus(status);
    });
    void window.aistudy?.updates?.releaseStatus?.().then((status) => {
      if (!cancelled) applyReleaseStatus(status);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const runUpdateAction = async (action: "check" | "download" | "install" | "open") => {
    setUpdateBusy(true);
    try {
      const api = window.aistudy?.updates;
      const result = action === "check"
        ? await api?.check?.()
        : action === "download"
          ? await api?.download?.()
          : action === "install"
            ? await api?.install?.()
            : await api?.openReleasePage?.();
      if (action !== "open") applyUpdateStatus(result);
    } finally {
      setUpdateBusy(false);
    }
  };

  const refreshReleaseStatus = async () => {
    setReleaseBusy(true);
    setPublishResult(null);
    try {
      const statusResult = await window.aistudy?.updates?.releaseStatus?.();
      applyReleaseStatus(statusResult);
    } finally {
      setReleaseBusy(false);
    }
  };

  const publishRelease = async () => {
    const version = releaseStatus?.version ?? latestEntry?.version;
    if (!version) return;
    setReleaseBusy(true);
    try {
      const result = await window.aistudy?.updates?.publishRelease?.(version);
      if (result && typeof result === "object") {
        const publish = result as AppReleasePublishResult;
        setPublishResult({
          ok: Boolean(publish.ok),
          message: typeof publish.message === "string" ? publish.message : "发布完成",
          releaseUrl: typeof publish.releaseUrl === "string" ? publish.releaseUrl : undefined,
          status: normalizeReleaseStatus(publish.status) ?? undefined
        });
        if (publish.status) applyReleaseStatus(publish.status);
      }
    } finally {
      setReleaseBusy(false);
    }
  };

  const status = updateStatus;
  const progress = Math.round(status?.downloadPercent ?? 0);
  const releaseDate = status?.releaseDate ? new Date(status.releaseDate).toLocaleDateString("zh-CN") : "";
  const failedChecks = releaseStatus?.checks.filter((item) => !item.ok) ?? [];

  return (
    <section className="update-manager" aria-label="更新管理">
      <article className="update-check-panel">
        <div className="update-check-main">
          <div>
            <span className="update-source">{status?.source ?? "GitHub Releases"}</span>
            <h2>版本检测</h2>
          </div>
          <div className={status?.updateAvailable ? "update-state available" : status?.phase === "error" ? "update-state error" : "update-state"}>
            {status?.message ?? "等待检查更新"}
          </div>
        </div>

        <div className="update-check-grid">
          <div>
            <span>当前版本</span>
            <strong>v{status?.currentVersion ?? sortedUpdates[0]?.version ?? "未知"}</strong>
          </div>
          <div>
            <span>远端版本</span>
            <strong>{status?.latestVersion ? `v${status.latestVersion}` : "待检测"}</strong>
          </div>
          <div>
            <span>发布信息</span>
            <strong>{status?.releaseName || releaseDate || "GitHub Release"}</strong>
          </div>
        </div>

        {(status?.phase === "downloading" || status?.phase === "downloaded") && (
          <div className="update-progress" aria-label="下载进度">
            <span style={{ width: `${progress}%` }} />
          </div>
        )}

        {status?.error && <p className="update-error">{status.error}</p>}

        <div className="update-actions">
          <button disabled={updateBusy || status?.canCheck === false} onClick={() => void runUpdateAction("check")}>
            <RotateCcw size={16} />
            检查更新
          </button>
          <button disabled={updateBusy || !status?.canDownload} onClick={() => void runUpdateAction("download")}>
            <Download size={16} />
            下载更新
          </button>
          <button disabled={updateBusy || !status?.canInstall} onClick={() => void runUpdateAction("install")}>
            <CirclePlay size={16} />
            重启安装
          </button>
          <button onClick={() => void runUpdateAction("open")}>
            <ExternalLink size={16} />
            发布页
          </button>
        </div>
      </article>

      <article className="release-console">
        <div className="release-console-header">
          <div>
            <span className="update-source">本机发布</span>
            <h2>发布草稿</h2>
          </div>
          <div className={releaseStatus?.canPublish ? "update-state available" : "update-state"}>
            {releaseStatus?.message ?? "等待检查"}
          </div>
        </div>

        <div className="release-summary-grid">
          <div>
            <span>目标版本</span>
            <strong>{releaseStatus?.tagName ?? `v${latestEntry?.version ?? "未知"}`}</strong>
          </div>
          <div>
            <span>分支</span>
            <strong>{releaseStatus?.branch ?? "待检查"}</strong>
          </div>
          <div>
            <span>提交</span>
            <strong>{releaseStatus?.commit ?? "待检查"}</strong>
          </div>
          <div>
            <span>阻塞项</span>
            <strong>{failedChecks.length}</strong>
          </div>
        </div>

        <div className="release-checks">
          {(releaseStatus?.checks ?? []).map((item) => (
            <div className={item.ok ? "release-check ok" : "release-check"} key={item.key}>
              {item.ok ? <CheckCircle2 size={16} /> : <X size={16} />}
              <span>{item.label}</span>
              <strong>{item.detail}</strong>
            </div>
          ))}
        </div>

        <div className="release-rollback-strip">
          <span>回滚方式：稳定 tag 升版发布</span>
          <span>同版本覆盖：禁止</span>
          <span>发布来源：当前干净提交</span>
        </div>

        {publishResult && (
          <p className={publishResult.ok ? "release-result ok" : "release-result"}>
            {publishResult.message}
          </p>
        )}

        <div className="update-actions">
          <button disabled={releaseBusy} onClick={() => void refreshReleaseStatus()}>
            <RotateCcw size={16} />
            刷新草稿
          </button>
          <button disabled={releaseBusy || !releaseStatus?.canPublish} onClick={() => void publishRelease()}>
            <PackageCheck size={16} />
            确认发布
          </button>
          <button onClick={() => void runUpdateAction("open")}>
            <ExternalLink size={16} />
            Release
          </button>
        </div>
      </article>

      {latestEntry && (
        <article className="current-release-card">
          <div className="version-row static">
            <div className="version-meta">
              <span className="version-number">v{latestEntry.version}</span>
              <strong>{latestEntry.title}</strong>
              <span className="latest-badge">当前记录</span>
            </div>
            <div className="version-side">
              <time>{latestEntry.date}</time>
            </div>
          </div>
          <div className="version-detail">
            <UpdateColumn title="功能更新" items={latestEntry.featureUpdates} />
            <UpdateColumn title="修复说明" items={latestEntry.fixes} />
            <UpdateColumn title="优化说明" items={latestEntry.optimizations} />
          </div>
        </article>
      )}

      <details className="release-history">
        <summary>历史记录</summary>
        <div className="release-history-list">
          {historyEntries.map((entry) => (
            <div className="release-history-row" key={entry.version}>
              <span>v{entry.version}</span>
              <strong>{entry.title}</strong>
              <time>{entry.date}</time>
            </div>
          ))}
        </div>
      </details>
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
              <span>方向键控制画布平移</span>
            </div>
            <div className="shortcut-keys" aria-label="arrow keys">
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

function McpPanel() {
  const [status, setStatus] = useState<McpNotionImportStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [logs, setLogs] = useState<McpLogEntry[]>([]);

  const appendLog = useCallback((entry: Omit<McpLogEntry, "id" | "time">) => {
    const now = new Date();
    setLogs((currentLogs) => [
      {
        id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
        time: now.toLocaleTimeString("zh-CN", { hour12: false }),
        ...entry
      },
      ...currentLogs
    ].slice(0, 18));
  }, []);

  const buildStatusItems = useCallback((nextStatus: McpNotionImportStatus | null): McpStatusItem[] => [
    {
      key: "contract",
      title: "契约",
      meta: "contract",
      ready: Boolean(nextStatus?.contractReady),
      detail: nextStatus?.contractPath ?? "等待检测"
    },
    {
      key: "guide",
      title: "娴佺▼",
      meta: "guide",
      ready: Boolean(nextStatus?.guideReady),
      detail: nextStatus?.guidePath ?? "等待检测"
    },
    {
      key: "gate",
      title: "写入规范",
      meta: "gate",
      ready: Boolean(nextStatus?.contractReady && nextStatus?.guideReady),
      detail: "强制规范入口"
    },
    {
      key: "notion",
      title: "Notion",
      meta: "cache",
      ready: Boolean(nextStatus?.notionCacheReady),
      detail: nextStatus?.notionCachePath ?? "等待检测"
    },
    {
      key: "course-db",
      title: "课程库",
      meta: "json",
      ready: Boolean(nextStatus?.jsonDatabaseReady),
      detail: nextStatus?.jsonDatabasePath ?? "等待检测"
    },
    {
      key: "mysql",
      title: "MySQL",
      meta: "sync",
      ready: Boolean(nextStatus?.mysqlConnected),
      detail: "数据库连接"
    },
    {
      key: "backup",
      title: "备份",
      meta: "backup",
      ready: Boolean(nextStatus?.latestBackupReady),
      detail: nextStatus?.latestBackupPath ?? "暂无备份"
    }
  ], []);

  const refreshStatus = useCallback((source: "manual" | "auto" = "manual") => {
    setIsChecking(true);
    appendLog({
      level: "run",
      title: source === "manual" ? "手动检测" : "自动检测",
      detail: "刷新 MCP 状态"
    });
    void window.aistudy?.mcp
      ?.notionImportStatus()
      .then((nextStatus) => {
        const typedStatus = nextStatus as McpNotionImportStatus;
        const items = buildStatusItems(typedStatus);
        const readyCount = items.filter((item) => item.ready).length;
        const missing = items.filter((item) => !item.ready).map((item) => item.title);

        setStatus(typedStatus);
        setLastCheckedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
        appendLog({
          level: missing.length === 0 ? "ok" : "warn",
          title: "检测完成",
          detail: missing.length === 0 ? `${readyCount}/${items.length} 项就绪` : `${readyCount}/${items.length} 项就绪，待处理：${missing.slice(0, 3).join("、")}`
        });
      })
      .catch(() => {
        setStatus(null);
        appendLog({
          level: "warn",
          title: "检测失败",
          detail: "MCP 状接口未返回"
        });
      })
      .finally(() => setIsChecking(false));
  }, [appendLog, buildStatusItems]);

  useEffect(() => {
    refreshStatus("auto");
    const timer = window.setInterval(() => refreshStatus("auto"), 8000);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  const statusItems = useMemo(() => buildStatusItems(status), [buildStatusItems, status]);
  const standardReady = Boolean(status?.contractReady && status?.guideReady);
  const accessReady = Boolean(status?.notionCacheReady && status?.jsonDatabaseReady && status?.mysqlConnected);
  const executionReady = Boolean(status?.latestBackupReady);
  const readyCount = statusItems.filter((item) => item.ready).length;
  const totalCount = statusItems.length;
  const progress = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
  const phaseItems: McpPhaseItem[] = [
    {
      key: "standard",
      title: "规范",
      meta: "contract / guide / gate",
      ready: standardReady,
      progress: status ? Math.round((Number(status.contractReady) + Number(status.guideReady) + Number(standardReady)) / 3 * 100) : 0,
      icon: <Braces size={18} />
    },
    {
      key: "access",
      title: "接入",
      meta: "Notion / 课程库 / MySQL",
      ready: accessReady,
      progress: status ? Math.round((Number(status.notionCacheReady) + Number(status.jsonDatabaseReady) + Number(status.mysqlConnected)) / 3 * 100) : 0,
      icon: <Link2 size={18} />
    },
    {
      key: "execution",
      title: "执行",
      meta: "backup / verify",
      ready: executionReady,
      progress: status ? Number(status.latestBackupReady) * 100 : 0,
      icon: <CheckCircle2 size={18} />
    }
  ];

  return (
    <section className="mcp-page" aria-label="MCP">
      <section className="mcp-hero">
        <div>
          <span>MCP CONSOLE</span>
          <h2>模型上下文控制台</h2>
          <b className={isChecking ? "mcp-live-dot running" : "mcp-live-dot"}>{isChecking ? "检测中" : "持续检测"}</b>
        </div>
        <div className="mcp-hero-actions">
          <div className="mcp-hero-metric">
            <strong>{progress}%</strong>
            <span>就绪度</span>
          </div>
          <div className="mcp-hero-metric">
            <strong>{readyCount}/{totalCount}</strong>
            <span>检测项</span>
          </div>
          <button className="primary-button" type="button" onClick={() => refreshStatus("manual")} disabled={isChecking}>
            <RotateCcw size={18} />
            <span>{isChecking ? "检测中" : "重新检测"}</span>
          </button>
        </div>
      </section>

      <section className="mcp-console-grid">
        <section className="mcp-pipeline-panel" aria-label="MCP 执行进度">
          <div className="mcp-panel-heading">
            <div>
              <span>Pipeline</span>
              <h3>调用进度</h3>
            </div>
            <b>{lastCheckedAt ? `更新 ${lastCheckedAt}` : "等待检测"}</b>
          </div>
          <div className="mcp-progress-track" aria-label={`MCP 就绪?${progress}%`}>
            <span className={isChecking ? "mcp-progress-fill running" : "mcp-progress-fill"} style={{ width: `${progress}%` }} />
          </div>
          <div className="mcp-phase-list">
            {phaseItems.map((phase) => (
              <article className={phase.ready ? "mcp-phase-row ready" : "mcp-phase-row"} key={phase.key}>
                <div className="mcp-card-icon">{phase.icon}</div>
                <div>
                  <strong>{phase.title}</strong>
                  <span>{phase.meta}</span>
                  <div className="mcp-phase-track">
                    <i style={{ width: `${phase.progress}%` }} />
                  </div>
                </div>
                <b>{phase.ready ? "就绪" : `${phase.progress}%`}</b>
              </article>
            ))}
          </div>
        </section>

        <section className="mcp-log-panel" aria-label="MCP 调用日志">
          <div className="mcp-panel-heading">
            <div>
              <span>Log</span>
              <h3>调用日志</h3>
            </div>
            <b>{isChecking ? "写入中" : "实时"}</b>
          </div>
          <div className="mcp-log-list" role="status" aria-live="polite">
            {(logs.length > 0 ? logs : [{
              id: "empty",
              time: "--:--:--",
              title: "等待检测",
              detail: "暂无调用记录",
              level: "run" as const
            }]).map((log) => (
              <article className={`mcp-log-entry ${log.level}`} key={log.id}>
                <time>{log.time}</time>
                <div>
                  <strong>{log.title}</strong>
                  <span>{log.detail}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="mcp-grid">
        {statusItems.map((item) => (
          <McpStatusCard item={item} key={item.key} />
        ))}
      </section>

      <section className="panel mcp-run-panel">
        <div className="panel-heading">
          <div>
            <h3>Notion 知识点导入</h3>
          </div>
          <b className={progress === 100 ? "mcp-run-state ready" : "mcp-run-state"}>{progress === 100 ? "可执行" : "待就绪"}</b>
        </div>
        <div className="mcp-run-rail">
          {["读取 Notion", "标题匹配", "写入知识点", "验证落库"].map((step, index) => (
            <React.Fragment key={step}>
              <span className={index === 0 || progress > index * 25 ? "active" : ""}>{step}</span>
              {index < 3 && <ChevronRight size={16} />}
            </React.Fragment>
          ))}
        </div>
      </section>
    </section>
  );
}

function McpStatusCard({ item }: { item: McpStatusItem }) {
  const ready = item.ready;
  return (
    <article className={ready ? "mcp-card ready" : "mcp-card"}>
      <div className="mcp-card-icon">
        {ready ? <CheckCircle2 size={20} /> : <Clock3 size={20} />}
      </div>
      <div>
        <span>{item.meta}</span>
        <strong>{item.title}</strong>
        <p title={item.detail}>{item.detail}</p>
      </div>
      <b>{ready ? "就绪" : "待处理"}</b>
    </article>
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
            <button aria-label="send">
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
  settings,
  labels = courseCenterLabels
}: {
  courses: Course[];
  selectedCourse: Course | null;
  onCreateCourse: (course: Course) => void;
  onSelectCourse: (courseId: string) => void;
  onBack: () => void;
  onUpdateCourse: (courseId: string, patch: Partial<Course> | ((course: Course) => Partial<Course>)) => void;
  settings: AppSettings;
  labels?: CourseCenterLabels;
}) {
  if (selectedCourse) {
    return (
      <CourseDetail
        course={selectedCourse}
        onBack={onBack}
        onUpdateCourse={onUpdateCourse}
        settings={settings}
        labels={labels}
      />
    );
  }

  return (
    <>
      <section className="course-hero">
        <div>
          <div className="status-pill">
            <LibraryBig size={15} />
            <span>已创建 {courses.length} {labels.statusCountSuffix}</span>
          </div>
          <h2>{labels.heroTitle}</h2>
        </div>
      </section>

      <CreateCoursePanel onCreateCourse={onCreateCourse} labels={labels} />

      <section className="course-toolbar" aria-label="course filter">
        <div className="filter-tabs">
          <button className="filter-tab active">全部</button>
        </div>
        <button className="text-button">
          {labels.manageCategory}
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
                      <span className="course-category">{course.category || labels.categoryFallback}</span>
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
            <EmptyState title={labels.emptyTitle} />
          )}
        </div>

        <aside className="course-side">
          <section className="panel continue-card">
            <div className="panel-heading">
              <div>
                <h3>{labels.continueTitle}</h3>
              </div>
              <CirclePlay size={21} />
            </div>
            <strong>{courses[0]?.title ?? labels.continueFallback}</strong>
            <button className="primary-button" onClick={() => courses[0] && onSelectCourse(courses[0].id)} disabled={courses.length === 0}>
              <PlayCircle size={18} />
              <span>{labels.enterButton}</span>
            </button>
          </section>

          <section className="panel course-stats">
            <div className="stat-row">
              <UsersRound size={18} />
              <div>
                <strong>{new Set(courses.map((course) => course.category).filter(Boolean)).size} {labels.statsCategorySuffix}</strong>
              </div>
            </div>
            <div className="stat-row">
              <Clock3 size={18} />
              <div>
                <strong>{labels.weeklyMeta}</strong>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </>
  );
}

function CreateCoursePanel({ onCreateCourse, labels }: { onCreateCourse: (course: Course) => void; labels: CourseCenterLabels }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(labels.defaultCategory);

  const canCreate = title.trim().length > 0;

  return (
    <section className="panel create-course-panel">
      <div className="panel-heading">
        <div>
          <h3>{labels.createTitle}</h3>
        </div>
        <Plus size={21} />
      </div>
      <div className="course-form">
        <label>
          <span>{labels.titleLabel}</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={labels.titlePlaceholder} />
        </label>
        <label>
          <span>{labels.categoryLabel}</span>
          <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder={labels.categoryPlaceholder} />
        </label>
        <button
          className="primary-button"
          type="button"
          disabled={!canCreate}
          onClick={() => {
            if (!canCreate) return;
            onCreateCourse(createCourse(title.trim(), category.trim(), "", labels.initialBranchTitle));
            setTitle("");
            setCategory(labels.defaultCategory);
          }}
        >
          <Plus size={18} />
          <span>{labels.createButton}</span>
        </button>
      </div>
    </section>
  );
}

function CourseDetail({
  course,
  onBack,
  onUpdateCourse,
  settings,
  labels
}: {
  course: Course;
  onBack: () => void;
  onUpdateCourse: (courseId: string, patch: Partial<Course> | ((course: Course) => Partial<Course>)) => void;
  settings: AppSettings;
  labels: CourseCenterLabels;
}) {
  const [workspaceMode, setWorkspaceMode] = useState<CourseWorkspaceMode>("knowledge");
  const [mindFormatBrush, setMindFormatBrush] = useState<MindFormatBrush | null>(null);
  const [knowledgeFormatBrush, setKnowledgeFormatBrush] = useState<KnowledgeFormatBrush | null>(null);

  useEffect(() => {
    setMindFormatBrush(null);
    setKnowledgeFormatBrush(null);
  }, [course.id]);

  return (
    <>
      <section className="mindmap-shell">
        <div className="mindmap-toolbar">
          <button className="secondary-button workspace-back-button" onClick={onBack}>
            <ChevronLeft size={18} />
            <span>{labels.detailBackLabel}</span>
          </button>
          <div className="workspace-switch" aria-label="课程功能切换">
            <button className={workspaceMode === "knowledge" ? "active" : ""} onClick={() => setWorkspaceMode("knowledge")}>
              {labels.switchKnowledge}
            </button>
            <button className={workspaceMode === "notes" ? "active" : ""} onClick={() => setWorkspaceMode("notes")}>
              {labels.switchNotes}
            </button>
            <button className={workspaceMode === "mindmap" ? "active" : ""} onClick={() => setWorkspaceMode("mindmap")}>
              {labels.switchMindmap}
            </button>
          </div>
        </div>
        <MindMapEditor
          courseId={course.id}
          title={course.title}
          data={course.mindMap}
          mode={workspaceMode}
          knowledgePoints={course.knowledgePoints ?? {}}
          knowledgeDocuments={course.knowledgeDocuments ?? {}}
          branchMindMaps={course.branchMindMaps ?? {}}
          syncNumberedOutline={course.syncNumberedOutline ?? true}
          numberedOutlineSnapshot={course.numberedOutlineSnapshot ?? buildOutline(course.mindMap)}
          collapsedOutlineIds={course.collapsedOutlineIds ?? []}
          hideParentKnowledgePages={course.hideParentKnowledgePages ?? false}
          mindFormatBrush={mindFormatBrush}
          onMindFormatBrushChange={setMindFormatBrush}
          knowledgeFormatBrush={knowledgeFormatBrush}
          onKnowledgeFormatBrushChange={setKnowledgeFormatBrush}
          onChange={(mindMap) =>
            onUpdateCourse(course.id, (currentCourse) => createMindMapStatePatch(currentCourse, mindMap))
          }
          onOutlineSyncStateChange={(syncNumberedOutline, numberedOutlineSnapshot) =>
            onUpdateCourse(course.id, (currentCourse) =>
              createOutlineSyncStatePatch(currentCourse, syncNumberedOutline, numberedOutlineSnapshot)
            )
          }
          onCollapsedOutlineChange={(collapsedOutlineIds) =>
            onUpdateCourse(course.id, (currentCourse) => createCollapsedOutlineStatePatch(currentCourse, collapsedOutlineIds))
          }
          onHideParentKnowledgePagesChange={(hideParentKnowledgePages) =>
            onUpdateCourse(course.id, createHideParentKnowledgePagesPatch(hideParentKnowledgePages))
          }
          onBranchMindMapChange={(nodeId, mindMap) =>
            onUpdateCourse(course.id, (currentCourse) => createBranchMindMapStatePatch(currentCourse, nodeId, mindMap))
          }
          onKnowledgeChange={(nodeId, content) =>
            onUpdateCourse(course.id, (currentCourse) => createKnowledgePointStatePatch(currentCourse, nodeId, content))
          }
          onKnowledgeDocumentChange={(nodeId, document) =>
            onUpdateCourse(course.id, (currentCourse) => createKnowledgeDocumentStatePatch(currentCourse, nodeId, document))
          }
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
  knowledgeDocuments,
  branchMindMaps,
  syncNumberedOutline: persistedSyncNumberedOutline,
  numberedOutlineSnapshot: persistedNumberedOutlineSnapshot,
  collapsedOutlineIds: persistedCollapsedOutlineIds,
  hideParentKnowledgePages,
  onChange,
  onOutlineSyncStateChange,
  onCollapsedOutlineChange,
  onHideParentKnowledgePagesChange,
  onBranchMindMapChange,
  onKnowledgeChange,
  onKnowledgeDocumentChange,
  mindFormatBrush,
  onMindFormatBrushChange,
  knowledgeFormatBrush,
  onKnowledgeFormatBrushChange,
  settings
}: {
  courseId: string;
  title: string;
  data: MindElixirData;
  mode: CourseWorkspaceMode;
  knowledgePoints: Record<string, string>;
  knowledgeDocuments: Record<string, KnowledgeCanvasDocument>;
  branchMindMaps: Record<string, MindElixirData>;
  syncNumberedOutline: boolean;
  numberedOutlineSnapshot: OutlineItem[];
  collapsedOutlineIds: string[];
  hideParentKnowledgePages: boolean;
  onChange: (data: MindElixirData) => void;
  onOutlineSyncStateChange: (syncNumberedOutline: boolean, numberedOutlineSnapshot: OutlineItem[]) => void;
  onCollapsedOutlineChange: (collapsedOutlineIds: string[]) => void;
  onHideParentKnowledgePagesChange: (hideParentKnowledgePages: boolean) => void;
  onBranchMindMapChange: (nodeId: string, data: MindElixirData | null) => void;
  onKnowledgeChange: (nodeId: string, content: string) => void;
  onKnowledgeDocumentChange: (nodeId: string, document: KnowledgeCanvasDocument) => void;
  mindFormatBrush: MindFormatBrush | null;
  onMindFormatBrushChange: (format: MindFormatBrush | null) => void;
  knowledgeFormatBrush: KnowledgeFormatBrush | null;
  onKnowledgeFormatBrushChange: (format: KnowledgeFormatBrush | null) => void;
  settings: AppSettings;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const outlineListRef = useRef<HTMLDivElement | null>(null);
  const outlineRef = useRef<HTMLElement | null>(null);
  const mindRef = useRef<MindElixirInstance | null>(null);
  const canvasDragRef = useRef({ active: false, x: 0, y: 0 });
  const panControlRef = useRef({ x: panControlCenter, y: panControlCenter });
  const outlineResizeRef = useRef({ active: false, startX: 0, startWidth: 0 });
  const [outline, setOutline] = useState<OutlineItem[]>(() =>
    persistedSyncNumberedOutline
      ? buildOutline(data)
      : applyNumberedOutlineSnapshot(buildOutline(data), persistedNumberedOutlineSnapshot)
  );
  const [noteEntries, setNoteEntries] = useState<NoteEntry[]>(() => buildNoteEntries(data));
  const [compactMode, setCompactMode] = useState(false);
  const [syncNumberedOutline, setSyncNumberedOutline] = useState(persistedSyncNumberedOutline);
  const [upstreamBranchIsolation, setUpstreamBranchIsolation] = useState(false);
  const [downstreamBranchIsolation, setDownstreamBranchIsolation] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState(data.nodeData.id);
  const [selectedNodeCount, setSelectedNodeCount] = useState(1);
  const [toolHint, setToolHint] = useState("");
  const [dragMode, setDragMode] = useState(false);
  const [expandedEdit, setExpandedEdit] = useState(false);
  const [collapsedOutlineIds, setCollapsedOutlineIds] = useState<string[]>(persistedCollapsedOutlineIds);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState<AiChatMessage[]>([]);
  const [aiChatPending, setAiChatPending] = useState(false);
  const [aiChatProvider, setAiChatProvider] = useState<AiChatProvider>("claude");
  const [draggingOutlineId, setDraggingOutlineId] = useState<string | null>(null);
  const [outlineDropTargetId, setOutlineDropTargetId] = useState<string | null>(null);
  const [outlineScroll, setOutlineScroll] = useState(0);
  const [panControl, setPanControl] = useState({ x: panControlCenter, y: panControlCenter });
  const [shouldMountMindMap, setShouldMountMindMap] = useState(mode === "mindmap");
  const [isOutlineResizing, setIsOutlineResizing] = useState(false);

  const onChangeRef = useRef(onChange);
  const onOutlineSyncStateChangeRef = useRef(onOutlineSyncStateChange);
  const onBranchMindMapChangeRef = useRef(onBranchMindMapChange);
  const mainMindDataRef = useRef(data);
  const branchMindMapsRef = useRef(branchMindMaps);
  const selectedPageIdRef = useRef(data.nodeData.id);
  const previousModeRef = useRef(mode);
  const manualCollapseGuardRef = useRef(0);
  const upstreamBranchIsolationRef = useRef(false);
  const downstreamBranchIsolationRef = useRef(false);
  const activeBranchCanvasIdRef = useRef<string | null>(null);
  const syncNumberedOutlineRef = useRef(persistedSyncNumberedOutline);
  const numberedOutlineSnapshotRef = useRef<OutlineItem[]>(
    persistedNumberedOutlineSnapshot.length > 0 ? persistedNumberedOutlineSnapshot : buildOutline(data)
  );
  const outlineParentIds = useMemo(() => getOutlineParentIds(outline), [outline]);
  const outlineParentIdsRef = useRef(outlineParentIds);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onOutlineSyncStateChangeRef.current = onOutlineSyncStateChange;
  }, [onOutlineSyncStateChange]);

  useEffect(() => {
    onBranchMindMapChangeRef.current = onBranchMindMapChange;
  }, [onBranchMindMapChange]);

  useEffect(() => {
    mainMindDataRef.current = data;
  }, [data]);

  useEffect(() => {
    branchMindMapsRef.current = branchMindMaps;
  }, [branchMindMaps]);

  useEffect(() => {
    selectedPageIdRef.current = selectedPageId;
  }, [selectedPageId]);

  useEffect(() => {
    upstreamBranchIsolationRef.current = upstreamBranchIsolation;
  }, [upstreamBranchIsolation]);

  useEffect(() => {
    downstreamBranchIsolationRef.current = downstreamBranchIsolation;
  }, [downstreamBranchIsolation]);

  useEffect(() => {
    syncNumberedOutlineRef.current = syncNumberedOutline;
  }, [syncNumberedOutline]);

  useEffect(() => {
    outlineParentIdsRef.current = outlineParentIds;
  }, [outlineParentIds]);

  const persistOutlineSyncState = (nextSyncState: boolean, nextSnapshot: OutlineItem[]) => {
    syncNumberedOutlineRef.current = nextSyncState;
    numberedOutlineSnapshotRef.current = nextSnapshot;
    setSyncNumberedOutline(nextSyncState);
    onOutlineSyncStateChangeRef.current(nextSyncState, nextSnapshot);
  };

  const refreshOutlineViews = (nextData: MindElixirData) => {
    const nextOutline = buildOutline(nextData);
    const visibleOutline = syncNumberedOutlineRef.current
      ? nextOutline
      : applyNumberedOutlineSnapshot(nextOutline, numberedOutlineSnapshotRef.current);

    if (syncNumberedOutlineRef.current) {
      numberedOutlineSnapshotRef.current = nextOutline;
    }

    setOutline(visibleOutline);
    setNoteEntries(buildNoteEntries(nextData));
  };

  const removeBranchMindMap = (nodeId: string) => {
    if (!branchMindMapsRef.current[nodeId]) return;
    const nextBranchMindMaps = { ...branchMindMapsRef.current };
    delete nextBranchMindMaps[nodeId];
    branchMindMapsRef.current = nextBranchMindMaps;
    onBranchMindMapChangeRef.current(nodeId, null);
  };

  const pruneStaleBranchMindMaps = (nextData: MindElixirData) => {
    const currentBranchMindMaps = branchMindMapsRef.current;
    const nextBranchMindMaps = reconcileFreshBranchMindMaps(nextData, currentBranchMindMaps);
    const staleIds = Object.keys(currentBranchMindMaps).filter((nodeId) => !nextBranchMindMaps[nodeId]);
    if (staleIds.length === 0) return;

    branchMindMapsRef.current = nextBranchMindMaps;
    staleIds.forEach((nodeId) => onBranchMindMapChangeRef.current(nodeId, null));
  };

  const getBranchMindData = (nodeId: string, preferMainSnapshot = false) => {
    const branchNode = findMindMapNode(mainMindDataRef.current.nodeData, nodeId);
    if (preferMainSnapshot && branchNode) return createBranchMindMapFromNode(branchNode);
    const storedBranch = branchMindMapsRef.current[nodeId];
    if (storedBranch) {
      if (isBranchMindMapFresh(mainMindDataRef.current, nodeId, storedBranch)) {
        return cloneMindData(storedBranch);
      }
      removeBranchMindMap(nodeId);
    }
    return branchNode ? createBranchMindMapFromNode(branchNode) : null;
  };

  const isIsolatedBranchSession = () => {
    const rootNodeId = mainMindDataRef.current.nodeData.id;
    return upstreamBranchIsolationRef.current && selectedPageIdRef.current !== rootNodeId;
  };

  const syncDescendantBranchMindMaps = (branchRoot: NodeObj) => {
    if (downstreamBranchIsolationRef.current) return;
    const updates: Array<{ nodeId: string; data: MindElixirData }> = [];
    const walk = (node: NodeObj) => {
      node.children?.forEach((child) => {
        if (branchMindMapsRef.current[child.id]) {
          updates.push({ nodeId: child.id, data: createBranchMindMapFromNode(child) });
        }
        walk(child);
      });
    };

    walk(branchRoot);
    updates.forEach(({ nodeId, data }) => saveBranchMindMap(nodeId, data));
  };

  const saveBranchMindMap = (nodeId: string, nextData: MindElixirData) => {
    const savedData = cloneMindData(nextData);
    branchMindMapsRef.current = {
      ...branchMindMapsRef.current,
      [nodeId]: savedData
    };
    onBranchMindMapChangeRef.current(nodeId, savedData);
  };

  const persistBranchCanvasData = (
    branchCanvasId: string,
    nextData: MindElixirData,
    options: { refreshOutline?: boolean; showHint?: boolean } = {}
  ) => {
    const shouldRefreshOutline = options.refreshOutline !== false;
    const shouldShowHint = options.showHint !== false;
    saveBranchMindMap(branchCanvasId, nextData);
    syncDescendantBranchMindMaps(nextData.nodeData);

    if (upstreamBranchIsolationRef.current) {
      if (shouldShowHint) setToolHint("上分支隔离已开启：仅保存当前分支");
      return;
    }

    const nextMainData = updateMindMapBranch(mainMindDataRef.current, branchCanvasId, nextData.nodeData);
    mainMindDataRef.current = nextMainData;
    pruneStaleBranchMindMaps(nextMainData);
    if (shouldRefreshOutline) refreshOutlineViews(nextMainData);
    onChangeRef.current(nextMainData);
    if (shouldShowHint) setToolHint("");
  };

  const getPersistingBranchCanvasId = (nextData: MindElixirData) => {
    const activeBranchId = activeBranchCanvasIdRef.current;
    const mainRootId = mainMindDataRef.current.nodeData.id;
    const canvasRootId = nextData.nodeData.id;

    if (activeBranchId && activeBranchId === canvasRootId) return activeBranchId;
    return canvasRootId !== mainRootId ? canvasRootId : null;
  };

  const persistPossiblyBranchedMindData = (
    nextData: MindElixirData,
    options: { refreshOutline?: boolean; showHint?: boolean } = {}
  ) => {
    const shouldRefreshOutline = options.refreshOutline !== false;
    const branchCanvasId = getPersistingBranchCanvasId(nextData);
    if (branchCanvasId) {
      activeBranchCanvasIdRef.current = branchCanvasId;
      persistBranchCanvasData(branchCanvasId, nextData, options);
      return;
    }

    mainMindDataRef.current = nextData;
    syncDescendantBranchMindMaps(nextData.nodeData);
    pruneStaleBranchMindMaps(nextData);
    if (shouldRefreshOutline) refreshOutlineViews(nextData);
    onChangeRef.current(nextData);
  };

  const applyReadableMindMapScale = (mind: MindElixirInstance) => {
    const currentScale = Number(mind.scaleVal);
    if (!Number.isFinite(currentScale) || currentScale < readableMindMapDefaultScale) {
      mind.scale(readableMindMapDefaultScale);
    }
  };

  const fitMindMapViewport = (mind: MindElixirInstance, focusId?: string) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const targetNode = focusId ? mind.findEle(focusId) : mind.findEle(mind.nodeData.id);
        applyReadableMindMapScale(mind);
        if (targetNode) {
          mind.selectNode(targetNode);
          mind.scrollIntoView(targetNode, true);
        } else {
          mind.toCenter();
        }
      });
    });
  };

  const persistCurrentCanvasBeforeNavigation = () => {
    const mind = mindRef.current;
    if (!mind) return;
    const nextData = mind.getData();
    persistPossiblyBranchedMindData(nextData);
  };

  const openMainMindMap = (focusId?: string) => {
    const mind = mindRef.current;
    if (!mind) return;
    const nextData = cloneMindData(mainMindDataRef.current);
    activeBranchCanvasIdRef.current = null;
    mind.refresh(nextData);
    refreshOutlineViews(nextData);
    requestAnimationFrame(() => {
      const targetId = focusId ?? nextData.nodeData.id;
      const topic = mind.findEle(targetId);
      if (!topic) return;
      applyReadableMindMapScale(mind);
      mind.selectNode(topic);
      if (targetId === nextData.nodeData.id) {
        fitMindMapViewport(mind, targetId);
      } else {
        mind.focusNode(topic);
        mind.scrollIntoView(topic, true);
      }
    });
  };

  const openIsolatedBranchMindMap = (nodeId: string, preferMainSnapshot = false) => {
    const mind = mindRef.current;
    if (!mind) return false;
    const branchData = getBranchMindData(nodeId, preferMainSnapshot);
    if (!branchData) return false;
    activeBranchCanvasIdRef.current = nodeId;
    if (preferMainSnapshot) saveBranchMindMap(nodeId, branchData);
    mind.refresh(branchData);
    setSelectedNodeId(branchData.nodeData.id);
    setSelectedNodeCount(1);
    requestAnimationFrame(() => {
      const rootNode = mind.findEle(branchData.nodeData.id);
      if (!rootNode) return;
      fitMindMapViewport(mind, branchData.nodeData.id);
    });
    return true;
  };

  const persistCurrentMindData = (nextData: MindElixirData) => {
    persistPossiblyBranchedMindData(nextData);
  };

  useEffect(() => {
    if (mode === "mindmap") {
      setShouldMountMindMap(true);
    }
  }, [mode]);

  useEffect(() => {
    selectedPageIdRef.current = data.nodeData.id;
    upstreamBranchIsolationRef.current = false;
    downstreamBranchIsolationRef.current = false;
    activeBranchCanvasIdRef.current = null;
    setSelectedPageId(data.nodeData.id);
    setSelectedNodeId(data.nodeData.id);
    setSelectedNodeCount(1);
    setUpstreamBranchIsolation(false);
    setDownstreamBranchIsolation(false);
    const nextOutline = buildOutline(data);
    const nextSnapshot = persistedNumberedOutlineSnapshot.length > 0
      ? persistedNumberedOutlineSnapshot
      : nextOutline;
    syncNumberedOutlineRef.current = persistedSyncNumberedOutline;
    numberedOutlineSnapshotRef.current = nextSnapshot;
    setSyncNumberedOutline(persistedSyncNumberedOutline);
    setOutline(
      persistedSyncNumberedOutline
        ? nextOutline
        : applyNumberedOutlineSnapshot(nextOutline, nextSnapshot)
    );
    setCollapsedOutlineIds(persistedCollapsedOutlineIds);
    setNoteEntries(buildNoteEntries(data));
  }, [courseId, data.nodeData.id, persistedSyncNumberedOutline, persistedNumberedOutlineSnapshot, persistedCollapsedOutlineIds]);

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
    refreshOutlineViews(initialData);
    setSelectedNodeId(mind.nodeData.id);
    fitMindMapViewport(mind, mind.nodeData.id);

    mind.bus.addListener("operation", () => {
      const nextData = mind.getData();
      persistCurrentMindData(nextData);
    });
    mind.bus.addListener("selectNodes", (nodes) => {
      const nextSelectedId = nodes[0]?.id ?? null;
      setSelectedNodeId(nextSelectedId);
      setSelectedNodeCount(nodes.length || 0);
      if (nodes.length >= 2) setToolHint("");
    });

    return () => {
      const nextData = mind.getData();
      persistPossiblyBranchedMindData(nextData, { refreshOutline: false, showHint: false });
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
      applyReadableMindMapScale(mind);
      mind.selectNode(topic);
      mind.focusNode(topic);
      mind.scrollIntoView(topic, true);
    });
  };

  const focusOutlineNode = (id: string) => {
    persistCurrentCanvasBeforeNavigation();
    selectedPageIdRef.current = id;
    setSelectedNodeId(id);
    setSelectedPageId(id);
    setSelectedNodeCount(1);
    const isBranchNode = outlineParentIds.has(id);
    if (
      id !== mainMindDataRef.current.nodeData.id
      && (isBranchNode || upstreamBranchIsolationRef.current)
      && openIsolatedBranchMindMap(id, isBranchNode && !upstreamBranchIsolationRef.current)
    ) {
      return;
    }
    if (isIsolatedBranchSession()) {
      openMainMindMap(id);
      return;
    }
    const currentCanvasRoot = mindRef.current?.nodeData;
    if (activeBranchCanvasIdRef.current && currentCanvasRoot && !findMindMapNode(currentCanvasRoot, id)) {
      openMainMindMap(id);
      return;
    }
    focusMindNode(id);
  };

  const focusRootMindMap = () => {
    persistCurrentCanvasBeforeNavigation();
    const rootNodeId = mainMindDataRef.current.nodeData.id;
    selectedPageIdRef.current = rootNodeId;
    setSelectedPageId(rootNodeId);
    setSelectedNodeId(rootNodeId);
    setSelectedNodeCount(1);
    const mind = mindRef.current;
    if (!mind) return;
    if (isIsolatedBranchSession() || mind.nodeData.id !== rootNodeId) {
      openMainMindMap(rootNodeId);
      return;
    }
    if ((mind as MindElixirInstance & { isFocusMode?: boolean }).isFocusMode) {
      mind.cancelFocus();
    }
    const rootNode = mind.findEle(rootNodeId);
    applyReadableMindMapScale(mind);
    if (rootNode) {
      mind.selectNode(rootNode);
      mind.scrollIntoView(rootNode, true);
    }
    const nextData = mind.getData();
    persistCurrentMindData(nextData);
  };

  useEffect(() => {
    if (mode !== "mindmap") return;
    if (!shouldMountMindMap) return;
    const rootNodeId = mainMindDataRef.current.nodeData.id;
    if (activeBranchCanvasIdRef.current === selectedPageId) return;
    if (selectedPageId === rootNodeId) {
      focusRootMindMap();
      return;
    }
    if (
      selectedPageId !== rootNodeId
      && (outlineParentIdsRef.current.has(selectedPageId) || upstreamBranchIsolationRef.current)
      && openIsolatedBranchMindMap(
        selectedPageId,
        outlineParentIdsRef.current.has(selectedPageId) && !upstreamBranchIsolationRef.current
      )
    ) {
      return;
    }
    focusMindNode(selectedPageId);
  }, [mode, shouldMountMindMap, selectedPageId]);

  const syncMindData = () => {
    const mind = mindRef.current;
    if (!mind) return;
    const nextData = mind.getData();
    persistCurrentMindData(nextData);
  };

  const toggleNumberedOutlineSync = () => {
    const mind = mindRef.current;
    const nextData = mind?.getData() ?? data;
    const nextOutline = buildOutline(nextData);
    const nextSyncState = !syncNumberedOutlineRef.current;

    if (nextSyncState) {
      persistOutlineSyncState(true, nextOutline);
      setOutline(nextOutline);
      setToolHint("目录同步已开启");
    } else {
      persistOutlineSyncState(false, nextOutline);
      setOutline(applyNumberedOutlineSnapshot(nextOutline, nextOutline));
      setToolHint("目录同步已关闭");
    }

    setNoteEntries(buildNoteEntries(nextData));
  };

  const toggleUpstreamBranchIsolation = () => {
    persistCurrentCanvasBeforeNavigation();
    const nextIsolationState = !upstreamBranchIsolationRef.current;
    const rootNodeId = mainMindDataRef.current.nodeData.id;
    const activePageId = selectedPageIdRef.current;

    upstreamBranchIsolationRef.current = nextIsolationState;
    setUpstreamBranchIsolation(nextIsolationState);

    if (nextIsolationState) {
      if (activePageId !== rootNodeId && openIsolatedBranchMindMap(activePageId)) {
        setToolHint("上分支隔离已弢启：当前分支不会回写上级导图");
        return;
      }
      setToolHint("上分支隔离已弢启：选择子分支后生效");
      return;
    }

    openMainMindMap(activePageId === rootNodeId ? rootNodeId : activePageId);
    setToolHint("上分支隔离已关闭：编辑将回写上级导图");
  };

  const toggleDownstreamBranchIsolation = () => {
    const nextIsolationState = !downstreamBranchIsolationRef.current;
    downstreamBranchIsolationRef.current = nextIsolationState;
    setDownstreamBranchIsolation(nextIsolationState);
    setToolHint(nextIsolationState
      ? "下分支隔离已弢启：下级分支导图不再跟随当前分支"
      : "下分支隔离已关闭：下级分支导图将跟随当前分支"
    );
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
    refreshOutlineViews(nextData);
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

  const copyMindNodeFormat = () => {
    const node = getActiveNode();
    if (!node) return;
    onMindFormatBrushChange({ ...(node.nodeObj.style ?? {}) });
    setToolHint("导图格式已复制");
  };

  const applyMindNodeFormat = async () => {
    if (!mindFormatBrush) {
      copyMindNodeFormat();
      return;
    }

    await runWithActiveNode((mind, node) => {
      return mind.reshapeNode(node, { style: { ...mindFormatBrush } });
    });
    onMindFormatBrushChange(null);
    setToolHint("导图格式已应用");
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

  // 快捷键删除分支
  useEffect(() => {
    if (mode !== "mindmap") return;

    const handleDeleteBranch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      // 在文本输入框内不处理，允许正常删除字符
      if (isTextInput) return;

      // Delete 或 Backspace 键删除分支
      if (event.key === "Delete" || event.key === "Backspace") {
        const mind = mindRef.current;
        if (!mind) return;

        const node = getActiveNode();
        if (!node) return;

        // 不能删除根节点
        if (node.nodeObj.id === mind.nodeData.id) return;

        event.preventDefault();
        event.stopPropagation();
        mind.removeNodes([node]);
        syncMindData();
      }
    };

    window.addEventListener("keydown", handleDeleteBranch, true);
    return () => window.removeEventListener("keydown", handleDeleteBranch, true);
  }, [mode]);

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

  const startOutlineResize = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const outline = outlineRef.current;
    if (!outline) return;
    outlineResizeRef.current = {
      active: true,
      startX: event.clientX,
      startWidth: outline.offsetWidth
    };
    setIsOutlineResizing(true);
    document.addEventListener("mousemove", handleOutlineResize);
    document.addEventListener("mouseup", stopOutlineResize);
  };

  const handleOutlineResize = (event: MouseEvent) => {
    const resizeState = outlineResizeRef.current;
    if (!resizeState.active) return;
    const outline = outlineRef.current;
    if (!outline) return;
    const deltaX = event.clientX - resizeState.startX;
    const newWidth = Math.min(500, Math.max(180, resizeState.startWidth + deltaX));
    outline.style.width = `${newWidth}px`;
    // 更新 CSS 变量，让右侧区域自适应
    document.documentElement.style.setProperty('--outline-width', `${newWidth}px`);
  };

  const stopOutlineResize = () => {
    outlineResizeRef.current.active = false;
    setIsOutlineResizing(false);
    document.removeEventListener("mousemove", handleOutlineResize);
    document.removeEventListener("mouseup", stopOutlineResize);
  };

  const rootNodeId = mainMindDataRef.current.nodeData.id;
  const canvasRootNodeId = mindRef.current?.nodeData.id ?? rootNodeId;
  const activePageId = selectedPageId ?? rootNodeId;
  const activeEditNodeId = selectedNodeId ?? activePageId;
  const isRootSelected = activeEditNodeId === canvasRootNodeId;
  const canUseMultiNodeTool = selectedNodeCount >= 2;
  const activeKnowledge = knowledgePoints[activePageId] ?? "";
  const activeKnowledgeDocument = knowledgeDocuments[activePageId] ?? null;
  const activeStoredBranch = branchMindMaps[activePageId];
  const activeBranchNode = activeStoredBranch && isBranchMindMapFresh(data, activePageId, activeStoredBranch)
    ? activeStoredBranch.nodeData
    : findMindMapNode(data.nodeData, activePageId);
  const activeOutlineItem = outline.find((item) => item.id === activePageId);
  const activeTopic = activeBranchNode?.topic ?? activeOutlineItem?.topic ?? title;
  const activeBranchHasChildren = Boolean(activeBranchNode?.children?.length);
  const activeDocumentIsStaleBranchOutline = isStaleGeneratedBranchDocument(activeKnowledgeDocument, activeBranchNode);
  const activeDocumentHasContent = hasKnowledgeDocumentContent(activeKnowledgeDocument);
  const shouldShowAutoBranchOutline =
    activeBranchHasChildren && (!activeDocumentHasContent || activeDocumentIsStaleBranchOutline) && !hasKnowledgeContent(activeKnowledge);
  const activeKnowledgePanelValue = shouldShowAutoBranchOutline && activeBranchNode
    ? renderCanvasMindBranchHtml(activeBranchNode)
    : activeKnowledge;
  const activeKnowledgePanelDocument = shouldShowAutoBranchOutline ? null : activeKnowledgeDocument;
  const visibleOutline = useMemo(() => getVisibleOutline(outline, collapsedOutlineIds), [outline, collapsedOutlineIds]);
  const hasKnowledgePageContent = (pageId: string) =>
    hasKnowledgeContent(knowledgePoints[pageId]) || hasKnowledgeDocumentContent(knowledgeDocuments[pageId]);
  const isKnowledgePageSelectable = (pageId: string) =>
    !hideParentKnowledgePages || !outlineParentIds.has(pageId) || hasKnowledgePageContent(pageId);
  const knowledgeContentPageIds = useMemo(
    () =>
      outline
        .filter((item) => hasKnowledgePageContent(item.id) && isKnowledgePageSelectable(item.id))
        .map((item) => item.id),
    [hideParentKnowledgePages, knowledgeDocuments, knowledgePoints, outline, outlineParentIds]
  );
  const knowledgeContentPageIdSet = useMemo(() => new Set(knowledgeContentPageIds), [knowledgeContentPageIds]);
  const firstKnowledgePageId = useMemo(
    () =>
      knowledgeContentPageIds[0]
      ?? outline.find((item) => isKnowledgePageSelectable(item.id))?.id
      ?? null,
    [hideParentKnowledgePages, knowledgeContentPageIds, outline, outlineParentIds]
  );
  const activeOutlineIndex = outline.findIndex((item) => item.id === activePageId);
  const previousKnowledgePageId = (() => {
    if (activeOutlineIndex <= 0) return null;
    for (let index = activeOutlineIndex - 1; index >= 0; index -= 1) {
      const candidateId = outline[index]?.id;
      if (candidateId && knowledgeContentPageIdSet.has(candidateId)) return candidateId;
    }
    return null;
  })();
  const nextKnowledgePageId = (() => {
    const startIndex = activeOutlineIndex >= 0 ? activeOutlineIndex + 1 : 0;
    for (let index = startIndex; index < outline.length; index += 1) {
      const candidateId = outline[index]?.id;
      if (candidateId && knowledgeContentPageIdSet.has(candidateId)) return candidateId;
    }
    return null;
  })();
  const getKnowledgePageTitle = (pageId: string | null) => {
    if (!pageId) return null;
    return outline.find((item) => item.id === pageId)?.topic ?? null;
  };
  const findFirstSelectableDescendant = (itemId: string) => {
    const startIndex = outline.findIndex((item) => item.id === itemId);
    if (startIndex < 0) return null;
    const parentDepth = outline[startIndex].depth;
    for (let index = startIndex + 1; index < outline.length; index += 1) {
      const candidate = outline[index];
      if (candidate.depth <= parentDepth) break;
      if (isKnowledgePageSelectable(candidate.id)) return candidate.id;
    }
    return null;
  };
  const findFirstContentDescendant = (itemId: string) => {
    const startIndex = outline.findIndex((item) => item.id === itemId);
    if (startIndex < 0) return null;
    const parentDepth = outline[startIndex].depth;
    for (let index = startIndex + 1; index < outline.length; index += 1) {
      const candidate = outline[index];
      if (candidate.depth <= parentDepth) break;
      if (knowledgeContentPageIdSet.has(candidate.id)) return candidate.id;
    }
    return null;
  };
  const findNearestContentAncestor = (itemId: string) => {
    const byId = new Map(outline.map((item) => [item.id, item]));
    let current = byId.get(itemId);
    while (current) {
      const parent = byId.get(current.parentId);
      if (!parent) return null;
      if (hasKnowledgePageContent(parent.id)) return parent.id;
      current = parent;
    }
    return null;
  };
  const isOutlineDescendant = (parentId: string, childId: string) => {
    const byId = new Map(outline.map((item) => [item.id, item]));
    let current = byId.get(childId);
    while (current) {
      if (current.parentId === parentId) return true;
      current = byId.get(current.parentId);
    }
    return false;
  };
  const handleHideParentKnowledgePagesChange = () => {
    const nextValue = !hideParentKnowledgePages;
    onHideParentKnowledgePagesChange(nextValue);
    if (!nextValue || !outlineParentIds.has(activePageId)) return;
    const nextPageId = findFirstSelectableDescendant(activePageId);
    if (nextPageId) focusOutlineNode(nextPageId);
  };

  useEffect(() => {
    if (mode !== "knowledge" || !firstKnowledgePageId) return;
    const collapseGuardActive = Date.now() - manualCollapseGuardRef.current < 500;
    if (collapseGuardActive) return;

    const enteredKnowledgeMode = previousModeRef.current !== "knowledge";
    const activeIsRoot = activePageId === rootNodeId;
    const activeIsDisabledParent = !isKnowledgePageSelectable(activePageId);
    const activeHasContent = hasKnowledgePageContent(activePageId);
    const nearestContentAncestorId = findNearestContentAncestor(activePageId);
    const activeIsEmptyPageFromModeSwitch = enteredKnowledgeMode && !activeHasContent && Boolean(nearestContentAncestorId);
    if (!activeIsRoot && !activeIsDisabledParent && !activeIsEmptyPageFromModeSwitch) return;

    const targetPageId = activeIsDisabledParent
      ? findFirstContentDescendant(activePageId) ?? firstKnowledgePageId
      : activeIsEmptyPageFromModeSwitch
        ? nearestContentAncestorId ?? firstKnowledgePageId
        : firstKnowledgePageId;

    const ancestorIds = getOutlineAncestorIds(outline, targetPageId);
    const nextCollapsedIds = collapsedOutlineIds.filter((id) => !ancestorIds.has(id));
    if (nextCollapsedIds.length !== collapsedOutlineIds.length) {
      setCollapsedOutlineIds(nextCollapsedIds);
      onCollapsedOutlineChange(nextCollapsedIds);
    }

    selectedPageIdRef.current = targetPageId;
    setSelectedPageId(targetPageId);
    setSelectedNodeId(targetPageId);
    setSelectedNodeCount(1);
  }, [
    activePageId,
    collapsedOutlineIds,
    firstKnowledgePageId,
    hideParentKnowledgePages,
    knowledgeDocuments,
    knowledgePoints,
    mode,
    onCollapsedOutlineChange,
    outline,
    outlineParentIds,
    rootNodeId
  ]);

  useEffect(() => {
    previousModeRef.current = mode;
  }, [mode]);

  const toggleOutlineCollapse = (itemId: string) => {
    const isCollapsed = collapsedOutlineIds.includes(itemId);
    const nextIds = isCollapsed
      ? collapsedOutlineIds.filter((id) => id !== itemId)
      : [...collapsedOutlineIds, itemId];
    manualCollapseGuardRef.current = Date.now();
    setCollapsedOutlineIds(nextIds);
    onCollapsedOutlineChange(nextIds);
    if (!isCollapsed && activePageId !== itemId && isOutlineDescendant(itemId, activePageId)) {
      selectedPageIdRef.current = itemId;
      setSelectedPageId(itemId);
      setSelectedNodeId(itemId);
      setSelectedNodeCount(1);
    }
  };

  const buildAiSystemContextMessage = (systemContext: SystemContextInfo) => {
    const readmeContent = systemContext.docs?.readmeContent?.trim();

    return [
      `当前课程：${title}`,
      `当前知识点：${activeTopic}`,
      "边界：只处理当前课程当前知识点。",
      "",
      "【系统 README】",
      readmeContent || "README 未读取到，请以运行与存储信息为准。"
    ].join("\n");
  };

  const sendAiChatText = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || aiChatPending) return;

    const userMessage: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message
    };
    setAiChatMessages((current) => [...current, userMessage]);
    setAiChatInput("");
    setAiChatPending(true);

    try {
      const result = (await window.aistudy?.ai?.chat({
        courseId,
        courseTitle: title,
        nodeId: activePageId,
        nodeTitle: activeTopic,
        message,
        knowledgeHtml: activeKnowledge,
        outline,
        provider: aiChatProvider
      })) as AiChatResult | undefined;

      if (typeof result?.updatedKnowledgeHtml === "string") {
        onKnowledgeChange(activePageId, result.updatedKnowledgeHtml);
      }

      setAiChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result?.reply || (result?.applied ? "已更新" : "已完成")
        }
      ]);
    } catch (error) {
      setAiChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: (error as Error).message || "处理失败"
        }
      ]);
    } finally {
      setAiChatPending(false);
    }
  };

  const sendAiChatMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendAiChatText(aiChatInput);
  };

  const sendAiSystemContext = async () => {
    if (aiChatPending) return;

    try {
      const systemContext = (await window.aistudy?.ai?.systemContext?.()) as SystemContextInfo | undefined;
      await sendAiChatText(buildAiSystemContextMessage(systemContext ?? {}));
    } catch (error) {
      setAiChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: (error as Error).message || "系统信息读取失败"
        }
      ]);
    }
  };

  return (
    <div className="mindmap-editor-layout">
      <aside
        className={isOutlineResizing ? "mindmap-outline resizing" : "mindmap-outline"}
        ref={outlineRef}
      >
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
            {visibleOutline.map((item) => {
              const hasChildren = outlineParentIds.has(item.id);
              const isCollapsed = collapsedOutlineIds.includes(item.id);

              return (
              <div
                className={[
                  "outline-item",
                  `depth-${Math.min(item.depth, 5)}`,
                  item.numbering ? "has-numbering" : "",
                  hasChildren ? "has-children" : "",
                  mode !== "mindmap" && hideParentKnowledgePages && hasChildren ? "knowledge-page-disabled" : "",
                  isCollapsed ? "collapsed" : "",
                  activePageId === item.id ? "active" : "",
                  draggingOutlineId === item.id ? "dragging" : "",
                  outlineDropTargetId === item.id ? "drop-target" : ""
                ].filter(Boolean).join(" ")}
                draggable
                key={item.id}
                role="button"
                tabIndex={0}
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
                onClick={() => {
                  if (mode !== "mindmap" && hideParentKnowledgePages && hasChildren) {
                    toggleOutlineCollapse(item.id);
                    return;
                  }
                  focusOutlineNode(item.id);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  if (mode !== "mindmap" && hideParentKnowledgePages && hasChildren) {
                    toggleOutlineCollapse(item.id);
                    return;
                  }
                  focusOutlineNode(item.id);
                }}
                title={mode !== "mindmap" && hideParentKnowledgePages && hasChildren ? "父级知识点页已关闭" : item.topic}
                style={{ paddingLeft: `${8 + item.depth * 22 + (item.depth >= 3 ? 16 : 0)}px` }}
              >
                {hasChildren ? (
                  <button
                    className="outline-collapse-toggle"
                    type="button"
                    title={isCollapsed ? "展开下级目录" : "折叠下级目录"}
                    aria-label={isCollapsed ? "展开下级目录" : "折叠下级目录"}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleOutlineCollapse(item.id);
                    }}
                    onDragStart={(event) => event.preventDefault()}
                  >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                ) : (
                  <span className="outline-collapse-spacer" aria-hidden="true" />
                )}
                {item.numbering && <span className="outline-numbering">{item.numbering}</span>}
                <span className="outline-topic">{item.topic}</span>
              </div>
              );
            })}
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
        <div
          className="outline-resize-handle"
          onMouseDown={startOutlineResize}
          title="拖动调整宽度"
        />
      </aside>
      <div className="mindmap-stage">
        {mode === "knowledge" && (
          <CanvasKnowledgePanel
            nodeId={activePageId}
            topic={activeTopic}
            value={activeKnowledgePanelValue}
            document={activeKnowledgePanelDocument}
            branchNode={activeBranchNode}
            isAutoOutline={shouldShowAutoBranchOutline}
            knowledgeFormatBrush={knowledgeFormatBrush}
            onKnowledgeFormatBrushChange={onKnowledgeFormatBrushChange}
            onKnowledgeChange={onKnowledgeChange}
            onKnowledgeDocumentChange={onKnowledgeDocumentChange}
            onNavigateNextKnowledgePage={nextKnowledgePageId ? () => focusOutlineNode(nextKnowledgePageId) : null}
            onNavigatePreviousKnowledgePage={previousKnowledgePageId ? () => focusOutlineNode(previousKnowledgePageId) : null}
            nextKnowledgePageTitle={getKnowledgePageTitle(nextKnowledgePageId)}
            previousKnowledgePageTitle={getKnowledgePageTitle(previousKnowledgePageId)}
            hideParentKnowledgePages={hideParentKnowledgePages}
            onToggleParentKnowledgePages={handleHideParentKnowledgePagesChange}
          />
        )}

        {mode === "knowledge" && (
          <div className={aiChatOpen ? "ai-chat-widget open" : "ai-chat-widget"}>
            <button
              className="ai-chat-launcher"
              type="button"
              aria-label="AI"
              onClick={() => setAiChatOpen((current) => !current)}
            >
              <img src={mascotUrl} alt="" />
            </button>
            {aiChatOpen && (
              <section className="ai-chat-panel" aria-label="AI">
                <header>
                  <img src={mascotUrl} alt="" />
                  <div className="ai-chat-provider" role="group" aria-label="model">
                    <button
                      type="button"
                      className={aiChatProvider === "claude" ? "active" : ""}
                      disabled={aiChatPending}
                      onClick={() => setAiChatProvider("claude")}
                    >
                      Claude
                    </button>
                    <button
                      type="button"
                      className={aiChatProvider === "mimo" ? "active" : ""}
                      disabled={aiChatPending}
                      onClick={() => setAiChatProvider("mimo")}
                    >
                      Mimo
                    </button>
                    <button
                      type="button"
                      className={aiChatProvider === "doubao" ? "active" : ""}
                      disabled={aiChatPending}
                      onClick={() => setAiChatProvider("doubao")}
                    >
                      Doubao
                    </button>
                    <button
                      type="button"
                      className={aiChatProvider === "chatgpt" ? "active" : ""}
                      disabled={aiChatPending}
                      onClick={() => setAiChatProvider("chatgpt")}
                    >
                      ChatGPT
                    </button>
                  </div>
                  <button type="button" aria-label="关闭" onClick={() => setAiChatOpen(false)}>
                    <X size={16} />
                  </button>
                </header>
                <div className="ai-chat-messages">
                  {aiChatMessages.map((message) => (
                    <div className={`ai-chat-bubble ${message.role}`} key={message.id}>
                      {message.content}
                    </div>
                  ))}
                  {aiChatPending && (
                    <div className="ai-chat-bubble assistant pending">
                      <span className="ai-chat-spinner" aria-label="loading" />
                    </div>
                  )}
                </div>
                <div className="ai-chat-quick-actions">
                  <button type="button" disabled={aiChatPending} onClick={sendAiSystemContext}>
                    <FileText size={14} />
                    <span>系统信息</span>
                  </button>
                </div>
                <form className="ai-chat-input" onSubmit={sendAiChatMessage}>
                  <input
                    aria-label="input"
                    disabled={aiChatPending}
                    onChange={(event) => setAiChatInput(event.target.value)}
                    placeholder="输入..."
                    value={aiChatInput}
                  />
                  <button type="submit" aria-label="send" disabled={aiChatPending || !aiChatInput.trim()}>
                    <Sparkles size={16} />
                  </button>
                </form>
              </section>
            )}
          </div>
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
                <button
                  className={syncNumberedOutline ? "active" : ""}
                  title={syncNumberedOutline ? "目录跟随序号层级编辑" : "序号层级目录已冻结"}
                  onClick={toggleNumberedOutlineSync}
                >
                  <List size={16} />
                  <span>同步目录</span>
                </button>
                <button
                  className={upstreamBranchIsolation ? "active" : ""}
                  title={upstreamBranchIsolation ? "上分支隔离已开启" : "当前分支同步上级导图"}
                  onClick={toggleUpstreamBranchIsolation}
                >
                  <GitFork size={16} />
                  <span>上隔离</span>
                </button>
                <button
                  className={downstreamBranchIsolation ? "active" : ""}
                  title={downstreamBranchIsolation ? "下分支隔离已开启" : "下级分支跟随当前分支"}
                  onClick={toggleDownstreamBranchIsolation}
                >
                  <GitBranchPlus size={16} />
                  <span>下隔离</span>
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
                <button
                  className={mindFormatBrush ? "active" : ""}
                  title={mindFormatBrush ? "应用导图格式" : "复制导图格式"}
                  onClick={applyMindNodeFormat}
                  onDoubleClick={() => onMindFormatBrushChange(null)}
                >
                  <Paintbrush size={16} />
                  <span>格式刷</span>
                </button>
                {mindFormatBrush && (
                  <button title="关闭导图格式刷" onClick={() => onMindFormatBrushChange(null)}>
                    <X size={16} />
                  </button>
                )}
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
                <div className="swatch-set" aria-label="background color">
                  <PaintBucket size={15} />
                  {fillColors.map((color) => (
                    <button
                      className="color-swatch fill"
                      key={color}
                      style={{ "--swatch-color": color } as React.CSSProperties}
                      title={`鑳屾櫙鑹?${color}`}
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

const legacyFontSizeMap: Record<string, string> = {
  "1": "12px",
  "2": "14px",
  "3": "16px",
  "4": "18px",
  "5": "24px",
  "6": "32px",
  "7": "36px"
};

const knowledgeInlineStyleProperties = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "textDecorationLine",
  "color",
  "backgroundColor"
];

const knowledgeBlockStyleProperties = [
  "textAlign",
  "textIndent",
  "marginLeft",
  "paddingLeft"
];

const knowledgePersistedStyleProperties = [
  ...knowledgeInlineStyleProperties,
  ...knowledgeBlockStyleProperties
];

function readStyleValue(style: CSSStyleDeclaration, property: string) {
  return style.getPropertyValue(property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`));
}

function writeStyleValue(style: CSSStyleDeclaration, property: string, value: string) {
  if (!value) return;
  style.setProperty(property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`), value);
}

function clearStyleValue(style: CSSStyleDeclaration, property: string) {
  style.removeProperty(property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`));
}

function getTextDecorationParts(value: string) {
  if (!value || value === "none") return [];
  return value.split(/\s+/).filter((item) => item === "underline" || item === "line-through");
}

function formatTextDecorationParts(parts: string[]) {
  const uniqueParts = Array.from(new Set(parts));
  return uniqueParts.length > 0 ? uniqueParts.join(" ") : "none";
}

function addTextDecorationPart(value: string, part: "underline" | "line-through") {
  return formatTextDecorationParts([...getTextDecorationParts(value), part]);
}

function copyKnowledgeElementStyles(source: HTMLElement, target: HTMLElement) {
  knowledgePersistedStyleProperties.forEach((property) => {
    writeStyleValue(target.style, property, readStyleValue(source.style, property));
  });

  const align = source.getAttribute("align");
  if (align) target.style.textAlign = align;
}

function convertLegacyFontTags(root: HTMLElement) {
  root.querySelectorAll("font").forEach((fontElement) => {
    const span = document.createElement("span");
    const size = fontElement.getAttribute("size");
    const face = fontElement.getAttribute("face");
    const color = fontElement.getAttribute("color");
    const fontSize = size ? legacyFontSizeMap[size] : "";

    if (fontSize) span.style.fontSize = fontSize;
    if (face) span.style.fontFamily = face;
    if (color) span.style.color = color;
    while (fontElement.firstChild) span.appendChild(fontElement.firstChild);
    fontElement.replaceWith(span);
  });
}

function getInlineStyleSnapshot(element: HTMLElement, inherited: Record<string, string>) {
  const styles = { ...inherited };

  knowledgeInlineStyleProperties.forEach((property) => {
    const value = readStyleValue(element.style, property).trim();
    if (value) styles[property] = value;
  });

  const tagName = element.tagName;
  if (tagName === "B" || tagName === "STRONG") styles.fontWeight = "800";
  if (tagName === "I" || tagName === "EM") styles.fontStyle = "italic";
  if (tagName === "U") styles.textDecorationLine = addTextDecorationPart(styles.textDecorationLine ?? "", "underline");
  if (tagName === "S" || tagName === "STRIKE") {
    styles.textDecorationLine = addTextDecorationPart(styles.textDecorationLine ?? "", "line-through");
  }

  Object.keys(styles).forEach((key) => {
    if (
      !styles[key] ||
      styles[key] === "normal" ||
      styles[key] === "initial" ||
      (key === "textDecorationLine" && styles[key] === "none")
    ) {
      delete styles[key];
    }
  });

  return styles;
}

function inlineStyleSignature(styles: Record<string, string>) {
  return knowledgeInlineStyleProperties
    .map((property) => {
      const value = styles[property];
      return value ? `${property}:${value}` : "";
    })
    .filter(Boolean)
    .join(";");
}

function applyInlineStyleSnapshot(element: HTMLElement, styles: Record<string, string>) {
  knowledgeInlineStyleProperties.forEach((property) => {
    const value = styles[property];
    if (value) writeStyleValue(element.style, property, value);
  });
}

function isFontWeightBoldValue(value: string) {
  const fontWeight = Number.parseInt(value, 10);
  return value === "bold" || (!Number.isNaN(fontWeight) && fontWeight >= 600);
}

function getStyleDelta(styles: Record<string, string>, baseStyles: Record<string, string>) {
  const delta: Record<string, string> = {};
  knowledgeInlineStyleProperties.forEach((property) => {
    const value = styles[property];
    const baseValue = baseStyles[property];
    if (property === "fontWeight" && !isFontWeightBoldValue(baseValue ?? "") && (value === "400" || value === "normal")) {
      return;
    }
    if (property === "fontStyle" && !baseValue && value === "normal") return;
    if (property === "textDecorationLine" && !baseValue && value === "none") return;
    if (property === "color" && !baseValue && value === "inherit") return;
    if (property === "backgroundColor" && !baseValue && (value === "transparent" || value === "rgba(0, 0, 0, 0)")) {
      return;
    }
    if ((property === "fontFamily" || property === "fontSize") && !baseValue && value === "inherit") return;
    if (value && value !== baseStyles[property]) delta[property] = value;
  });
  return delta;
}

function appendInlineText(
  target: ParentNode,
  text: string,
  styles: Record<string, string>,
  baseStyles: Record<string, string>
) {
  if (!text) return;
  const styleDelta = getStyleDelta(styles, baseStyles);
  const signature = inlineStyleSignature(styleDelta);
  if (!signature) {
    target.appendChild(document.createTextNode(text));
    return;
  }

  const lastChild = target.lastChild;
  if (
    lastChild instanceof HTMLSpanElement &&
    (lastChild.dataset.styleSignature ?? "") === signature
  ) {
    lastChild.appendChild(document.createTextNode(text));
    return;
  }

  const span = document.createElement("span");
  span.dataset.styleSignature = signature;
  applyInlineStyleSnapshot(span, styleDelta);
  span.appendChild(document.createTextNode(text));
  target.appendChild(span);
}

function appendSimplifiedInline(
  node: Node,
  target: ParentNode,
  inheritedStyles: Record<string, string>,
  baseStyles: Record<string, string>
) {
  if (node.nodeType === Node.TEXT_NODE) {
    appendInlineText(target, node.textContent ?? "", inheritedStyles, baseStyles);
    return;
  }

  if (!(node instanceof HTMLElement)) return;

  if (node.tagName === "BR") {
    target.appendChild(document.createElement("br"));
    return;
  }

  const nextStyles = getInlineStyleSnapshot(node, inheritedStyles);
  node.childNodes.forEach((child) => appendSimplifiedInline(child, target, nextStyles, baseStyles));
}

function trimBlockBoundaryWhitespace(fragment: DocumentFragment) {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode instanceof Text) textNodes.push(walker.currentNode);
  }

  const firstText = textNodes[0];
  if (firstText) firstText.textContent = (firstText.textContent ?? "").replace(/^[\s\u00a0]+/, "");

  const lastText = textNodes[textNodes.length - 1];
  if (lastText) lastText.textContent = (lastText.textContent ?? "").replace(/[\s\u00a0]+$/, "");

  textNodes.forEach((textNode) => {
    if ((textNode.textContent ?? "").length === 0) textNode.remove();
  });
}

function simplifyInlineChildren(element: HTMLElement) {
  const fragment = document.createDocumentFragment();
  const baseStyles = getInlineStyleSnapshot(element, {});
  element.childNodes.forEach((child) => appendSimplifiedInline(child, fragment, baseStyles, baseStyles));
  trimBlockBoundaryWhitespace(fragment);
  element.replaceChildren(fragment);
  element.querySelectorAll("span[data-style-signature]").forEach((span) => {
    delete (span as HTMLElement).dataset.styleSignature;
  });
}

function normalizeKnowledgeHtml(rawHtml: string) {
  if (rawHtml.length === 0) return "";

  const source = document.createElement("div");
  source.innerHTML = rawHtml;
  convertLegacyFontTags(source);
  const output = document.createElement("div");
  let paragraph = document.createElement("p");

  const hasVisibleOrIntentionalContent = (element: HTMLElement) =>
    element.textContent !== "" ||
    element.querySelectorAll("br, img, table, ul, ol, .knowledge-branch-map, .knowledge-flowchart").length > 0;

  const appendParagraph = (preserveEmpty = false) => {
    if (!hasVisibleOrIntentionalContent(paragraph)) {
      if (preserveEmpty) {
        paragraph.appendChild(document.createElement("br"));
        output.appendChild(paragraph);
      }
      paragraph = document.createElement("p");
      return;
    }

    simplifyInlineChildren(paragraph);
    output.appendChild(paragraph);
    paragraph = document.createElement("p");
  };

  const appendInline = (node: Node) => {
    paragraph.appendChild(node.cloneNode(true));
  };

  source.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? "").length > 0) appendInline(node);
      return;
    }

    if (!(node instanceof HTMLElement)) return;

    if (node.tagName === "BR") {
      appendParagraph(true);
      return;
    }

    if (node.classList.contains("knowledge-branch-map") || node.classList.contains("knowledge-flowchart")) {
      appendParagraph();
      output.appendChild(node.cloneNode(true));
      return;
    }

    if (node.tagName === "DIV" || node.tagName === "P") {
      appendParagraph();
      const nextParagraph = document.createElement("p");
      copyKnowledgeElementStyles(node, nextParagraph);
      nextParagraph.innerHTML = node.innerHTML;
      simplifyInlineChildren(nextParagraph);
      paragraph = nextParagraph;
      appendParagraph(node.innerHTML === "" || node.innerHTML === "<br>");
      return;
    }

    if (node.tagName === "UL" || node.tagName === "OL") {
      appendParagraph();
      const list = node.cloneNode(true);
      if (list instanceof HTMLElement) {
        list.querySelectorAll("li").forEach((item) => simplifyInlineChildren(item));
      }
      output.appendChild(list);
      return;
    }

    appendInline(node);
  });

  appendParagraph();
  return output.innerHTML;
}

const canvasKnowledgeHtmlInnerWidth = 980;
const canvasKnowledgeDocumentVersion = 2;
const canvasKnowledgeDefaultLetterSpacing = 0;
const canvasKnowledgeDefaultRowMargin = 1.2;
const canvasKnowledgeExtraPickAttrs: Array<keyof IElement> = ["letterSpacing"];
const canvasKnowledgeLetterSpacingOptions = [
  { label: "字距 紧 -0.5", value: -0.5 },
  { label: "字距 微紧 -0.25", value: -0.25 },
  { label: "字距 标准 0", value: 0 },
  { label: "字距 微宽 0.25", value: 0.25 },
  { label: "字距 0.5", value: 0.5 },
  { label: "字距 0.75", value: 0.75 },
  { label: "字距 宽 1", value: 1 },
  { label: "字距 1.25", value: 1.25 },
  { label: "字距 更宽 1.5", value: 1.5 },
  { label: "字距 1.75", value: 1.75 },
  { label: "字距 大 2", value: 2 },
  { label: "字距 2.5", value: 2.5 },
  { label: "字距 很大 3", value: 3 }
];
const canvasKnowledgeRowMarginOptions = [
  { label: "段距 0.8", value: 0.8 },
  { label: "段距 0.9", value: 0.9 },
  { label: "段距 紧凑 1", value: 1 },
  { label: "段距 1.1", value: 1.1 },
  { label: "段距 标准 1.2", value: canvasKnowledgeDefaultRowMargin },
  { label: "段距 1.3", value: 1.3 },
  { label: "段距 1.4", value: 1.4 },
  { label: "段距 1.5", value: 1.5 },
  { label: "段距 舒展 1.6", value: 1.6 },
  { label: "段距 1.8", value: 1.8 },
  { label: "段距 宽 2", value: 2 },
  { label: "段距 2.2", value: 2.2 },
  { label: "段距 大 2.4", value: 2.4 },
  { label: "段距 2.8", value: 2.8 },
  { label: "段距 很大 3", value: 3 }
];
const canvasKnowledgeEditorOptions: IEditorOption = {
  mode: EditorMode.EDIT,
  pageMode: PageMode.CONTINUITY,
  paperDirection: PaperDirection.HORIZONTAL,
  width: 794,
  height: 1123,
  scale: 1,
  pageGap: 0,
  margins: [56, 64, 80, 64],
  defaultFont: "Microsoft YaHei",
  defaultSize: 16,
  defaultColor: "#111827",
  defaultBasicRowMarginHeight: 8,
  defaultRowMargin: canvasKnowledgeDefaultRowMargin,
  wordBreak: WordBreak.BREAK_WORD
};

const canvasKnowledgeFontSizes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 64, 72];
const canvasKnowledgeTextColors = ["#111827", "#64748b", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0d9488", "#2563eb", "#7c3aed", "#db2777"];
const canvasKnowledgeHighlightColors = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecdd3", "#fde68a"];
const canvasKnowledgeFormatProperties: Array<keyof CanvasKnowledgeFormatBrush["styles"]> = [
  "font",
  "size",
  "bold",
  "italic",
  "underline",
  "strikeout",
  "color",
  "highlight",
  "rowFlex",
  "rowMargin",
  "letterSpacing",
  "level",
  "listType",
  "listStyle"
];

function createCanvasDataFromHtml(rawHtml: string): IEditorData {
  const html = rawHtml.trim();
  if (!html) return { main: [{ value: "" }] };
  try {
    const main = getElementListByHTML(html, { innerWidth: canvasKnowledgeHtmlInnerWidth });
    return { main: main.length > 0 ? main : [{ value: "" }] };
  } catch {
    const text = (() => {
      const container = document.createElement("div");
      container.innerHTML = html;
      return container.textContent || html.replace(/<[^>]+>/g, "");
    })();
    return {
      main: text
        .split(/\r?\n/)
        .flatMap((line, index, lines) => index < lines.length - 1 ? [{ value: line }, { value: "\n" }] : [{ value: line }])
    };
  }
}

function normalizeCanvasKnowledgeElement(
  element: IElement,
  options: { resetLegacyJustify: boolean }
): IElement {
  const next: IElement = { ...element };
  const letterSpacing = typeof next.letterSpacing === "number" ? next.letterSpacing : canvasKnowledgeDefaultLetterSpacing;
  if (Math.abs(letterSpacing) < 0.01 || letterSpacing > 3) {
    delete next.letterSpacing;
  }

  if (typeof next.rowMargin === "number" && next.rowMargin > 3) {
    next.rowMargin = canvasKnowledgeDefaultRowMargin;
  }

  if (options.resetLegacyJustify && (next.rowFlex === RowFlex.JUSTIFY || next.rowFlex === RowFlex.ALIGNMENT)) {
    next.rowFlex = RowFlex.LEFT;
  }

  if (next.valueList) {
    next.valueList = next.valueList.map((child) => normalizeCanvasKnowledgeElement(child, options));
  }

  if (next.trList) {
    next.trList = next.trList.map((row) => ({
      ...row,
      tdList: row.tdList.map((cell) => ({
        ...cell,
        value: cell.value.map((child) => normalizeCanvasKnowledgeElement(child, options))
      }))
    }));
  }

  return next;
}

function normalizeCanvasKnowledgeData(
  data: IEditorData,
  options: { resetLegacyJustify?: boolean } = {}
): IEditorData {
  const normalizeList = (list: IElement[] | undefined) =>
    list?.map((element) => normalizeCanvasKnowledgeElement(element, { resetLegacyJustify: Boolean(options.resetLegacyJustify) }));

  return {
    ...data,
    header: normalizeList(data.header),
    main: normalizeList(data.main) ?? [{ value: "" }],
    footer: normalizeList(data.footer)
  };
}

function applyCanvasKnowledgeLetterSpacing(element: IElement, letterSpacing: number): IElement {
  const next: IElement = { ...element };
  if (next.valueList) {
    next.valueList = next.valueList.map((child) => applyCanvasKnowledgeLetterSpacing(child, letterSpacing));
  }

  if (next.trList) {
    next.trList = next.trList.map((row) => ({
      ...row,
      tdList: row.tdList.map((cell) => ({
        ...cell,
        value: cell.value.map((child) => applyCanvasKnowledgeLetterSpacing(child, letterSpacing))
      }))
    }));
  }

  const isTextElement = !next.type || next.type === "text";
  if (isTextElement && next.value && next.value !== "\n" && next.value !== "​") {
    if (Math.abs(letterSpacing) < 0.01) {
      delete next.letterSpacing;
    } else {
      next.letterSpacing = letterSpacing;
    }
  }

  return next;
}

function pickCanvasKnowledgeFormat(element: Partial<IElement>): CanvasKnowledgeFormatBrush["styles"] {
  const styles: CanvasKnowledgeFormatBrush["styles"] = {};
  canvasKnowledgeFormatProperties.forEach((property) => {
    const value = element[property];
    if (value !== undefined && value !== null) {
      Object.assign(styles, { [property]: value });
    }
  });
  return styles;
}

function applyCanvasKnowledgeFormat(element: IElement, styles: CanvasKnowledgeFormatBrush["styles"]): IElement {
  const next: IElement = { ...element, ...styles };
  if (Array.isArray(next.valueList)) {
    next.valueList = next.valueList.map((child) => applyCanvasKnowledgeFormat(child, styles));
  }
  if (Array.isArray(next.trList)) {
    next.trList = next.trList.map((row) => ({
      ...row,
      tdList: row.tdList.map((cell) => ({
        ...cell,
        value: cell.value.map((child) => applyCanvasKnowledgeFormat(child, styles))
      }))
    }));
  }
  return next;
}

function getCanvasDocumentInitialData(
  canvasDocument: KnowledgeCanvasDocument | null,
  html: string
): IEditorData {
  if (canvasDocument?.kind === "canvas-editor" && Array.isArray(canvasDocument.data?.main)) {
    return normalizeCanvasKnowledgeData(canvasDocument.data, {
      resetLegacyJustify: canvasDocument.version < canvasKnowledgeDocumentVersion
    });
  }
  return normalizeCanvasKnowledgeData(createCanvasDataFromHtml(html), { resetLegacyJustify: true });
}

function collectCanvasKnowledgeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectCanvasKnowledgeText).join(" ");
  if (!value || typeof value !== "object") return "";
  return Object.values(value as Record<string, unknown>).map(collectCanvasKnowledgeText).join(" ");
}

function getCanvasDocumentText(canvasDocument: KnowledgeCanvasDocument | null) {
  if (!canvasDocument) return "";
  return `${canvasDocument.html ?? ""} ${collectCanvasKnowledgeText(canvasDocument.data?.main)}`.replace(/\s+/g, " ").trim();
}

function looksLikeGeneratedBranchOutline(canvasDocument: KnowledgeCanvasDocument | null) {
  const html = canvasDocument?.html ?? "";
  return (
    html.includes('data-aistudy-auto-branch-outline="true"') ||
    html.includes("knowledge-branch-map")
  );
}

function isStaleGeneratedBranchDocument(canvasDocument: KnowledgeCanvasDocument | null, branchNode: NodeObj | null) {
  if (!canvasDocument || !branchNode) return false;
  const text = getCanvasDocumentText(canvasDocument);
  if (!looksLikeGeneratedBranchOutline(canvasDocument)) return false;
  if (!text.includes(branchNode.topic)) return true;
  const children = branchNode.children ?? [];
  if (children.length === 0) return false;
  return !children.some((child) => text.includes(child.topic));
}

function renderCanvasMindBranchList(nodes: NodeObj[] | undefined): string {
  if (!nodes || nodes.length === 0) return "";
  return `<ul>${nodes
    .map((node) => `<li>${escapeHtml(node.topic)}${renderCanvasMindBranchList(node.children)}</li>`)
    .join("")}</ul>`;
}

function renderCanvasMindBranchHtml(branch: NodeObj) {
  return [
    `<h2 data-aistudy-auto-branch-outline="true">思维导图：${escapeHtml(branch.topic)}</h2>`,
    renderCanvasMindBranchList(branch.children) || "<p>暂无子分支</p>"
  ].join("");
}

function CanvasKnowledgePanel({
  nodeId,
  topic,
  value,
  document: canvasDocument,
  branchNode,
  isAutoOutline,
  knowledgeFormatBrush,
  onKnowledgeFormatBrushChange,
  onKnowledgeChange,
  onKnowledgeDocumentChange,
  onNavigatePreviousKnowledgePage,
  onNavigateNextKnowledgePage,
  previousKnowledgePageTitle,
  nextKnowledgePageTitle,
  hideParentKnowledgePages,
  onToggleParentKnowledgePages
}: {
  nodeId: string;
  topic: string;
  value: string;
  document: KnowledgeCanvasDocument | null;
  branchNode: NodeObj | null;
  isAutoOutline: boolean;
  knowledgeFormatBrush: KnowledgeFormatBrush | null;
  onKnowledgeFormatBrushChange: (format: KnowledgeFormatBrush | null) => void;
  onKnowledgeChange: (nodeId: string, content: string) => void;
  onKnowledgeDocumentChange: (nodeId: string, document: KnowledgeCanvasDocument) => void;
  onNavigatePreviousKnowledgePage: (() => void) | null;
  onNavigateNextKnowledgePage: (() => void) | null;
  previousKnowledgePageTitle: string | null;
  nextKnowledgePageTitle: string | null;
  hideParentKnowledgePages: boolean;
  onToggleParentKnowledgePages: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CanvasEditor | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedHtmlRef = useRef(value);
  const lastRangeRef = useRef<IRange | null>(null);
  const initialAutoOutlineRef = useRef(isAutoOutline);
  const hasUserEditedAutoOutlineRef = useRef(false);
  const [rangeStyle, setRangeStyle] = useState<Partial<IRangeStyle>>({});
  const [canvasFormatBrush, setCanvasFormatBrush] = useState<CanvasKnowledgeFormatBrush | null>(null);

  const persistCanvasDocument = useCallback((reason = "content-change") => {
    const editor = editorRef.current;
    if (!editor) return;
    if (initialAutoOutlineRef.current && !hasUserEditedAutoOutlineRef.current) return;
    const result = editor.command.getValue({ extraPickAttrs: canvasKnowledgeExtraPickAttrs });
    const htmlResult = editor.command.getHTML();
    const html = htmlResult.main || "";
    const nextDocument: KnowledgeCanvasDocument = {
      kind: "canvas-editor",
      version: canvasKnowledgeDocumentVersion,
      nodeId,
      topic,
      html,
      data: result.data,
      options: result.options,
      updatedAt: new Date().toISOString()
    };
    lastSavedHtmlRef.current = html;
    onKnowledgeChange(nodeId, html);
    onKnowledgeDocumentChange(nodeId, nextDocument);
    void window.aistudy?.debug?.appendKnowledgeFormatLog?.({
      at: new Date().toISOString(),
      event: "canvas-knowledge.persist",
      reason,
      nodeId,
      topic,
      htmlLength: html.length,
      mainElementCount: result.data.main.length
    });
  }, [nodeId, onKnowledgeChange, onKnowledgeDocumentChange, topic]);

  const schedulePersist = useCallback((reason = "content-change") => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      persistCanvasDocument(reason);
    }, 360);
  }, [persistCanvasDocument]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    container.innerHTML = "";
    const initialData = getCanvasDocumentInitialData(canvasDocument, value);
    const initialOptions = {
      ...(canvasDocument?.options ?? {}),
      ...canvasKnowledgeEditorOptions
    };
    const editor = new CanvasEditor(container, initialData, initialOptions);
    editorRef.current = editor;
    initialAutoOutlineRef.current = isAutoOutline;
    hasUserEditedAutoOutlineRef.current = false;
    lastSavedHtmlRef.current = canvasDocument?.html ?? value;
    editor.listener.contentChange = () => {
      hasUserEditedAutoOutlineRef.current = true;
      schedulePersist("content-change");
    };
    editor.listener.rangeStyleChange = (payload) => {
      setRangeStyle(payload);
      const range = editor.command.getRange();
      if (range.startIndex >= 0 || range.endIndex >= 0) {
        lastRangeRef.current = range;
      }
    };
    editor.listener.saved = () => persistCanvasDocument("editor-saved");
    window.setTimeout(() => editor.command.executeFocus(), 80);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      persistCanvasDocument("unmount");
      editor.destroy();
      editorRef.current = null;
      container.innerHTML = "";
    };
  }, [canvasDocument?.nodeId, isAutoOutline, nodeId]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !value || value === lastSavedHtmlRef.current) return;
    const nextData = createCanvasDataFromHtml(value);
    editor.command.executeSetValue(nextData, { isSetCursor: false });
    lastSavedHtmlRef.current = value;
  }, [value]);

  const restoreCanvasRange = (editor: CanvasEditor) => {
    const range = lastRangeRef.current;
    if (!range || (range.startIndex < 0 && range.endIndex < 0)) return;
    editor.command.executeSetRange(
      range.startIndex,
      range.endIndex,
      range.tableId,
      range.startTdIndex,
      range.endTdIndex,
      range.startTrIndex,
      range.endTrIndex
    );
  };

  const rememberCanvasRange = (editor: CanvasEditor) => {
    const range = editor.command.getRange();
    if (range.startIndex >= 0 || range.endIndex >= 0) {
      lastRangeRef.current = range;
    }
  };

  const preserveCanvasScroll = (action: () => void) => {
    const stage = stageRef.current;
    const scrollLeft = stage?.scrollLeft ?? 0;
    const scrollTop = stage?.scrollTop ?? 0;
    action();

    if (!stage) return;
    const restore = () => {
      stage.scrollLeft = scrollLeft;
      stage.scrollTop = scrollTop;
    };
    restore();
    window.requestAnimationFrame(restore);
    window.setTimeout(restore, 0);
  };

  const runCommand = (action: (editor: CanvasEditor) => void, reason: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    preserveCanvasScroll(() => {
      editor.command.executeFocus();
      restoreCanvasRange(editor);
      action(editor);
      rememberCanvasRange(editor);
      schedulePersist(reason);
    });
  };

  const applyLetterSpacing = (letterSpacing: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    preserveCanvasScroll(() => {
      editor.command.executeFocus();
      restoreCanvasRange(editor);
      const selectedElements = editor.command.getRangeContext()?.selectionElementList ?? [];
      if (selectedElements.length === 0) return;
      editor.command.executeInsertElementList(
        selectedElements.map((element) => applyCanvasKnowledgeLetterSpacing(element, letterSpacing)),
        { isReplace: true }
      );
      rememberCanvasRange(editor);
      schedulePersist("letter-spacing");
    });
  };

  const copyCanvasFormat = (reusable = false) => {
    const editor = editorRef.current;
    if (!editor) return;
    preserveCanvasScroll(() => {
      editor.command.executeFocus();
      restoreCanvasRange(editor);
      const selectedElements = editor.command.getRangeContext()?.selectionElementList ?? [];
      const sourceElement = selectedElements[0];
      const styles = pickCanvasKnowledgeFormat(sourceElement ?? rangeStyle);
      if (Object.keys(styles).length === 0) return;
      if (knowledgeFormatBrush) onKnowledgeFormatBrushChange(null);
      setCanvasFormatBrush({ styles, reusable });
      rememberCanvasRange(editor);
    });
  };

  const applyCanvasFormatBrush = () => {
    const editor = editorRef.current;
    if (!editor || !canvasFormatBrush) return;
    preserveCanvasScroll(() => {
      editor.command.executeFocus();
      restoreCanvasRange(editor);
      const selectedElements = editor.command.getRangeContext()?.selectionElementList ?? [];
      if (selectedElements.length === 0) {
        rememberCanvasRange(editor);
        return;
      }

      editor.command.executeInsertElementList(
        selectedElements.map((element) => applyCanvasKnowledgeFormat(element, canvasFormatBrush.styles)),
        { isReplace: true }
      );
      rememberCanvasRange(editor);
      schedulePersist("format-brush-apply");
    });
    if (!canvasFormatBrush.reusable) {
      setCanvasFormatBrush(null);
    }
  };

  const handleCanvasFormatBrushClick = () => {
    if (canvasFormatBrush) {
      applyCanvasFormatBrush();
      return;
    }
    copyCanvasFormat(false);
  };

  const handleReusableCanvasFormatBrushClick = () => {
    if (canvasFormatBrush?.reusable) {
      applyCanvasFormatBrush();
      return;
    }
    copyCanvasFormat(true);
  };

  const clearCanvasFormatBrush = () => {
    setCanvasFormatBrush(null);
  };

  useEffect(() => {
    if (!canvasFormatBrush) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      clearCanvasFormatBrush();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canvasFormatBrush]);

  const protectCanvasToolbarSelection = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) {
      event.preventDefault();
    }
  };

  const insertMindBranch = () => {
    if (!branchNode) return;
    runCommand((editor) => {
      const elementList = getElementListByHTML(renderCanvasMindBranchHtml(branchNode), { innerWidth: canvasKnowledgeHtmlInnerWidth });
      editor.command.executeInsertElementList(elementList);
    }, "insert-mind-branch");
  };

  const navigatePreviousKnowledgePage = () => {
    persistCanvasDocument("navigate-previous");
    onNavigatePreviousKnowledgePage?.();
  };

  const navigateNextKnowledgePage = () => {
    persistCanvasDocument("navigate-next");
    onNavigateNextKnowledgePage?.();
  };

  useEffect(() => {
    if (localStorage.getItem("aistudy:format-probe-enabled") !== "1") return undefined;
    const probeWindow = window as Window & {
      __aistudyCanvasKnowledgeProbe?: {
        getHTML: () => ReturnType<CanvasEditor["command"]["getHTML"]> | null;
        getRange: () => IRange | null;
        getValue: () => ReturnType<CanvasEditor["command"]["getValue"]> | null;
        setRange: (startIndex: number, endIndex: number) => boolean;
        setValue: (main: IElement[]) => boolean;
        reset: (text?: string) => boolean;
        selectAll: () => boolean;
      };
    };

    probeWindow.__aistudyCanvasKnowledgeProbe = {
      getHTML: () => editorRef.current?.command.getHTML() ?? null,
      getRange: () => editorRef.current?.command.getRange() ?? null,
      getValue: () => editorRef.current?.command.getValue({ extraPickAttrs: canvasKnowledgeExtraPickAttrs }) ?? null,
      setRange: (startIndex: number, endIndex: number) => {
        const editor = editorRef.current;
        if (!editor) return false;
        editor.command.executeSetRange(startIndex, endIndex);
        rememberCanvasRange(editor);
        return true;
      },
      setValue: (main) => {
        const editor = editorRef.current;
        if (!editor) return false;
        lastRangeRef.current = null;
        editor.command.executeSetValue({ main }, { isSetCursor: true });
        return true;
      },
      reset: (text = "股票定义 段落测试") => {
        const editor = editorRef.current;
        if (!editor) return false;
        lastRangeRef.current = null;
        editor.command.executeSetValue({ main: [{ value: text }] }, { isSetCursor: true });
        return true;
      },
      selectAll: () => {
        const editor = editorRef.current;
        if (!editor) return false;
        editor.command.executeSelectAll();
        rememberCanvasRange(editor);
        return true;
      }
    };

    return () => {
      delete probeWindow.__aistudyCanvasKnowledgeProbe;
    };
  });

  return (
    <section className="knowledge-panel canvas-knowledge-panel" aria-label="knowledge">
      <div className="canvas-knowledge-toolbar" onMouseDown={protectCanvasToolbarSelection}>
        <div className="toolbar-group">
          <button title="撤销" onClick={() => runCommand((editor) => editor.command.executeUndo(), "undo")}>
            <Undo2 size={16} />
          </button>
          <button title="重做" onClick={() => runCommand((editor) => editor.command.executeRedo(), "redo")}>
            <Redo2 size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <select
            title="标题与正文"
            defaultValue=""
            onChange={(event) => {
              const value = event.currentTarget.value;
              const levelMap: Record<string, TitleLevel | null> = {
                body: null,
                h1: TitleLevel.FIRST,
                h2: TitleLevel.SECOND,
                h3: TitleLevel.THIRD
              };
              runCommand((editor) => editor.command.executeTitle(levelMap[value] ?? null), "title");
              event.currentTarget.value = "";
            }}
          >
            <option value="" disabled>标题/正文</option>
            <option value="body">正文</option>
            <option value="h1">标题一</option>
            <option value="h2">标题二</option>
            <option value="h3">标题三</option>
          </select>
          <select
            title="字体"
            defaultValue="Microsoft YaHei"
            onChange={(event) => runCommand((editor) => editor.command.executeFont(event.currentTarget.value), "font")}
          >
            {knowledgeFontFamilies.map((font) => (
              <option key={font.value} value={font.value}>{font.label}</option>
            ))}
          </select>
          <select
            title="字号"
            defaultValue="16"
            onChange={(event) => runCommand((editor) => editor.command.executeSize(Number(event.currentTarget.value)), "size")}
          >
            {canvasKnowledgeFontSizes.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <select
            title="字间距"
            defaultValue=""
            onChange={(event) => {
              applyLetterSpacing(Number(event.currentTarget.value));
              event.currentTarget.value = "";
            }}
          >
            <option value="" disabled>字距</option>
            {canvasKnowledgeLetterSpacingOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            title="段间距"
            defaultValue=""
            onChange={(event) => {
              runCommand((editor) => editor.command.executeRowMargin(Number(event.currentTarget.value)), "row-margin");
              event.currentTarget.value = "";
            }}
          >
            <option value="" disabled>段距</option>
            {canvasKnowledgeRowMarginOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button className={rangeStyle.bold ? "active" : ""} title="加粗" onClick={() => runCommand((editor) => editor.command.executeBold(), "bold")}>
            <Bold size={16} />
          </button>
          <button className={rangeStyle.italic ? "active" : ""} title="斜体" onClick={() => runCommand((editor) => editor.command.executeItalic(), "italic")}>
            <em>I</em>
          </button>
          <button className={rangeStyle.underline ? "active" : ""} title="下划线" onClick={() => runCommand((editor) => editor.command.executeUnderline(), "underline")}>
            <u>U</u>
          </button>
          <button className={rangeStyle.strikeout ? "active" : ""} title="删除线" onClick={() => runCommand((editor) => editor.command.executeStrikeout(), "strikeout")}>
            <s>S</s>
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group canvas-color-group" aria-label="字体颜色">
          <span className="toolbar-group-icon" title="字体颜色"><Type size={14} /></span>
          {canvasKnowledgeTextColors.map((color) => (
            <button
              key={color}
              type="button"
              className="text-color-swatch"
              style={{ "--swatch-color": color } as React.CSSProperties}
              title="字体颜色"
              onClick={() => runCommand((editor) => editor.command.executeColor(color), "color")}
            >
              <span />
            </button>
          ))}
        </div>

        <div className="toolbar-group canvas-color-group" aria-label="高亮">
          <span className="toolbar-group-icon" title="高亮"><Highlighter size={14} /></span>
          {canvasKnowledgeHighlightColors.map((color) => (
            <button
              key={color}
              type="button"
              className="text-color-swatch"
              style={{ "--swatch-color": color } as React.CSSProperties}
              title="高亮"
              onClick={() => runCommand((editor) => editor.command.executeHighlight(color), "highlight")}
            >
              <span />
            </button>
          ))}
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button title="左对齐" onClick={() => runCommand((editor) => editor.command.executeRowFlex(RowFlex.LEFT), "align-left")}>
            <AlignLeft size={16} />
          </button>
          <button title="居中" onClick={() => runCommand((editor) => editor.command.executeRowFlex(RowFlex.CENTER), "align-center")}>
            <AlignCenter size={16} />
          </button>
          <button title="右对齐" onClick={() => runCommand((editor) => editor.command.executeRowFlex(RowFlex.RIGHT), "align-right")}>
            <AlignRight size={16} />
          </button>
          <button title="两端对齐" onClick={() => runCommand((editor) => editor.command.executeRowFlex(RowFlex.JUSTIFY), "align-justify")}>
            <AlignJustify size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button title="无序列表" onClick={() => runCommand((editor) => editor.command.executeList(ListType.UL, ListStyle.DISC), "list-ul")}>
            <List size={16} />
          </button>
          <button title="有序列表" onClick={() => runCommand((editor) => editor.command.executeList(ListType.OL, ListStyle.DECIMAL), "list-ol")}>
            <ListOrdered size={16} />
          </button>
          <button title="表格" onClick={() => runCommand((editor) => editor.command.executeInsertTable(3, 3), "table")}>
            <Table size={16} />
          </button>
          <button title="分页" onClick={() => runCommand((editor) => editor.command.executePageBreak(), "page-break")}>
            <FileText size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button title="插入当前思维导图分支" disabled={!branchNode} onClick={insertMindBranch}>
            <GitFork size={16} />
          </button>
          <button title="打印" onClick={() => runCommand((editor) => { void editor.command.executePrint(); }, "print")}>
            <Printer size={16} />
          </button>
          <button
            className={canvasFormatBrush && !canvasFormatBrush.reusable ? "active" : ""}
            title={canvasFormatBrush && !canvasFormatBrush.reusable ? "应用格式刷" : "复制格式"}
            onClick={handleCanvasFormatBrushClick}
          >
            <Paintbrush size={16} />
          </button>
          <button
            className={canvasFormatBrush?.reusable ? "active" : ""}
            title={canvasFormatBrush?.reusable ? "连续应用格式刷" : "复制复用格式"}
            onClick={handleReusableCanvasFormatBrushClick}
          >
            <Paintbrush size={16} />
            <span className="button-corner-mark">∞</span>
          </button>
          {canvasFormatBrush && (
            <button title="关闭格式刷" onClick={clearCanvasFormatBrush}>
              <X size={14} />
            </button>
          )}
          <button
            className={hideParentKnowledgePages ? "active" : ""}
            title={hideParentKnowledgePages ? "开启父级知识点页" : "关闭父级知识点页"}
            onClick={onToggleParentKnowledgePages}
          >
            <Settings size={16} />
          </button>
        </div>

        <div className="toolbar-spacer" />

        <div className="toolbar-group knowledge-page-nav" aria-label="有内容页面切换">
          <button
            aria-label="切换到上一页"
            disabled={!onNavigatePreviousKnowledgePage}
            onClick={navigatePreviousKnowledgePage}
            title={previousKnowledgePageTitle ? `上一页：${previousKnowledgePageTitle}` : "没有上一页"}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            aria-label="切换到下一页"
            disabled={!onNavigateNextKnowledgePage}
            onClick={navigateNextKnowledgePage}
            title={nextKnowledgePageTitle ? `下一页：${nextKnowledgePageTitle}` : "没有下一页"}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="canvas-knowledge-stage" ref={stageRef}>
        <div className="canvas-knowledge-editor" ref={containerRef} />
      </div>
    </section>
  );
}

function KnowledgePanel({
  nodeId,
  topic,
  value,
  branchNode,
  knowledgeFormatBrush,
  onKnowledgeFormatBrushChange,
  onKnowledgeChange,
  onNavigatePreviousKnowledgePage,
  onNavigateNextKnowledgePage,
  previousKnowledgePageTitle,
  nextKnowledgePageTitle,
  hideParentKnowledgePages,
  onToggleParentKnowledgePages
}: {
  nodeId: string;
  topic: string;
  value: string;
  branchNode: NodeObj | null;
  knowledgeFormatBrush: KnowledgeFormatBrush | null;
  onKnowledgeFormatBrushChange: (format: KnowledgeFormatBrush | null) => void;
  onKnowledgeChange: (nodeId: string, content: string) => void;
  onNavigatePreviousKnowledgePage: (() => void) | null;
  onNavigateNextKnowledgePage: (() => void) | null;
  previousKnowledgePageTitle: string | null;
  nextKnowledgePageTitle: string | null;
  hideParentKnowledgePages: boolean;
  onToggleParentKnowledgePages: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [historyState, setHistoryState] = useState<KnowledgeHistoryState>({ canUndo: false, canRedo: false });
  const [knowledgeZoom, setKnowledgeZoom] = useState(loadKnowledgeZoom);
  const [flowchartEditor, setFlowchartEditor] = useState<FlowchartEditorState | null>(null);
  const latestDraftRef = useRef(value);
  const persistedValueRef = useRef(value);
  const nodeIdRef = useRef(nodeId);
  const onKnowledgeChangeRef = useRef(onKnowledgeChange);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const activeBlockRef = useRef<HTMLElement | null>(null);
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const lastSelectApplyRef = useRef<{ key: string; value: string; at: number } | null>(null);
  const isEditorFocusedRef = useRef(false);
  const knowledgeFormatBrushClickTimerRef = useRef<number | null>(null);

  const isKnowledgeFormatDebugEnabled = () => {
    try {
      return localStorage.getItem(knowledgeFormatDebugStorageKey) !== "0";
    } catch {
      return true;
    }
  };

  const getNodeLabel = (node: Node | null) => {
    if (!node) return "none";
    if (node.nodeType === Node.TEXT_NODE) {
      return `#text(${(node.textContent ?? "").replace(/\s+/g, " ").slice(0, 28)})`;
    }
    if (node instanceof HTMLElement) {
      const className = node.className ? `.${String(node.className).replace(/\s+/g, ".")}` : "";
      return `${node.tagName.toLowerCase()}${className}`;
    }
    return node.nodeName;
  };

  const getHtmlMetrics = (html: string) => ({
    length: html.length,
    styleAttributes: (html.match(/\sstyle=/g) ?? []).length,
    paragraphs: (html.match(/<p[\s>]/g) ?? []).length,
    emptyParagraphs: (html.match(/<p(?:\s[^>]*)?><br><\/p>/g) ?? []).length,
    preview: html.replace(/\s+/g, " ").slice(0, 220)
  });

  const getRangeDebugSummary = (range: Range | null) => {
    if (!range) return null;
    return {
      collapsed: range.collapsed,
      text: range.toString().replace(/\s+/g, " ").slice(0, 80),
      start: getNodeLabel(range.startContainer),
      startOffset: range.startOffset,
      end: getNodeLabel(range.endContainer),
      endOffset: range.endOffset
    };
  };

  const logKnowledgeFormatDebug = (event: string, detail: Record<string, unknown> = {}) => {
    if (!isKnowledgeFormatDebugEnabled()) return;
    const editor = editorRef.current;
    const entry = {
      at: new Date().toISOString(),
      event,
      nodeId,
      topic,
      activeBlock: getNodeLabel(activeBlockRef.current),
      savedRange: getRangeDebugSummary(selectionRangeRef.current),
      editor: getHtmlMetrics(editor?.innerHTML ?? ""),
      ...detail
    };
    console.info("[AIstudy knowledge format]", entry);
    void window.aistudy?.debug?.appendKnowledgeFormatLog?.(entry);
  };

  const refreshHistoryState = () => {
    setHistoryState({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0
    });
  };

  const getCurrentEditorHtml = () => normalizeKnowledgeHtml(editorRef.current?.innerHTML || "");

  const restoreEditorHtml = (content: string) => {
    const normalizedContent = normalizeKnowledgeHtml(content);
    if (editorRef.current && editorRef.current.innerHTML !== normalizedContent) {
      editorRef.current.innerHTML = normalizedContent;
    }
    selectionRangeRef.current = null;
    latestDraftRef.current = normalizedContent;
    setDraft(normalizedContent);
    onKnowledgeChangeRef.current(nodeIdRef.current, normalizedContent);
    persistedValueRef.current = normalizedContent;
  };

  const captureHistorySnapshot = () => {
    const currentContent = getCurrentEditorHtml();
    const history = undoStackRef.current;
    if (history[history.length - 1] !== currentContent) {
      history.push(currentContent);
      if (history.length > knowledgeHistoryLimit) history.shift();
    }
    redoStackRef.current = [];
    refreshHistoryState();
  };

  const undoKnowledgeEdit = () => {
    const currentContent = getCurrentEditorHtml();
    let previousContent = undoStackRef.current.pop();
    while (previousContent === currentContent && undoStackRef.current.length > 0) {
      previousContent = undoStackRef.current.pop();
    }
    if (previousContent === undefined) {
      refreshHistoryState();
      return;
    }
    redoStackRef.current.push(currentContent);
    restoreEditorHtml(previousContent);
    refreshHistoryState();
    editorRef.current?.focus();
  };

  const redoKnowledgeEdit = () => {
    const nextContent = redoStackRef.current.pop();
    if (nextContent === undefined) {
      refreshHistoryState();
      return;
    }
    undoStackRef.current.push(getCurrentEditorHtml());
    restoreEditorHtml(nextContent);
    refreshHistoryState();
    editorRef.current?.focus();
  };

  useEffect(() => {
    const normalizedValue = normalizeKnowledgeHtml(value);
    const sameNode = nodeIdRef.current === nodeId;
    const shouldPreserveFocusedDom = sameNode && isEditorFocusedRef.current;

    persistedValueRef.current = normalizedValue;
    nodeIdRef.current = nodeId;

    if (shouldPreserveFocusedDom) {
      return;
    }

    setDraft(normalizedValue);
    latestDraftRef.current = normalizedValue;
    selectionRangeRef.current = null;
    activeBlockRef.current = null;
    undoStackRef.current = [];
    redoStackRef.current = [];
    refreshHistoryState();
    if (editorRef.current && editorRef.current.innerHTML !== normalizedValue) {
      editorRef.current.innerHTML = normalizedValue || "";
    }
    if (value && normalizedValue !== value) {
      onKnowledgeChangeRef.current(nodeId, normalizedValue);
    }
  }, [nodeId, value]);

  useEffect(() => {
    onKnowledgeChangeRef.current = onKnowledgeChange;
  }, [onKnowledgeChange]);

  useEffect(() => {
    return () => {
      if (knowledgeFormatBrushClickTimerRef.current !== null) {
        window.clearTimeout(knowledgeFormatBrushClickTimerRef.current);
      }
      if (latestDraftRef.current !== persistedValueRef.current) {
        onKnowledgeChangeRef.current(nodeIdRef.current, normalizeKnowledgeHtml(latestDraftRef.current));
      }
    };
  }, []);

  useEffect(() => {
    if (draft === value) return;
    if (draft !== latestDraftRef.current) return;
    latestDraftRef.current = draft;
    const timeoutId = window.setTimeout(() => {
      onKnowledgeChange(nodeId, latestDraftRef.current);
      persistedValueRef.current = latestDraftRef.current;
    }, 360);

    return () => window.clearTimeout(timeoutId);
  }, [draft, nodeId, onKnowledgeChange, value]);

  const flushDraft = () => {
    isEditorFocusedRef.current = false;
    const normalizedDraft = normalizeKnowledgeHtml(latestDraftRef.current);
    if (normalizedDraft !== latestDraftRef.current && editorRef.current) {
      editorRef.current.innerHTML = normalizedDraft;
      latestDraftRef.current = normalizedDraft;
      setDraft(normalizedDraft);
    }
    if (normalizedDraft !== value) {
      onKnowledgeChange(nodeId, normalizedDraft);
      persistedValueRef.current = normalizedDraft;
    }
  };

  const isNodeInsideEditor = (node: Node | null) => {
    const editor = editorRef.current;
    return Boolean(editor && node && (node === editor || editor.contains(node)));
  };

  const isRangeInsideEditor = (range: Range | null): range is Range => {
    return Boolean(range && isNodeInsideEditor(range.startContainer) && isNodeInsideEditor(range.endContainer));
  };

  const getLiveEditorSelectionRange = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    return isRangeInsideEditor(range) ? range : null;
  };

  const rememberSelection = () => {
    const selection = window.getSelection();
    const range = getLiveEditorSelectionRange();
    if (!selection || !range) return;
    selectionRangeRef.current = range.cloneRange();
    activeBlockRef.current = getEditableBlock(selection.focusNode);
  };

  const restoreSelection = () => {
    const range = selectionRangeRef.current;
    if (!isRangeInsideEditor(range)) {
      selectionRangeRef.current = null;
      logKnowledgeFormatDebug("selection.restore.invalid");
      return false;
    }
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    logKnowledgeFormatDebug("selection.restore.ok", { range: getRangeDebugSummary(range) });
    return true;
  };

  const getActiveSelectionRange = () => {
    const liveRange = getLiveEditorSelectionRange();
    if (liveRange) {
      selectionRangeRef.current = liveRange.cloneRange();
      activeBlockRef.current = getEditableBlock(liveRange.startContainer);
      return liveRange;
    }

    if (!restoreSelection()) return null;
    const restoredRange = getLiveEditorSelectionRange();
    if (restoredRange) {
      selectionRangeRef.current = restoredRange.cloneRange();
      activeBlockRef.current = getEditableBlock(restoredRange.startContainer);
    }
    return restoredRange;
  };

  const getSelectionElement = () => {
    const range = getActiveSelectionRange();
    if (!range) return activeBlockRef.current;
    const node = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;
    return node instanceof HTMLElement ? node : activeBlockRef.current;
  };

  const getEditableBlock = (node: Node | null) => {
    const editor = editorRef.current;
    if (!editor || !node) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
    if (!element) return null;
    const block = element.closest("p, div, li, h1, h2, h3, h4, h5, h6");
    if (!(block instanceof HTMLElement) || !editor.contains(block) || block === editor) return null;
    return block;
  };

  const setElementStyles = (element: HTMLElement, styles: KnowledgeStylePatch) => {
    Object.entries(styles).forEach(([key, styleValue]) => {
      if (styleValue === null || styleValue === "") {
        clearStyleValue(element.style, key);
        return;
      }
      if (!styleValue) return;
      writeStyleValue(element.style, key, String(styleValue));
    });
  };

  const removeElementStyles = (element: HTMLElement, properties: string[]) => {
    properties.forEach((property) => clearStyleValue(element.style, property));
  };

  const getTextNodesInRange = (range: Range) => {
    const editor = editorRef.current;
    if (!editor) return [];
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      if (!(textNode instanceof Text) || (textNode.textContent ?? "").trim().length === 0) continue;
      try {
        if (range.intersectsNode(textNode)) textNodes.push(textNode);
      } catch {
        // Browser selections can briefly point at detached nodes after toolbar actions.
      }
    }

    return textNodes;
  };

  const getInlineStyleProbeElements = (range: Range | null) => {
    if (range && !range.collapsed) {
      return getTextNodesInRange(range)
        .map((node) => node.parentElement)
        .filter((element): element is HTMLElement => element instanceof HTMLElement);
    }

    const selectionElement = getSelectionElement();
    return selectionElement ? [selectionElement] : [];
  };

  const isInlineStyleActive = (predicate: (style: CSSStyleDeclaration) => boolean) => {
    const range = getActiveSelectionRange();
    const elements = getInlineStyleProbeElements(range);
    return elements.length > 0 && elements.every((element) => predicate(window.getComputedStyle(element)));
  };

  const getEffectiveTextDecorationParts = (element: HTMLElement) => {
    const editor = editorRef.current;
    const decorations = new Set<string>();
    let current: HTMLElement | null = element;
    while (current && current !== editor) {
      if (current.tagName === "U") decorations.add("underline");
      if (current.tagName === "S" || current.tagName === "STRIKE") decorations.add("line-through");
      const inlineValue = readStyleValue(current.style, "textDecorationLine");
      const computedValue = window.getComputedStyle(current).textDecorationLine;
      getTextDecorationParts(inlineValue || computedValue).forEach((part) => decorations.add(part));
      current = current.parentElement;
    }
    return Array.from(decorations);
  };

  const isTextDecorationActive = (decoration: "underline" | "line-through") => {
    const range = getActiveSelectionRange();
    const elements = getInlineStyleProbeElements(range);
    return elements.length > 0 && elements.every((element) => getEffectiveTextDecorationParts(element).includes(decoration));
  };

  const getSelectionDecorationUnion = () => {
    const range = getActiveSelectionRange();
    const decorations = new Set<string>();
    getInlineStyleProbeElements(range).forEach((element) => {
      getEffectiveTextDecorationParts(element).forEach((part) => {
        decorations.add(part);
      });
    });
    return Array.from(decorations);
  };

  const isSelectionInsideBlockStyle = (predicate: (style: CSSStyleDeclaration) => boolean) => {
    const range = getActiveSelectionRange();
    const elements = getInlineStyleProbeElements(range);
    return elements.some((element) => {
      const block = getEditableBlock(element);
      return block ? predicate(window.getComputedStyle(block)) : false;
    });
  };

  const getStyleMap = (computedStyle: CSSStyleDeclaration | null, properties: string[]) => {
    const styles: Record<string, string> = {};
    if (!computedStyle) return styles;
    properties.forEach((property) => {
      const value = readStyleValue(computedStyle, property);
      if (value) styles[property] = value;
    });
    return styles;
  };

  const getEditableBlocksInRange = (range: Range) => {
    const editor = editorRef.current;
    if (!editor) return [];
    const blocks = new Set<HTMLElement>();
    const addBlock = (node: Node | null) => {
      const block = getEditableBlock(node);
      if (block) blocks.add(block);
    };

    addBlock(range.startContainer);
    addBlock(range.endContainer);

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      const element = walker.currentNode;
      if (!(element instanceof HTMLElement) || element === editor) continue;
      if (!element.matches("p, div, li, h1, h2, h3, h4, h5, h6")) continue;
      try {
        if (range.intersectsNode(element)) blocks.add(element);
      } catch {
        // Detached browser selection nodes can throw during fast toolbar operations.
      }
    }

    return Array.from(blocks);
  };

  const applyBlockStylesToSelection = (styles: KnowledgeStylePatch) => {
    const range = getActiveSelectionRange();
    const editor = editorRef.current;
    if (!editor) return;

    const blocks = range
      ? getEditableBlocksInRange(range)
      : activeBlockRef.current && editor.contains(activeBlockRef.current) && activeBlockRef.current !== editor
        ? [activeBlockRef.current]
        : [];

    logKnowledgeFormatDebug("block.styles.apply", {
      styles,
      range: getRangeDebugSummary(range),
      blockCount: blocks.length,
      blocks: blocks.map((block) => getNodeLabel(block))
    });
    blocks.forEach((block) => setElementStyles(block, styles));
  };

  const applyParagraphPreset = (presetValue: string) => {
    const preset = knowledgeParagraphPresets.find((item) => item.value === presetValue);
    if (!preset) return;
    runKnowledgeFormatCommand("paragraphPreset", { presetValue }, () => {
      restoreSelection();
      captureHistorySnapshot();
      applyBlockStylesToSelection(preset.styles);
      rememberSelection();
      editorRef.current?.focus();
      commitCurrentEditor({ reason: "paragraph.preset" });
    });
  };

  const stripPatchedStylesFromFragment = (fragment: DocumentFragment, styles: KnowledgeStylePatch) => {
    const properties = Object.keys(styles);
    if (properties.length === 0) return;
    fragment.querySelectorAll("*").forEach((element) => {
      if (element instanceof HTMLElement) removeElementStyles(element, properties);
    });
  };

  const styleSelectedTextFragment = (fragment: DocumentFragment, styles: KnowledgeStylePatch) => {
    const wrappers: HTMLElement[] = [];
    const shouldWrapText = Object.values(styles).some((styleValue) => styleValue !== null && styleValue !== "");
    if (!shouldWrapText) return wrappers;

    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
      if (walker.currentNode instanceof Text) textNodes.push(walker.currentNode);
    }

    textNodes.forEach((textNode) => {
      const text = textNode.textContent ?? "";
      if (text.trim().length === 0) return;

      const wrapper = document.createElement("span");
      setElementStyles(wrapper, styles);
      textNode.parentNode?.insertBefore(wrapper, textNode);
      wrapper.appendChild(textNode);
      wrappers.push(wrapper);
    });

    return wrappers;
  };

  const splitTextNodeForRange = (textNode: Text, range: Range) => {
    const textLength = textNode.textContent?.length ?? 0;
    const startOffset = range.startContainer === textNode ? range.startOffset : 0;
    const endOffset = range.endContainer === textNode ? range.endOffset : textLength;
    const boundedStart = Math.max(0, Math.min(startOffset, textLength));
    const boundedEnd = Math.max(boundedStart, Math.min(endOffset, textLength));

    if (boundedStart === boundedEnd) return null;

    let selectedText = textNode;
    if (boundedEnd < textLength) selectedText.splitText(boundedEnd);
    if (boundedStart > 0) selectedText = selectedText.splitText(boundedStart);
    return selectedText;
  };

  const getReusableInlineWrapper = (textNode: Text) => {
    const editor = editorRef.current;
    const parent = textNode.parentElement;
    if (!editor || !parent || parent === editor) return null;
    if (!editor.contains(parent)) return null;
    if (parent.matches("p, div, li, h1, h2, h3, h4, h5, h6")) return null;
    if (parent.childNodes.length !== 1 || parent.firstChild !== textNode) return null;
    return parent;
  };

  const applyInlineStyleToTextNodes = (
    styles: KnowledgeStylePatch,
    options: { captureHistory?: boolean; commit?: boolean } = {}
  ) => {
    const shouldCaptureHistory = options.captureHistory ?? true;
    const shouldCommit = options.commit ?? true;
    const range = getActiveSelectionRange();
    logKnowledgeFormatDebug("inline.text.start", {
      styles,
      shouldCaptureHistory,
      shouldCommit,
      range: getRangeDebugSummary(range)
    });
    if (!range || range.collapsed) {
      logKnowledgeFormatDebug("inline.text.fallback", {
        reason: !range ? "missing-range" : "collapsed-range",
        styles
      });
      applyInlineStyle(styles, { captureHistory: shouldCaptureHistory, commit: shouldCommit });
      return;
    }

    const textNodes = getTextNodesInRange(range);
    logKnowledgeFormatDebug("inline.text.nodes", {
      count: textNodes.length,
      nodes: textNodes.map((node) => getNodeLabel(node))
    });
    if (textNodes.length === 0) {
      logKnowledgeFormatDebug("inline.text.no-nodes", { selectedText: range.toString() });
      editorRef.current?.focus();
      return;
    }

    if (shouldCaptureHistory) captureHistorySnapshot();
    const wrappers: HTMLElement[] = [];
    const beforeHtml = editorRef.current?.innerHTML ?? "";

    [...textNodes].reverse().forEach((textNode) => {
      const selectedText = splitTextNodeForRange(textNode, range);
      if (!selectedText || (selectedText.textContent ?? "").length === 0) return;
      const reusableWrapper = getReusableInlineWrapper(selectedText);
      if (reusableWrapper) {
        setElementStyles(reusableWrapper, styles);
        wrappers.unshift(reusableWrapper);
        return;
      }
      const wrapper = document.createElement("span");
      setElementStyles(wrapper, styles);
      selectedText.parentNode?.insertBefore(wrapper, selectedText);
      wrapper.appendChild(selectedText);
      wrappers.unshift(wrapper);
    });

    if (wrappers.length > 0) {
      const selection = window.getSelection();
      const nextRange = document.createRange();
      nextRange.setStartBefore(wrappers[0]);
      nextRange.setEndAfter(wrappers[wrappers.length - 1]);
      selection?.removeAllRanges();
      selection?.addRange(nextRange);
      rememberSelection();
      if (shouldCommit) commitCurrentEditor({ reason: "inline.text" });
    }

    logKnowledgeFormatDebug("inline.text.done", {
      wrapperCount: wrappers.length,
      before: getHtmlMetrics(beforeHtml),
      after: getHtmlMetrics(editorRef.current?.innerHTML ?? "")
    });
    editorRef.current?.focus();
  };

  const applyStylesToRangeFragment = (range: Range, styles: KnowledgeStylePatch) => {
    const fragment = range.extractContents();
    stripPatchedStylesFromFragment(fragment, styles);
    const wrappers = styleSelectedTextFragment(fragment, styles);

    const startMarker = document.createComment("knowledge-selection-start");
    const marker = document.createComment("knowledge-selection-end");
    fragment.insertBefore(startMarker, fragment.firstChild);
    fragment.appendChild(marker);
    range.insertNode(fragment);

    const insertedNodes: Node[] = [];
    let currentNode = startMarker.nextSibling;
    while (currentNode && currentNode !== marker) {
      insertedNodes.push(currentNode);
      currentNode = currentNode.nextSibling;
    }

    const firstBoundary = wrappers[0] ?? insertedNodes[0] ?? null;
    const lastBoundary = wrappers[wrappers.length - 1] ?? insertedNodes[insertedNodes.length - 1] ?? null;
    startMarker.remove();
    marker.remove();
    return firstBoundary && lastBoundary ? [firstBoundary, lastBoundary] : [];
  };

  const applyInlineStyle = (
    styles: KnowledgeStylePatch,
    options: { captureHistory?: boolean; commit?: boolean; releaseFormatBrush?: boolean } = {}
  ) => {
    const shouldCaptureHistory = options.captureHistory ?? true;
    const shouldCommit = options.commit ?? true;
    const range = getActiveSelectionRange();
    if (!range) {
      const editor = editorRef.current;
      const block = activeBlockRef.current;
      logKnowledgeFormatDebug("inline.fragment.no-range", {
        styles,
        block: getNodeLabel(block)
      });
      if (editor && block && editor.contains(block) && block !== editor) {
        if (shouldCaptureHistory) captureHistorySnapshot();
        setElementStyles(block, styles);
        if (shouldCommit) commitCurrentEditor({ reason: "inline.fragment.block-fallback" });
      }
      editorRef.current?.focus();
      return;
    }

    if (range.collapsed) {
      const block = getEditableBlock(range.startContainer);
      logKnowledgeFormatDebug("inline.fragment.collapsed", {
        styles,
        block: getNodeLabel(block)
      });
      if (block) {
        if (shouldCaptureHistory) captureHistorySnapshot();
        setElementStyles(block, styles);
        rememberSelection();
        if (shouldCommit) commitCurrentEditor({ reason: "inline.fragment.collapsed" });
      }
      editorRef.current?.focus();
      return;
    }

    if (shouldCaptureHistory) captureHistorySnapshot();
    const wrapperBounds = applyStylesToRangeFragment(range, styles);
    if (wrapperBounds.length === 0) {
      logKnowledgeFormatDebug("inline.fragment.no-bounds", { styles });
      editorRef.current?.focus();
      return;
    }

    const selection = window.getSelection();
    selection?.removeAllRanges();
    const nextRange = document.createRange();
    nextRange.setStartBefore(wrapperBounds[0]);
    nextRange.setEndAfter(wrapperBounds[1]);
    selection?.addRange(nextRange);
    rememberSelection();
    editorRef.current?.focus();
    if (shouldCommit) commitCurrentEditor({ reason: "inline.fragment" });
    logKnowledgeFormatDebug("inline.fragment.done", {
      styles,
      bounds: wrapperBounds.map((node) => getNodeLabel(node))
    });
    if ((options.releaseFormatBrush ?? true) && knowledgeFormatBrush && !knowledgeFormatBrush.reusable) {
      onKnowledgeFormatBrushChange(null);
    }
  };

  const finishEditorCommand = (releaseFormatBrush = true) => {
    rememberSelection();
    editorRef.current?.focus();
    commitCurrentEditor({ reason: "editor.command.finish" });
    if (releaseFormatBrush && knowledgeFormatBrush && !knowledgeFormatBrush.reusable) {
      onKnowledgeFormatBrushChange(null);
    }
  };

  const sortBlocksInDocumentOrder = (blocks: HTMLElement[]) =>
    [...blocks].sort((first, second) => {
      if (first === second) return 0;
      return first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1;
    });

  const getTargetEditableBlocks = () => {
    const range = getActiveSelectionRange();
    const editor = editorRef.current;
    if (!editor) return [];
    if (range) return sortBlocksInDocumentOrder(getEditableBlocksInRange(range));
    const block = activeBlockRef.current;
    return block && editor.contains(block) && block !== editor ? [block] : [];
  };

  const selectAroundNodes = (nodes: Node[]) => {
    const connectedNodes = nodes.filter((node) => node.isConnected);
    if (connectedNodes.length === 0) return;
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.setStartBefore(connectedNodes[0]);
    range.setEndAfter(connectedNodes[connectedNodes.length - 1]);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const createParagraphFromListItem = (item: HTMLLIElement) => {
    const paragraph = document.createElement("p");
    copyKnowledgeElementStyles(item, paragraph);
    paragraph.innerHTML = item.innerHTML || "<br>";
    return paragraph;
  };

  const unwrapList = (list: HTMLUListElement | HTMLOListElement) => {
    const paragraphs = Array.from(list.children)
      .filter((item): item is HTMLLIElement => item instanceof HTMLLIElement)
      .map(createParagraphFromListItem);
    list.replaceWith(...paragraphs);
    return paragraphs;
  };

  const convertListTag = (list: HTMLUListElement | HTMLOListElement, listTag: "UL" | "OL") => {
    const nextList = document.createElement(listTag.toLowerCase()) as HTMLUListElement | HTMLOListElement;
    copyKnowledgeElementStyles(list, nextList);
    while (list.firstChild) nextList.appendChild(list.firstChild);
    list.replaceWith(nextList);
    return nextList;
  };

  const toggleList = (listTag: "UL" | "OL") => {
    logKnowledgeFormatDebug("command.start", { command: "list", listTag });
    restoreSelection();
    const blocks = getTargetEditableBlocks();
    if (blocks.length === 0) {
      logKnowledgeFormatDebug("command.no-target", { command: "list", listTag });
      return;
    }
    captureHistorySnapshot();

    const listBlocks = blocks.filter((block): block is HTMLLIElement => block instanceof HTMLLIElement);
    if (listBlocks.length === blocks.length) {
      const lists = Array.from(
        new Set(
          listBlocks
            .map((block) => block.closest("ul, ol"))
            .filter((list): list is HTMLUListElement | HTMLOListElement => list instanceof HTMLUListElement || list instanceof HTMLOListElement)
        )
      );
      const nextSelectionNodes: Node[] = lists.flatMap((list): Node[] =>
        list.tagName === listTag ? unwrapList(list) : [convertListTag(list, listTag)]
      );
      selectAroundNodes(nextSelectionNodes);
      finishEditorCommand();
      logKnowledgeFormatDebug("command.done", { command: "list", listTag, mode: "unwrap-or-convert" });
      return;
    }

    const firstBlock = blocks[0];
    const parent = firstBlock.parentNode;
    if (!parent) {
      logKnowledgeFormatDebug("command.no-target", { command: "list", listTag, reason: "missing-parent" });
      return;
    }

    const list = document.createElement(listTag.toLowerCase()) as HTMLUListElement | HTMLOListElement;
    blocks.forEach((block) => {
      const item = document.createElement("li");
      copyKnowledgeElementStyles(block, item);
      item.innerHTML = block.innerHTML || "<br>";
      list.appendChild(item);
    });
    parent.insertBefore(list, firstBlock);
    blocks.forEach((block) => block.remove());
    selectAroundNodes([list]);
    finishEditorCommand();
    logKnowledgeFormatDebug("command.done", { command: "list", listTag, mode: "wrap" });
  };

  const applyIndentChange = (direction: 1 | -1) => {
    logKnowledgeFormatDebug("command.start", { command: "indent", direction });
    restoreSelection();
    const blocks = getTargetEditableBlocks();
    if (blocks.length === 0) {
      logKnowledgeFormatDebug("command.no-target", { command: "indent", direction });
      return;
    }
    captureHistorySnapshot();
    blocks.forEach((block) => {
      const current = Number.parseFloat(block.style.marginLeft || "0") || 0;
      const next = Math.max(0, current + direction * 2);
      setElementStyles(block, { marginLeft: next === 0 ? null : `${next}em` });
    });
    finishEditorCommand(false);
    logKnowledgeFormatDebug("command.done", { command: "indent", direction, blockCount: blocks.length });
  };

  const insertHtmlAtSelection = (html: string) => {
    const editor = editorRef.current;
    if (!editor) return [];
    const template = document.createElement("template");
    template.innerHTML = html;
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const insertedNodes = Array.from(fragment.childNodes);
    const range = getActiveSelectionRange();

    if (range) {
      range.deleteContents();
      range.insertNode(fragment);
    } else {
      editor.appendChild(fragment);
    }

    if (insertedNodes.length > 0) {
      const selection = window.getSelection();
      const lastNode = insertedNodes[insertedNodes.length - 1];
      if (selection && lastNode.isConnected) {
        const nextRange = document.createRange();
        nextRange.setStartAfter(lastNode);
        nextRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(nextRange);
      }
    }

    return insertedNodes;
  };

  const runKnowledgeFormatCommand = (command: string, detail: Record<string, unknown>, action: () => void) => {
    logKnowledgeFormatDebug("command.start", { command, ...detail });
    try {
      action();
      logKnowledgeFormatDebug("command.done", { command });
    } catch (error) {
      logKnowledgeFormatDebug("command.error", {
        command,
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };

  const toggleInlineStyleValue = ({
    command,
    property,
    enabledValue,
    disabledValue,
    isActive
  }: {
    command: string;
    property: keyof KnowledgeStylePatch;
    enabledValue: string;
    disabledValue: string;
    isActive: (style: CSSStyleDeclaration) => boolean;
  }) => {
    runKnowledgeFormatCommand(command, { enabledValue, disabledValue }, () => {
      const active = isInlineStyleActive(isActive);
      applyInlineStyleToTextNodes({
        [property]: active ? disabledValue : enabledValue
      });
    });
  };

  const normalizeCssColorValue = (value: string) => {
    const probe = document.createElement("span");
    probe.style.color = value;
    return probe.style.color.replace(/\s+/g, " ").trim().toLowerCase();
  };

  const isSameCssColor = (first: string, second: string) => {
    const firstColor = normalizeCssColorValue(first);
    const secondColor = normalizeCssColorValue(second);
    return Boolean(firstColor && secondColor && firstColor === secondColor);
  };

  const applyFontFamily = (fontFamily: string) => {
    runKnowledgeFormatCommand("fontFamily", { fontFamily }, () => {
      applyInlineStyleToTextNodes({ fontFamily });
    });
  };

  const applyFontSize = (fontSize: string) => {
    runKnowledgeFormatCommand("fontSize", { fontSize }, () => {
      applyInlineStyleToTextNodes({ fontSize });
    });
  };

  const applyBold = () => {
    toggleInlineStyleValue({
      command: "bold",
      property: "fontWeight",
      enabledValue: "800",
      disabledValue: "400",
      isActive: (style) => isFontWeightBoldValue(style.fontWeight)
    });
  };

  const applyItalic = () => {
    toggleInlineStyleValue({
      command: "italic",
      property: "fontStyle",
      enabledValue: "italic",
      disabledValue: "normal",
      isActive: (style) => style.fontStyle === "italic" || style.fontStyle === "oblique"
    });
  };

  const toggleTextDecoration = (decoration: "underline" | "line-through") => {
    runKnowledgeFormatCommand(decoration, {}, () => {
      const isActive = isTextDecorationActive(decoration);
      const currentParts = getSelectionDecorationUnion();
      const nextParts = isActive
        ? currentParts.filter((part) => part !== decoration)
        : [...currentParts, decoration];
      const nextTextDecorationLine =
        nextParts.length > 0
          ? formatTextDecorationParts(nextParts)
          : "none";
      applyInlineStyleToTextNodes({ textDecorationLine: nextTextDecorationLine });
    });
  };

  const applyUnderline = () => {
    toggleTextDecoration("underline");
  };

  const applyStrikeThrough = () => {
    toggleTextDecoration("line-through");
  };

  const applyTextAlign = (textAlign: string) => {
    runKnowledgeFormatCommand("textAlign", { textAlign }, () => {
      restoreSelection();
      captureHistorySnapshot();
      applyBlockStylesToSelection({ textAlign });
      rememberSelection();
      editorRef.current?.focus();
      commitCurrentEditor({ reason: "text.align" });
    });
  };

  const clearFormatting = () => {
    runKnowledgeFormatCommand("clearFormatting", {}, () => {
      restoreSelection();
      captureHistorySnapshot();
      applyInlineStyleToTextNodes(
        {
          fontFamily: "inherit",
          fontSize: "inherit",
          fontWeight: "400",
          fontStyle: "normal",
          textDecorationLine: "none",
          color: "inherit",
          backgroundColor: "transparent"
        },
        { captureHistory: false, commit: false }
      );
      applyBlockStylesToSelection(
        Object.fromEntries(knowledgeBlockStyleProperties.map((property) => [property, null])) as KnowledgeStylePatch
      );
      finishEditorCommand();
    });
  };

  const handleFontFamilySelect = (event: React.FormEvent<HTMLSelectElement>) => {
    if (!shouldApplySelectValue("fontFamily", event.currentTarget.value)) return;
    applyFontFamily(event.currentTarget.value);
  };

  const handleFontSizeSelect = (event: React.FormEvent<HTMLSelectElement>) => {
    if (!shouldApplySelectValue("fontSize", event.currentTarget.value)) return;
    applyFontSize(event.currentTarget.value);
  };

  const shouldApplySelectValue = (key: string, value: string) => {
    const now = performance.now();
    const lastApply = lastSelectApplyRef.current;
    if (lastApply && lastApply.key === key && lastApply.value === value && now - lastApply.at < 120) {
      return false;
    }
    lastSelectApplyRef.current = { key, value, at: now };
    return true;
  };

  const applyTextColor = (color: string) => {
    runKnowledgeFormatCommand("textColor", { color }, () => {
      applyInlineStyleToTextNodes({ color });
    });
  };

  const toggleTextColor = (color: string) => {
    toggleInlineStyleValue({
      command: "textColor.swatch",
      property: "color",
      enabledValue: color,
      disabledValue: "inherit",
      isActive: (style) => isSameCssColor(style.color, color)
    });
  };

  const applyBackgroundColor = (backgroundColor: string) => {
    runKnowledgeFormatCommand("backgroundColor", { backgroundColor }, () => {
      applyInlineStyleToTextNodes({ backgroundColor });
    });
  };

  const commitCurrentEditor = (options: { normalizeDom?: boolean; reason?: string } = {}) => {
    const rawContent = editorRef.current?.innerHTML || "";
    const content = normalizeKnowledgeHtml(rawContent);
    const shouldNormalizeDom = options.normalizeDom ?? false;
    const willRewriteDom = Boolean(shouldNormalizeDom && editorRef.current && editorRef.current.innerHTML !== content);
    if (willRewriteDom && editorRef.current) editorRef.current.innerHTML = content;
    setDraft(content);
    latestDraftRef.current = content;
    onKnowledgeChange(nodeId, content);
    persistedValueRef.current = content;
    logKnowledgeFormatDebug("commit.current", {
      reason: options.reason ?? "unknown",
      normalizedDom: willRewriteDom,
      raw: getHtmlMetrics(rawContent),
      normalized: getHtmlMetrics(content)
    });
  };

  const copyKnowledgeFormat = (reusable = false) => {
    restoreSelection();
    const sourceElement = getSelectionElement();
    const sourceBlock = activeBlockRef.current ?? getEditableBlock(sourceElement);
    const computedStyle = sourceElement ? window.getComputedStyle(sourceElement) : null;
    const blockStyle = sourceBlock ? window.getComputedStyle(sourceBlock) : computedStyle;
    onKnowledgeFormatBrushChange({
      inlineStyles: getStyleMap(computedStyle, knowledgeInlineStyleProperties),
      blockStyles: getStyleMap(blockStyle, knowledgeBlockStyleProperties),
      reusable
    });
    editorRef.current?.focus();
  };

  const applyKnowledgeFormat = () => {
    if (!knowledgeFormatBrush) {
      copyKnowledgeFormat();
      return;
    }

    restoreSelection();
    const copiedFormat = knowledgeFormatBrush;
    captureHistorySnapshot();
    applyInlineStyle(copiedFormat.inlineStyles, {
      captureHistory: false,
      commit: false,
      releaseFormatBrush: false
    });
    applyBlockStylesToSelection(copiedFormat.blockStyles);
    rememberSelection();
    editorRef.current?.focus();
    commitCurrentEditor({ reason: "format.brush.apply" });
    if (!copiedFormat.reusable) {
      onKnowledgeFormatBrushChange(null);
    }
  };

  const handleKnowledgeFormatBrushClick = () => {
    if (knowledgeFormatBrushClickTimerRef.current !== null) {
      window.clearTimeout(knowledgeFormatBrushClickTimerRef.current);
    }
    knowledgeFormatBrushClickTimerRef.current = window.setTimeout(() => {
      knowledgeFormatBrushClickTimerRef.current = null;
      applyKnowledgeFormat();
    }, 180);
  };

  const handleKnowledgeFormatBrushDoubleClick = () => {
    if (knowledgeFormatBrushClickTimerRef.current !== null) {
      window.clearTimeout(knowledgeFormatBrushClickTimerRef.current);
      knowledgeFormatBrushClickTimerRef.current = null;
    }
    copyKnowledgeFormat(true);
  };

  const handleInput = () => {
    const content = editorRef.current?.innerHTML || "";
    setDraft(content);
    latestDraftRef.current = content;
    rememberSelection();
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    if (key === "escape" && knowledgeFormatBrush) {
      event.preventDefault();
      onKnowledgeFormatBrushChange(null);
      return;
    }
    if (!event.ctrlKey && !event.metaKey) return;
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      undoKnowledgeEdit();
      return;
    }
    if (key === "y" || (key === "z" && event.shiftKey)) {
      event.preventDefault();
      redoKnowledgeEdit();
      return;
    }
    if (key === "b") {
      event.preventDefault();
      applyBold();
      return;
    }
    if (key === "i") {
      event.preventDefault();
      applyItalic();
      return;
    }
    if (key === "u") {
      event.preventDefault();
      applyUnderline();
    }
  };

  const navigatePreviousKnowledgePage = () => {
    if (!onNavigatePreviousKnowledgePage) return;
    flushDraft();
    onNavigatePreviousKnowledgePage();
  };

  const navigateNextKnowledgePage = () => {
    if (!onNavigateNextKnowledgePage) return;
    flushDraft();
    onNavigateNextKnowledgePage();
  };

  const handleKnowledgeWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    const nextZoom = clampKnowledgeZoom(Number((knowledgeZoom + direction * knowledgeZoomStep).toFixed(2)));
    if (nextZoom === knowledgeZoom) return;
    setKnowledgeZoom(nextZoom);
    localStorage.setItem(knowledgeZoomStorageKey, String(nextZoom));
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      if (!isEditorFocusedRef.current) return;
      rememberSelection();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const commitEditorContent = (content: string) => {
    const normalizedContent = normalizeKnowledgeHtml(content);
    const willRewriteDom = Boolean(editorRef.current && editorRef.current.innerHTML !== normalizedContent);
    if (editorRef.current && editorRef.current.innerHTML !== normalizedContent) {
      editorRef.current.innerHTML = normalizedContent;
    }
    setDraft(normalizedContent);
    latestDraftRef.current = normalizedContent;
    onKnowledgeChange(nodeId, normalizedContent);
    persistedValueRef.current = normalizedContent;
    logKnowledgeFormatDebug("commit.structural", {
      normalizedDom: willRewriteDom,
      raw: getHtmlMetrics(content),
      normalized: getHtmlMetrics(normalizedContent)
    });
  };

  const insertBranchMap = () => {
    if (!branchNode || !editorRef.current) return;
    const branchHtml = renderKnowledgeBranchHtml(branchNode);
    restoreSelection();
    editorRef.current.focus();
    captureHistorySnapshot();

    insertHtmlAtSelection(branchHtml);
    commitEditorContent(editorRef.current.innerHTML || "");
    rememberSelection();
  };

  const insertFlowchart = () => {
    if (!editorRef.current) return;
    const blockId = crypto.randomUUID();
    const flowchart = createDefaultFlowchart();
    restoreSelection();
    editorRef.current.focus();
    captureHistorySnapshot();

    const flowchartHtml = renderKnowledgeFlowchartHtml(flowchart, blockId);

    insertHtmlAtSelection(flowchartHtml);
    commitEditorContent(editorRef.current.innerHTML || "");
    selectionRangeRef.current = null;
    setFlowchartEditor({ blockId, data: flowchart, selectedNodeId: flowchart.nodes[0]?.id ?? "" });
  };

  const saveFlowchart = (state: FlowchartEditorState) => {
    if (!editorRef.current) return;
    captureHistorySnapshot();
    const block = editorRef.current.querySelector(`[data-flowchart-id="${state.blockId}"]`);
    const nextHtml = renderKnowledgeFlowchartHtml(state.data, state.blockId);
    if (block) {
      block.outerHTML = nextHtml;
    } else {
      editorRef.current.insertAdjacentHTML("beforeend", nextHtml);
    }
    commitEditorContent(editorRef.current.innerHTML || "");
    setFlowchartEditor(null);
  };

  const handleEditorClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const flowchartEditButton = target.closest(".flowchart-edit");
    if (flowchartEditButton) {
      event.preventDefault();
      const flowchartBlock = flowchartEditButton.closest(".knowledge-flowchart");
      if (!flowchartBlock) return;
      const data = parseKnowledgeFlowchart(flowchartBlock);
      setFlowchartEditor({
        blockId: flowchartBlock.getAttribute("data-flowchart-id") || crypto.randomUUID(),
        data,
        selectedNodeId: data.nodes[0]?.id ?? ""
      });
      return;
    }

    const flowchartDeleteButton = target.closest(".flowchart-delete");
    if (flowchartDeleteButton) {
      event.preventDefault();
      const flowchartBlock = flowchartDeleteButton.closest(".knowledge-flowchart");
      if (!flowchartBlock || !editorRef.current) return;
      captureHistorySnapshot();
      const nextSibling = flowchartBlock.nextSibling;
      flowchartBlock.remove();
      if (
        nextSibling instanceof HTMLParagraphElement &&
        (nextSibling.textContent ?? "").trim() === "" &&
        nextSibling.querySelector("br")
      ) {
        nextSibling.remove();
      }
      commitEditorContent(editorRef.current.innerHTML || "");
      selectionRangeRef.current = null;
      return;
    }

    const closeButton = target.closest(".branch-map-close");
    if (!closeButton || !editorRef.current) return;

    event.preventDefault();
    const branchMap = closeButton.closest(".knowledge-branch-map");
    if (!branchMap) return;

    captureHistorySnapshot();
    const nextSibling = branchMap.nextSibling;
    branchMap.remove();
    if (
      nextSibling instanceof HTMLParagraphElement &&
      (nextSibling.textContent ?? "").trim() === "" &&
      nextSibling.querySelector("br")
    ) {
      nextSibling.remove();
    }

    commitEditorContent(editorRef.current.innerHTML || "");
    selectionRangeRef.current = null;
  };

  const protectToolbarSelection = (event: React.MouseEvent<HTMLDivElement>) => {
    rememberSelection();
    const target = event.target as HTMLElement;
    if (target.closest("select") || target.closest('input[type="color"]')) return;
    event.preventDefault();
    restoreSelection();
  };

  return (
    <section className="knowledge-panel" aria-label="knowledge">
      <div className="knowledge-toolbar" onMouseDown={protectToolbarSelection}>
        <div className="toolbar-group">
          <button title="撤销 (Ctrl+Z)" disabled={!historyState.canUndo} onClick={undoKnowledgeEdit}>
            <Undo2 size={16} />
          </button>
          <button title="重做 (Ctrl+X)" disabled={!historyState.canRedo} onClick={redoKnowledgeEdit}>
            <Redo2 size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button title="加粗 (Ctrl+B)" onClick={applyBold}>
            <Bold size={16} />
          </button>
          <button title="斜体 (Ctrl+I)" onClick={applyItalic}>
            <em>I</em>
          </button>
          <button title="下划线 (Ctrl+U)" onClick={applyUnderline}>
            <u>U</u>
          </button>
          <button title="删除线" onClick={applyStrikeThrough}>
            <s>S</s>
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <select
            title="标题与正文"
            defaultValue=""
            onChange={(event) => {
              applyParagraphPreset(event.target.value);
              event.currentTarget.value = "";
            }}
          >
            <option value="" disabled>
              标题/正文
            </option>
            {knowledgeParagraphPresets.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
          <select
            title="字体"
            defaultValue="Microsoft YaHei"
            onChange={handleFontFamilySelect}
            onInput={handleFontFamilySelect}
          >
            {knowledgeFontFamilies.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
          <select
            title="字号"
            defaultValue="22px"
            onChange={handleFontSizeSelect}
          >
            {knowledgeFontSizes.map((size) => (
              <option key={size} value={size}>
                {size.replace("px", "")}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group text-color-swatch-group" aria-label="常用字体颜色">
          <span className="toolbar-group-icon" title="常用字体颜色">
            <Type size={14} />
          </span>
          {knowledgeTextColorSwatches.map((color) => (
            <button
              key={color.value}
              type="button"
              className="text-color-swatch"
              style={{ "--swatch-color": color.value } as React.CSSProperties}
              title={`字体颜色：${color.label}（再次点击取消）`}
              aria-label={`字体颜色：${color.label}`}
              onClick={() => toggleTextColor(color.value)}
            >
              <span />
            </button>
          ))}
          <label className="color-picker-label" title="文字颜色">
            <Type size={14} />
            <input type="color" defaultValue="#111827" onChange={(event) => applyTextColor(event.target.value)} />
          </label>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <label className="color-picker-label" title="背景颜色">
            <PaintBucket size={14} />
            <input type="color" defaultValue="#fef3c7" onChange={(event) => applyBackgroundColor(event.target.value)} />
          </label>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button title="左对齐" onClick={() => applyTextAlign("left")}>
            <AlignLeft size={16} />
          </button>
          <button title="居中" onClick={() => applyTextAlign("center")}>
            <AlignCenter size={16} />
          </button>
          <button title="右对齐" onClick={() => applyTextAlign("right")}>
            <AlignRight size={16} />
          </button>
          <button title="两端" onClick={() => applyTextAlign("justify")}>
            <AlignJustify size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button title="无序列表" onClick={() => toggleList("UL")}>
            <List size={16} />
          </button>
          <button title="有序列表" onClick={() => toggleList("OL")}>
            <ListOrdered size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button title="增加缩进" onClick={() => applyIndentChange(1)}>
            <IndentIncrease size={16} />
          </button>
          <button title="减少缩进" onClick={() => applyIndentChange(-1)}>
            <IndentDecrease size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            className={knowledgeFormatBrush ? "active" : ""}
            title={knowledgeFormatBrush?.reusable ? "连续应用格式刷" : knowledgeFormatBrush ? "应用格式刷" : "复制格式"}
            onClick={handleKnowledgeFormatBrushClick}
            onDoubleClick={handleKnowledgeFormatBrushDoubleClick}
          >
            <Paintbrush size={16} />
          </button>
          {knowledgeFormatBrush && (
            <button title="关闭格式刷" onClick={() => onKnowledgeFormatBrushChange(null)}>
              <X size={16} />
            </button>
          )}
          <button title="清除格式" onClick={clearFormatting}>
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            className="flowchart-button"
            title="插入流程图"
            onClick={insertFlowchart}
          >
            <GitBranchPlus size={16} />
          </button>
          <button
            className="branch-map-button"
            disabled={!branchNode}
            title="插入当前分支思维导图"
            onClick={insertBranchMap}
          >
            <GitFork size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            className={hideParentKnowledgePages ? "active" : ""}
            title={hideParentKnowledgePages ? "开启父级知识点页" : "关闭父级知识点页"}
            onClick={onToggleParentKnowledgePages}
          >
            <Settings size={16} />
          </button>
        </div>

        <div className="toolbar-spacer" />

        <div className="toolbar-group knowledge-page-nav" aria-label="有内容页面切换">
          <button
            aria-label="切换到上一页"
            disabled={!onNavigatePreviousKnowledgePage}
            onClick={navigatePreviousKnowledgePage}
            title={previousKnowledgePageTitle ? `上一页：${previousKnowledgePageTitle}` : "没有上一页"}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            aria-label="切换到下一页"
            disabled={!onNavigateNextKnowledgePage}
            onClick={navigateNextKnowledgePage}
            title={nextKnowledgePageTitle ? `下一页：${nextKnowledgePageTitle}` : "没有下一页"}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div
        className="knowledge-reader-stage"
        onWheel={handleKnowledgeWheel}
        style={{ "--knowledge-zoom": knowledgeZoom } as React.CSSProperties}
      >
        <div
          ref={editorRef}
          className="knowledge-editor"
          contentEditable
          onFocus={() => {
            isEditorFocusedRef.current = true;
          }}
          onBeforeInput={captureHistorySnapshot}
          onInput={handleInput}
          onClick={handleEditorClick}
          onKeyDown={handleEditorKeyDown}
          onKeyUp={rememberSelection}
          onSelect={rememberSelection}
          onMouseUp={rememberSelection}
          onBlur={flushDraft}
          data-placeholder="定义、重点、例子、易错点..."
          suppressContentEditableWarning
        />
      </div>
      {flowchartEditor && (
        <FlowchartEditorModal
          state={flowchartEditor}
          onChange={setFlowchartEditor}
          onCancel={() => setFlowchartEditor(null)}
          onSave={saveFlowchart}
        />
      )}
    </section>
  );
}

function FlowchartEditorModal({
  state,
  onChange,
  onCancel,
  onSave
}: {
  state: FlowchartEditorState;
  onChange: (state: FlowchartEditorState) => void;
  onCancel: () => void;
  onSave: (state: FlowchartEditorState) => void;
}) {
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const selectedNode = state.data.nodes.find((node) => node.id === state.selectedNodeId) ?? state.data.nodes[0] ?? null;
  const nodeMap = new Map(state.data.nodes.map((node) => [node.id, node]));
  const bounds = getFlowchartBounds(state.data);

  const updateData = (updater: (data: KnowledgeFlowchart) => KnowledgeFlowchart) => {
    onChange({ ...state, data: normalizeFlowchartData(updater(state.data)) });
  };

  const updateSelectedNode = (patch: Partial<FlowchartNode>) => {
    if (!selectedNode) return;
    updateData((data) => ({
      ...data,
      nodes: data.nodes.map((node) => node.id === selectedNode.id ? { ...node, ...patch } : node)
    }));
  };

  const addNode = () => {
    const node: FlowchartNode = {
      id: crypto.randomUUID(),
      label: "新节点",
      kind: "process",
      x: 120 + state.data.nodes.length * 32,
      y: 190 + state.data.nodes.length * 18
    };
    onChange({
      ...state,
      selectedNodeId: node.id,
      data: { ...state.data, nodes: [...state.data.nodes, node] }
    });
  };

  const deleteSelectedNode = () => {
    if (!selectedNode || state.data.nodes.length <= 1) return;
    const nodes = state.data.nodes.filter((node) => node.id !== selectedNode.id);
    onChange({
      ...state,
      selectedNodeId: nodes[0]?.id ?? "",
      data: {
        ...state.data,
        nodes,
        edges: state.data.edges.filter((edge) => edge.from !== selectedNode.id && edge.to !== selectedNode.id)
      }
    });
  };

  const addEdge = () => {
    if (state.data.nodes.length < 2) return;
    const from = selectedNode?.id ?? state.data.nodes[0].id;
    const to = state.data.nodes.find((node) => node.id !== from)?.id ?? state.data.nodes[0].id;
    updateData((data) => ({
      ...data,
      edges: [...data.edges, { id: crypto.randomUUID(), from, to, label: "" }]
    }));
  };

  const updateEdge = (edgeId: string, patch: Partial<FlowchartEdge>) => {
    updateData((data) => ({
      ...data,
      edges: data.edges.map((edge) => edge.id === edgeId ? { ...edge, ...patch } : edge)
    }));
  };

  const deleteEdge = (edgeId: string) => {
    updateData((data) => ({ ...data, edges: data.edges.filter((edge) => edge.id !== edgeId) }));
  };

  const startDragNode = (event: React.PointerEvent<SVGGElement>, node: FlowchartNode) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = bounds.width / rect.width;
    const scaleY = bounds.height / rect.height;
    dragRef.current = {
      nodeId: node.id,
      offsetX: (event.clientX - rect.left) * scaleX - node.x,
      offsetY: (event.clientY - rect.top) * scaleY - node.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    onChange({ ...state, selectedNodeId: node.id });
  };

  const dragNode = (event: React.PointerEvent<SVGSVGElement>) => {
    const dragState = dragRef.current;
    if (!dragState) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = bounds.width / rect.width;
    const scaleY = bounds.height / rect.height;
    const x = Math.max(24, (event.clientX - rect.left) * scaleX - dragState.offsetX);
    const y = Math.max(24, (event.clientY - rect.top) * scaleY - dragState.offsetY);
    updateData((data) => ({
      ...data,
      nodes: data.nodes.map((node) => node.id === dragState.nodeId ? { ...node, x, y } : node)
    }));
  };

  const stopDragNode = () => {
    dragRef.current = null;
  };

  return (
    <div className="flowchart-modal-backdrop" role="presentation">
      <section className="flowchart-modal" role="dialog" aria-modal="true" aria-label="flowchart editor">
        <header className="flowchart-modal-header">
          <input
            aria-label="流程图标题"
            value={state.data.title}
            onChange={(event) => updateData((data) => ({ ...data, title: event.target.value }))}
          />
          <div>
            <button type="button" className="secondary-button" onClick={onCancel}>取消</button>
            <button type="button" className="primary-button" onClick={() => onSave(state)}>保存</button>
          </div>
        </header>

        <div className="flowchart-editor-grid">
          <div className="flowchart-canvas-panel">
            <svg
              viewBox={`0 0 ${bounds.width} ${bounds.height}`}
              onPointerMove={dragNode}
              onPointerUp={stopDragNode}
              onPointerCancel={stopDragNode}
            >
              <defs>
                <marker id="flowchart-editor-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,6 L8,3 z" />
                </marker>
              </defs>
              {state.data.edges.map((edge) => {
                const from = nodeMap.get(edge.from);
                const to = nodeMap.get(edge.to);
                if (!from || !to) return null;
                const start = getFlowchartNodeCenter(from);
                const end = getFlowchartNodeCenter(to);
                return (
                  <g key={edge.id}>
                    <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="flowchart-edge-line" markerEnd="url(#flowchart-editor-arrow)" />
                    {edge.label && (
                      <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 8} textAnchor="middle" className="flowchart-edge-label">
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}
              {state.data.nodes.map((node) => (
                <g
                  className={node.id === state.selectedNodeId ? "flowchart-editor-node selected" : "flowchart-editor-node"}
                  key={node.id}
                  onPointerDown={(event) => startDragNode(event, node)}
                >
                  {node.kind === "decision" ? (
                    <polygon points={`${node.x + 64},${node.y} ${node.x + 128},${node.y + 28} ${node.x + 64},${node.y + 56} ${node.x},${node.y + 28}`} className="flowchart-node-shape decision" />
                  ) : (
                    <rect x={node.x} y={node.y} width={128} height={56} rx={node.kind === "process" ? 8 : 28} className={`flowchart-node-shape ${node.kind}`} />
                  )}
                  <text x={node.x + 64} y={node.y + 32} textAnchor="middle">{node.label}</text>
                </g>
              ))}
            </svg>
          </div>

          <aside className="flowchart-side-panel">
            <div className="flowchart-side-actions">
              <button type="button" onClick={addNode}><Plus size={15} />节点</button>
              <button type="button" onClick={deleteSelectedNode} disabled={!selectedNode || state.data.nodes.length <= 1}><Trash2 size={15} />节点</button>
              <button type="button" onClick={addEdge} disabled={state.data.nodes.length < 2}><GitBranchPlus size={15} />连线</button>
            </div>

            {selectedNode && (
              <div className="flowchart-fieldset">
                <strong>节点</strong>
                <label>
                  <span>文案</span>
                  <input value={selectedNode.label} onChange={(event) => updateSelectedNode({ label: event.target.value })} />
                </label>
                <label>
                  <span>形状</span>
                  <select value={selectedNode.kind} onChange={(event) => updateSelectedNode({ kind: event.target.value as FlowchartNodeKind })}>
                    <option value="start">开始/结束</option>
                    <option value="process">处理</option>
                    <option value="decision">判断</option>
                    <option value="end">结束</option>
                  </select>
                </label>
              </div>
            )}

            <div className="flowchart-fieldset">
              <strong>连线</strong>
              <div className="flowchart-edge-list">
                {state.data.edges.length === 0 ? (
                  <span className="flowchart-empty">暂无连线</span>
                ) : state.data.edges.map((edge) => (
                  <div className="flowchart-edge-editor" key={edge.id}>
                    <select value={edge.from} onChange={(event) => updateEdge(edge.id, { from: event.target.value })}>
                      {state.data.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
                    </select>
                    <select value={edge.to} onChange={(event) => updateEdge(edge.id, { to: event.target.value })}>
                      {state.data.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
                    </select>
                    <input placeholder="标签" value={edge.label} onChange={(event) => updateEdge(edge.id, { label: event.target.value })} />
                    <button type="button" title="删除连线" onClick={() => deleteEdge(edge.id)}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
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
