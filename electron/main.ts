import { app, BrowserWindow, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { Socket } from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const execFileAsync = promisify(execFile);
const MIND_MAP_SNAPSHOT_RETENTION_LIMIT = 12;
const KNOWLEDGE_DOCUMENT_SNAPSHOT_RETENTION_LIMIT = 16;
const BEFORE_CLOSE_DRAIN_TIMEOUT_MS = 2500;

type CourseRecord = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

type CourseStore = {
  courses: CourseRecord[];
  activeCourseId: string | null;
};

type SimpleMindMapNodeData = {
  uid?: string;
  text?: unknown;
  expand?: unknown;
  [key: string]: unknown;
};

type SimpleMindMapNode = {
  data?: SimpleMindMapNodeData;
  children?: unknown;
  [key: string]: unknown;
};

type MindMapSnapshot = {
  schemaVersion: 1;
  editor: "simple-mind-map";
  editorVersion: string;
  root: SimpleMindMapNode;
  layout: string;
  theme?: unknown;
  view?: unknown;
  updatedAt: string;
};

type MindMapDocument = {
  courseId: string;
  mapId: string;
  title: string;
  snapshot: MindMapSnapshot | null;
  updatedAt: string | null;
  nodeCount: number;
};

type MindMapSaveRequest = {
  courseId: string;
  mapId?: string;
  title?: string;
  snapshot: unknown;
};

type KnowledgeDocumentSnapshot = {
  schemaVersion: 1;
  editor: "aistudy-word";
  editorVersion: string;
  content: unknown;
  updatedAt: string;
};

type KnowledgeDocument = {
  courseId: string;
  mindMapId: string;
  nodeId: string;
  documentId: string;
  title: string;
  snapshot: KnowledgeDocumentSnapshot | null;
  updatedAt: string | null;
  byteSize: number;
};

type KnowledgeDocumentNodeRequest = {
  courseId: string;
  mindMapId: string;
  nodeId: string;
};

type KnowledgeDocumentSaveRequest = KnowledgeDocumentNodeRequest & {
  title?: string;
  snapshot: unknown;
};

type MysqlConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  courseTable: string;
  mindMapTable: string;
  mindMapSnapshotTable: string;
  mindMapNodeTable: string;
  knowledgeDocumentTable: string;
  knowledgeDocumentSnapshotTable: string;
};

type CourseRow = RowDataPacket & {
  id: string;
  name: string;
  description: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type MysqlRuntime = {
  pool: Pool;
  courseTable: string;
  mindMapTable: string;
  mindMapSnapshotTable: string;
  mindMapNodeTable: string;
  knowledgeDocumentTable: string;
  knowledgeDocumentSnapshotTable: string;
};

type MindMapRow = RowDataPacket & {
  id: string;
  courseId: string;
  title: string;
  currentSnapshotId: string | null;
  nodeCount: number;
  updatedAt: Date | string;
};

type MindMapSnapshotRow = RowDataPacket & {
  payloadJson: string;
};

type SnapshotMetaRow = RowDataPacket & {
  id: string;
  payloadHash: string;
  payloadJson?: string;
  byteSize?: number | string;
};

type MindMapSequenceRow = RowDataPacket & {
  nextSequence: number | string | null;
};

type KnowledgeDocumentRow = RowDataPacket & {
  id: string;
  courseId: string;
  mindMapId: string;
  nodeId: string;
  title: string;
  currentSnapshotId: string | null;
  currentByteSize: number | string;
  updatedAt: Date | string;
};

type KnowledgeDocumentSnapshotRow = RowDataPacket & {
  payloadJson: string;
  byteSize: number | string;
};

type KnowledgeDocumentSequenceRow = RowDataPacket & {
  nextSequence: number | string | null;
};

type MysqlSchemaRow = RowDataPacket & {
  COLUMN_NAME?: string;
  INDEX_NAME?: string;
};

type MindMapProjectionNode = {
  nodeId: string;
  parentNodeId: string | null;
  title: string;
  depth: number;
  positionIndex: number;
  pathText: string;
  isCollapsed: boolean;
};

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

type GitHubReleaseAsset = {
  name?: unknown;
  browser_download_url?: unknown;
  size?: unknown;
};

type GitHubRelease = {
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  assets?: unknown;
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

type ChromePortPlatformId = "doubao" | "chatgpt";

type ChromePortDefinition = {
  id: ChromePortPlatformId;
  name: string;
  port: number;
  loginUrl: string;
  hostKeyword: string;
  authCookieDomains: string[];
  authCookieNames: string[];
  authDomKeywords: string[];
};

type ChromePortStatus = ChromePortDefinition & {
  connected: boolean;
  pageDetected: boolean;
  authenticated: boolean;
  saved: boolean;
  profileDir: string;
  statusText: string;
  lastCheckedAt: string;
  savedAt: string;
  authenticatedAt: string;
  detectedUrl: string;
};

type ChromePortOpenResult = {
  status: ChromePortStatus;
  message: string;
};

type ChromeDebugTarget = {
  id?: string;
  type?: string;
  title?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
};

type ChromeCookie = {
  name?: string;
  domain?: string;
  value?: string;
};

type ChromePortSavedEntry = {
  platformId: ChromePortPlatformId;
  port: number;
  profileDir: string;
  savedAt: string;
  authenticatedAt: string;
  detectedUrl: string;
};

type ChromePortSavedStore = {
  version: 1;
  ports: Partial<Record<ChromePortPlatformId, ChromePortSavedEntry>>;
};

type ChromePortLoginProbe = {
  pageDetected: boolean;
  authenticated: boolean;
  authenticatedAt: string;
  detectedUrl: string;
};

type AiChatProvider = Extract<ChromePortPlatformId, "doubao" | "chatgpt">;

type AiChatRequest = {
  provider?: AiChatProvider;
  message?: string;
  courseTitle?: string;
  nodeTitle?: string;
  contextText?: string;
};

type AiChatResult = {
  ok: boolean;
  provider: AiChatProvider;
  reply: string;
  error?: string;
};

let mainWindow: BrowserWindow | null = null;
let mysqlRuntime: MysqlRuntime | null = null;
let mysqlRuntimePromise: Promise<MysqlRuntime> | null = null;
const beforeCloseResolvers = new Map<string, () => void>();
const chromePortDefinitions: ChromePortDefinition[] = [
  {
    id: "doubao",
    name: "豆包",
    port: 9224,
    loginUrl: "https://www.doubao.com/chat/",
    hostKeyword: "doubao.com/chat",
    authCookieDomains: ["doubao.com"],
    authCookieNames: ["sessionid", "sessionid_ss", "sid_guard", "sid_tt", "uid_tt", "uid_tt_ss", "oauth_token", "oauth_token_v2", "multi_sids"],
    authDomKeywords: ["新对话", "历史对话"]
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    port: 9230,
    loginUrl: "https://chatgpt.com/",
    hostKeyword: "chatgpt.com",
    authCookieDomains: ["chatgpt.com", "openai.com"],
    authCookieNames: ["__Secure-next-auth.session-token", "__Secure-authjs.session-token", "oai-did", "oai-sc"],
    authDomKeywords: ["New chat", "ChatGPT"]
  }
];

async function requestRendererBeforeCloseDrain(window: BrowserWindow) {
  if (window.webContents.isDestroyed()) return;

  const token = randomUUID();
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      beforeCloseResolvers.delete(token);
      resolve();
    }, BEFORE_CLOSE_DRAIN_TIMEOUT_MS);

    beforeCloseResolvers.set(token, () => {
      clearTimeout(timeout);
      resolve();
    });

    window.webContents.send("app:before-close", token);
  });
}

function getEventWindow(event: IpcMainInvokeEvent) {
  return BrowserWindow.fromWebContents(event.sender);
}

function getChromePortDefinition(platformId: unknown) {
  return chromePortDefinitions.find((platform) => platform.id === platformId);
}

function getChromePortRuntimeRoot() {
  const configuredRoot = process.env.AISTUDY_RUNTIME_ROOT?.trim();
  if (configuredRoot) return configuredRoot;
  if (isDev) return path.join(app.getAppPath(), ".runtime");

  const configuredDataRoot = process.env.AISTUDY_DATA_ROOT?.trim();
  if (configuredDataRoot) return path.join(configuredDataRoot, "runtime");

  const exeDriveRoot = path.parse(app.getPath("exe")).root;
  if (exeDriveRoot && !exeDriveRoot.toLowerCase().startsWith("c:")) {
    return path.join(exeDriveRoot, "AIstudyData", "runtime");
  }

  const fDriveRoot = "F:\\";
  if (existsSync(fDriveRoot)) {
    return path.join(fDriveRoot, "AIstudyData", "runtime");
  }

  return path.join(app.getPath("userData"), "runtime");
}

function getChromePortProfileDir(platform: ChromePortDefinition) {
  return path.join(getChromePortRuntimeRoot(), "chrome-profiles", `${platform.id}-${platform.port}`);
}

function getChromePortStatePath() {
  return path.join(getChromePortRuntimeRoot(), "chrome-ports.json");
}

function normalizeChromePortSavedStore(value: unknown): ChromePortSavedStore {
  if (!value || typeof value !== "object") {
    return { version: 1, ports: {} };
  }

  const candidate = value as Partial<ChromePortSavedStore>;
  const ports: ChromePortSavedStore["ports"] = {};
  if (candidate.ports && typeof candidate.ports === "object") {
    for (const platform of chromePortDefinitions) {
      const entry = candidate.ports[platform.id] as Partial<ChromePortSavedEntry> | undefined;
      if (!entry || typeof entry !== "object") continue;
      if (entry.platformId !== platform.id || entry.port !== platform.port) continue;
      ports[platform.id] = {
        platformId: platform.id,
        port: platform.port,
        profileDir: typeof entry.profileDir === "string" ? entry.profileDir : getChromePortProfileDir(platform),
        savedAt: typeof entry.savedAt === "string" ? entry.savedAt : "",
        authenticatedAt: typeof entry.authenticatedAt === "string" ? entry.authenticatedAt : "",
        detectedUrl: typeof entry.detectedUrl === "string" ? entry.detectedUrl : ""
      };
    }
  }

  return { version: 1, ports };
}

async function readChromePortSavedStore() {
  try {
    const raw = await fs.readFile(getChromePortStatePath(), "utf8");
    return normalizeChromePortSavedStore(JSON.parse(raw));
  } catch {
    return { version: 1, ports: {} } satisfies ChromePortSavedStore;
  }
}

async function writeChromePortSavedStore(store: ChromePortSavedStore) {
  const filePath = getChromePortStatePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function saveAuthenticatedChromePort(platform: ChromePortDefinition, probe: ChromePortLoginProbe) {
  if (!probe.authenticated) return null;

  const store = await readChromePortSavedStore();
  const now = new Date().toISOString();
  const entry: ChromePortSavedEntry = {
    platformId: platform.id,
    port: platform.port,
    profileDir: getChromePortProfileDir(platform),
    savedAt: store.ports[platform.id]?.savedAt || now,
    authenticatedAt: probe.authenticatedAt || now,
    detectedUrl: probe.detectedUrl
  };
  store.ports[platform.id] = entry;
  await writeChromePortSavedStore(store);
  return entry;
}

function canConnectToLocalPort(port: number, timeoutMs = 800) {
  return new Promise<boolean>((resolve) => {
    const socket = new Socket();
    let settled = false;

    const finish = (connected: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(connected);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, "127.0.0.1");
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForChromePort(port: number, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canConnectToLocalPort(port, 500)) return true;
    await delay(250);
  }
  return false;
}

async function openUrlInChromePort(port: number, loginUrl: string) {
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(loginUrl)}`;
  try {
    const response = await fetch(endpoint, { method: "PUT" });
    if (response.ok) return true;
  } catch {
    // Some Chromium builds still accept GET for /json/new; keep this fallback narrow.
  }

  try {
    const response = await fetch(endpoint);
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchChromeJson<T>(url: string, timeoutMs = 1600): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function readChromeDebugTargets(port: number) {
  return await fetchChromeJson<ChromeDebugTarget[]>(`http://127.0.0.1:${port}/json/list`) ?? [];
}

function findPlatformTarget(platform: ChromePortDefinition, targets: ChromeDebugTarget[]) {
  return targets.find((target) => {
    if (target.type !== "page" || typeof target.url !== "string") return false;
    return target.url.includes(platform.hostKeyword) || target.url.includes(new URL(platform.loginUrl).hostname);
  }) ?? null;
}

function cdpStringifyData(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value).toString("utf8");
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer).toString("utf8");
  return "";
}

function sendChromeCdpCommand(wsUrl: string, method: string, params: Record<string, unknown> = {}, timeoutMs = 2200) {
  return new Promise<Record<string, unknown> | null>((resolve) => {
    const WebSocketCtor = globalThis.WebSocket;
    if (!WebSocketCtor) {
      resolve(null);
      return;
    }

    const commandId = 1;
    const socket = new WebSocketCtor(wsUrl);
    const timeout = setTimeout(() => {
      try {
        socket.close();
      } catch {
        // The probe is best-effort; a closed socket is fine.
      }
      resolve(null);
    }, timeoutMs);

    const finish = (value: Record<string, unknown> | null) => {
      clearTimeout(timeout);
      try {
        socket.close();
      } catch {
        // The probe is best-effort; a closed socket is fine.
      }
      resolve(value);
    };

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ id: commandId, method, params }));
    });
    socket.addEventListener("error", () => finish(null));
    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(cdpStringifyData(event.data)) as { id?: number; result?: Record<string, unknown> };
        if (message.id === commandId) {
          finish(message.result ?? null);
        }
      } catch {
        finish(null);
      }
    });
  });
}

async function readChromeCookies(target: ChromeDebugTarget) {
  if (!target.webSocketDebuggerUrl) return [];
  const result = await sendChromeCdpCommand(target.webSocketDebuggerUrl, "Network.getAllCookies");
  return Array.isArray(result?.cookies) ? result.cookies.filter((cookie): cookie is ChromeCookie => Boolean(cookie && typeof cookie === "object")) : [];
}

async function readChromePageText(target: ChromeDebugTarget) {
  if (!target.webSocketDebuggerUrl) return "";
  const expression = "document.body ? document.body.innerText.slice(0, 1200) : ''";
  const result = await sendChromeCdpCommand(target.webSocketDebuggerUrl, "Runtime.evaluate", { expression, returnByValue: true });
  const remoteObject = result?.result as { value?: unknown } | undefined;
  return typeof remoteObject?.value === "string" ? remoteObject.value : "";
}

function cookieMatchesPlatformAuth(platform: ChromePortDefinition, cookie: ChromeCookie) {
  const domain = cookie.domain ?? "";
  const name = cookie.name ?? "";
  const value = cookie.value ?? "";
  if (!value) return false;
  const domainMatched = platform.authCookieDomains.some((keyword) => domain.includes(keyword));
  const nameMatched = platform.authCookieNames.some((cookieName) => cookieName.toLowerCase() === name.toLowerCase());
  return domainMatched && nameMatched;
}

async function probeChromePortLogin(platform: ChromePortDefinition, connected: boolean): Promise<ChromePortLoginProbe> {
  if (!connected) {
    return { pageDetected: false, authenticated: false, authenticatedAt: "", detectedUrl: "" };
  }

  const targets = await readChromeDebugTargets(platform.port);
  const target = findPlatformTarget(platform, targets);
  if (!target) {
    return { pageDetected: false, authenticated: false, authenticatedAt: "", detectedUrl: "" };
  }

  const cookies = await readChromeCookies(target);
  let authenticated = cookies.some((cookie) => cookieMatchesPlatformAuth(platform, cookie));
  if (!authenticated && platform.authDomKeywords.length > 0) {
    const pageText = await readChromePageText(target);
    authenticated = platform.authDomKeywords.every((keyword) => pageText.includes(keyword));
  }

  return {
    pageDetected: true,
    authenticated,
    authenticatedAt: authenticated ? new Date().toISOString() : "",
    detectedUrl: target.url ?? ""
  };
}

function sanitizeAiChatRequest(value: unknown): Required<AiChatRequest> {
  const request = value && typeof value === "object" ? value as AiChatRequest : {};
  const provider = request.provider === "chatgpt" ? "chatgpt" : "doubao";
  const message = typeof request.message === "string" ? request.message.trim() : "";
  if (!message) {
    throw new Error("请输入要发送给 AI 助手的问题");
  }

  return {
    provider,
    message: message.slice(0, 4000),
    courseTitle: typeof request.courseTitle === "string" ? request.courseTitle.slice(0, 120) : "",
    nodeTitle: typeof request.nodeTitle === "string" ? request.nodeTitle.slice(0, 120) : "",
    contextText: typeof request.contextText === "string" ? request.contextText.slice(0, 4000) : ""
  };
}

function buildAiChatPrompt(request: Required<AiChatRequest>) {
  return request.message;
  /*
    "你是 AIstudy 内嵌学习助手。",
    "请用简洁中文直接回答，不要复述系统提示。",
    request.courseTitle ? `当前课程：${request.courseTitle}` : "",
    request.nodeTitle ? `当前节点：${request.nodeTitle}` : "",
    request.contextText ? `参考上下文：${request.contextText}` : "",
    `用户问题：${request.message}`
  */
}

function getAiChatPlatform(provider: AiChatProvider) {
  const platform = getChromePortDefinition(provider);
  if (!platform) {
    throw new Error(`未配置 ${provider} 端口`);
  }
  return platform;
}

async function getAiChatPageTarget(platform: ChromePortDefinition) {
  const connected = await canConnectToLocalPort(platform.port);
  if (!connected) {
    await openChromePortLogin(platform.id);
    await delay(1200);
  }

  let targets = await readChromeDebugTargets(platform.port);
  let target = findPlatformTarget(platform, targets);

  if (!target) {
    await openUrlInChromePort(platform.port, platform.loginUrl);
    await delay(1200);
    targets = await readChromeDebugTargets(platform.port);
    target = findPlatformTarget(platform, targets);
  }

  if (!target?.webSocketDebuggerUrl) {
    throw new Error(`${platform.name} 端口 ${platform.port} 未就绪，请先在端口管理打开并确认登录`);
  }

  let status = await getChromePortStatus(platform);
  for (let attempt = 0; attempt < 6 && !status.authenticated; attempt += 1) {
    await delay(1000);
    status = await getChromePortStatus(platform);
  }
  if (!status.authenticated) {
    throw new Error(`${platform.name} 尚未识别到登录状态，请先在端口管理完成登录`);
  }

  return target;
}

function getAiChatAutomationExpression(provider: AiChatProvider, prompt: string) {
  const inputSelectors = provider === "chatgpt"
    ? ["#prompt-textarea", "[contenteditable='true'][id='prompt-textarea']", "[contenteditable='true']", "textarea", "[role='textbox']"]
    : ["textarea", "[contenteditable='true']", "[role='textbox']"];
  const assistantSelectors = provider === "chatgpt"
    ? ["[data-message-author-role='assistant']", "article[data-testid^='conversation-turn-']", "section[data-testid^='conversation-turn-']"]
    : ["[class*='message']", "[class*='answer']", "[class*='assistant']", "[class*='conversation']", "[class*='chat']"];
  const gateWords = provider === "chatgpt"
    ? ["Log in", "Sign up", "登录", "注册", "验证", "captcha", "Cloudflare", "Checking your browser"]
    : ["扫码登录", "手机号登录", "请先登录", "立即登录", "验证码", "滑块验证", "安全验证", "操作频繁"];
  const chromeNoise = provider === "chatgpt"
    ? ["ChatGPT", "New chat", "新聊天", "发送", "停止生成", "重新生成", "Search", "Reason", "Canvas"]
    : ["Doubao", "豆包", "新对话", "历史对话", "发送", "停止生成", "重新生成", "内容由豆包AI生成"];

  return `
(async () => {
  const prompt = ${JSON.stringify(prompt)};
  const inputSelectors = ${JSON.stringify(inputSelectors)};
  const assistantSelectors = ${JSON.stringify(assistantSelectors)};
  const gateWords = ${JSON.stringify(gateWords)};
  const chromeNoise = ${JSON.stringify(chromeNoise)};
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
  const cleanReply = (text) => {
    const seen = new Set();
    const lines = [];
    for (const rawLine of normalizeLines(text)) {
      const line = rawLine
        .replace(/^ChatGPT\\s*[:：]?\\s*/i, "")
        .replace(/^豆包\\s*[:：]?\\s*/i, "")
        .trim();
      if (!line || seen.has(line)) continue;
      if (prompt.includes(line)) continue;
      if (chromeNoise.some((noise) => line === noise || line.includes(noise))) continue;
      if (line.includes("AIstudy 内嵌学习助手") || line.startsWith("当前课程：") || line.startsWith("当前节点：") || line.startsWith("参考上下文：") || line.startsWith("用户问题：")) continue;
      if (line.includes("ChatGPT can make mistakes") || line.includes("仅供参考")) {
        if (lines.length > 0) break;
        continue;
      }
      seen.add(line);
      lines.push(line);
    }
    return lines.join("\\n").trim();
  };
  const hasGate = () => gateWords.some((word) => bodyText().includes(word));
  const input = inputSelectors.map((selector) => document.querySelector(selector)).find(visible);
  if (!input) {
    return { ok: false, blocker: hasGate() ? "login-or-verification" : "input-not-found", reply: "" };
  }

  const beforeText = bodyText();
  const beforeAssistantCount = assistantSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector))).filter(visible).length;
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

  await sleep(300);
  const buttons = Array.from(document.querySelectorAll("button,[role='button']")).filter((element) => visible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true");
  const sendButton = buttons.find((element) => {
    const label = [element.id, element.getAttribute("data-testid"), element.innerText, element.getAttribute("aria-label"), element.getAttribute("title")]
      .filter(Boolean).join(" ").toLowerCase();
    return label.includes("send") || label.includes("发送") || label.includes("submit") || label.includes("composer-submit-button");
  }) || buttons.sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0];

  if (!sendButton) {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
  } else {
    sendButton.click();
  }

  const getLatestAssistantReply = () => {
    const assistantBlocks = assistantSelectors
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .filter(visible);
    const newBlocks = assistantBlocks.slice(Math.max(0, beforeAssistantCount));
    const candidates = newBlocks.length ? newBlocks : assistantBlocks.slice(-3);
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const reply = cleanReply(candidates[index].innerText || candidates[index].textContent || "");
      if (reply) return reply;
    }
    const currentText = bodyText();
    const changed = currentText.startsWith(beforeText) ? currentText.slice(beforeText.length) : currentText;
    return cleanReply(changed);
  };

  let stableText = "";
  let stableCount = 0;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 70000) {
    await sleep(800);
    const reply = getLatestAssistantReply();
    if (reply && reply === stableText) stableCount += 1;
    else {
      stableText = reply;
      stableCount = reply ? 1 : 0;
    }
    const generating = bodyText().includes("停止生成") || bodyText().includes("正在生成") || Boolean(document.querySelector("button[data-testid='stop-button'],button[aria-label*='Stop'],button[aria-label*='停止']"));
    if (stableCount >= 2 && !generating) break;
  }

  if (hasGate() && !stableText) {
    return { ok: false, blocker: "login-or-verification", reply: "" };
  }
  return { ok: Boolean(stableText), blocker: stableText ? "" : "reply-timeout", reply: stableText };
})()
`;
}

async function sendAiChat(rawRequest: unknown): Promise<AiChatResult> {
  const request = sanitizeAiChatRequest(rawRequest);
  const platform = getAiChatPlatform(request.provider);
  const target = await getAiChatPageTarget(platform);
  const prompt = buildAiChatPrompt(request);
  const result = await sendChromeCdpCommand(
    target.webSocketDebuggerUrl!,
    "Runtime.evaluate",
    {
      expression: getAiChatAutomationExpression(request.provider, prompt),
      awaitPromise: true,
      returnByValue: true,
      timeout: 90000
    },
    95000
  );
  const evaluation = result as { result?: { value?: unknown }; exceptionDetails?: { text?: string; exception?: { description?: string } } } | null;
  if (evaluation?.exceptionDetails) {
    throw new Error(evaluation.exceptionDetails.exception?.description || evaluation.exceptionDetails.text || `${platform.name} 页面执行失败`);
  }

  const payload = evaluation?.result?.value as { ok?: boolean; blocker?: string; reply?: string } | undefined;
  if (payload?.reply?.trim()) {
    return {
      ok: true,
      provider: request.provider,
      reply: payload.reply.trim()
    };
  }

  if (payload?.blocker === "login-or-verification") {
    throw new Error(`${platform.name} 需要登录或验证，请先在端口管理确认登录状态`);
  }

  throw new Error(payload?.blocker ? `${platform.name} 未返回结果：${payload.blocker}` : `${platform.name} 未返回结果`);
}

async function findChromeExecutable() {
  const registryCandidates = await getChromeRegistryCandidates();
  const candidates = [
    process.env.AISTUDY_CHROME_PATH,
    ...registryCandidates,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe") : "",
    process.env["ProgramFiles(x86)"] ? path.join(process.env["ProgramFiles(x86)"]!, "Google", "Chrome", "Application", "chrome.exe") : "",
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe") : ""
  ].filter((candidate, index, all): candidate is string => Boolean(candidate && candidate.trim()) && all.indexOf(candidate) === index);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next common Chrome install path.
    }
  }

  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync("where.exe", ["chrome"], { windowsHide: true });
      const chromePath = stdout.split(/\r?\n/).find((line) => line.trim().toLowerCase().endsWith("chrome.exe"));
      if (chromePath) return chromePath.trim();
    } catch {
      return null;
    }
  }

  return null;
}

async function readWindowsRegistryString(key: string, valueName?: string) {
  if (process.platform !== "win32") return null;

  const args = valueName ? ["query", key, "/v", valueName] : ["query", key, "/ve"];
  try {
    const { stdout } = await execFileAsync("reg.exe", args, { windowsHide: true });
    for (const line of stdout.split(/\r?\n/)) {
      const match = line.match(/\s+REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/i);
      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function getChromeRegistryCandidates() {
  const keys = [
    "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe",
    "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe",
    "HKCU\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe",
    "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe"
  ];
  const candidates: string[] = [];

  for (const key of keys) {
    const executablePath = await readWindowsRegistryString(key);
    if (executablePath) {
      candidates.push(executablePath);
    }

    const installDir = await readWindowsRegistryString(key, "Path");
    if (installDir) {
      candidates.push(path.join(installDir, "chrome.exe"));
    }
  }

  return candidates;
}

async function getChromePortStatus(platform: ChromePortDefinition): Promise<ChromePortStatus> {
  const connected = await canConnectToLocalPort(platform.port);
  const savedStore = await readChromePortSavedStore();
  const probe = await probeChromePortLogin(platform, connected);
  const savedEntry = probe.authenticated
    ? (await saveAuthenticatedChromePort(platform, probe)) ?? savedStore.ports[platform.id]
    : savedStore.ports[platform.id];
  const saved = Boolean(savedEntry);
  const statusText = probe.authenticated
    ? "已登录并保存"
    : connected
      ? probe.pageDetected
        ? "待登录确认"
        : "端口已连接"
      : saved
        ? "已保存，未启动"
        : "未启动";

  return {
    ...platform,
    connected,
    pageDetected: probe.pageDetected,
    authenticated: probe.authenticated,
    saved,
    profileDir: getChromePortProfileDir(platform),
    statusText,
    lastCheckedAt: new Date().toISOString(),
    savedAt: savedEntry?.savedAt ?? "",
    authenticatedAt: probe.authenticatedAt || savedEntry?.authenticatedAt || "",
    detectedUrl: probe.detectedUrl || savedEntry?.detectedUrl || ""
  };
}

function getChromePortStatuses() {
  return Promise.all(chromePortDefinitions.map((platform) => getChromePortStatus(platform)));
}

async function openChromePortLogin(platformId: unknown): Promise<ChromePortOpenResult> {
  const platform = getChromePortDefinition(platformId);
  if (!platform) {
    throw new Error("未知的 Chrome 端口平台");
  }

  if (await canConnectToLocalPort(platform.port)) {
    const opened = await openUrlInChromePort(platform.port, platform.loginUrl);
    await delay(700);
    const status = await getChromePortStatus(platform);
    return {
      status,
      message: status.authenticated
        ? `${platform.name} 已识别登录状态，端口 ${platform.port} 已保存`
        : opened
          ? `${platform.name} 登录页已在固定端口 ${platform.port} 打开，登录完成后会自动识别并保存`
          : `${platform.name} 固定端口 ${platform.port} 已连接，请在对应 Chrome 窗口确认登录页`
    };
  }

  const chromePath = await findChromeExecutable();
  if (!chromePath) {
    throw new Error("未找到 Chrome，可通过 AISTUDY_CHROME_PATH 指定 chrome.exe 路径");
  }

  const profileDir = getChromePortProfileDir(platform);
  await fs.mkdir(profileDir, { recursive: true });
  const child = spawn(
    chromePath,
    [
      `--remote-debugging-port=${platform.port}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--new-window",
      platform.loginUrl
    ],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: false
    }
  );
  child.unref();

  const ready = await waitForChromePort(platform.port);
  await delay(700);
  const status = await getChromePortStatus(platform);
  return {
    status,
    message: status.authenticated
      ? `${platform.name} 已识别登录状态，端口 ${platform.port} 已保存`
      : ready
        ? `${platform.name} 登录窗口已启动，端口 ${platform.port} 已连接；登录完成后会自动识别并保存`
        : `${platform.name} 登录窗口已尝试启动，端口 ${platform.port} 暂未就绪`
  };
}

function normalizeCourseStore(value: unknown): CourseStore {
  if (!value || typeof value !== "object") {
    return { courses: [], activeCourseId: null };
  }

  const candidate = value as Partial<CourseStore>;
  const courses = Array.isArray(candidate.courses)
    ? candidate.courses.filter(
        (course): course is CourseRecord =>
          Boolean(course) &&
          typeof course.id === "string" &&
          typeof course.name === "string" &&
          typeof course.description === "string" &&
          typeof course.createdAt === "string" &&
          typeof course.updatedAt === "string"
      )
    : [];
  const activeCourseId = typeof candidate.activeCourseId === "string" && courses.some((course) => course.id === candidate.activeCourseId)
    ? candidate.activeCourseId
    : null;

  return { courses, activeCourseId };
}

function validateMysqlIdentifier(value: string, label: string) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`${label} can only contain letters, numbers, and underscores.`);
  }
}

function escapeMysqlIdentifier(value: string, label: string) {
  validateMysqlIdentifier(value, label);
  return `\`${value}\``;
}

function parsePort(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 65535) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
      return parsed;
    }
  }

  return fallback;
}

function getStringSetting(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readSetting(source: unknown, key: keyof MysqlConfig) {
  if (!source || typeof source !== "object") return undefined;
  return (source as Partial<Record<keyof MysqlConfig, unknown>>)[key];
}

async function readMysqlConfigFile(filePath: string) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as Partial<MysqlConfig>;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function readMysqlConfig(): Promise<MysqlConfig> {
  const executableConfig = await readMysqlConfigFile(path.join(path.dirname(process.execPath), "mysql.config.json"));
  const userConfig = await readMysqlConfigFile(path.join(app.getPath("userData"), "mysql.config.json"));
  const mergedConfig = { ...executableConfig, ...userConfig };

  const config = {
    host: getStringSetting(process.env.AISTUDY_MYSQL_HOST, getStringSetting(readSetting(mergedConfig, "host"), "127.0.0.1")),
    port: parsePort(process.env.AISTUDY_MYSQL_PORT, parsePort(readSetting(mergedConfig, "port"), 3306)),
    user: getStringSetting(process.env.AISTUDY_MYSQL_USER, getStringSetting(readSetting(mergedConfig, "user"), "root")),
    password: typeof process.env.AISTUDY_MYSQL_PASSWORD === "string"
      ? process.env.AISTUDY_MYSQL_PASSWORD
      : getStringSetting(readSetting(mergedConfig, "password"), ""),
    database: getStringSetting(process.env.AISTUDY_MYSQL_DATABASE, getStringSetting(readSetting(mergedConfig, "database"), "aistudy")),
    courseTable: getStringSetting(
      process.env.AISTUDY_MYSQL_COURSE_TABLE,
      getStringSetting(readSetting(mergedConfig, "courseTable"), "course_management_courses")
    ),
    mindMapTable: getStringSetting(
      process.env.AISTUDY_MYSQL_MIND_MAP_TABLE,
      getStringSetting(readSetting(mergedConfig, "mindMapTable"), "mind_maps")
    ),
    mindMapSnapshotTable: getStringSetting(
      process.env.AISTUDY_MYSQL_MIND_MAP_SNAPSHOT_TABLE,
      getStringSetting(readSetting(mergedConfig, "mindMapSnapshotTable"), "mind_map_snapshots")
    ),
    mindMapNodeTable: getStringSetting(
      process.env.AISTUDY_MYSQL_MIND_MAP_NODE_TABLE,
      getStringSetting(readSetting(mergedConfig, "mindMapNodeTable"), "mind_map_nodes")
    ),
    knowledgeDocumentTable: getStringSetting(
      process.env.AISTUDY_MYSQL_KNOWLEDGE_DOCUMENT_TABLE,
      getStringSetting(readSetting(mergedConfig, "knowledgeDocumentTable"), "knowledge_documents")
    ),
    knowledgeDocumentSnapshotTable: getStringSetting(
      process.env.AISTUDY_MYSQL_KNOWLEDGE_DOCUMENT_SNAPSHOT_TABLE,
      getStringSetting(readSetting(mergedConfig, "knowledgeDocumentSnapshotTable"), "knowledge_document_snapshots")
    )
  };

  validateMysqlIdentifier(config.database, "MySQL database");
  validateMysqlIdentifier(config.courseTable, "MySQL course table");
  validateMysqlIdentifier(config.mindMapTable, "MySQL mind map table");
  validateMysqlIdentifier(config.mindMapSnapshotTable, "MySQL mind map snapshot table");
  validateMysqlIdentifier(config.mindMapNodeTable, "MySQL mind map node table");
  validateMysqlIdentifier(config.knowledgeDocumentTable, "MySQL knowledge document table");
  validateMysqlIdentifier(config.knowledgeDocumentSnapshotTable, "MySQL knowledge document snapshot table");
  return config;
}

async function ensureDatabase(config: MysqlConfig) {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${escapeMysqlIdentifier(config.database, "MySQL database")} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

async function ensureCourseTable(pool: Pool, courseTable: string) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${courseTable} (
      id VARCHAR(64) NOT NULL,
      name VARCHAR(120) NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_updated_at (updated_at),
      KEY idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function rawMysqlIdentifier(escapedIdentifier: string) {
  return escapedIdentifier.replace(/^`|`$/g, "");
}

async function hasMysqlColumn(pool: Pool, tableName: string, columnName: string) {
  const [rows] = await pool.execute<MysqlSchemaRow[]>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function hasMysqlIndex(pool: Pool, tableName: string, indexName: string) {
  const [rows] = await pool.execute<MysqlSchemaRow[]>(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return rows.length > 0;
}

async function addMysqlColumnIfMissing(pool: Pool, table: string, tableName: string, columnName: string, definition: string) {
  if (await hasMysqlColumn(pool, tableName, columnName)) return;
  await pool.query(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

async function addMysqlIndexIfMissing(pool: Pool, table: string, tableName: string, indexName: string, definition: string) {
  if (await hasMysqlIndex(pool, tableName, indexName)) return;
  await pool.query(`ALTER TABLE ${table} ADD ${definition}`);
}

async function migrateMindMapTables(pool: Pool, mindMapTable: string, snapshotTable: string, nodeTable: string) {
  const mindMapTableName = rawMysqlIdentifier(mindMapTable);
  const snapshotTableName = rawMysqlIdentifier(snapshotTable);
  const nodeTableName = rawMysqlIdentifier(nodeTable);

  await addMysqlColumnIfMissing(pool, mindMapTable, mindMapTableName, "node_count", "`node_count` INT NOT NULL DEFAULT 0 AFTER `current_snapshot_id`");
  if (await hasMysqlColumn(pool, mindMapTableName, "schema_version")) {
    await pool.query(`UPDATE ${mindMapTable} SET schema_version = 1 WHERE schema_version IS NULL`);
    await pool.query(`ALTER TABLE ${mindMapTable} MODIFY COLUMN schema_version INT NOT NULL DEFAULT 1`);
  }
  await pool.query(`ALTER TABLE ${mindMapTable} MODIFY COLUMN id VARCHAR(64) NOT NULL`);
  await pool.query(`ALTER TABLE ${mindMapTable} MODIFY COLUMN root_node_id VARCHAR(96) NOT NULL`);
  await pool.query(`ALTER TABLE ${mindMapTable} MODIFY COLUMN current_snapshot_id VARCHAR(64) NULL`);
  await addMysqlIndexIfMissing(pool, mindMapTable, mindMapTableName, "idx_course_updated", "KEY idx_course_updated (course_id, updated_at)");
  await addMysqlIndexIfMissing(pool, mindMapTable, mindMapTableName, "idx_deleted_at", "KEY idx_deleted_at (deleted_at)");

  await pool.query(`ALTER TABLE ${snapshotTable} MODIFY COLUMN id VARCHAR(64) NOT NULL`);
  await pool.query(`ALTER TABLE ${snapshotTable} MODIFY COLUMN mind_map_id VARCHAR(64) NOT NULL`);
  await addMysqlIndexIfMissing(pool, snapshotTable, snapshotTableName, "uk_map_sequence", "UNIQUE KEY uk_map_sequence (mind_map_id, sequence_no)");
  await addMysqlIndexIfMissing(pool, snapshotTable, snapshotTableName, "idx_map_created", "KEY idx_map_created (mind_map_id, created_at)");

  await addMysqlColumnIfMissing(pool, nodeTable, nodeTableName, "node_id", "`node_id` VARCHAR(96) NULL AFTER `id`");
  await addMysqlColumnIfMissing(pool, nodeTable, nodeTableName, "path_text", "`path_text` TEXT NULL AFTER `position_index`");
  await pool.query(`UPDATE ${nodeTable} SET node_id = id WHERE node_id IS NULL OR node_id = ''`);
  await pool.query(`ALTER TABLE ${nodeTable} MODIFY COLUMN id VARCHAR(180) NOT NULL`);
  await pool.query(`ALTER TABLE ${nodeTable} MODIFY COLUMN node_id VARCHAR(96) NOT NULL`);
  await pool.query(`ALTER TABLE ${nodeTable} MODIFY COLUMN mind_map_id VARCHAR(64) NOT NULL`);
  await pool.query(`ALTER TABLE ${nodeTable} MODIFY COLUMN parent_node_id VARCHAR(96) NULL`);
  await addMysqlIndexIfMissing(pool, nodeTable, nodeTableName, "uk_map_node", "UNIQUE KEY uk_map_node (mind_map_id, node_id)");
  await addMysqlIndexIfMissing(pool, nodeTable, nodeTableName, "idx_nodes_map_parent", "KEY idx_nodes_map_parent (mind_map_id, parent_node_id)");
  await addMysqlIndexIfMissing(pool, nodeTable, nodeTableName, "idx_nodes_course_title", "KEY idx_nodes_course_title (course_id, title(120))");
  await addMysqlIndexIfMissing(pool, nodeTable, nodeTableName, "idx_nodes_map_depth", "KEY idx_nodes_map_depth (mind_map_id, depth)");
}

async function ensureMindMapTables(pool: Pool, mindMapTable: string, snapshotTable: string, nodeTable: string) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${mindMapTable} (
      id VARCHAR(64) NOT NULL,
      course_id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      root_node_id VARCHAR(96) NOT NULL,
      current_snapshot_id VARCHAR(64) NULL,
      node_count INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      deleted_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_course_map (course_id, id),
      KEY idx_course_updated (course_id, updated_at),
      KEY idx_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${snapshotTable} (
      id VARCHAR(64) NOT NULL,
      mind_map_id VARCHAR(64) NOT NULL,
      sequence_no BIGINT NOT NULL,
      schema_version INT NOT NULL,
      editor VARCHAR(64) NOT NULL,
      editor_version VARCHAR(64) NULL,
      payload_json LONGTEXT NOT NULL,
      payload_hash CHAR(64) NOT NULL,
      byte_size INT NOT NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_map_sequence (mind_map_id, sequence_no),
      KEY idx_map_created (mind_map_id, created_at),
      KEY idx_payload_hash (payload_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${nodeTable} (
      id VARCHAR(180) NOT NULL,
      node_id VARCHAR(96) NOT NULL,
      mind_map_id VARCHAR(64) NOT NULL,
      course_id VARCHAR(64) NOT NULL,
      parent_node_id VARCHAR(96) NULL,
      title VARCHAR(512) NOT NULL,
      depth INT NOT NULL,
      position_index INT NOT NULL,
      path_text TEXT NULL,
      is_collapsed TINYINT(1) NOT NULL DEFAULT 0,
      updated_at DATETIME(3) NOT NULL,
      deleted_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_map_node (mind_map_id, node_id),
      KEY idx_nodes_map_parent (mind_map_id, parent_node_id),
      KEY idx_nodes_course_title (course_id, title(120)),
      KEY idx_nodes_map_depth (mind_map_id, depth),
      KEY idx_nodes_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await migrateMindMapTables(pool, mindMapTable, snapshotTable, nodeTable);
}

async function migrateKnowledgeDocumentTables(pool: Pool, documentTable: string, snapshotTable: string) {
  const documentTableName = rawMysqlIdentifier(documentTable);
  const snapshotTableName = rawMysqlIdentifier(snapshotTable);

  await addMysqlColumnIfMissing(pool, documentTable, documentTableName, "mind_map_id", "`mind_map_id` VARCHAR(64) NULL AFTER `course_id`");
  await addMysqlColumnIfMissing(pool, documentTable, documentTableName, "current_byte_size", "`current_byte_size` INT NOT NULL DEFAULT 0 AFTER `current_snapshot_id`");
  await pool.query(`UPDATE ${documentTable} SET mind_map_id = 'legacy' WHERE mind_map_id IS NULL OR mind_map_id = ''`);
  await pool.query(`ALTER TABLE ${documentTable} MODIFY COLUMN id VARCHAR(64) NOT NULL`);
  await pool.query(`ALTER TABLE ${documentTable} MODIFY COLUMN course_id VARCHAR(64) NOT NULL`);
  await pool.query(`ALTER TABLE ${documentTable} MODIFY COLUMN mind_map_id VARCHAR(64) NOT NULL`);
  await pool.query(`ALTER TABLE ${documentTable} MODIFY COLUMN node_id VARCHAR(96) NOT NULL`);
  await pool.query(`ALTER TABLE ${documentTable} MODIFY COLUMN current_snapshot_id VARCHAR(64) NULL`);
  await addMysqlIndexIfMissing(
    pool,
    documentTable,
    documentTableName,
    "uk_doc_node",
    "UNIQUE KEY uk_doc_node (course_id, mind_map_id, node_id)"
  );
  await addMysqlIndexIfMissing(
    pool,
    documentTable,
    documentTableName,
    "idx_doc_node_lookup",
    "KEY idx_doc_node_lookup (mind_map_id, node_id, deleted_at)"
  );
  await addMysqlIndexIfMissing(
    pool,
    documentTable,
    documentTableName,
    "idx_doc_course_updated",
    "KEY idx_doc_course_updated (course_id, updated_at)"
  );
  await addMysqlIndexIfMissing(
    pool,
    documentTable,
    documentTableName,
    "idx_doc_current_snapshot",
    "KEY idx_doc_current_snapshot (current_snapshot_id)"
  );
  await addMysqlIndexIfMissing(pool, documentTable, documentTableName, "idx_doc_deleted_at", "KEY idx_doc_deleted_at (deleted_at)");

  await pool.query(`ALTER TABLE ${snapshotTable} MODIFY COLUMN id VARCHAR(64) NOT NULL`);
  await pool.query(`ALTER TABLE ${snapshotTable} MODIFY COLUMN document_id VARCHAR(64) NOT NULL`);
  await addMysqlColumnIfMissing(pool, snapshotTable, snapshotTableName, "schema_version", "`schema_version` INT NOT NULL DEFAULT 1 AFTER `sequence_no`");
  await addMysqlColumnIfMissing(pool, snapshotTable, snapshotTableName, "editor", "`editor` VARCHAR(64) NOT NULL DEFAULT 'aistudy-word' AFTER `schema_version`");
  await addMysqlColumnIfMissing(pool, snapshotTable, snapshotTableName, "editor_version", "`editor_version` VARCHAR(64) NULL AFTER `editor`");
  await addMysqlColumnIfMissing(pool, snapshotTable, snapshotTableName, "payload_hash", "`payload_hash` CHAR(64) NULL AFTER `payload_json`");
  await pool.query(`UPDATE ${snapshotTable} SET payload_hash = COALESCE(SHA2(payload_json, 256), REPEAT('0', 64)) WHERE payload_hash IS NULL OR payload_hash = ''`);
  await pool.query(`ALTER TABLE ${snapshotTable} MODIFY COLUMN payload_hash CHAR(64) NOT NULL`);
  await addMysqlIndexIfMissing(
    pool,
    snapshotTable,
    snapshotTableName,
    "uk_doc_sequence",
    "UNIQUE KEY uk_doc_sequence (document_id, sequence_no)"
  );
  await addMysqlIndexIfMissing(
    pool,
    snapshotTable,
    snapshotTableName,
    "idx_doc_created",
    "KEY idx_doc_created (document_id, created_at)"
  );
  await addMysqlIndexIfMissing(pool, snapshotTable, snapshotTableName, "idx_doc_hash", "KEY idx_doc_hash (payload_hash)");
  await addMysqlIndexIfMissing(pool, snapshotTable, snapshotTableName, "idx_doc_size", "KEY idx_doc_size (byte_size)");
}

async function ensureKnowledgeDocumentTables(pool: Pool, documentTable: string, snapshotTable: string) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${documentTable} (
      id VARCHAR(64) NOT NULL,
      course_id VARCHAR(64) NOT NULL,
      mind_map_id VARCHAR(64) NOT NULL,
      node_id VARCHAR(96) NOT NULL,
      title VARCHAR(255) NOT NULL,
      current_snapshot_id VARCHAR(64) NULL,
      current_byte_size INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      deleted_at DATETIME(3) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_doc_node (course_id, mind_map_id, node_id),
      KEY idx_doc_node_lookup (mind_map_id, node_id, deleted_at),
      KEY idx_doc_course_updated (course_id, updated_at),
      KEY idx_doc_current_snapshot (current_snapshot_id),
      KEY idx_doc_deleted_at (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${snapshotTable} (
      id VARCHAR(64) NOT NULL,
      document_id VARCHAR(64) NOT NULL,
      sequence_no BIGINT NOT NULL,
      schema_version INT NOT NULL,
      editor VARCHAR(64) NOT NULL,
      editor_version VARCHAR(64) NULL,
      payload_json LONGTEXT NOT NULL,
      payload_hash CHAR(64) NOT NULL,
      byte_size INT NOT NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_doc_sequence (document_id, sequence_no),
      KEY idx_doc_created (document_id, created_at),
      KEY idx_doc_hash (payload_hash),
      KEY idx_doc_size (byte_size)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await migrateKnowledgeDocumentTables(pool, documentTable, snapshotTable);
}

async function createMysqlRuntime(): Promise<MysqlRuntime> {
  const config = await readMysqlConfig();
  try {
    await ensureDatabase(config);
  } catch (error) {
    console.warn("MySQL database check did not complete. Continuing with configured database.", error);
  }

  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4"
  });
  const courseTable = escapeMysqlIdentifier(config.courseTable, "MySQL course table");
  const mindMapTable = escapeMysqlIdentifier(config.mindMapTable, "MySQL mind map table");
  const mindMapSnapshotTable = escapeMysqlIdentifier(config.mindMapSnapshotTable, "MySQL mind map snapshot table");
  const mindMapNodeTable = escapeMysqlIdentifier(config.mindMapNodeTable, "MySQL mind map node table");
  const knowledgeDocumentTable = escapeMysqlIdentifier(config.knowledgeDocumentTable, "MySQL knowledge document table");
  const knowledgeDocumentSnapshotTable = escapeMysqlIdentifier(
    config.knowledgeDocumentSnapshotTable,
    "MySQL knowledge document snapshot table"
  );
  await ensureCourseTable(pool, courseTable);
  await ensureMindMapTables(pool, mindMapTable, mindMapSnapshotTable, mindMapNodeTable);
  await ensureKnowledgeDocumentTables(pool, knowledgeDocumentTable, knowledgeDocumentSnapshotTable);

  mysqlRuntime = {
    pool,
    courseTable,
    mindMapTable,
    mindMapSnapshotTable,
    mindMapNodeTable,
    knowledgeDocumentTable,
    knowledgeDocumentSnapshotTable
  };
  return mysqlRuntime;
}

function getMysqlRuntime() {
  if (!mysqlRuntimePromise) {
    mysqlRuntimePromise = createMysqlRuntime().catch((error) => {
      mysqlRuntimePromise = null;
      throw error;
    });
  }

  return mysqlRuntimePromise;
}

function toIsoTimestamp(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
}

function toMysqlDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findProjectRoot() {
  const candidates = [
    process.cwd(),
    path.resolve(__dirname, ".."),
    app.isPackaged ? path.resolve(process.resourcesPath, "app.asar") : app.getAppPath()
  ];

  for (const candidate of candidates) {
    if (await pathExists(path.join(candidate, ".git"))) {
      return candidate;
    }
  }

  return path.resolve(__dirname, "..");
}

async function runGit(args: string[], cwd: string) {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, windowsHide: true });
    return stdout.trim();
  } catch {
    return "";
  }
}

async function readPackageRepositoryUrl() {
  try {
    const packageJson = JSON.parse(await fs.readFile(path.join(app.getAppPath(), "package.json"), "utf8")) as {
      repository?: string | { url?: string };
    };
    if (typeof packageJson.repository === "string") {
      return packageJson.repository;
    }
    return packageJson.repository?.url ?? "";
  } catch {
    return "";
  }
}

function toRepositoryWebUrl(remoteUrl: string) {
  if (!remoteUrl) return "";
  if (remoteUrl.startsWith("git@github.com:")) {
    return `https://github.com/${remoteUrl.slice("git@github.com:".length).replace(/\.git$/, "")}`;
  }
  return remoteUrl.replace(/\.git$/, "");
}

function parseGitHubRepository(remoteUrl: string) {
  const webUrl = toRepositoryWebUrl(remoteUrl);
  const match = webUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2]
  };
}

function normalizeVersion(value: string) {
  return value.trim().replace(/^v/i, "");
}

function compareVersions(a: string, b: string) {
  const left = normalizeVersion(a).split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const right = normalizeVersion(b).split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.isFinite(left[index]) ? left[index] : 0;
    const rightPart = Number.isFinite(right[index]) ? right[index] : 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

function parseReleaseNotes(body: unknown, releaseName: string) {
  const lines = typeof body === "string" ? body.split(/\r?\n/) : [];
  const notes = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, ""))
    .filter(Boolean)
    .slice(0, 20);

  if (notes.length > 0) {
    return notes;
  }

  return releaseName ? [`发布版本 ${releaseName}`] : ["发布新版本。"];
}

function selectInstallerAsset(release: GitHubRelease) {
  const assets = Array.isArray(release.assets) ? (release.assets as GitHubReleaseAsset[]) : [];
  return (
    assets.find((asset) => typeof asset.name === "string" && /setup.*\.exe$/i.test(asset.name)) ??
    assets.find((asset) => typeof asset.name === "string" && /\.exe$/i.test(asset.name)) ??
    null
  );
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const repositoryUrl = (await runGit(["remote", "get-url", "origin"], await findProjectRoot())) || (await readPackageRepositoryUrl());
  const repository = parseGitHubRepository(repositoryUrl);
  if (!repository) {
    throw new Error("未配置有效的 GitHub 仓库地址。");
  }

  const response = await fetch(`https://api.github.com/repos/${repository.owner}/${repository.repo}/releases/latest`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "AIstudy-Updater"
    }
  });

  if (response.status === 404) {
    throw new Error("GitHub 仓库还没有可用的 Release。");
  }

  if (!response.ok) {
    throw new Error(`GitHub 更新检测失败：${response.status}`);
  }

  return await response.json() as GitHubRelease;
}

async function checkForUpdates(): Promise<UpdateCheckResult> {
  const release = await fetchLatestRelease();
  const latestVersion = normalizeVersion(typeof release.tag_name === "string" ? release.tag_name : "");
  if (!latestVersion) {
    throw new Error("最新版本号读取失败。");
  }

  const asset = selectInstallerAsset(release);
  const currentVersion = app.getVersion();
  const releaseName = typeof release.name === "string" ? release.name : `v${latestVersion}`;
  const downloadUrl = typeof asset?.browser_download_url === "string" ? asset.browser_download_url : "";

  return {
    currentVersion,
    latestVersion,
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
    releaseName,
    publishedAt: typeof release.published_at === "string" ? release.published_at : "",
    releaseUrl: typeof release.html_url === "string" ? release.html_url : "",
    notes: parseReleaseNotes(release.body, releaseName),
    assetName: typeof asset?.name === "string" ? asset.name : "",
    assetSize: typeof asset?.size === "number" ? asset.size : 0,
    downloadUrl
  };
}

async function downloadUpdate(downloadUrlValue: unknown): Promise<UpdateDownloadResult> {
  if (typeof downloadUrlValue !== "string" || !downloadUrlValue.startsWith("https://")) {
    throw new Error("下载地址不可用。");
  }

  const url = new URL(downloadUrlValue);
  const fileName = decodeURIComponent(path.basename(url.pathname)) || `AIstudy-Setup-${app.getVersion()}.exe`;
  const updateDir = path.join(app.getPath("userData"), "updates");
  const filePath = path.join(updateDir, fileName);
  await fs.mkdir(updateDir, { recursive: true });

  const response = await fetch(downloadUrlValue, {
    headers: {
      "User-Agent": "AIstudy-Updater"
    }
  });

  if (!response.ok) {
    throw new Error(`下载安装包失败：${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return {
    filePath,
    fileName,
    fileSize: buffer.byteLength
  };
}

async function installUpdate(filePathValue: unknown) {
  if (typeof filePathValue !== "string" || !filePathValue.toLowerCase().endsWith(".exe")) {
    throw new Error("安装包路径不可用。");
  }

  if (!await pathExists(filePathValue)) {
    throw new Error("安装包不存在，请重新下载。");
  }

  const result = await shell.openPath(filePathValue);
  if (result) {
    throw new Error(result);
  }

  setTimeout(() => app.quit(), 500);
  return true;
}

async function getUpdateManagerInfo(): Promise<UpdateManagerInfo> {
  const projectRoot = await findProjectRoot();
  const repositoryUrl = (await runGit(["remote", "get-url", "origin"], projectRoot)) || (await readPackageRepositoryUrl());
  const branch = await runGit(["branch", "--show-current"], projectRoot);
  const commit = await runGit(["rev-parse", "--short", "HEAD"], projectRoot);
  const status = await runGit(["status", "--porcelain"], projectRoot);
  const releaseDir = path.join(projectRoot, "release");
  const installerPath = path.join(releaseDir, `AIstudy-Setup-${app.getVersion()}.exe`);

  return {
    appVersion: app.getVersion(),
    repositoryUrl,
    repositoryWebUrl: toRepositoryWebUrl(repositoryUrl),
    branch,
    commit,
    dirty: Boolean(status),
    canUseGit: Boolean(repositoryUrl),
    updateIndexPath: path.join(projectRoot, "docs", "updates", "INDEX.md"),
    releaseDir,
    installerPath
  };
}

async function readCourseStore(): Promise<CourseStore> {
  const { pool, courseTable } = await getMysqlRuntime();
  const [rows] = await pool.execute<CourseRow[]>(
    `SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt
     FROM ${courseTable}
     ORDER BY updated_at DESC`
  );
  const courses = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: toIsoTimestamp(row.createdAt),
    updatedAt: toIsoTimestamp(row.updatedAt)
  }));

  return { courses, activeCourseId: courses[0]?.id ?? null };
}

async function replaceCourseRows(connection: PoolConnection, courseTable: string, courses: CourseRecord[]) {
  if (courses.length === 0) {
    await connection.execute(`DELETE FROM ${courseTable}`);
    return;
  }

  const ids = courses.map((course) => course.id);
  await connection.execute(`DELETE FROM ${courseTable} WHERE id NOT IN (${ids.map(() => "?").join(", ")})`, ids);

  const sql = `
    INSERT INTO ${courseTable} (id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      description = VALUES(description),
      created_at = VALUES(created_at),
      updated_at = VALUES(updated_at)
  `;

  for (const course of courses) {
    await connection.execute(sql, [
      course.id,
      course.name,
      course.description,
      toMysqlDate(course.createdAt),
      toMysqlDate(course.updatedAt)
    ]);
  }
}

async function writeCourseStore(store: CourseStore) {
  const normalized = normalizeCourseStore(store);
  const { pool, courseTable } = await getMysqlRuntime();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await replaceCourseRows(connection, courseTable, normalized.courses);
    await connection.commit();
    return normalized;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function getNonEmptyString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeId(value: unknown, label: string, fallback?: string) {
  const text = getNonEmptyString(value, fallback);
  if (!text || text.length > 64 || !/^[A-Za-z0-9:_-]+$/.test(text)) {
    throw new Error(`${label} is invalid.`);
  }
  return text;
}

function normalizeNodeScopedId(value: unknown, label: string) {
  const text = getNonEmptyString(value);
  if (!text || text.length > 96 || !/^[A-Za-z0-9:_-]+$/.test(text)) {
    throw new Error(`${label} is invalid.`);
  }
  return text;
}

function createEntityId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

function createSnapshotPayloadJson<T extends { updatedAt: string }>(snapshot: T, updatedAt: string) {
  return JSON.stringify({ ...snapshot, updatedAt });
}

function createSnapshotContentHash<T extends { updatedAt: string }>(snapshot: T) {
  return createHash("sha256").update(JSON.stringify({ ...snapshot, updatedAt: "" })).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeMindMapSnapshot(value: unknown): MindMapSnapshot {
  if (!isRecord(value)) {
    throw new Error("Mind map snapshot must be an object.");
  }

  const root = value.root;
  if (!isRecord(root)) {
    throw new Error("Mind map snapshot root is missing.");
  }

  if (value.schemaVersion !== 1 || value.editor !== "simple-mind-map") {
    throw new Error("Unsupported mind map snapshot format.");
  }

  return {
    schemaVersion: 1,
    editor: "simple-mind-map",
    editorVersion: getNonEmptyString(value.editorVersion, "unknown"),
    root,
    layout: getNonEmptyString(value.layout, "mindMap"),
    theme: value.theme,
    view: value.view,
    updatedAt: getNonEmptyString(value.updatedAt, new Date().toISOString())
  };
}

function normalizeMindMapSaveRequest(value: unknown): MindMapSaveRequest & { courseId: string; snapshot: MindMapSnapshot } {
  if (!isRecord(value)) {
    throw new Error("Mind map save request must be an object.");
  }

  return {
    courseId: normalizeId(value.courseId, "Course id"),
    mapId: value.mapId === undefined || value.mapId === null || value.mapId === "" ? undefined : normalizeId(value.mapId, "Mind map id"),
    title: getNonEmptyString(value.title).slice(0, 255) || undefined,
    snapshot: normalizeMindMapSnapshot(value.snapshot)
  };
}

function readNodeData(node: SimpleMindMapNode) {
  return isRecord(node.data) ? node.data : {};
}

function readNodeChildren(node: SimpleMindMapNode) {
  return Array.isArray(node.children) ? node.children.filter(isRecord) as SimpleMindMapNode[] : [];
}

function getNodeTitle(node: SimpleMindMapNode, fallback: string) {
  const text = readNodeData(node).text;
  return getNonEmptyString(text, fallback).slice(0, 512);
}

function getNodeId(node: SimpleMindMapNode, pathKey: string) {
  const uid = getNonEmptyString(readNodeData(node).uid);
  if (uid && uid.length <= 96 && /^[A-Za-z0-9:_-]+$/.test(uid)) {
    return uid;
  }

  if (uid) {
    return createHash("sha256").update(uid).digest("hex").slice(0, 32);
  }

  return pathKey.slice(0, 96);
}

function flattenMindMapNodes(
  node: SimpleMindMapNode,
  parentNodeId: string | null,
  depth: number,
  positionIndex: number,
  pathKey: string,
  titlePath: string[]
): MindMapProjectionNode[] {
  const title = getNodeTitle(node, depth === 0 ? "Central topic" : "Untitled");
  const nodeId = getNodeId(node, pathKey || "root");
  const nextTitlePath = [...titlePath, title];
  const current: MindMapProjectionNode = {
    nodeId,
    parentNodeId,
    title,
    depth,
    positionIndex,
    pathText: nextTitlePath.join(" / "),
    isCollapsed: readNodeData(node).expand === false
  };

  const children = readNodeChildren(node);
  return [
    current,
    ...children.flatMap((child, index) =>
      flattenMindMapNodes(child, nodeId, depth + 1, index, `${pathKey || "root"}.${index}`, nextTitlePath)
    )
  ];
}

async function findMindMapByCourse(
  connection: PoolConnection | Pool,
  mindMapTable: string,
  courseId: string,
  forUpdate = false
) {
  const [rows] = await connection.execute<MindMapRow[]>(
    `SELECT id, course_id AS courseId, title, current_snapshot_id AS currentSnapshotId,
            node_count AS nodeCount, updated_at AS updatedAt
     FROM ${mindMapTable}
     WHERE course_id = ? AND deleted_at IS NULL
     ORDER BY updated_at DESC
     LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [courseId]
  );
  return rows[0] ?? null;
}

async function findMindMapById(
  connection: PoolConnection | Pool,
  mindMapTable: string,
  courseId: string,
  mapId: string,
  forUpdate = false
) {
  const [rows] = await connection.execute<MindMapRow[]>(
    `SELECT id, course_id AS courseId, title, current_snapshot_id AS currentSnapshotId,
            node_count AS nodeCount, updated_at AS updatedAt
     FROM ${mindMapTable}
     WHERE course_id = ? AND id = ? AND deleted_at IS NULL
     LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [courseId, mapId]
  );
  return rows[0] ?? null;
}

async function readSnapshotMeta(
  connection: PoolConnection | Pool,
  snapshotTable: string,
  snapshotId: string,
  ownerColumn: "mind_map_id" | "document_id",
  ownerId: string
) {
  const [rows] = await connection.execute<SnapshotMetaRow[]>(
    `SELECT id, payload_hash AS payloadHash, payload_json AS payloadJson, byte_size AS byteSize
     FROM ${snapshotTable}
     WHERE id = ? AND ${ownerColumn} = ?
     LIMIT 1`,
    [snapshotId, ownerId]
  );
  return rows[0] ?? null;
}

async function pruneOldSnapshots(
  connection: PoolConnection,
  snapshotTable: string,
  ownerColumn: "mind_map_id" | "document_id",
  ownerId: string,
  keepLimit: number
) {
  await connection.execute(
    `DELETE FROM ${snapshotTable}
     WHERE ${ownerColumn} = ?
       AND id NOT IN (
         SELECT id FROM (
           SELECT id
           FROM ${snapshotTable}
           WHERE ${ownerColumn} = ?
           ORDER BY sequence_no DESC
           LIMIT ${keepLimit}
         ) AS retained_snapshots
       )`,
    [ownerId, ownerId]
  );
}

async function readMindMapDocument(courseIdValue: unknown): Promise<MindMapDocument | null> {
  const courseId = normalizeId(courseIdValue, "Course id");
  const { pool, mindMapTable, mindMapSnapshotTable } = await getMysqlRuntime();
  const map = await findMindMapByCourse(pool, mindMapTable, courseId);
  if (!map) return null;

  let snapshot: MindMapSnapshot | null = null;
  if (map.currentSnapshotId) {
    const [rows] = await pool.execute<MindMapSnapshotRow[]>(
      `SELECT payload_json AS payloadJson
       FROM ${mindMapSnapshotTable}
       WHERE id = ? AND mind_map_id = ?
       LIMIT 1`,
      [map.currentSnapshotId, map.id]
    );
    if (rows[0]?.payloadJson) {
      snapshot = normalizeMindMapSnapshot(JSON.parse(rows[0].payloadJson));
    }
  }

  return {
    courseId,
    mapId: map.id,
    title: map.title,
    snapshot,
    updatedAt: toIsoTimestamp(map.updatedAt),
    nodeCount: Number(map.nodeCount) || 0
  };
}

async function getNextMindMapSequence(connection: PoolConnection, snapshotTable: string, mindMapId: string) {
  const [rows] = await connection.execute<MindMapSequenceRow[]>(
    `SELECT COALESCE(MAX(sequence_no), 0) + 1 AS nextSequence
     FROM ${snapshotTable}
     WHERE mind_map_id = ?
     FOR UPDATE`,
    [mindMapId]
  );
  const nextSequence = Number(rows[0]?.nextSequence ?? 1);
  return Number.isFinite(nextSequence) && nextSequence > 0 ? nextSequence : 1;
}

async function upsertMindMapNodes(
  connection: PoolConnection,
  nodeTable: string,
  courseId: string,
  mindMapId: string,
  nodes: MindMapProjectionNode[],
  updatedAt: Date
) {
  await connection.execute(`UPDATE ${nodeTable} SET deleted_at = ? WHERE mind_map_id = ? AND deleted_at IS NULL`, [updatedAt, mindMapId]);

  const sql = `
    INSERT INTO ${nodeTable}
      (id, node_id, mind_map_id, course_id, parent_node_id, title, depth, position_index, path_text, is_collapsed, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON DUPLICATE KEY UPDATE
      parent_node_id = VALUES(parent_node_id),
      title = VALUES(title),
      depth = VALUES(depth),
      position_index = VALUES(position_index),
      path_text = VALUES(path_text),
      is_collapsed = VALUES(is_collapsed),
      updated_at = VALUES(updated_at),
      deleted_at = NULL
  `;

  for (const node of nodes) {
    await connection.execute(sql, [
      `${mindMapId}:${node.nodeId}`,
      node.nodeId,
      mindMapId,
      courseId,
      node.parentNodeId,
      node.title,
      node.depth,
      node.positionIndex,
      node.pathText,
      node.isCollapsed ? 1 : 0,
      updatedAt
    ]);
  }
}

async function softDeleteKnowledgeDocumentsForMissingNodes(
  connection: PoolConnection,
  documentTable: string,
  courseId: string,
  mindMapId: string,
  nodeIds: string[],
  updatedAt: Date
) {
  if (nodeIds.length === 0) return;
  const placeholders = nodeIds.map(() => "?").join(", ");
  await connection.execute(
    `UPDATE ${documentTable}
     SET deleted_at = ?, updated_at = ?
     WHERE course_id = ?
       AND mind_map_id = ?
       AND deleted_at IS NULL
       AND node_id NOT IN (${placeholders})`,
    [updatedAt, updatedAt, courseId, mindMapId, ...nodeIds]
  );
}

async function writeMindMapDocument(input: unknown): Promise<MindMapDocument> {
  const request = normalizeMindMapSaveRequest(input);
  const { pool, mindMapTable, mindMapSnapshotTable, mindMapNodeTable, knowledgeDocumentTable } = await getMysqlRuntime();
  const connection = await pool.getConnection();
  const now = new Date();
  const updatedAt = now.toISOString();

  try {
    await connection.beginTransaction();

    const existing = request.mapId
      ? await findMindMapById(connection, mindMapTable, request.courseId, request.mapId, true)
      : await findMindMapByCourse(connection, mindMapTable, request.courseId, true);
    const mapId = request.mapId ?? existing?.id ?? createEntityId("mindmap");
    const title = (request.title || getNodeTitle(request.snapshot.root, "Mind map")).slice(0, 255);
    const nodes = flattenMindMapNodes(request.snapshot.root, null, 0, 0, "root", []);
    const rootNodeId = nodes[0]?.nodeId ?? "root";
    const payloadJson = createSnapshotPayloadJson(request.snapshot, updatedAt);
    const payloadHash = createSnapshotContentHash(request.snapshot);
    const byteSize = Buffer.byteLength(payloadJson, "utf8");

    const currentSnapshotMeta = existing?.currentSnapshotId
      ? await readSnapshotMeta(connection, mindMapSnapshotTable, existing.currentSnapshotId, "mind_map_id", mapId)
      : null;
    const shouldReuseSnapshot = currentSnapshotMeta?.payloadHash === payloadHash;
    const snapshotId = shouldReuseSnapshot && existing?.currentSnapshotId ? existing.currentSnapshotId : createEntityId("mmsnap");

    await connection.execute(
      `INSERT INTO ${mindMapTable}
        (id, course_id, title, root_node_id, current_snapshot_id, node_count, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE
        course_id = VALUES(course_id),
        title = VALUES(title),
        root_node_id = VALUES(root_node_id),
        current_snapshot_id = VALUES(current_snapshot_id),
        node_count = VALUES(node_count),
        updated_at = VALUES(updated_at),
        deleted_at = NULL`,
      [mapId, request.courseId, title, rootNodeId, snapshotId, nodes.length, now, now]
    );

    if (!shouldReuseSnapshot) {
      const sequenceNo = await getNextMindMapSequence(connection, mindMapSnapshotTable, mapId);
      await connection.execute(
        `INSERT INTO ${mindMapSnapshotTable}
          (id, mind_map_id, sequence_no, schema_version, editor, editor_version, payload_json, payload_hash, byte_size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          snapshotId,
          mapId,
          sequenceNo,
          request.snapshot.schemaVersion,
          request.snapshot.editor,
          request.snapshot.editorVersion,
          payloadJson,
          payloadHash,
          byteSize,
          now
        ]
      );
      await pruneOldSnapshots(connection, mindMapSnapshotTable, "mind_map_id", mapId, MIND_MAP_SNAPSHOT_RETENTION_LIMIT);
    }

    await upsertMindMapNodes(connection, mindMapNodeTable, request.courseId, mapId, nodes, now);
    await softDeleteKnowledgeDocumentsForMissingNodes(
      connection,
      knowledgeDocumentTable,
      request.courseId,
      mapId,
      nodes.map((node) => node.nodeId),
      now
    );
    await connection.commit();

    return {
      courseId: request.courseId,
      mapId,
      title,
      snapshot: JSON.parse(payloadJson) as MindMapSnapshot,
      updatedAt,
      nodeCount: nodes.length
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function normalizeKnowledgeDocumentSnapshot(value: unknown): KnowledgeDocumentSnapshot {
  if (!isRecord(value)) {
    throw new Error("Knowledge document snapshot must be an object.");
  }

  if (value.schemaVersion !== 1 || value.editor !== "aistudy-word") {
    throw new Error("Unsupported knowledge document snapshot format.");
  }

  return {
    schemaVersion: 1,
    editor: "aistudy-word",
    editorVersion: getNonEmptyString(value.editorVersion, "unknown"),
    content: value.content ?? null,
    updatedAt: getNonEmptyString(value.updatedAt, new Date().toISOString())
  };
}

function normalizeKnowledgeDocumentNodeRequest(value: unknown): KnowledgeDocumentNodeRequest {
  if (!isRecord(value)) {
    throw new Error("Knowledge document request must be an object.");
  }

  return {
    courseId: normalizeId(value.courseId, "Course id"),
    mindMapId: normalizeId(value.mindMapId, "Mind map id"),
    nodeId: normalizeNodeScopedId(value.nodeId, "Mind map node id")
  };
}

function normalizeKnowledgeDocumentSaveRequest(
  value: unknown
): KnowledgeDocumentSaveRequest & { snapshot: KnowledgeDocumentSnapshot } {
  const request = normalizeKnowledgeDocumentNodeRequest(value);
  const record = value as Record<string, unknown>;
  return {
    ...request,
    title: getNonEmptyString(record.title).slice(0, 255) || undefined,
    snapshot: normalizeKnowledgeDocumentSnapshot(record.snapshot)
  };
}

async function findKnowledgeDocumentByNode(
  connection: PoolConnection | Pool,
  documentTable: string,
  request: KnowledgeDocumentNodeRequest,
  forUpdate = false,
  includeDeleted = false
) {
  const [rows] = await connection.execute<KnowledgeDocumentRow[]>(
    `SELECT id, course_id AS courseId, mind_map_id AS mindMapId, node_id AS nodeId, title,
            current_snapshot_id AS currentSnapshotId, current_byte_size AS currentByteSize,
            updated_at AS updatedAt
     FROM ${documentTable}
     WHERE course_id = ? AND mind_map_id = ? AND node_id = ?${includeDeleted ? "" : " AND deleted_at IS NULL"}
     LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
    [request.courseId, request.mindMapId, request.nodeId]
  );
  return rows[0] ?? null;
}

async function assertMindMapNodeExists(
  connection: PoolConnection,
  nodeTable: string,
  request: KnowledgeDocumentNodeRequest
) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT node_id
     FROM ${nodeTable}
     WHERE course_id = ? AND mind_map_id = ? AND node_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [request.courseId, request.mindMapId, request.nodeId]
  );
  if (!rows[0]) {
    throw new Error("Mind map node is missing. Save the mind map before writing node details.");
  }
}

async function getNextKnowledgeDocumentSequence(connection: PoolConnection, snapshotTable: string, documentId: string) {
  const [rows] = await connection.execute<KnowledgeDocumentSequenceRow[]>(
    `SELECT COALESCE(MAX(sequence_no), 0) + 1 AS nextSequence
     FROM ${snapshotTable}
     WHERE document_id = ?
     FOR UPDATE`,
    [documentId]
  );
  const nextSequence = Number(rows[0]?.nextSequence ?? 1);
  return Number.isFinite(nextSequence) && nextSequence > 0 ? nextSequence : 1;
}

async function readKnowledgeDocument(input: unknown): Promise<KnowledgeDocument | null> {
  const request = normalizeKnowledgeDocumentNodeRequest(input);
  const { pool, knowledgeDocumentTable, knowledgeDocumentSnapshotTable } = await getMysqlRuntime();
  const document = await findKnowledgeDocumentByNode(pool, knowledgeDocumentTable, request);
  if (!document) return null;

  let snapshot: KnowledgeDocumentSnapshot | null = null;
  if (document.currentSnapshotId) {
    const [rows] = await pool.execute<KnowledgeDocumentSnapshotRow[]>(
      `SELECT payload_json AS payloadJson, byte_size AS byteSize
       FROM ${knowledgeDocumentSnapshotTable}
       WHERE id = ? AND document_id = ?
       LIMIT 1`,
      [document.currentSnapshotId, document.id]
    );
    if (rows[0]?.payloadJson) {
      snapshot = normalizeKnowledgeDocumentSnapshot(JSON.parse(rows[0].payloadJson));
    }
  }

  return {
    courseId: request.courseId,
    mindMapId: request.mindMapId,
    nodeId: request.nodeId,
    documentId: document.id,
    title: document.title,
    snapshot,
    updatedAt: toIsoTimestamp(document.updatedAt),
    byteSize: Number(document.currentByteSize) || 0
  };
}

async function writeKnowledgeDocument(input: unknown): Promise<KnowledgeDocument> {
  const request = normalizeKnowledgeDocumentSaveRequest(input);
  const { pool, mindMapNodeTable, knowledgeDocumentTable, knowledgeDocumentSnapshotTable } = await getMysqlRuntime();
  const connection = await pool.getConnection();
  const now = new Date();
  const updatedAt = now.toISOString();

  try {
    await connection.beginTransaction();
    await assertMindMapNodeExists(connection, mindMapNodeTable, request);

    const existing = await findKnowledgeDocumentByNode(connection, knowledgeDocumentTable, request, true, true);
    const documentId = existing?.id ?? createEntityId("kdoc");
    const title = (request.title || existing?.title || "未命名文档").slice(0, 255);
    const payloadJson = createSnapshotPayloadJson(request.snapshot, updatedAt);
    const payloadHash = createSnapshotContentHash(request.snapshot);
    const byteSize = Buffer.byteLength(payloadJson, "utf8");

    const currentSnapshotMeta = existing?.currentSnapshotId
      ? await readSnapshotMeta(connection, knowledgeDocumentSnapshotTable, existing.currentSnapshotId, "document_id", documentId)
      : null;
    const shouldReuseSnapshot = currentSnapshotMeta?.payloadHash === payloadHash;
    const snapshotId = shouldReuseSnapshot && existing?.currentSnapshotId ? existing.currentSnapshotId : createEntityId("kdocsnap");

    await connection.execute(
      `INSERT INTO ${knowledgeDocumentTable}
        (id, course_id, mind_map_id, node_id, title, current_snapshot_id, current_byte_size, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        current_snapshot_id = VALUES(current_snapshot_id),
        current_byte_size = VALUES(current_byte_size),
        updated_at = VALUES(updated_at),
        deleted_at = NULL`,
      [
        documentId,
        request.courseId,
        request.mindMapId,
        request.nodeId,
        title,
        snapshotId,
        byteSize,
        now,
        now
      ]
    );

    if (!shouldReuseSnapshot) {
      const sequenceNo = await getNextKnowledgeDocumentSequence(connection, knowledgeDocumentSnapshotTable, documentId);
      await connection.execute(
        `INSERT INTO ${knowledgeDocumentSnapshotTable}
          (id, document_id, sequence_no, schema_version, editor, editor_version, payload_json, payload_hash, byte_size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          snapshotId,
          documentId,
          sequenceNo,
          request.snapshot.schemaVersion,
          request.snapshot.editor,
          request.snapshot.editorVersion,
          payloadJson,
          payloadHash,
          byteSize,
          now
        ]
      );
      await pruneOldSnapshots(
        connection,
        knowledgeDocumentSnapshotTable,
        "document_id",
        documentId,
        KNOWLEDGE_DOCUMENT_SNAPSHOT_RETENTION_LIMIT
      );
    }

    await connection.commit();

    return {
      courseId: request.courseId,
      mindMapId: request.mindMapId,
      nodeId: request.nodeId,
      documentId,
      title,
      snapshot: JSON.parse(payloadJson) as KnowledgeDocumentSnapshot,
      updatedAt,
      byteSize
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 820,
    minWidth: 1080,
    minHeight: 680,
    frame: true,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#f4f6f8",
    title: "AIstudy",
    icon: path.join(__dirname, "../build/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  let canCloseAfterDrain = false;
  let isDrainingBeforeClose = false;

  mainWindow.on("close", (event) => {
    const window = mainWindow;
    if (canCloseAfterDrain || !window || window.webContents.isDestroyed()) return;

    event.preventDefault();
    if (isDrainingBeforeClose) return;

    isDrainingBeforeClose = true;
    requestRendererBeforeCloseDrain(window).finally(() => {
      canCloseAfterDrain = true;
      if (!window.isDestroyed()) {
        window.close();
      }
    });
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDev) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  void mysqlRuntime?.pool.end();
});

ipcMain.handle("window:minimize", (event) => {
  getEventWindow(event)?.minimize();
});

ipcMain.handle("window:toggle-maximize", (event) => {
  const window = getEventWindow(event);
  if (!window) return;
  if (window.isMaximized()) {
    window.unmaximize();
  } else {
    window.maximize();
  }
});

ipcMain.handle("window:close", (event) => {
  getEventWindow(event)?.close();
});

ipcMain.handle("app:before-close-complete", (_event, token: unknown) => {
  if (typeof token !== "string") return false;
  const resolve = beforeCloseResolvers.get(token);
  if (!resolve) return false;
  beforeCloseResolvers.delete(token);
  resolve();
  return true;
});

ipcMain.handle("courses:load", () => readCourseStore());

ipcMain.handle("courses:save", (_event, store: CourseStore) => writeCourseStore(store));

ipcMain.handle("mindmaps:load", (_event, courseId: unknown) => readMindMapDocument(courseId));

ipcMain.handle("mindmaps:save", (_event, request: unknown) => writeMindMapDocument(request));

ipcMain.handle("knowledge-documents:load", (_event, request: unknown) => readKnowledgeDocument(request));

ipcMain.handle("knowledge-documents:save", (_event, request: unknown) => writeKnowledgeDocument(request));

ipcMain.handle("chrome-ports:status", () => getChromePortStatuses());

ipcMain.handle("chrome-ports:open-login", (_event, platformId: unknown) => openChromePortLogin(platformId));

ipcMain.handle("ai-chat:send", async (_event, request: unknown) => {
  try {
    return await sendAiChat(request);
  } catch (error) {
    const provider = request && typeof request === "object" && (request as AiChatRequest).provider === "chatgpt" ? "chatgpt" : "doubao";
    return {
      ok: false,
      provider,
      reply: "",
      error: error instanceof Error ? error.message : "AI 聊天请求失败"
    } satisfies AiChatResult;
  }
});

ipcMain.handle("updates:info", () => getUpdateManagerInfo());

ipcMain.handle("updates:open-repository", async () => {
  const info = await getUpdateManagerInfo();
  if (!info.repositoryWebUrl) return false;
  await shell.openExternal(info.repositoryWebUrl);
  return true;
});

ipcMain.handle("updates:open-index", async () => {
  const info = await getUpdateManagerInfo();
  await shell.openPath(info.updateIndexPath);
});

ipcMain.handle("updates:open-release-dir", async () => {
  const info = await getUpdateManagerInfo();
  await shell.openPath(info.releaseDir);
});

ipcMain.handle("updates:check", () => checkForUpdates());

ipcMain.handle("updates:download", (_event, downloadUrl: unknown) => downloadUpdate(downloadUrl));

ipcMain.handle("updates:install", (_event, filePath: unknown) => installUpdate(filePath));

ipcMain.handle("updates:open-release-page", async (_event, releaseUrl: unknown) => {
  if (typeof releaseUrl !== "string" || !releaseUrl.startsWith("https://")) return false;
  await shell.openExternal(releaseUrl);
  return true;
});
