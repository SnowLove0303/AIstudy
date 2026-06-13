import { app, BrowserWindow, Menu, ipcMain, shell } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import iconv from "iconv-lite";
import net from "node:net";
import path from "node:path";
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const courseDatabaseFile = "courses.json";
const developerDocumentDatabaseFile = "developer-documents.json";
const mysqlConfigFile = "mysql.json";
const mimoConfigFile = "mimo.json";
const knowledgeFormatDebugLogFile = "knowledge-format-debug.log";
const claudeBridgeBaseUrl = "http://127.0.0.1:18765";
const claudeAgentExePath = "F:\\AIAPP\\Xiangmu\\The Muti Agent\\exe\\The Muti Agent.exe";
const claudeSessionBindingsFile = "claude-course-sessions.json";
const chatgptWebLoginPort = Number(
  process.env.AISTUDY_CHATGPT_WEB_LOGIN_PORT
    || process.env.AISTUDY_CHATGPT_LOGIN_PORT
    || 9230
);
const chatgptWebLoginCdpUrl = getManagedPortCdpUrl(chatgptWebLoginPort);

type ManagedPortPlatformId = "bilibili" | "zhihu" | "doubao" | "chatgpt";
type ManagedPortKind = "cdp";

type ManagedPortPlatform = {
  id: ManagedPortPlatformId;
  label: string;
  port: number;
  loginUrl: string;
  hostKeyword: string;
  source: string;
  kind?: ManagedPortKind;
  endpointLabel?: string;
  loginActionLabel?: string;
  startActionLabel?: string;
  canStartService?: boolean;
};

type ManagedPortStatus = ManagedPortPlatform & {
  kind: ManagedPortKind;
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

type AiDailyRunRequest = {
  source?: "bilibili" | "zhihu";
  bvid?: string;
  zhihuUrl?: string;
  query?: string;
  engine?: "auto" | "whisper" | "funasr";
  forceTranscribe?: boolean;
  skipDownloadTranscribe?: boolean;
};

type AiDailyManifest = {
  source?: "bilibili" | "zhihu";
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
  sections?: Array<{
    index?: number;
    title?: string;
    text?: string;
  }>;
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

type SanitizedAiDailyRunRequest = Required<Omit<AiDailyRunRequest, "source" | "zhihuUrl">> & {
  source: "bilibili" | "zhihu";
  zhihuUrl: string;
};

type MysqlConfig = {
  host: string;
  port?: number;
  user: string;
  password?: string;
  database: string;
  connectionLimit?: number;
  autoStartServer?: boolean;
  serverRoot?: string;
};

type CourseRecord = {
  id: string;
  title?: string;
  category?: string;
  description?: string;
  progress?: number;
  createdAt?: string;
};

type AiCourseRecord = CourseRecord & {
  knowledgePoints?: Record<string, string>;
};

type AiChatProvider = "claude" | "mimo" | "doubao" | "chatgpt";

type ClaudeSessionBindings = Record<string, string>;

type AiChatRequest = {
  courseId?: string;
  courseTitle?: string;
  nodeId?: string;
  nodeTitle?: string;
  message?: string;
  knowledgeHtml?: string;
  outline?: unknown;
  provider?: AiChatProvider;
};

type ClaudeTaskResponse = {
  ok?: boolean;
  channel?: string;
  taskId?: string;
  mode?: string;
  message?: string;
  source?: string;
  status?: string;
  accepted?: boolean;
  started?: boolean;
  streamContentSeen?: boolean;
  streamStartedAt?: string;
  completed?: boolean;
  failed?: boolean;
  sessionId?: string;
  requestedSessionId?: string;
  cwd?: string;
  createdAt?: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  lastActivityAt?: string;
  exitCode?: number | null;
  sessionEnded?: boolean;
  terminalReason?: string;
  stopReason?: string;
  resultText?: string;
  finalSummary?: string;
  stdoutLog?: string;
  stderrLog?: string;
  eventLog?: string;
  resultLog?: string;
  jsonlLog?: string;
  textLog?: string;
  standardName?: string;
  receipt?: unknown;
  events?: unknown[];
  error?: string;
};

type ClaudeKnowledgeReply = {
  reply?: string;
  action?: "none" | "replace_current_knowledge";
  knowledgeHtml?: string;
};

type ClaudeKnowledgeReplyAction = NonNullable<ClaudeKnowledgeReply["action"]>;

type MimoConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

type MimoChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
      reasoning_content?: string;
    };
  }>;
  error?: { message?: string };
};

type MimoRequestMode = "answer" | "edit";

type CdpTargetInfo = {
  id?: string;
  type?: string;
  title?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
};

type CdpRuntimeEvaluation = {
  result?: {
    value?: unknown;
  };
  exceptionDetails?: {
    text?: string;
    exception?: {
      description?: string;
      value?: unknown;
    };
  };
};

type SystemContextInfo = {
  app: {
    name: string;
    version: string;
    isPackaged: boolean;
    electron: string;
    chrome: string;
    node: string;
  };
  paths: {
    repository: string;
    appPath: string;
    executable: string;
    userData: string;
    dataDirectory: string;
    courseDatabase: string;
    developerDocumentDatabase: string;
    mysqlConfig: string;
    mimoConfig: string;
    claudeSessionBindings: string;
    claudeCourseSessionsDirectory: string;
    packageOutput: string;
    mcpGuide: string;
    mcpContract: string;
    notionCache: string;
  };
  storage: {
    jsonDatabaseReady: boolean;
    developerDocumentDatabaseReady: boolean;
    mysqlConfigured: boolean;
    mysqlConnected: boolean;
    mysqlConfigPath: string;
    mysqlHost?: string;
    mysqlPort?: number;
    mysqlDatabase?: string;
    mysqlUser?: string;
    mysqlAutoStartServer?: boolean;
    mysqlServerRoot?: string;
    latestNotionImportBackup: string | null;
  };
  ai: {
    claudeBridgeBaseUrl: string;
    claudeAgentExePath: string;
    claudeSessionMode: string;
    mimoConfigPath: string;
    mimoDefaultModel: string;
  };
  docs: {
    readme: string;
    projectIndex: string;
    updateLog: string;
    readmeContent: string;
  };
};

type CourseRow = RowDataPacket & {
  payload_json: string;
};

type CourseDatabasePayload = {
  version: number;
  source?: string;
  savedAt?: string;
  loadedAt?: string;
  recoveredAt?: string;
  courses: unknown[];
};

type DeveloperDocumentDatabasePayload = Omit<CourseDatabasePayload, "courses"> & {
  documents: unknown[];
};
type CollectionDatabasePayload = Omit<CourseDatabasePayload, "courses"> & {
  courses?: unknown[];
  documents?: unknown[];
};
type DatabaseCollectionConfig = {
  payloadKey: "courses" | "documents";
  tableName: "courses" | "developer_documents";
  savedAtMetaKey: "courses_saved_at" | "developer_documents_saved_at";
  databasePath: () => string;
  recoverFromLocalStorage: boolean;
};

type MysqlMetaRow = RowDataPacket & {
  meta_value: string | null;
};

let mysqlPool: Pool | null = null;
let mysqlUnavailableLogged = false;
let mysqlStartAttempted = false;

const managedPortPlatforms: ManagedPortPlatform[] = [
  {
    id: "bilibili",
    label: "Bilibili",
    port: 9222,
    loginUrl: "https://passport.bilibili.com/login",
    hostKeyword: "bilibili.com",
    source: "All-Channal-Research"
  },
  {
    id: "zhihu",
    label: "知乎",
    port: 9223,
    loginUrl: "https://www.zhihu.com/signin?next=%2F",
    hostKeyword: "zhihu.com",
    source: "ChromeDidy"
  },
  {
    id: "doubao",
    label: "Doubao",
    port: 9224,
    loginUrl: "https://www.doubao.com/chat/",
    hostKeyword: "doubao.com/chat",
    source: "AI Chat"
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    port: chatgptWebLoginPort,
    loginUrl: "https://chatgpt.com/",
    hostKeyword: "chatgpt.com",
    source: "AI Chat",
    endpointLabel: "CDP",
    loginActionLabel: "打开登录窗口"
  }
];

function getDataDirectory() {
  return path.join(app.getPath("userData"), "data");
}

function getCourseDatabasePath() {
  return path.join(getDataDirectory(), courseDatabaseFile);
}

function getDeveloperDocumentDatabasePath() {
  return path.join(getDataDirectory(), developerDocumentDatabaseFile);
}

const databaseCollectionIndex = {
  courses: {
    payloadKey: "courses",
    tableName: "courses",
    savedAtMetaKey: "courses_saved_at",
    databasePath: getCourseDatabasePath,
    recoverFromLocalStorage: true
  },
  developerDocuments: {
    payloadKey: "documents",
    tableName: "developer_documents",
    savedAtMetaKey: "developer_documents_saved_at",
    databasePath: getDeveloperDocumentDatabasePath,
    recoverFromLocalStorage: false
  }
} satisfies Record<string, DatabaseCollectionConfig>;

function getMysqlConfigPath() {
  return path.join(getDataDirectory(), mysqlConfigFile);
}

function getMimoConfigPath() {
  return path.join(getDataDirectory(), mimoConfigFile);
}

function getKnowledgeFormatDebugLogPath() {
  return path.join(getDataDirectory(), knowledgeFormatDebugLogFile);
}

function getPackagedResourcePath(...segments: string[]) {
  return path.join(__dirname, "..", ...segments);
}

async function fileExists(filePath: string) {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getLatestNotionImportBackup() {
  try {
    const entries = await fs.readdir(getDataDirectory(), { withFileTypes: true });
    const backups = entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(`${courseDatabaseFile}.before-notion-import-`))
      .map((entry) => entry.name)
      .sort()
      .reverse();

    return backups[0] ? path.join(getDataDirectory(), backups[0]) : null;
  } catch {
    return null;
  }
}

async function appendMysqlAutoStartLog(message: string) {
  try {
    await fs.mkdir(getDataDirectory(), { recursive: true });
    await fs.appendFile(
      path.join(getDataDirectory(), "mysql-autostart.log"),
      `[${new Date().toISOString()}] ${message}\n`,
      "utf8"
    );
  } catch {
    // Logging must never block application startup.
  }
}

async function appendKnowledgeFormatDebugLog(entry: unknown) {
  try {
    await fs.mkdir(getDataDirectory(), { recursive: true });
    const payload = {
      loggedAt: new Date().toISOString(),
      entry
    };
    await fs.appendFile(getKnowledgeFormatDebugLogPath(), `${JSON.stringify(payload)}\n`, "utf8");
  } catch {
    // Debug logging must never block knowledge editing.
  }
}

async function readJsonFile(filePath: string) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content.replace(/^\uFEFF/, "")) as unknown;
}

async function ensureMysqlConfigTemplate() {
  const configPath = getMysqlConfigPath();
  try {
    await fs.access(configPath);
  } catch {
    await fs.mkdir(getDataDirectory(), { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify(
        {
          host: "127.0.0.1",
          port: 3306,
          user: "aistudy",
          password: "",
          database: "aistudy",
          connectionLimit: 5,
          autoStartServer: true,
          serverRoot: "F:/AIAPP/MySQL"
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

async function loadMysqlConfig(): Promise<MysqlConfig | null> {
  const envConfig = {
    host: process.env.AISTUDY_MYSQL_HOST,
    port: process.env.AISTUDY_MYSQL_PORT ? Number(process.env.AISTUDY_MYSQL_PORT) : undefined,
    user: process.env.AISTUDY_MYSQL_USER,
    password: process.env.AISTUDY_MYSQL_PASSWORD,
    database: process.env.AISTUDY_MYSQL_DATABASE
  };

  if (envConfig.host && envConfig.user && envConfig.database) {
    return envConfig as MysqlConfig;
  }

  await ensureMysqlConfigTemplate();

  try {
    const config = (await readJsonFile(getMysqlConfigPath())) as Partial<MysqlConfig>;
    if (!config.host || !config.user || !config.database) return null;
    return {
      host: config.host,
      port: config.port ?? 3306,
      user: config.user,
      password: config.password ?? "",
      database: config.database,
      connectionLimit: config.connectionLimit ?? 5,
      autoStartServer: config.autoStartServer ?? true,
      serverRoot: config.serverRoot ?? "F:/AIAPP/MySQL"
    };
  } catch {
    return null;
  }
}

function isLocalMysqlHost(host: string) {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function canConnectToPort(host: string, port: number, timeout = 900) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (connected: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(connected);
    };

    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function getManagedPortRuntimeRoot() {
  const configured = process.env.AISTUDY_PORT_RUNTIME_ROOT || process.env.CHROME_DIDY_RUNTIME_ROOT;
  if (configured) return configured;
  if (process.platform === "win32") {
    return "E:\\MorenAnzhuangLujing\\Huangjingdajian\\ChromeDidy";
  }
  return path.join(app.getPath("userData"), "ChromeDidy");
}

function getRepositoryRootCandidates() {
  const exeDir = path.dirname(app.getPath("exe"));
  return [
    process.env.AISTUDY_PROJECT_ROOT,
    process.cwd(),
    path.resolve(exeDir, "..", ".."),
    path.resolve(process.resourcesPath, "..", "..", ".."),
    path.resolve(__dirname, "..")
  ].filter((candidate): candidate is string => Boolean(candidate));
}

async function findFirstExistingPath(candidates: string[]) {
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  return candidates.find(Boolean) ?? "";
}

function getManagedPortProfileDir(platform: ManagedPortPlatform) {
  if (platform.id === "chatgpt") {
    return getChatGptLoggedChromeProfileDir();
  }
  return path.join(getManagedPortRuntimeRoot(), "chrome-profiles", `aistudy-${platform.id}-${platform.port}`);
}

function getChatGptLoggedChromeProfileDir() {
  const localAppData = process.env.AISTUDY_CHATGPT_CHROME_USER_DATA_DIR
    || process.env.LOCALAPPDATA
    || process.env.LocalAppData
    || "";
  if (!localAppData) return "";
  return process.env.AISTUDY_CHATGPT_CHROME_USER_DATA_DIR
    ? localAppData
    : path.join(localAppData, "Google", "Chrome", "User Data");
}

function getChatGptLoggedChromeProfileName() {
  return process.env.AISTUDY_CHATGPT_CHROME_PROFILE || "Default";
}

function getManagedPortDefinition(platformId: unknown) {
  return managedPortPlatforms.find((platform) => platform.id === platformId);
}

function getManagedPortCdpUrl(port: number) {
  return `http://127.0.0.1:${port}`;
}

function getManagedPortKind(platform: ManagedPortPlatform): ManagedPortKind {
  return platform.kind ?? "cdp";
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 1200, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getChromeExecutablePath() {
  const candidates = [
    process.env.AISTUDY_CHROME_EXE,
    process.env.CHROME_DIDY_CHROME_EXE,
    process.env.CHROME_EXECUTABLE,
    "E:\\MorenAnzhuangLujing\\Chrome\\Chrome\\Application\\chrome.exe",
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe") : "",
    process.env["ProgramFiles(x86)"] ? path.join(process.env["ProgramFiles(x86)"]!, "Google", "Chrome", "Application", "chrome.exe") : "",
    process.env.LocalAppData ? path.join(process.env.LocalAppData, "Google", "Chrome", "Application", "chrome.exe") : ""
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && await fileExists(candidate)) return candidate;
  }

  return null;
}

function pickPlatformTab(tabs: Array<{ title?: string; url?: string }>, platform: ManagedPortPlatform) {
  return tabs.find((tab) => tab.url?.includes(platform.hostKeyword))
    ?? tabs.find((tab) => tab.url && !tab.url.startsWith("devtools://"))
    ?? null;
}

async function getManagedPortStatus(platform: ManagedPortPlatform): Promise<ManagedPortStatus> {
  const cdpUrl = getManagedPortCdpUrl(platform.port);
  const profileDir = getManagedPortProfileDir(platform);
  const baseStatus = {
    ...platform,
    kind: getManagedPortKind(platform),
    cdpUrl,
    profileDir,
    profileReady: await fileExists(profileDir),
    lastCheckedAt: new Date().toISOString()
  };

  try {
    const version = await fetchJsonWithTimeout<{ Browser?: string }>(`${cdpUrl}/json/version`);
    const tabs = await fetchJsonWithTimeout<Array<{ title?: string; url?: string }>>(`${cdpUrl}/json`, 1200, {});
    const activeTab = pickPlatformTab(Array.isArray(tabs) ? tabs : [], platform);

    return {
      ...baseStatus,
      ready: true,
      activeTitle: activeTab?.title ?? "",
      activeUrl: activeTab?.url ?? "",
      browser: version.Browser ?? "Chrome"
    };
  } catch (error) {
    return {
      ...baseStatus,
      ready: false,
      activeTitle: "",
      activeUrl: "",
      browser: "",
      error: error instanceof Error ? error.message : "CDP port unavailable"
    };
  }
}

async function getManagedPortStatuses() {
  return Promise.all(managedPortPlatforms.map((platform) => getManagedPortStatus(platform)));
}

async function openManagedPortTab(platform: ManagedPortPlatform) {
  const cdpUrl = getManagedPortCdpUrl(platform.port);
  try {
    await fetchJsonWithTimeout(`${cdpUrl}/json/new?${encodeURIComponent(platform.loginUrl)}`, 1800, { method: "PUT" });
    return true;
  } catch {
    return false;
  }
}

async function openUrlInCdpPort(port: number, url: string, hostKeyword: string) {
  const cdpUrl = getManagedPortCdpUrl(port);
  try {
    const tabs = await fetchJsonWithTimeout<Array<{ id?: string; title?: string; url?: string }>>(`${cdpUrl}/json`, 1800, {});
    const existingTab = Array.isArray(tabs)
      ? tabs.find((tab) => tab.url?.includes(hostKeyword))
      : null;
    if (existingTab?.id) {
      try {
        await fetchJsonWithTimeout(`${cdpUrl}/json/activate/${existingTab.id}`, 1200);
      } catch {
        // Chrome may return a non-JSON response for activation; the tab is still reusable.
      }
      return { opened: true, reused: true };
    }
  } catch {
    // If tab listing fails, fall through and try opening a fresh target.
  }

  try {
    await fetchJsonWithTimeout(`${cdpUrl}/json/new?${encodeURIComponent(url)}`, 1800, { method: "PUT" });
    return { opened: true, reused: false };
  } catch {
    return { opened: false, reused: false };
  }
}

async function waitForManagedCdpPort(port: number, waitMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < waitMs) {
    if (await canConnectToPort("127.0.0.1", port, 700)) return true;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return false;
}

async function openChatGptInLoggedChromePort(loginUrl: string) {
  const chromeExe = await getChromeExecutablePath();
  if (!chromeExe) return null;

  const profileDir = getChatGptLoggedChromeProfileDir();
  const profileName = getChatGptLoggedChromeProfileName();
  const args = [
    `--remote-debugging-port=${chatgptWebLoginPort}`,
    "--no-first-run",
    "--no-default-browser-check",
    ...(profileDir ? [`--user-data-dir=${profileDir}`] : []),
    ...(profileName ? [`--profile-directory=${profileName}`] : []),
    "--new-window",
    loginUrl
  ];

  const child = spawn(chromeExe, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => resolve(), 1000);
    child.once("spawn", () => {
      clearTimeout(timer);
      resolve();
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  child.unref();
  const ready = await waitForManagedCdpPort(chatgptWebLoginPort, 3500);
  return { pid: child.pid, chromeExe, profileDir, ready };
}

async function openChatGptLoginWindow(platform: ManagedPortPlatform): Promise<OpenManagedLoginWindowResult> {
  if (chatgptWebLoginPort > 0 && Number.isFinite(chatgptWebLoginPort) && await canConnectToPort("127.0.0.1", chatgptWebLoginPort, 700)) {
    const result = await openUrlInCdpPort(chatgptWebLoginPort, platform.loginUrl, platform.hostKeyword);
    return {
      opened: result.opened,
      message: result.opened
        ? `已通过本机 Chrome 端口 ${chatgptWebLoginPort} ${result.reused ? "切到" : "打开"} ChatGPT 登录页`
        : `本机 Chrome 端口 ${chatgptWebLoginPort} 已连接，但未能打开 ChatGPT 登录页`,
      status: await getManagedPortStatus(platform)
    };
  }

  const portChrome = await openChatGptInLoggedChromePort(platform.loginUrl);
  if (portChrome?.ready) {
    const result = await openUrlInCdpPort(chatgptWebLoginPort, platform.loginUrl, platform.hostKeyword);
    return {
      opened: result.opened,
      message: `已通过默认 Chrome 登录目录启动端口 ${chatgptWebLoginPort}${portChrome.pid ? `，PID ${portChrome.pid}` : ""}`,
      status: await getManagedPortStatus(platform)
    };
  }

  return {
    opened: Boolean(portChrome),
    message: portChrome
      ? `已尝试用默认 Chrome 登录目录启动端口 ${chatgptWebLoginPort}，但端口未就绪。请先关闭未带端口的默认 Chrome，再点“打开登录窗口”。`
      : "未找到默认 Chrome，无法启动 ChatGPT 登录端口",
    status: await getManagedPortStatus(platform)
  };
}

async function startManagedPortService(platformId: unknown): Promise<StartManagedPortServiceResult> {
  const platform = getManagedPortDefinition(platformId);
  if (!platform) {
    throw new Error("未知端口平台");
  }

  return {
    started: false,
    message: "该平台通过登录窗口启动端口",
    status: await getManagedPortStatus(platform)
  };
}

async function openManagedLoginWindow(platformId: unknown): Promise<OpenManagedLoginWindowResult> {
  const platform = getManagedPortDefinition(platformId);
  if (!platform) {
    throw new Error("未知端口平台");
  }

  if (platform.id === "chatgpt") {
    return openChatGptLoginWindow(platform);
  }

  if (await canConnectToPort("127.0.0.1", platform.port)) {
    const opened = await openManagedPortTab(platform);
    return {
      opened,
      message: opened ? "已在现有端口打开登录页" : "端口已运行，请在对应 Chrome 窗口查看",
      status: await getManagedPortStatus(platform)
    };
  }

  const chromePath = await getChromeExecutablePath();
  if (!chromePath) {
    throw new Error("未找到 Chrome，请安装 Chrome 或设置 AISTUDY_CHROME_EXE");
  }

  const profileDir = getManagedPortProfileDir(platform);
  await fs.mkdir(profileDir, { recursive: true });
  await fs.writeFile(
    path.join(profileDir, "aistudy-port-profile.json"),
    JSON.stringify({
      platform: platform.id,
      label: platform.label,
      port: platform.port,
      cdpUrl: getManagedPortCdpUrl(platform.port),
      loginUrl: platform.loginUrl,
      source: platform.source,
      updatedAt: new Date().toISOString()
    }, null, 2),
    "utf8"
  );

  const child = spawn(chromePath, [
    `--remote-debugging-port=${platform.port}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
    platform.loginUrl
  ], {
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });
  child.unref();

  const ready = await waitForManagedCdpPort(platform.port);
  return {
    opened: true,
    message: ready ? "登录窗口已打开，端口已就绪" : "登录窗口已打开，端口仍在启动中",
    status: await getManagedPortStatus(platform)
  };
}

function getAiDailyOutputRoot() {
  return process.env.AISTUDY_AI_DAILY_OUTPUT_ROOT || "E:\\MorenAnzhuangLujing\\Huangjingdajian\\aistudy-ai-daily";
}

async function getAiDailyWorkflowScriptPath() {
  const candidates = [
    process.env.AISTUDY_AI_DAILY_WORKFLOW,
    app.isPackaged ? path.join(process.resourcesPath, "scripts", "ai-daily-workflow.ps1") : "",
    path.join(__dirname, "..", "scripts", "ai-daily-workflow.ps1"),
    path.join(app.getAppPath(), "scripts", "ai-daily-workflow.ps1")
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && await fileExists(candidate)) return candidate;
  }

  throw new Error("未找到 AI日报工作流脚本");
}

function sanitizeAiDailyRunRequest(request: AiDailyRunRequest): SanitizedAiDailyRunRequest {
  const source = request.source === "zhihu" ? "zhihu" : "bilibili";
  const bvid = String(request.bvid || "BV1fPJ76wEYA").trim();
  if (source === "bilibili" && !/^BV[a-zA-Z0-9]+$/.test(bvid)) {
    throw new Error("BV 号格式不正确");
  }
  const zhihuUrl = String(request.zhihuUrl || "").trim();
  if (source === "zhihu") {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(zhihuUrl);
    } catch {
      throw new Error("知乎链接格式不正确");
    }
    if (!/(^|\.)zhihu\.com$/i.test(parsedUrl.hostname)) {
      throw new Error("仅支持 zhihu.com 链接");
    }
  }

  const query = String(request.query || "").trim().slice(0, 160);
  const engine = request.engine === "whisper" || request.engine === "funasr" ? request.engine : "auto";

  return {
    source,
    bvid,
    zhihuUrl,
    query,
    engine,
    forceTranscribe: Boolean(request.forceTranscribe),
    skipDownloadTranscribe: Boolean(request.skipDownloadTranscribe)
  };
}

function appendLimitedOutput(current: string, chunk: Buffer) {
  const next = current + chunk.toString("utf8");
  return next.length > 120000 ? next.slice(-120000) : next;
}

async function readAiDailyManifest(manifestPath: string): Promise<AiDailyManifest | null> {
  try {
    const payload = await readJsonFile(manifestPath);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    return payload as AiDailyManifest;
  } catch {
    return null;
  }
}

async function getLatestAiDailyManifest(): Promise<AiDailyManifest | null> {
  const outputRoot = getAiDailyOutputRoot();
  try {
    const entries = await fs.readdir(outputRoot, { withFileTypes: true });
    const manifests: Array<{ path: string; mtimeMs: number }> = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(outputRoot, entry.name, "report", "manifest.json");
      try {
        const stat = await fs.stat(manifestPath);
        manifests.push({ path: manifestPath, mtimeMs: stat.mtimeMs });
      } catch {
        continue;
      }
    }
    manifests.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return manifests[0] ? readAiDailyManifest(manifests[0].path) : null;
  } catch {
    return null;
  }
}

async function runAiDailyWorkflow(rawRequest: unknown): Promise<AiDailyRunResult> {
  const request = sanitizeAiDailyRunRequest((rawRequest || {}) as AiDailyRunRequest);
  const scriptPath = await getAiDailyWorkflowScriptPath();
  const outputRoot = getAiDailyOutputRoot();
  await fs.mkdir(outputRoot, { recursive: true });

  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    "-Source",
    request.source,
    "-Bvid",
    request.bvid,
    "-Engine",
    request.engine,
    "-OutputRoot",
    outputRoot
  ];

  if (request.zhihuUrl) args.push("-ZhihuUrl", request.zhihuUrl);
  if (request.query) args.push("-Query", request.query);
  if (request.forceTranscribe) args.push("-ForceTranscribe");
  if (request.skipDownloadTranscribe) args.push("-SkipDownloadTranscribe");

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn("powershell.exe", args, {
      cwd: path.dirname(scriptPath),
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8"
      }
    });

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({
        ok: false,
        message: "AI日报生成超时",
        stdout,
        stderr,
        manifest: null
      });
    }, 900000);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = appendLimitedOutput(stdout, chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = appendLimitedOutput(stderr, chunk);
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", async (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const manifest = await getLatestAiDailyManifest();
      resolve({
        ok: code === 0,
        message: code === 0 ? "AI日报已生成" : "AI日报生成失败",
        stdout,
        stderr,
        manifest
      });
    });
  });
}

function isPathInsideDirectory(filePath: string, directory: string) {
  const resolvedFile = path.resolve(filePath).toLowerCase();
  const resolvedDirectory = path.resolve(directory).toLowerCase();
  return resolvedFile === resolvedDirectory || resolvedFile.startsWith(`${resolvedDirectory}${path.sep}`);
}

async function openAiDailyArtifact(rawPath: unknown) {
  const targetPath = String(rawPath || "");
  if (!targetPath || !isPathInsideDirectory(targetPath, getAiDailyOutputRoot())) {
    throw new Error("只能打开 AI日报输出目录内的文件");
  }
  if (!await fileExists(targetPath)) {
    throw new Error("文件不存在");
  }
  const error = await shell.openPath(targetPath);
  if (error) throw new Error(error);
  return { opened: true };
}

function escapePowerShellSingleQuotedString(value: string) {
  return value.replace(/'/g, "''");
}

function runHiddenPowerShell(command: string) {
  return new Promise<void>((resolve) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", command],
      {
        detached: false,
        stdio: "ignore",
        windowsHide: true
      }
    );

    child.once("error", () => resolve());
    child.once("exit", () => resolve());
  });
}

async function startMysqlServerHidden(mysqldPath: string, iniPath: string, serverRoot: string, pidPath: string) {
  const escapedMysqldPath = escapePowerShellSingleQuotedString(mysqldPath);
  const escapedIniPath = escapePowerShellSingleQuotedString(iniPath);
  const escapedServerRoot = escapePowerShellSingleQuotedString(serverRoot);
  const escapedPidPath = escapePowerShellSingleQuotedString(pidPath);
  const command = [
    `$mysqldPath = '${escapedMysqldPath}'`,
    `$iniPath = '${escapedIniPath}'`,
    `$serverRoot = '${escapedServerRoot}'`,
    `$pidPath = '${escapedPidPath}'`,
    "$args = @(\"--defaults-file=$iniPath\", \"--pid-file=$pidPath\")",
    "$process = Start-Process -FilePath $mysqldPath -ArgumentList $args -WorkingDirectory $serverRoot -WindowStyle Hidden -PassThru",
    "if ($process -and $process.Id) { Set-Content -LiteralPath $pidPath -Value ([string]$process.Id) -Encoding ASCII }"
  ].join("; ");

  await runHiddenPowerShell(command);
}

async function stopConsoleMysqlProcesses(serverRoot: string) {
  const normalizedRoot = escapePowerShellSingleQuotedString(path.normalize(serverRoot));
  const command = [
    `$serverRoot = '${normalizedRoot}'`,
    "$procs = Get-CimInstance Win32_Process | Where-Object {",
    "  $_.Name -eq 'mysqld.exe' -and",
    "  $_.CommandLine -like '*--console*' -and",
    "  $_.CommandLine -like ('*' + $serverRoot + '*')",
    "}",
    "foreach ($proc in $procs) { Stop-Process -Id $proc.ProcessId -Force }",
    "$windows = Get-Process | Where-Object {",
    "  ($_.ProcessName -in @('WindowsTerminal', 'OpenConsole')) -and",
    "  ($_.MainWindowTitle -like '*MySQL*' -or $_.MainWindowTitle -like '*mysqld*' -or $_.MainWindowTitle -like '*server\\bin*')",
    "}",
    "foreach ($window in $windows) { Stop-Process -Id $window.Id -Force }"
  ].join("; ");

  await runHiddenPowerShell(command);
}

async function fixWindowsShortcutIcons() {
  if (process.platform !== "win32" || isDev) return;

  const exePath = escapePowerShellSingleQuotedString(process.execPath);
  const exeDirectory = escapePowerShellSingleQuotedString(path.dirname(process.execPath));
  const command = [
    `$exePath = '${exePath}'`,
    `$exeDirectory = '${exeDirectory}'`,
    "$shell = New-Object -ComObject WScript.Shell",
    "$roots = @(",
    "  [Environment]::GetFolderPath('Desktop'),",
    "  [Environment]::GetFolderPath('CommonDesktopDirectory'),",
    "  [Environment]::GetFolderPath('StartMenu'),",
    "  [Environment]::GetFolderPath('CommonStartMenu')",
    ") | Where-Object { $_ -and (Test-Path $_) }",
    "foreach ($root in $roots) {",
    "  Get-ChildItem -Path $root -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue | ForEach-Object {",
    "    try {",
    "      $shortcut = $shell.CreateShortcut($_.FullName)",
    "      if ($_.BaseName -eq 'AIstudy' -or $shortcut.TargetPath -like '*AIstudy.exe') {",
    "        $shortcut.TargetPath = $exePath",
    "        $shortcut.WorkingDirectory = $exeDirectory",
    "        $shortcut.IconLocation = \"$exePath,0\"",
    "        $shortcut.Save()",
    "      }",
    "    } catch {}",
    "  }",
    "}"
  ].join("; ");

  await runHiddenPowerShell(command);
}

async function ensureMysqlServerStarted() {
  if (mysqlStartAttempted) return;
  mysqlStartAttempted = true;
  await appendMysqlAutoStartLog("auto-start check started");

  const config = await loadMysqlConfig();
  if (!config) {
    await appendMysqlAutoStartLog("skipped: mysql config is missing");
    return;
  }
  if (config.autoStartServer === false) {
    await appendMysqlAutoStartLog("skipped: autoStartServer is disabled");
    return;
  }
  if (!isLocalMysqlHost(config.host)) {
    await appendMysqlAutoStartLog(`skipped: host is not local (${config.host})`);
    return;
  }

  const port = config.port ?? 3306;
  const serverRoot = config.serverRoot ?? "F:/AIAPP/MySQL";
  await stopConsoleMysqlProcesses(serverRoot);
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (await canConnectToPort(config.host, port)) {
    await appendMysqlAutoStartLog(`skipped: ${config.host}:${port} is already reachable`);
    return;
  }

  const mysqldPath = path.join(serverRoot, "server", "bin", "mysqld.exe");
  const iniPath = path.join(serverRoot, "my.ini");
  const pidPath = path.join(serverRoot, "mysql.pid");

  try {
    await fs.access(mysqldPath);
    await fs.access(iniPath);
  } catch {
    console.error("MySQL server files not found", mysqldPath, iniPath);
    await appendMysqlAutoStartLog(`failed: server files not found (${mysqldPath}, ${iniPath})`);
    return;
  }

  await startMysqlServerHidden(mysqldPath, iniPath, serverRoot, pidPath);
  await appendMysqlAutoStartLog(`spawned hidden via Start-Process: ${mysqldPath} --defaults-file=${iniPath}`);
}

async function getMysqlPool() {
  if (mysqlPool) return mysqlPool;

  const config = await loadMysqlConfig();
  if (!config) return null;

  mysqlPool = mysql.createPool({
    host: config.host,
    port: config.port ?? 3306,
    user: config.user,
    password: config.password ?? "",
    database: config.database,
    waitForConnections: true,
    connectionLimit: config.connectionLimit ?? 5,
    charset: "utf8mb4"
  });

  return mysqlPool;
}

async function withMysqlConnection<T>(task: (connection: PoolConnection) => Promise<T>) {
  const pool = await getMysqlPool();
  if (!pool) return null;

  let connection: PoolConnection | null = null;
  try {
    connection = await pool.getConnection();
    await initializeMysqlSchema(connection);
    mysqlUnavailableLogged = false;
    return await task(connection);
  } catch (error) {
    if (mysqlPool) {
      const stalePool = mysqlPool;
      mysqlPool = null;
      void stalePool.end().catch(() => undefined);
    }

    if (!mysqlUnavailableLogged) {
      console.error("MySQL course database unavailable, falling back to local JSON", error);
      mysqlUnavailableLogged = true;
    }
    return null;
  } finally {
    connection?.release();
  }
}

async function initializeMysqlSchema(connection: PoolConnection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS courses (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      position_index INT NOT NULL DEFAULT 0,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(255) NOT NULL DEFAULT '',
      description TEXT NULL,
      progress INT NOT NULL DEFAULT 0,
      created_at VARCHAR(64) NULL,
      payload_json LONGTEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS developer_documents (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      position_index INT NOT NULL DEFAULT 0,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(255) NOT NULL DEFAULT '',
      description TEXT NULL,
      progress INT NOT NULL DEFAULT 0,
      created_at VARCHAR(64) NULL,
      payload_json LONGTEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS app_meta (
      meta_key VARCHAR(64) NOT NULL PRIMARY KEY,
      meta_value TEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

function isCourseList(value: unknown): value is unknown[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        "id" in item &&
        "title" in item &&
        "mindMap" in item
    )
  );
}

function extractUtf16JsonArrays(buffer: Buffer) {
  const arrays: unknown[][] = [];

  for (let start = 0; start < buffer.length - 3; start += 1) {
    if (
      buffer[start] !== 0x5b ||
      buffer[start + 1] !== 0 ||
      buffer[start + 2] !== 0x7b ||
      buffer[start + 3] !== 0
    ) {
      continue;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let offset = start; offset < buffer.length - 1; offset += 2) {
      const character = String.fromCharCode(buffer[offset] | (buffer[offset + 1] << 8));

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === "\"") {
          inString = false;
        }
        continue;
      }

      if (character === "\"") {
        inString = true;
      } else if (character === "[" || character === "{") {
        depth += 1;
      } else if (character === "]" || character === "}") {
        depth -= 1;
        if (depth === 0 && character === "]") {
          const rawJson = buffer.subarray(start, offset + 2).toString("utf16le");
          try {
            const parsed = JSON.parse(rawJson) as unknown;
            if (Array.isArray(parsed)) arrays.push(parsed);
          } catch {
            // Ignore unrelated binary fragments that only look like JSON.
          }
          break;
        }
      }
    }
  }

  return arrays;
}

async function recoverCoursesFromLocalStorage() {
  const levelDbDirectory = path.join(app.getPath("userData"), "Local Storage", "leveldb");
  let bestMatch: unknown[] = [];
  let bestSize = 0;

  try {
    const entries = await fs.readdir(levelDbDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;

      try {
        const buffer = await fs.readFile(path.join(levelDbDirectory, entry.name));
        for (const candidate of extractUtf16JsonArrays(buffer)) {
          if (!isCourseList(candidate)) continue;
          const size = JSON.stringify(candidate).length;
          if (size > bestSize) {
            bestMatch = candidate;
            bestSize = size;
          }
        }
      } catch {
        // Local Storage files can be locked while Chromium is running.
      }
    }
  } catch {
    return null;
  }

  return bestMatch.length > 0
    ? {
        version: 1,
        recoveredAt: new Date().toISOString(),
        courses: bestMatch
      }
    : null;
}

function normalizeCollectionPayload(
  collection: DatabaseCollectionConfig,
  payload: unknown,
  source: string
): CollectionDatabasePayload | null {
  if (payload && typeof payload === "object" && collection.payloadKey in payload) {
    return { ...(payload as CollectionDatabasePayload), source };
  }
  if (Array.isArray(payload)) {
    return { version: 1, source, [collection.payloadKey]: payload };
  }
  return null;
}

function getCollectionItems(payload: CollectionDatabasePayload | null, collection: DatabaseCollectionConfig) {
  return payload?.[collection.payloadKey] ?? [];
}

async function loadLocalCollectionDatabase(collection: DatabaseCollectionConfig): Promise<CollectionDatabasePayload | null> {
  const databasePath = collection.databasePath();
  const backupPath = `${databasePath}.bak`;

  try {
    return normalizeCollectionPayload(collection, await readJsonFile(databasePath), "json");
  } catch (error) {
    try {
      return normalizeCollectionPayload(collection, await readJsonFile(backupPath), "json-backup");
    } catch {
      if (collection.recoverFromLocalStorage) {
        const recoveredCourses = await recoverCoursesFromLocalStorage();
        if (recoveredCourses) return recoveredCourses;
      }
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
}

function payloadTime(payload: CollectionDatabasePayload | null) {
  if (!payload) return 0;
  const rawTime = payload.savedAt ?? payload.loadedAt ?? payload.recoveredAt;
  return rawTime ? Date.parse(rawTime) || 0 : 0;
}

async function loadCollectionDatabase(collection: DatabaseCollectionConfig) {
  const [mysqlPayload, localPayload] = await Promise.all([
    loadCollectionDatabaseFromMysql(collection),
    loadLocalCollectionDatabase(collection)
  ]);

  if (mysqlPayload && localPayload) {
    const mysqlTime = payloadTime(mysqlPayload);
    const localTime = payloadTime(localPayload);
    const chosen = localTime >= mysqlTime ? localPayload : mysqlPayload;
    const source = chosen === localPayload ? "json" : "mysql";

    if (source === "json") {
      void saveCollectionItemsToMysql(collection, getCollectionItems(localPayload, collection)).catch((error) => {
        console.error(`Failed to sync local JSON ${collection.tableName} to MySQL`, error);
      });
    } else {
      void saveCollectionDatabase(collection, getCollectionItems(mysqlPayload, collection)).catch((error) => {
        console.error(`Failed to sync MySQL ${collection.tableName} to local JSON`, error);
      });
    }

    return {
      ...chosen,
      version: 1,
      source,
      loadedAt: new Date().toISOString()
    };
  }

  if (mysqlPayload) {
    void saveCollectionDatabase(collection, getCollectionItems(mysqlPayload, collection)).catch((error) => {
      console.error(`Failed to sync MySQL ${collection.tableName} to local JSON`, error);
    });
    return { ...mysqlPayload, source: "mysql", loadedAt: new Date().toISOString() };
  }

  if (localPayload) {
    void saveCollectionItemsToMysql(collection, getCollectionItems(localPayload, collection)).catch((error) => {
      console.error(`Failed to sync local JSON ${collection.tableName} to MySQL`, error);
    });
    return { ...localPayload, source: localPayload.source ?? "json", loadedAt: new Date().toISOString() };
  }

  return null;
}

async function loadCollectionDatabaseFromMysql(collection: DatabaseCollectionConfig): Promise<CollectionDatabasePayload | null> {
  return withMysqlConnection(async (connection) => {
    const [rows] = await connection.query<CourseRow[]>(
      `SELECT payload_json FROM ${collection.tableName} ORDER BY position_index ASC, updated_at DESC`
    );

    const items = rows
      .map((row) => {
        try {
          return JSON.parse(row.payload_json) as unknown;
        } catch {
          return null;
        }
      })
      .filter((course): course is unknown => Boolean(course));

    if (items.length === 0) return null;

    const [metaRows] = await connection.query<MysqlMetaRow[]>(
      "SELECT meta_value FROM app_meta WHERE meta_key = ? LIMIT 1",
      [collection.savedAtMetaKey]
    );

    return {
      version: 1,
      source: "mysql",
      savedAt: metaRows[0]?.meta_value ?? undefined,
      [collection.payloadKey]: items
    };
  });
}

async function loadCourseDatabase(): Promise<CourseDatabasePayload | null> {
  return loadCollectionDatabase(databaseCollectionIndex.courses) as Promise<CourseDatabasePayload | null>;
}

async function loadDeveloperDocumentDatabase(): Promise<DeveloperDocumentDatabasePayload | null> {
  return loadCollectionDatabase(databaseCollectionIndex.developerDocuments) as Promise<DeveloperDocumentDatabasePayload | null>;
}

async function saveCollectionItemsToMysql(collection: DatabaseCollectionConfig, items: unknown) {
  if (!isCourseList(items)) return;

  await withMysqlConnection(async (connection) => {
    await connection.beginTransaction();
    try {
      const ids = new Set<string>();

      for (const [index, item] of items.entries()) {
        const record = item as CourseRecord;
        ids.add(record.id);
        await connection.execute(
          `
            INSERT INTO ${collection.tableName} (
              id,
              position_index,
              title,
              category,
              description,
              progress,
              created_at,
              payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              position_index = VALUES(position_index),
              title = VALUES(title),
              category = VALUES(category),
              description = VALUES(description),
              progress = VALUES(progress),
              created_at = VALUES(created_at),
              payload_json = VALUES(payload_json)
          `,
          [
            record.id,
            index,
            record.title ?? "",
            record.category ?? "",
            record.description ?? "",
            record.progress ?? 0,
            record.createdAt ?? null,
            JSON.stringify(item)
          ]
        );
      }

      if (ids.size > 0) {
        await connection.query(`DELETE FROM ${collection.tableName} WHERE id NOT IN (?)`, [[...ids]]);
      } else {
        await connection.query(`DELETE FROM ${collection.tableName}`);
      }

      await connection.execute(
        `
          INSERT INTO app_meta (meta_key, meta_value)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)
        `,
        [collection.savedAtMetaKey, new Date().toISOString()]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}

async function saveCollectionDatabase(collection: DatabaseCollectionConfig, items: unknown) {
  const databasePath = collection.databasePath();
  const backupPath = `${databasePath}.bak`;
  const tempPath = `${databasePath}.tmp`;
  const payload = JSON.stringify(
    {
      version: 1,
      savedAt: new Date().toISOString(),
      [collection.payloadKey]: items
    },
    null,
    2
  );

  await fs.mkdir(getDataDirectory(), { recursive: true });

  try {
    await fs.copyFile(databasePath, backupPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await fs.writeFile(tempPath, payload, "utf8");
  await fs.rename(tempPath, databasePath);
  await saveCollectionItemsToMysql(collection, items);
}

async function saveCourseDatabase(courses: unknown) {
  await saveCollectionDatabase(databaseCollectionIndex.courses, courses);
}

async function saveDeveloperDocumentDatabase(documents: unknown) {
  await saveCollectionDatabase(databaseCollectionIndex.developerDocuments, documents);
}

function getClaudeSessionBindingsPath() {
  return path.join(getDataDirectory(), claudeSessionBindingsFile);
}

function getClaudeCourseWorkspacePath(courseId: string) {
  return path.join(getDataDirectory(), "claude-course-sessions", courseId.replace(/[^a-zA-Z0-9._-]/g, "_"));
}

async function loadClaudeSessionBindings(): Promise<ClaudeSessionBindings> {
  try {
    const payload = await readJsonFile(getClaudeSessionBindingsPath());
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};

    return Object.fromEntries(
      Object.entries(payload).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
  } catch {
    return {};
  }
}

async function saveClaudeSessionBindings(bindings: ClaudeSessionBindings) {
  await fs.mkdir(getDataDirectory(), { recursive: true });
  await fs.writeFile(getClaudeSessionBindingsPath(), JSON.stringify(bindings, null, 2), "utf8");
}

async function requestClaudeBridgeJson<T = unknown>(endpoint: string, body?: unknown, timeoutMs = 900000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${claudeBridgeBaseUrl}${endpoint}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `Claude bridge request failed: ${response.status}`);
    }
    return text ? (JSON.parse(text) as T) : ({} as T);
  } finally {
    clearTimeout(timer);
  }
}

async function ensureClaudeBridgeReady() {
  try {
    await requestClaudeBridgeJson("/api/health", undefined, 1800);
    return;
  } catch {
    // Try the packaged suite first; it owns the local Claude Code bridge.
  }

  try {
    const child = spawn(claudeAgentExePath, [], {
      cwd: path.dirname(claudeAgentExePath),
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.unref();
  } catch (error) {
    throw new Error(`无法启动 Claude Code 会话：${(error as Error).message}`);
  }

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    try {
      await requestClaudeBridgeJson("/api/health", undefined, 1800);
      return;
    } catch {
      // Keep waiting for the local bridge to come up.
    }
  }

  throw new Error("Claude Code 会话未就绪");
}

function recoverClaudeText(value: string) {
  const decoded = iconv.decode(iconv.encode(value, "gb18030"), "utf8");
  const brokenScore = (text: string) => (text.match(/[\u0590-\u05ff\u0700-\u074f\ufffd]/g) ?? []).length;
  const readableScore = (text: string) => (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  return readableScore(decoded) > readableScore(value) || brokenScore(decoded) < brokenScore(value)
    ? decoded
    : value;
}

function extractJsonStringField(text: string, field: string) {
  const startToken = `"${field}":"`;
  const start = text.indexOf(startToken);
  if (start < 0) return undefined;

  const valueStart = start + startToken.length;
  const nextField = text.slice(valueStart).match(/","(?:action|knowledgeHtml|reply)":/);
  const valueEnd = nextField?.index === undefined ? text.indexOf("\"}", valueStart) : valueStart + nextField.index;
  if (valueEnd < 0) return undefined;

  return text
    .slice(valueStart, valueEnd)
    .replace(/\\"/g, "\"")
    .replace(/\\n/g, "\n");
}

function extractJsonActionField(text: string): ClaudeKnowledgeReplyAction | undefined {
  const match = text.match(/"action"\s*:\s*"(none|replace_current_knowledge)"/);
  return match?.[1] as ClaudeKnowledgeReplyAction | undefined;
}

function extractAssistantTextFromJsonl(rawText: string) {
  const parts: string[] = [];
  for (const line of rawText.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const event = JSON.parse(line) as {
        type?: string;
        message?: { role?: string; content?: Array<{ type?: string; text?: string }> };
      };
      if (event.type !== "assistant" || event.message?.role !== "assistant") continue;
      for (const content of event.message.content ?? []) {
        if (content.type === "text" && content.text) parts.push(content.text);
      }
    } catch {
      continue;
    }
  }
  return parts.at(-1);
}

function normalizeClaudeReply(reply: ClaudeKnowledgeReply) {
  return {
    ...reply,
    reply: reply.reply ? recoverClaudeText(reply.reply) : reply.reply,
    knowledgeHtml: reply.knowledgeHtml ? recoverClaudeText(reply.knowledgeHtml) : reply.knowledgeHtml
  };
}

function extractJsonFromText(rawText: string): ClaudeKnowledgeReply | null {
  const text = (extractAssistantTextFromJsonl(rawText) ?? rawText)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!text) return null;

  try {
    return normalizeClaudeReply(JSON.parse(text) as ClaudeKnowledgeReply);
  } catch {
    // Claude Code logs can include progress lines; parse the last JSON object conservatively.
  }

  for (let end = text.lastIndexOf("}"); end >= 0; end = text.lastIndexOf("}", end - 1)) {
    for (let start = text.lastIndexOf("{", end); start >= 0; start = text.lastIndexOf("{", start - 1)) {
      const candidate = text.slice(start, end + 1);
      try {
        return normalizeClaudeReply(JSON.parse(candidate) as ClaudeKnowledgeReply);
      } catch {
        continue;
      }
    }
  }

  const action = extractJsonActionField(text);
  const reply = extractJsonStringField(text, "reply");
  const knowledgeHtml = extractJsonStringField(text, "knowledgeHtml");
  if (action || reply || knowledgeHtml) {
    return normalizeClaudeReply({ action: action ?? "none", reply, knowledgeHtml });
  }

  return null;
}

async function readTextFileIfAvailable(filePath: string | undefined) {
  if (!filePath) return "";
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function readOptionalUtf8File(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function readClaudeTaskText(task: ClaudeTaskResponse) {
  if (task.resultText?.trim()) return task.resultText;

  const textLog = await readTextFileIfAvailable(task.textLog);
  if (textLog.trim()) return textLog;

  const stdoutLog = await readTextFileIfAvailable(task.stdoutLog);
  if (stdoutLog.trim()) return stdoutLog;

  const jsonlLog = await readTextFileIfAvailable(task.jsonlLog);
  if (jsonlLog.trim()) return jsonlLog;

  return task.finalSummary ?? "";
}

async function startClaudeTrackedTask(payload: {
  cwd: string;
  message: string;
  standardName: string;
  sessionId?: string;
}) {
  const created = await requestClaudeBridgeJson<ClaudeTaskResponse>(
    "/api/claude/tasks",
    {
      mode: payload.sessionId ? "resume" : "new",
      sessionId: payload.sessionId,
      cwd: payload.cwd,
      message: payload.message,
      standardName: payload.standardName,
      source: "aistudy"
    },
    8000
  );

  if (!created.taskId) throw new Error("Claude Code MCP 创建失败");
  return created;
}

async function fetchClaudeTrackedTask(taskId: string) {
  const status = await requestClaudeBridgeJson<ClaudeTaskResponse>(
    `/api/claude/tasks/${encodeURIComponent(taskId)}`,
    undefined,
    8000
  );
  if (!status.ok) throw new Error(status.error || "Claude Code MCP 状态异常");
  return status;
}

function parseClaudeTaskEvent(rawEvent: string): { type?: string; taskId?: string } | null {
  const dataLine = rawEvent
    .split(/\r?\n/)
    .find((line) => line.startsWith("data:"));
  if (!dataLine) return null;

  try {
    return JSON.parse(dataLine.slice("data:".length).trim()) as { type?: string; taskId?: string };
  } catch {
    return null;
  }
}

async function waitForClaudeTaskEvent(taskId: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 240000);

  try {
    const response = await fetch(`${claudeBridgeBaseUrl}/api/claude/tasks/${encodeURIComponent(taskId)}/events`, {
      method: "GET",
      signal: controller.signal
    });
    if (!response.ok || !response.body) return null;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const consumeChunk = async (chunk: string) => {
      const event = parseClaudeTaskEvent(chunk);
      if (!event || event.taskId !== taskId) return null;
      if (event.type === "completed" || event.type === "failed") {
        return fetchClaudeTrackedTask(taskId);
      }
      return null;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) {
          const result = await consumeChunk(buffer);
          if (result) return result;
        }
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\n\n/);
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const result = await consumeChunk(chunk);
        if (result) return result;
      }
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }

  return null;
}

async function waitForClaudeTrackedTask(taskId: string) {
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const latest = await fetchClaudeTrackedTask(taskId);

    if (latest.completed || latest.status === "completed") return latest;
    if (latest.failed || latest.status === "failed") {
      const errorText =
        latest.error ||
        (await readTextFileIfAvailable(latest.stderrLog)).trim() ||
        "Claude Code MCP 失败";
      throw new Error(errorText);
    }
  }

  throw new Error("Claude Code MCP 等待超时");
}

async function dispatchAndTrackClaudeTask(payload: {
  cwd: string;
  message: string;
  standardName: string;
  sessionId?: string;
}) {
  const created = await startClaudeTrackedTask(payload);
  const taskId = created.taskId!;
  const firstStatus = await fetchClaudeTrackedTask(taskId).catch(() => null);
  if (firstStatus?.completed || firstStatus?.status === "completed" || firstStatus?.failed || firstStatus?.status === "failed") {
    return firstStatus;
  }

  return Promise.race([
    waitForClaudeTaskEvent(taskId).then((result) => result ?? waitForClaudeTrackedTask(taskId)),
    waitForClaudeTrackedTask(taskId)
  ]);
}

function normalizeMimoBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

async function loadMimoConfig(): Promise<MimoConfig> {
  const fromFile = await readJsonFile(getMimoConfigPath()).catch(() => null);
  const fileConfig = fromFile && typeof fromFile === "object" && !Array.isArray(fromFile)
    ? (fromFile as Partial<MimoConfig>)
    : {};

  const apiKey =
    fileConfig.apiKey?.trim() ||
    process.env.MIMO_API_KEY?.trim() ||
    process.env.XIAOMI_MIMO_API_KEY?.trim() ||
    "";

  if (!apiKey) throw new Error("Mimo API Key 未配置");

  return {
    apiKey,
    baseUrl: normalizeMimoBaseUrl(
      fileConfig.baseUrl?.trim() ||
      process.env.MIMO_BASE_URL?.trim() ||
      "https://token-plan-cn.xiaomimimo.com/v1"
    ),
    model: fileConfig.model?.trim() || process.env.MIMO_MODEL?.trim() || "mimo-v2.5-pro"
  };
}

function extractMimoText(response: MimoChatResponse) {
  const message = response.choices?.[0]?.message;
  const content = message?.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => (part.type === "text" || !part.type) && typeof part.text === "string" ? part.text : "")
      .filter(Boolean)
      .join("");
    if (text.trim()) return text;
  }
  return message?.reasoning_content ?? "";
}

function getMimoRequestTimeoutMs(mode: MimoRequestMode) {
  return mode === "edit" ? 120000 : 45000;
}

function getMimoOutputBudget(mode: MimoRequestMode) {
  return mode === "edit" ? 4096 : 768;
}

async function runMimoKnowledgeRequest(prompt: string, mode: MimoRequestMode) {
  const config = await loadMimoConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getMimoRequestTimeoutMs(mode));

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: mode === "edit"
              ? "You are the AIstudy knowledge editor. Return only strict JSON. Do not use markdown or code fences. Keep reply concise and include knowledgeHtml only when replacing the current knowledge point."
              : "You are the AIstudy assistant. Return only strict JSON like {\"reply\":\"...\",\"action\":\"none\"}. Do not use markdown or code fences. Keep the reply concise."
          },
          { role: "user", content: prompt }
        ],
        max_completion_tokens: getMimoOutputBudget(mode),
        temperature: 0.2
      }),
      signal: controller.signal
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Mimo 请求超时");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let payload: MimoChatResponse = {};
  try {
    payload = text ? (JSON.parse(text) as MimoChatResponse) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || text || `Mimo request failed: ${response.status}`);
  }

  return extractMimoText(payload);
}

function extractQuestionFromChatGptPrompt(prompt: string) {
  const markers = ["用户输入：", "用户问题：", "问题："];
  for (const marker of markers) {
    const index = prompt.lastIndexOf(marker);
    if (index >= 0) return prompt.slice(index + marker.length).trim();
  }
  return prompt.split(/\r?\n/).filter(Boolean).at(-1)?.trim() || prompt.slice(-120);
}

async function runChatGptBrowserKnowledgeRequest(prompt: string, _mode: MimoRequestMode) {
  const platform = getChatGptPlatform();
  const target = await getChatGptPageTarget(platform);
  const client = new CdpClient(target.webSocketDebuggerUrl!);
  await client.open();

  try {
    await client.send("Runtime.enable");
    const result = await client.send<CdpRuntimeEvaluation>("Runtime.evaluate", {
      expression: getChatGptAutomationExpression(prompt, extractQuestionFromChatGptPrompt(prompt)),
      awaitPromise: true,
      returnByValue: true,
      timeout: 90000
    });

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "ChatGPT 页面执行失败");
    }

    const payload = result.result?.value as { ok?: boolean; blocker?: string; reply?: string } | undefined;
    if (payload?.reply?.trim()) return payload.reply.trim();
    if (payload?.blocker === "login-or-verification") {
      throw new Error("ChatGPT 需要登录或验证，请先确认当前 9230 Chrome 窗口已登录 ChatGPT");
    }
    throw new Error(payload?.blocker ? `ChatGPT 未返回结果：${payload.blocker}` : "ChatGPT 未返回结果");
  } finally {
    client.close();
  }
}

class CdpClient {
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private socket: WebSocket;

  constructor(webSocketUrl: string) {
    this.socket = new WebSocket(webSocketUrl);
  }

  open() {
    if (this.socket.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      this.socket.addEventListener("open", () => resolve(), { once: true });
      this.socket.addEventListener("error", () => reject(new Error("CDP websocket connection failed")), { once: true });
      this.socket.addEventListener("message", (event) => {
        const payload = JSON.parse(String(event.data)) as {
          id?: number;
          result?: unknown;
          error?: { message?: string };
        };
        if (!payload.id || !this.pending.has(payload.id)) return;
        const task = this.pending.get(payload.id)!;
        this.pending.delete(payload.id);
        if (payload.error) {
          task.reject(new Error(payload.error.message || "CDP command failed"));
          return;
        }
        task.resolve(payload.result);
      });
    });
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}) {
    const id = this.nextId++;
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  close() {
    this.socket.close();
  }
}

function getDoubaoPlatform() {
  const platform = getManagedPortDefinition("doubao");
  if (!platform) throw new Error("Doubao 端口未配置");
  return platform;
}

function buildDoubaoAnswerPrompt(params: {
  courseTitle: string;
  nodeTitle: string;
  message: string;
  knowledgeHtml: string;
}) {
  const knowledgeText = params.knowledgeHtml
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);

  return [
    `课程：${params.courseTitle}`,
    `知识点：${params.nodeTitle}`,
    knowledgeText ? `参考内容：${knowledgeText}` : "",
    `请直接回答问题，不要复述课程、知识点、参考内容或问题本身。问题：${params.message}`
  ].filter(Boolean).join("\n");
}

async function getDoubaoPageTarget(platform: ManagedPortPlatform) {
  const cdpUrl = getManagedPortCdpUrl(platform.port);
  if (!await canConnectToPort("127.0.0.1", platform.port)) {
    throw new Error("Doubao 端口未启动，请先到信息搜集的端口管理打开 Doubao 登录窗口");
  }

  let targets = await fetchJsonWithTimeout<CdpTargetInfo[]>(`${cdpUrl}/json`, 2500);
  let target = targets.find((item) => item.type === "page" && item.url?.includes(platform.hostKeyword) && item.webSocketDebuggerUrl)
    ?? targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);

  if (!target || !target.url?.includes(platform.hostKeyword)) {
    await openManagedPortTab(platform);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    targets = await fetchJsonWithTimeout<CdpTargetInfo[]>(`${cdpUrl}/json`, 2500);
    target = targets.find((item) => item.type === "page" && item.url?.includes(platform.hostKeyword) && item.webSocketDebuggerUrl)
      ?? targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
  }

  if (!target?.webSocketDebuggerUrl) {
    throw new Error("未找到可用 Doubao 页面，请先在端口管理打开 Doubao 登录窗口");
  }

  return target;
}

function getDoubaoAutomationExpression(prompt: string, userMessage: string) {
  return `
(async () => {
  const prompt = ${JSON.stringify(prompt)};
  const userQuestion = ${JSON.stringify(userMessage)};
  const promptLines = new Set(prompt.split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const bodyText = () => document.body?.innerText || "";
  const normalizeLines = (text) => String(text || "")
    .split(/\\r?\\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const normalizeCompact = (text) => String(text || "").replace(/\\s+/g, "");
  const userQuestionCompact = normalizeCompact(userQuestion);
  const isUserQuestionEchoLine = (line) => {
    const compactLine = normalizeCompact(line);
    return Boolean(userQuestionCompact) && (
      compactLine === userQuestionCompact ||
      compactLine === "问题：" + userQuestionCompact ||
      compactLine === "问题:" + userQuestionCompact
    );
  };
  const isPromptLine = (line) => {
    if (promptLines.has(line)) return true;
    if (isUserQuestionEchoLine(line)) return true;
    if (line === userQuestion || line.includes(userQuestion)) return true;
    if (["课程", "知识点", "参考内容", "用户问题", "请直接回答问题"].some((prefix) => line.startsWith(prefix))) return true;
    return false;
  };
  const isChromeLine = (line) => {
    const exactNoise = ["Doubao", "豆包", "新对话", "历史对话", "发送", "停止生成", "重新生成", "下载", "登录", "更多", "复制", "分享", "点赞", "点踩", "朗读", "快速", "图像生成", "帮我写作", "编程"];
    if (exactNoise.includes(line)) return true;
    if (line.includes("内容由豆包AI生成")) return true;
    if (line.includes("AI 生成内容仅供参考")) return true;
    return false;
  };
  const isShortQuestionLine = (line) => {
    const compactLine = line.replace(/\\s+/g, "");
    return compactLine.length <= 44
      && (compactLine.endsWith("？") || compactLine.endsWith("?") || compactLine.endsWith("？→") || compactLine.endsWith("?→") || compactLine.endsWith("？->") || compactLine.endsWith("?->"));
  };
  const trimFollowups = (lines) => {
    const kept = [];
    for (const line of lines) {
      if (kept.length > 0 && isShortQuestionLine(line)) break;
      kept.push(line);
    }
    return kept;
  };
  const isSuggestionOnly = (text) => {
    const lines = normalizeLines(text);
    return lines.length > 0 && lines.every((line) => isShortQuestionLine(line));
  };
  const replyScore = (text) => {
    const lines = normalizeLines(text);
    let score = Math.min(text.length, 600) / 10 + lines.length;
    if (lines.some((line) => isUserQuestionEchoLine(line))) score -= 500;
    if (isSuggestionOnly(text)) score -= 300;
    if (lines.length === 1 && isShortQuestionLine(lines[0])) score -= 200;
    if (userQuestion && text.includes(userQuestion)) score -= 120;
    if (text.includes("参考内容：") || text.includes("请直接回答问题")) score -= 500;
    return score;
  };
  const getChangedText = (text) => {
    if (!beforeText) return text;
    if (text.startsWith(beforeText)) return text.slice(beforeText.length);
    let index = 0;
    const maxIndex = Math.min(text.length, beforeText.length);
    while (index < maxIndex && text.charCodeAt(index) === beforeText.charCodeAt(index)) index += 1;
    return text.slice(index);
  };
  const isPromptInstructionLine = (line) => {
    if (promptLines.has(line)) return true;
    if (["课程", "知识点", "参考内容", "用户问题"].some((prefix) => line.startsWith(prefix))) return true;
    if (line.includes("请直接回答问题")) return true;
    if (userQuestion && line.includes("问题") && line.includes(userQuestion)) return true;
    return false;
  };
  const isDisclaimerLine = (line) => {
    return line.includes("本回答由AI生成")
      || line.includes("本回答由 AI 生成")
      || line.includes("AI生成")
      || line.includes("AI 生成")
      || line.includes("仅供参考")
      || line.includes("谨慎投资");
  };
  const classText = (element) => String(element?.className || "");
  const getAssistantActionBars = () => Array.from(document.querySelectorAll("[class*='message-action-bar']"))
    .filter((element) => visible(element) && !classText(element).includes("justify-end"));
  const cleanReplyBlock = (text) => {
    const kept = [];
    for (const line of normalizeLines(text)) {
      if (isPromptInstructionLine(line) || isChromeLine(line)) continue;
      if (isUserQuestionEchoLine(line)) continue;
      if (isDisclaimerLine(line)) {
        if (kept.length > 0) break;
        continue;
      }
      if (isShortQuestionLine(line) && kept.length > 0) break;
      kept.push(line);
    }
    return kept.join("\\n").trim();
  };
  const textBeforeDescendant = (root, descendant) => {
    if (!root || !descendant || !root.contains(descendant)) return "";
    let marker = descendant;
    while (marker.parentElement && marker.parentElement !== root) marker = marker.parentElement;
    if (marker.parentElement !== root) return "";

    const parts = [];
    for (const child of Array.from(root.children)) {
      if (child === marker || child.contains(descendant)) break;
      parts.push(child.innerText || child.textContent || "");
    }
    return cleanReplyBlock(parts.join("\\n"));
  };
  const extractReplyBeforeActionBar = (actionBar) => {
    let root = actionBar;
    for (let depth = 0; depth < 10 && root?.parentElement; depth += 1) {
      root = root.parentElement;
      const reply = textBeforeDescendant(root, actionBar);
      if (reply) return reply;
    }
    return "";
  };
  const cleanLatestActionBarReply = () => {
    const bars = getAssistantActionBars();
    const newBars = bars.slice(Math.max(0, assistantActionBarCountBefore));
    const candidates = newBars.length > 0 ? newBars : [];

    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const reply = extractReplyBeforeActionBar(candidates[index]);
      if (reply) return reply;
    }
    return "";
  };
  const cleanLatestChangedReply = (text) => {
    const changedText = getChangedText(text);
    const lines = normalizeLines(changedText);
    if (lines.length === 0) return "";

    const hasPromptBlock = changedText.includes("请直接回答问题")
      || changedText.includes("问题：")
      || changedText.includes("问题:");
    let waitingForAnswer = hasPromptBlock;
    const kept = [];

    for (const line of lines) {
      if (waitingForAnswer) {
        if (line.includes("请直接回答问题") || line.includes("问题：") || line.includes("问题:")) {
          waitingForAnswer = false;
        }
        continue;
      }
      if (isUserQuestionEchoLine(line)) continue;
      if (isPromptInstructionLine(line)) continue;
      if (isDisclaimerLine(line)) {
        if (kept.length > 0) break;
        continue;
      }
      if (isShortQuestionLine(line)) {
        if (kept.length > 0) break;
        continue;
      }
      if (isChromeLine(line)) {
        if (kept.length > 0) break;
        continue;
      }
      kept.push(line);
    }

    return kept.join("\\n").trim();
  };
  const cleanTailAfterLatestPrompt = (text) => {
    const promptIndex = text.lastIndexOf(prompt);
    const questionIndex = userQuestion ? text.lastIndexOf(userQuestion) : -1;
    const startIndex = promptIndex >= 0
      ? promptIndex + prompt.length
      : questionIndex >= 0
        ? questionIndex + userQuestion.length
        : -1;
    if (startIndex < 0) return "";

    const lines = normalizeLines(text.slice(startIndex));
    const kept = [];
    for (const line of lines) {
      if (isPromptLine(line) || isChromeLine(line)) continue;
      if (isUserQuestionEchoLine(line)) continue;
      if (line.includes("本回答由AI生成") || line.includes("本回答由 AI 生成") || line.includes("仅供参考")) {
        if (kept.length > 0) break;
        continue;
      }
      if (kept.length > 0 && isShortQuestionLine(line)) break;
      if (line.length <= 1) continue;
      kept.push(line);
    }
    return kept.join("\\n").trim();
  };
  const cleanReplyText = (text) => {
    const seen = new Set();
    const lines = trimFollowups(normalizeLines(text).filter((line) => {
      if (beforeLines.has(line)) return false;
      if (isUserQuestionEchoLine(line)) return false;
      if (isPromptLine(line)) return false;
      if (isChromeLine(line)) return false;
      if (line.length <= 1) return false;
      return true;
    }));
    return lines.filter((line) => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    }).join("\\n").trim();
  };
  const getAssistantReply = (allowFallback = true) => {
    const selectors = [
      "[data-testid*='message']",
      "[class*='message']",
      "[class*='answer']",
      "[class*='assistant']",
      "[class*='conversation']",
      "[class*='chat']"
    ];
    const actionBarReply = cleanLatestActionBarReply();
    if (actionBarReply) return actionBarReply;
    if (!allowFallback) return "";
    const changedTextReply = cleanLatestChangedReply(bodyText());
    if (changedTextReply) return changedTextReply;
    const newestTextReply = cleanTailAfterLatestPrompt(bodyText());
    if (newestTextReply) return newestTextReply;
    const candidates = Array.from(document.querySelectorAll(selectors.join(",")))
      .filter(visible)
      .map((element) => cleanReplyText(element.innerText || element.textContent || ""))
      .filter(Boolean)
      .filter((text) => !text.includes("参考内容：") && !text.includes("请直接回答问题"));
    return candidates.sort((a, b) => replyScore(b) - replyScore(a))[0] || cleanReplyText(bodyText());
  };
  const hasGate = () => ["扫码登录", "手机号登录", "请先登录", "立即登录", "验证码", "滑块验证", "安全验证", "操作频繁", "环境异常"].some((text) => bodyText().includes(text));
  if (hasGate()) {
    return { ok: false, blocker: "login-or-verification", reply: "" };
  }

  const beforeText = bodyText();
  const assistantActionBarCountBefore = getAssistantActionBars().length;
  const beforeLines = new Set(beforeText.split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean));
  const root = document.querySelector("#input-engine-container") || document;
  const input = root.querySelector("textarea")
    || document.querySelector("textarea")
    || document.querySelector("[contenteditable='true']")
    || document.querySelector("[role='textbox']");
  if (!input || !visible(input)) {
    return { ok: false, blocker: "input-not-found", reply: "" };
  }

  input.focus();
  if ("value" in input) {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")
      || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    if (descriptor?.set) descriptor.set.call(input, prompt);
    else input.value = prompt;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: prompt, inputType: "insertText" }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    input.textContent = prompt;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: prompt, inputType: "insertText" }));
  }

  await sleep(300);
  const rootRect = (document.querySelector("#input-engine-container") || input).getBoundingClientRect();
  const sendWords = ["send", "发送", "提交"];
  const button = Array.from(document.querySelectorAll("button,[role='button']"))
    .filter((element) => visible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true")
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const text = [element.innerText, element.getAttribute("aria-label"), element.getAttribute("title")]
        .filter(Boolean).join(" ").toLowerCase();
      const textMatch = sendWords.some((word) => text.includes(word.toLowerCase()));
      const rightControl = rect.left > rootRect.right - 80 && rect.bottom > rootRect.bottom - 64 && element.querySelector("svg");
      const voice = ["语音", "麦克风", "more", "更多"].some((word) => text.includes(word));
      return { element, score: (textMatch ? 10 : 0) + (rightControl && !voice ? 5 : 0) + rect.left / 10000 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.element;

  if (button) button.click();
  else input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));

  await sleep(700);
  let stableText = "";
  let stableCount = 0;
  const startedAt = Date.now();
  const fallbackReplyDelayMs = 4500;
  while (Date.now() - startedAt < 30000) {
    await sleep(700);
    const currentBody = bodyText();
    const elapsedMs = Date.now() - startedAt;
    const reply = getAssistantReply(elapsedMs >= fallbackReplyDelayMs);
    if (reply && reply === stableText) stableCount += 1;
    else {
      stableText = reply;
      stableCount = reply ? 1 : 0;
    }
    const generating = ["停止生成", "正在生成", "生成中", "Stop generating"].some((text) => currentBody.includes(text));
    if (stableCount >= 2 && !generating) break;
  }

  if (hasGate()) {
    return { ok: false, blocker: "login-or-verification", reply: stableText };
  }
  return { ok: Boolean(stableText), blocker: stableText ? "" : "reply-timeout", reply: stableText };
})()
`;
}

async function runDoubaoKnowledgeAnswer(params: {
  courseTitle: string;
  nodeTitle: string;
  message: string;
  knowledgeHtml: string;
}) {
  const platform = getDoubaoPlatform();
  const target = await getDoubaoPageTarget(platform);
  const client = new CdpClient(target.webSocketDebuggerUrl!);
  await client.open();

  try {
    await client.send("Runtime.enable");
    const prompt = buildDoubaoAnswerPrompt(params);
    const result = await client.send<CdpRuntimeEvaluation>("Runtime.evaluate", {
      expression: getDoubaoAutomationExpression(prompt, params.message),
      awaitPromise: true,
      returnByValue: true,
      timeout: 70000
    });

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Doubao 页面执行失败");
    }

    const payload = result.result?.value as { ok?: boolean; blocker?: string; reply?: string } | undefined;
    if (payload?.reply?.trim()) return payload.reply.trim();
    if (payload?.blocker === "login-or-verification") {
      throw new Error("Doubao 需要登录或验证，请先到信息搜集的端口管理打开 Doubao 登录窗口并完成登录");
    }
    throw new Error(payload?.blocker ? `Doubao 未返回结果：${payload.blocker}` : "Doubao 未返回结果");
  } finally {
    client.close();
  }
}

function getChatGptPlatform() {
  const platform = getManagedPortDefinition("chatgpt");
  if (!platform) throw new Error("ChatGPT 端口未配置");
  return platform;
}

function buildChatGptAnswerPrompt(params: {
  courseTitle: string;
  nodeTitle: string;
  message: string;
  knowledgeHtml: string;
}) {
  const knowledgeText = params.knowledgeHtml
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);

  return [
    `课程：${params.courseTitle}`,
    `知识点：${params.nodeTitle}`,
    knowledgeText ? `参考内容：${knowledgeText}` : "",
    `请直接回答问题，不要复述课程、知识点、参考内容或问题本身。问题：${params.message}`
  ].filter(Boolean).join("\n");
}

async function getChatGptPageTarget(platform: ManagedPortPlatform) {
  const cdpUrl = getManagedPortCdpUrl(platform.port);
  if (!await canConnectToPort("127.0.0.1", platform.port)) {
    throw new Error(`ChatGPT 端口 ${platform.port} 未启动，请先使用当前已登录 Chrome 打开 ChatGPT 登录窗口`);
  }

  let targets = await fetchJsonWithTimeout<CdpTargetInfo[]>(`${cdpUrl}/json`, 2500);
  let target = targets.find((item) => item.type === "page" && item.url?.includes(platform.hostKeyword) && item.webSocketDebuggerUrl)
    ?? targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);

  if (!target || !target.url?.includes(platform.hostKeyword)) {
    await openManagedPortTab(platform);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    targets = await fetchJsonWithTimeout<CdpTargetInfo[]>(`${cdpUrl}/json`, 2500);
    target = targets.find((item) => item.type === "page" && item.url?.includes(platform.hostKeyword) && item.webSocketDebuggerUrl)
      ?? targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
  }

  if (!target?.webSocketDebuggerUrl) {
    throw new Error(`未找到可用 ChatGPT 页面，请先在端口管理打开 ChatGPT 登录窗口`);
  }

  return target;
}

function getChatGptAutomationExpression(prompt: string, userMessage: string) {
  return `
(async () => {
  const prompt = ${JSON.stringify(prompt)};
  const userQuestion = ${JSON.stringify(userMessage)};
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const bodyText = () => document.body?.innerText || "";
  const normalizeLines = (text) => String(text || "")
    .split(/\\r?\\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const normalizeCompact = (text) => String(text || "").replace(/\\s+/g, "");
  const userQuestionCompact = normalizeCompact(userQuestion);
  const isUserQuestionEchoLine = (line) => {
    const compactLine = normalizeCompact(line);
    return Boolean(userQuestionCompact) && (
      compactLine === userQuestionCompact ||
      compactLine === "问题：" + userQuestionCompact ||
      compactLine === "问题:" + userQuestionCompact
    );
  };
  const isPromptInstructionLine = (line) => {
    if (["课程", "知识点", "参考内容"].some((prefix) => line.startsWith(prefix))) return true;
    if (line.includes("请直接回答问题")) return true;
    if (userQuestion && line.includes("问题") && line.includes(userQuestion)) return true;
    return false;
  };
  const isChromeLine = (line) => {
    const exactNoise = ["ChatGPT", "New chat", "新聊天", "发送", "停止生成", "重新生成", "复制", "分享", "点赞", "点踩", "朗读", "Search", "Reason", "Canvas"];
    if (exactNoise.includes(line)) return true;
    if (line.includes("ChatGPT can make mistakes")) return true;
    if (line.includes("ChatGPT 也可能会犯错")) return true;
    return false;
  };
  const isShortQuestionLine = (line) => {
    const compactLine = line.replace(/\\s+/g, "");
    return compactLine.length <= 52
      && (compactLine.endsWith("？") || compactLine.endsWith("?") || compactLine.endsWith("？→") || compactLine.endsWith("?→"));
  };
  const stripAssistantLabel = (line) => line
    .replace(/^ChatGPT\\s*说[:：]\\s*/i, "")
    .replace(/^ChatGPT[:：]\\s*/i, "")
    .trim();
  const cleanReplyBlock = (text) => {
    const kept = [];
    for (const line of normalizeLines(text)) {
      const cleanedLine = stripAssistantLabel(line);
      if (!cleanedLine) continue;
      if (isPromptInstructionLine(cleanedLine) || isChromeLine(cleanedLine) || isUserQuestionEchoLine(cleanedLine)) continue;
      if (isShortQuestionLine(cleanedLine) && kept.length > 0) break;
      kept.push(cleanedLine);
    }
    return kept.join("\\n").trim();
  };
  const roleBlocks = () => Array.from(document.querySelectorAll("[data-message-author-role]"))
    .filter(visible)
    .map((element) => ({ element, role: element.getAttribute("data-message-author-role") || "" }))
    .sort((a, b) => {
      const position = a.element.compareDocumentPosition(b.element);
      return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0;
    });
  const assistantBlocks = () => Array.from(document.querySelectorAll([
    "[data-message-author-role='assistant']",
    "article[data-testid^='conversation-turn-'] [data-message-author-role='assistant']",
    "section[data-testid^='conversation-turn-'] [data-message-author-role='assistant']",
    "article[data-turn='assistant']",
    "section[data-turn='assistant']"
  ].join(","))).filter(visible);
  const isPromptEchoBlock = (text) => {
    return (text.includes("课程：") && text.includes("知识点："))
      || text.includes("参考内容：")
      || text.includes("请直接回答问题");
  };
  const latestAssistantBlocksAfterUser = () => {
    const blocks = roleBlocks();
    let lastUserIndex = -1;
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      if (blocks[index].role !== "user") continue;
      const text = blocks[index].element.innerText || blocks[index].element.textContent || "";
      if (!userQuestion || text.includes(userQuestion) || isPromptEchoBlock(text)) {
        lastUserIndex = index;
        break;
      }
    }
    if (lastUserIndex < 0) return [];
    return blocks
      .slice(lastUserIndex + 1)
      .filter((block) => block.role === "assistant")
      .map((block) => block.element);
  };
  const getLatestAssistantReply = (beforeCount) => {
    const blocks = assistantBlocks();
    const candidates = blocks.slice(Math.max(0, beforeCount));
    const afterUserBlocks = latestAssistantBlocksAfterUser();
    const targetBlocks = (candidates.length > 0 ? candidates : afterUserBlocks.length > 0 ? afterUserBlocks : blocks.slice(-1))
      .filter((block) => !isPromptEchoBlock(block.innerText || block.textContent || ""));
    for (let index = targetBlocks.length - 1; index >= 0; index -= 1) {
      const reply = cleanReplyBlock(targetBlocks[index].innerText || targetBlocks[index].textContent || "");
      if (reply) return reply;
    }
    return "";
  };
  const hasGate = () => ["Log in", "Sign up", "登录", "注册", "验证", "captcha", "Cloudflare", "Checking your browser"].some((text) => bodyText().includes(text));
  if (hasGate() && !document.querySelector("#prompt-textarea,[contenteditable='true'],textarea,[role='textbox']")) {
    return { ok: false, blocker: "login-or-verification", reply: "" };
  }

  const beforeCount = assistantBlocks().length;
  const input = document.querySelector("#prompt-textarea")
    || document.querySelector("[contenteditable='true'][id='prompt-textarea']")
    || document.querySelector("[contenteditable='true']")
    || document.querySelector("textarea")
    || document.querySelector("[role='textbox']");
  if (!input || !visible(input)) {
    return { ok: false, blocker: "input-not-found", reply: "" };
  }

  input.focus({ preventScroll: true });
  if ("value" in input) {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")
      || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    if (descriptor?.set) descriptor.set.call(input, prompt);
    else input.value = prompt;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: prompt, inputType: "insertText" }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    range.deleteContents();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand("insertText", false, prompt);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: prompt, inputType: "insertText" }));
  }

  await sleep(250);
  const sendButton = Array.from(document.querySelectorAll("button"))
    .filter((element) => visible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true")
    .find((element) => {
      const label = [element.innerText, element.getAttribute("aria-label"), element.getAttribute("title")]
        .filter(Boolean).join(" ").toLowerCase();
      return element.getAttribute("data-testid") === "send-button"
        || element.id === "composer-submit-button"
        || label.includes("send")
        || label.includes("发送");
    });
  if (!sendButton) {
    return { ok: false, blocker: "send-button-not-found", reply: "" };
  }
  sendButton.click();

  let stableText = "";
  let stableCount = 0;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 70000) {
    await sleep(700);
    const reply = getLatestAssistantReply(beforeCount);
    if (reply && reply === stableText) stableCount += 1;
    else {
      stableText = reply;
      stableCount = reply ? 1 : 0;
    }
    const generating = Boolean(document.querySelector("button[data-testid='stop-button'],button[aria-label*='Stop'],button[aria-label*='停止']"));
    if (stableCount >= 2 && !generating) break;
  }

  if (hasGate() && !stableText) {
    return { ok: false, blocker: "login-or-verification", reply: "" };
  }
  return { ok: Boolean(stableText), blocker: stableText ? "" : "reply-timeout", reply: stableText };
})()
`;
}

async function runChatGptKnowledgeAnswer(params: {
  courseTitle: string;
  nodeTitle: string;
  message: string;
  knowledgeHtml: string;
}) {
  const platform = getChatGptPlatform();
  const target = await getChatGptPageTarget(platform);
  const client = new CdpClient(target.webSocketDebuggerUrl!);
  await client.open();

  try {
    await client.send("Runtime.enable");
    const prompt = buildChatGptAnswerPrompt(params);
    const result = await client.send<CdpRuntimeEvaluation>("Runtime.evaluate", {
      expression: getChatGptAutomationExpression(prompt, params.message),
      awaitPromise: true,
      returnByValue: true,
      timeout: 90000
    });

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "ChatGPT 页面执行失败");
    }

    const payload = result.result?.value as { ok?: boolean; blocker?: string; reply?: string } | undefined;
    if (payload?.reply?.trim()) return payload.reply.trim();
    if (payload?.blocker === "login-or-verification") {
      throw new Error("ChatGPT 需要登录或验证，请先确认当前 9230 Chrome 窗口已登录 ChatGPT");
    }
    throw new Error(payload?.blocker ? `ChatGPT 未返回结果：${payload.blocker}` : "ChatGPT 未返回结果");
  } finally {
    client.close();
  }
}

function buildClaudeKnowledgePrompt(params: {
  courseId: string;
  courseTitle: string;
  nodeId: string;
  nodeTitle: string;
  message: string;
  knowledgeHtml: string;
  outline: unknown;
  compact?: boolean;
}) {
  const outlineJson = params.compact ? "" : JSON.stringify(params.outline).slice(0, 12000);
  return [
    "你是 AIstudy 知识点编辑助手，正在通过 AIstudy MCP 受控会话连接 Claude Code。",
    "你必须只返回严格 JSON，不要 Markdown，不要代码块，不要输出 shell 命令。",
    "硬性边界：",
    `- 当前课程 ID：${params.courseId}`,
    `- 当前课程标题：${params.courseTitle}`,
    `- 当前知识点 ID：${params.nodeId}`,
    `- 当前知识点标题：${params.nodeTitle}`,
    "- 你只能建议或改写当前课程的当前知识点 HTML 内容。",
    "- 不要编辑文件，不要修改其他课程，不要修改其他知识点。",
    "- 如果用户只是提问，action 返回 none。",
    "- 如果用户要求修改当前知识点，action 返回 replace_current_knowledge，并给出完整 knowledgeHtml。",
    "- knowledgeHtml 必须是可直接保存的正文 HTML；保留原有流程图、分支图等结构，除非用户明确要求调整。",
    "- reply 用简短中文说明结果。",
    '返回格式：{"reply":"...","action":"none|replace_current_knowledge","knowledgeHtml":"..."}',
    "",
    params.compact ? "" : `课程目录 JSON：${outlineJson}`,
    "",
    "当前知识点 HTML：",
    params.knowledgeHtml || "",
    "",
    "用户输入：",
    params.message
  ].join("\n");
}

function getUserInstructionHead(message: string) {
  return message.split("【系统 README】")[0]?.slice(0, 800) || message.slice(0, 800);
}

function isKnowledgeEditRequest(message: string) {
  const instruction = getUserInstructionHead(message);
  return /改写|修改|编辑|更新|替换|写入|保存|应用|排版|优化|润色|补充|插入|删除|改成|变成/.test(instruction);
}

function buildMimoAnswerPrompt(params: {
  courseId: string;
  courseTitle: string;
  nodeId: string;
  nodeTitle: string;
  message: string;
}) {
  return [
    "你是 AIstudy 知识点聊天助手。",
    "只回答用户当前问题，不改写知识点，不输出 knowledgeHtml。",
    `当前课程：${params.courseTitle}（${params.courseId}）`,
    `当前知识点：${params.nodeTitle}（${params.nodeId}）`,
    '返回格式：{"reply":"...","action":"none"}',
    "",
    "用户输入：",
    params.message
  ].join("\n");
}

async function handleAiChatRequest(request: AiChatRequest) {
  const courseId = request.courseId?.trim();
  const nodeId = request.nodeId?.trim();
  const message = request.message?.trim();

  if (!courseId || !nodeId || !message) {
    throw new Error("缺少课程、知识点或输入内容");
  }

  const payload = await loadCourseDatabase();
  const courses = payload?.courses;
  if (!Array.isArray(courses)) throw new Error("课程数据不可用");

  const course = courses.find((item): item is AiCourseRecord => {
    return Boolean(item && typeof item === "object" && (item as AiCourseRecord).id === courseId);
  });
  if (!course) throw new Error("当前课程不存在");

  const knowledgePoints = course.knowledgePoints ?? {};
  const currentKnowledgeHtml =
    typeof knowledgePoints[nodeId] === "string" ? knowledgePoints[nodeId] : request.knowledgeHtml ?? "";
  const courseTitle = request.courseTitle?.trim() || course.title || "课程";
  const nodeTitle = request.nodeTitle?.trim() || "知识点";
  const provider: AiChatProvider = request.provider === "chatgpt"
    ? "chatgpt"
    : request.provider === "doubao"
      ? "doubao"
      : request.provider === "mimo"
        ? "mimo"
        : "claude";
  const mimoMode: MimoRequestMode = isKnowledgeEditRequest(message) ? "edit" : "answer";
  const prompt = provider === "mimo" && mimoMode === "answer"
    ? buildMimoAnswerPrompt({
      courseId,
      courseTitle,
      nodeId,
      nodeTitle,
      message
    })
    : buildClaudeKnowledgePrompt({
      courseId,
      courseTitle,
      nodeId,
      nodeTitle,
      message,
      knowledgeHtml: currentKnowledgeHtml,
      outline: request.outline ?? [],
      compact: provider === "mimo"
    });
  let sessionId: string | undefined;
  let rawText = "";

  if (provider === "doubao") {
    rawText = await runDoubaoKnowledgeAnswer({
      courseTitle,
      nodeTitle,
      message,
      knowledgeHtml: currentKnowledgeHtml
    });
  } else if (provider === "chatgpt") {
    rawText = await runChatGptKnowledgeAnswer({
      courseTitle,
      nodeTitle,
      message,
      knowledgeHtml: currentKnowledgeHtml
    });
  } else if (provider === "mimo") {
    rawText = await runMimoKnowledgeRequest(prompt, mimoMode);
  } else {
    const cwd = getClaudeCourseWorkspacePath(courseId);
    await fs.mkdir(cwd, { recursive: true });
    await ensureClaudeBridgeReady();

    const bindings = await loadClaudeSessionBindings();
    sessionId = bindings[courseId];
    const task = await dispatchAndTrackClaudeTask({
      cwd,
      message,
      standardName: `AIstudy-${courseTitle}`,
      sessionId
    });

    if (task.sessionId && task.sessionId !== bindings[courseId]) {
      bindings[courseId] = task.sessionId;
      await saveClaudeSessionBindings(bindings);
    }
    sessionId = task.sessionId ?? sessionId;
    rawText = await readClaudeTaskText(task);
  }
  const parsed = extractJsonFromText(rawText);
  if (provider === "doubao" || provider === "chatgpt") {
    return {
      ok: true,
      applied: false,
      sessionId,
      provider,
      reply: rawText.trim() || (provider === "chatgpt" ? "ChatGPT 已返回，但未给出内容" : "Doubao 已返回，但未给出内容")
    };
  }

  if (!parsed) {
    return {
      ok: true,
      applied: false,
      sessionId,
      provider,
      reply: rawText.trim() || (provider === "mimo"
        ? "Mimo 已返回，但未给出可应用结果"
        : "Claude Code 已返回，但未给出可应用结果")
    };
  }

  let updatedKnowledgeHtml: string | undefined;
  let applied = false;

  if (parsed.action === "replace_current_knowledge" && typeof parsed.knowledgeHtml === "string") {
    const latestPayload = await loadCourseDatabase();
    const latestCourses = latestPayload?.courses;
    if (!Array.isArray(latestCourses)) throw new Error("课程数据不可用");

    const latestCourse = latestCourses.find((item): item is AiCourseRecord => {
      return Boolean(item && typeof item === "object" && (item as AiCourseRecord).id === courseId);
    });
    if (!latestCourse) throw new Error("当前课程不存在");

    latestCourse.knowledgePoints = {
      ...(latestCourse.knowledgePoints ?? {}),
      [nodeId]: parsed.knowledgeHtml
    };
    await saveCourseDatabase(latestCourses);
    updatedKnowledgeHtml = parsed.knowledgeHtml;
    applied = true;
  }

  return {
    ok: true,
    applied,
    sessionId,
    provider,
    reply: parsed.reply?.trim() || (applied ? "已更新当前知识点" : "已完成"),
    updatedKnowledgeHtml
  };
}

async function getSystemContextInfo(): Promise<SystemContextInfo> {
  const mysqlConfig = await loadMysqlConfig();
  const mysqlConnected = mysqlConfig ? await withMysqlConnection(async () => true) : false;
  const latestNotionImportBackup = await getLatestNotionImportBackup();
  const appPath = app.getAppPath();
  const packageOutput = path.dirname(app.getPath("exe"));
  const repository = "F:\\AIAPP\\Xiangmu\\AIstudy";
  const readmePath = path.join(repository, "README.md");

  return {
    app: {
      name: app.getName(),
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    },
    paths: {
      repository,
      appPath,
      executable: app.getPath("exe"),
      userData: app.getPath("userData"),
      dataDirectory: getDataDirectory(),
      courseDatabase: getCourseDatabasePath(),
      developerDocumentDatabase: getDeveloperDocumentDatabasePath(),
      mysqlConfig: getMysqlConfigPath(),
      mimoConfig: getMimoConfigPath(),
      claudeSessionBindings: getClaudeSessionBindingsPath(),
      claudeCourseSessionsDirectory: path.join(getDataDirectory(), "claude-course-sessions"),
      packageOutput,
      mcpGuide: getPackagedResourcePath("docs", "mcp-notion-knowledge-import.md"),
      mcpContract: getPackagedResourcePath("mcp", "aistudy-notion-knowledge-import.contract.json"),
      notionCache: path.join(app.getPath("appData"), "Notion", "notion.db")
    },
    storage: {
      jsonDatabaseReady: await fileExists(getCourseDatabasePath()),
      developerDocumentDatabaseReady: await fileExists(getDeveloperDocumentDatabasePath()),
      mysqlConfigured: Boolean(mysqlConfig),
      mysqlConnected: Boolean(mysqlConnected),
      mysqlConfigPath: getMysqlConfigPath(),
      mysqlHost: mysqlConfig?.host,
      mysqlPort: mysqlConfig?.port ?? 3306,
      mysqlDatabase: mysqlConfig?.database,
      mysqlUser: mysqlConfig?.user,
      mysqlAutoStartServer: mysqlConfig?.autoStartServer ?? true,
      mysqlServerRoot: mysqlConfig?.serverRoot,
      latestNotionImportBackup
    },
    ai: {
      claudeBridgeBaseUrl,
      claudeAgentExePath,
      claudeSessionMode: "按课程绑定 Claude Code 任务会话，只允许写回当前课程的当前知识点",
      mimoConfigPath: getMimoConfigPath(),
      mimoDefaultModel: "mimo-v2.5-pro"
    },
    docs: {
      readme: readmePath,
      projectIndex: path.join(repository, "PROJECT_INDEX.md"),
      updateLog: path.join(repository, "src", "updateLog.ts"),
      readmeContent: await readOptionalUtf8File(readmePath)
    }
  };
}

function registerDataHandlers() {
  ipcMain.handle("courses:load", async () => loadCourseDatabase());
  ipcMain.handle("courses:save", async (_event, courses: unknown) => saveCourseDatabase(courses));
  ipcMain.handle("developer-documents:load", async () => loadDeveloperDocumentDatabase());
  ipcMain.handle("developer-documents:save", async (_event, documents: unknown) => saveDeveloperDocumentDatabase(documents));
  ipcMain.handle("debug:knowledge-format-log", async (_event, entry: unknown) => appendKnowledgeFormatDebugLog(entry));
  ipcMain.handle("debug:knowledge-format-log-path", async () => getKnowledgeFormatDebugLogPath());
  ipcMain.handle("ai:chat", async (_event, request: AiChatRequest) => handleAiChatRequest(request));
  ipcMain.handle("ai:system-context", async () => getSystemContextInfo());
  ipcMain.handle("ports:status", async () => getManagedPortStatuses());
  ipcMain.handle("ports:open-login-window", async (_event, platformId: unknown) => openManagedLoginWindow(platformId));
  ipcMain.handle("ports:start-service", async (_event, platformId: unknown) => startManagedPortService(platformId));
  ipcMain.handle("ai-daily:latest", async () => getLatestAiDailyManifest());
  ipcMain.handle("ai-daily:run", async (_event, request: unknown) => runAiDailyWorkflow(request));
  ipcMain.handle("ai-daily:open-artifact", async (_event, filePath: unknown) => openAiDailyArtifact(filePath));
  ipcMain.handle("mcp:notion-import-status", async () => {
    const contractPath = getPackagedResourcePath("mcp", "aistudy-notion-knowledge-import.contract.json");
    const guidePath = getPackagedResourcePath("docs", "mcp-notion-knowledge-import.md");
    const notionCachePath = path.join(app.getPath("appData"), "Notion", "notion.db");
    const jsonDatabasePath = getCourseDatabasePath();
    const mysqlStatus = await withMysqlConnection(async () => true);
    const latestBackupPath = await getLatestNotionImportBackup();

    return {
      contractPath,
      contractReady: await fileExists(contractPath),
      guidePath,
      guideReady: await fileExists(guidePath),
      notionCachePath,
      notionCacheReady: await fileExists(notionCachePath),
      jsonDatabasePath,
      jsonDatabaseReady: await fileExists(jsonDatabasePath),
      mysqlConnected: Boolean(mysqlStatus),
      latestBackupPath,
      latestBackupReady: Boolean(latestBackupPath)
    };
  });
  ipcMain.handle("courses:storage-status", async () => {
    const config = await loadMysqlConfig();
    if (!config) {
      return {
        mysqlConfigured: false,
        mysqlConnected: false,
        jsonDatabasePath: getCourseDatabasePath(),
        mysqlConfigPath: getMysqlConfigPath()
      };
    }

    const connected = await withMysqlConnection(async () => true);
    return {
      mysqlConfigured: true,
      mysqlConnected: Boolean(connected),
      jsonDatabasePath: getCourseDatabasePath(),
      mysqlConfigPath: getMysqlConfigPath(),
      host: config.host,
      port: config.port ?? 3306,
      database: config.database,
      user: config.user,
      autoStartServer: config.autoStartServer ?? true,
      serverRoot: config.serverRoot
    };
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    title: "AIstudy",
    icon: path.join(__dirname, "../assets/icon.ico"),
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#eef3f6",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  void fixWindowsShortcutIcons();
  void ensureMysqlServerStarted();
  registerDataHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
