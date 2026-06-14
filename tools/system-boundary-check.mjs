import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

function note(message) {
  notes.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

const packageJson = JSON.parse(read("package.json"));
const updateLogText = read("src/updateLog.ts");
const preloadText = read("electron/preload.ts");
const mainProcessText = read("electron/main.ts");
const rendererText = read("src/main.tsx");

const releaseLikeDirectories = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^release-.+/.test(entry.name))
  .map((entry) => entry.name);

if (releaseLikeDirectories.length > 0) {
  fail(`Found obsolete side release directories: ${releaseLikeDirectories.join(", ")}`);
} else {
  note("Only the default release directory is present.");
}

if (!exists("release/win-unpacked/AIstudy.exe")) {
  fail("Default release executable is missing: release/win-unpacked/AIstudy.exe");
}

if (exists(".claude-content-sandbox")) {
  fail("Old Claude content sandbox still exists: .claude-content-sandbox");
}

if (exists("scripts/code-lock.ps1") || exists("scripts/prepare-claude-sandbox.ps1")) {
  fail("Old code-lock or Claude sandbox script still exists.");
}

const forbiddenScripts = ["code:lock", "code:unlock", "code:lock:status", "claude:sandbox:prepare"];
const presentForbiddenScripts = forbiddenScripts.filter((scriptName) => packageJson.scripts?.[scriptName]);
if (presentForbiddenScripts.length > 0) {
  fail(`Forbidden package scripts are still present: ${presentForbiddenScripts.join(", ")}`);
}

const latestVersionMatch = updateLogText.match(/version:\s*"([^"]+)"/);
if (!latestVersionMatch) {
  fail("Cannot read latest version from src/updateLog.ts");
} else if (latestVersionMatch[1] !== packageJson.version) {
  fail(`package.json version ${packageJson.version} does not match latest updateLog version ${latestVersionMatch[1]}`);
} else {
  note(`Version is synchronized at ${packageJson.version}.`);
}

for (const requiredDoc of ["README.md", "PROJECT_INDEX.md", "docs/system-feature-relations.md"]) {
  if (!exists(requiredDoc)) fail(`Missing required system document: ${requiredDoc}`);
}

const requiredIpcPairs = [
  ["courses.load", "courses:load"],
  ["courses.save", "courses:save"],
  ["developerDocuments.load", "developer-documents:load"],
  ["developerDocuments.save", "developer-documents:save"],
  ["ai.chat", "ai:chat"],
  ["ai.systemContext", "ai:system-context"],
  ["ports.status", "ports:status"],
  ["ports.openLoginWindow", "ports:open-login-window"],
  ["ports.startService", "ports:start-service"],
  ["aiDaily.latest", "ai-daily:latest"],
  ["aiDaily.run", "ai-daily:run"],
  ["updates.status", "updates:status"],
  ["updates.check", "updates:check"],
  ["updates.download", "updates:download"],
  ["updates.install", "updates:install"],
  ["mcp.notionImportStatus", "mcp:notion-import-status"]
];

for (const [preloadMarker, ipcChannel] of requiredIpcPairs) {
  const preloadKey = preloadMarker.split(".").at(-1);
  if (!preloadText.includes(preloadKey)) {
    fail(`Preload API marker is missing: ${preloadMarker}`);
  }
  if (!mainProcessText.includes(`"${ipcChannel}"`)) {
    fail(`Main process IPC handler is missing: ${ipcChannel}`);
  }
}

for (const marker of [
  "courseCollectionIndex",
  "coursesStorageKey",
  "developerDocumentsStorageKey",
  "CourseDetail",
  "MindMapEditor",
  "knowledgePoints",
  "knowledgeDocuments",
  "branchMindMaps"
]) {
  if (!rendererText.includes(marker)) {
    fail(`Renderer shared workspace marker is missing: ${marker}`);
  }
}

if (!mainProcessText.includes("databaseCollectionIndex")) {
  fail("Main process database collection index is missing.");
}

if (!mainProcessText.includes("developer_documents")) {
  fail("Developer platform MySQL table mapping is missing.");
}

if (!mainProcessText.includes("courses.json") || !mainProcessText.includes("developer-documents.json")) {
  fail("Collection JSON database paths are incomplete.");
}

if (failures.length > 0) {
  console.error("AIstudy system boundary check failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log("AIstudy system boundary check passed.");
  notes.forEach((message) => console.log(`- ${message}`));
}
