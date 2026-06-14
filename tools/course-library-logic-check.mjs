import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const failures = [];
const notes = [];

const generatedBranchMarker = 'data-aistudy-auto-branch-outline="true"';
const insertedBranchClass = "knowledge-branch-map";
const testCourseId = "1b97e2b7-2541-447c-9923-9f3b0e1516d1";
const courseLogicNodeId = "842cf575-784e-4fe8-bce5-199d025b0d84";
const courseLogicReferencePath = "docs/course-library-core-logic.md";

const implementationRules = [
  {
    label: "single mind-map tree builds the outline",
    file: "src/domain/mindMap.ts",
    markers: ["export function buildOutline(data: MindElixirData)", "walk(data.nodeData.children, 0, data.nodeData.id)"]
  },
  {
    label: "knowledge point and note are keyed by selected node id",
    file: "src/main.tsx",
    markers: ["knowledgePoints[activePageId]", "knowledgeDocuments[activePageId]"]
  },
  {
    label: "course state writes are centralized behind state patch helpers",
    file: "src/domain/courseState.ts",
    markers: [
      "export function createMindMapStatePatch",
      "export function createBranchMindMapStatePatch",
      "export function createKnowledgePointStatePatch",
      "export function reconcileCourseState"
    ]
  },
  {
    label: "course detail writes use centralized state patch helpers",
    file: "src/main.tsx",
    markers: [
      "createMindMapStatePatch(currentCourse, mindMap)",
      "createBranchMindMapStatePatch(currentCourse, nodeId, mindMap)",
      "createKnowledgePointStatePatch(currentCourse, nodeId, content)"
    ]
  },
  {
    label: "course outline, knowledge page, and mind-map node relations are centralized",
    file: "src/domain/courseRelations.ts",
    markers: [
      "export function isKnowledgePageSelectable",
      "export function getAdjacentKnowledgePageIds",
      "export function findFirstSelectableDescendant",
      "export function isOutlineDescendant"
    ]
  },
  {
    label: "course workspace uses centralized relation helpers",
    file: "src/main.tsx",
    markers: [
      "getKnowledgeContentPageIds(outline, outlineParentIds, hideParentKnowledgePages, knowledgePoints, knowledgeDocuments)",
      "getAdjacentKnowledgePageIds(outline, activePageId, knowledgeContentPageIds)",
      "findNearestContentAncestor(outline, activePageId, pageHasKnowledgeContent)"
    ]
  },
  {
    label: "course outline UI is isolated from workspace state logic",
    file: "src/components/CourseOutlinePanel.tsx",
    markers: [
      "export function CourseOutlinePanel",
      "visibleOutline.map",
      "toggleOutlineCollapse(item.id)"
    ]
  },
  {
    label: "course workspace renders the isolated outline panel",
    file: "src/main.tsx",
    markers: [
      "<CourseOutlinePanel",
      "visibleOutline={visibleOutline}",
      "focusOutlineNode={focusOutlineNode}"
    ]
  },
  {
    label: "branch mind-map sync rules are isolated from workspace UI",
    file: "src/domain/courseBranchSync.ts",
    markers: [
      "export function getBranchMindDataForNode",
      "export function getDescendantBranchMindMapUpdates",
      "export function getPersistingBranchCanvasId",
      "export function applyBranchToMainMindMap"
    ]
  },
  {
    label: "course workspace delegates branch sync decisions",
    file: "src/main.tsx",
    markers: [
      "getBranchMindDataForNode(",
      "getDescendantBranchMindMapUpdates(",
      "resolvePersistingBranchCanvasId("
    ]
  },
  {
    label: "mind-map outline clicks open any non-root node as a local branch",
    file: "src/main.tsx",
    markers: [
      'mode === "mindmap"',
      "id !== mainMindDataRef.current.nodeData.id",
      "if (!openIsolatedBranchMindMap(id, !upstreamBranchIsolationRef.current))"
    ]
  },
  {
    label: "parent nodes can show a temporary child outline",
    file: "src/main.tsx",
    markers: ["shouldShowAutoBranchOutline", "renderCanvasMindBranchHtml(activeBranchNode)", "isAutoOutline"]
  },
  {
    label: "temporary child outline is machine-marked instead of guessed from user text",
    file: "src/main.tsx",
    markers: [generatedBranchMarker, "looksLikeGeneratedBranchOutline(canvasDocument)"]
  },
  {
    label: "branch mind maps persist only to the active branch root",
    file: "src/domain/courseBranchSync.ts",
    markers: ["activeBranchCanvasId && activeBranchCanvasId === canvasRootId", "canvasRootId !== mainMindMap.nodeData.id"]
  },
  {
    label: "stale branch caches are rejected before reuse",
    file: "src/domain/courseBranchSync.ts",
    markers: ["isBranchMindMapFresh(mainMindMap, nodeId, storedBranch)", "staleBranchId: nodeId"]
  },
  {
    label: "manual outline collapse has priority over auto focus",
    file: "src/main.tsx",
    markers: ["manualCollapseGuardRef", "if (collapseGuardActive) return"]
  },
  {
    label: "numbered outline snapshot cannot rewrite high-level parent or depth",
    file: "src/domain/mindMap.ts",
    markers: ["outlineDirectoryFreezeDepth", "if (item.depth < outlineDirectoryFreezeDepth) return item"]
  }
];

const forbiddenDirectCoursePatchMarkers = [
  "onUpdateCourse(course.id, { mindMap })",
  "onUpdateCourse(course.id, { syncNumberedOutline, numberedOutlineSnapshot })",
  "onUpdateCourse(course.id, { collapsedOutlineIds })",
  "onUpdateCourse(course.id, { hideParentKnowledgePages })",
  "[nodeId]: content",
  "[nodeId]: document"
];

function fail(message) {
  failures.push(message);
}

function note(message) {
  notes.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function countNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((sum, child) => sum + countNodes(child), 0);
}

function collectText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectText).join(" ");
  if (!value || typeof value !== "object") return "";
  return Object.values(value).map(collectText).join(" ");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function documentText(document) {
  return `${stripHtml(document?.html)} ${collectText(document?.data?.main)}`.replace(/\s+/g, " ").trim();
}

function normalizeContractText(value) {
  return stripHtml(value)
    .replace(/[`*_#>-]/g, " ")
    .replace(/[，。；：、,.():（）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractReferenceRules(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => normalizeContractText(line.slice(2)))
    .filter(Boolean);
}

function isGeneratedBranchOutline(value) {
  const html = typeof value === "string" ? value : String(value?.html || "");
  return (
    html.includes(generatedBranchMarker) ||
    html.includes(insertedBranchClass)
  );
}

function summarizeCourse(course) {
  return {
    nodes: countNodes(course.mindMap?.nodeData),
    snapshot: course.numberedOutlineSnapshot?.length ?? 0,
    collapsed: course.collapsedOutlineIds?.length ?? 0,
    knowledgePoints: Object.keys(course.knowledgePoints || {}).length,
    knowledgeDocuments: Object.keys(course.knowledgeDocuments || {}).length,
    branchMindMaps: Object.keys(course.branchMindMaps || {}).length
  };
}

function buildOutline(course) {
  const items = [];
  const walk = (nodes, depth, parentId) => {
    for (const node of nodes || []) {
      items.push({ id: node.id, topic: node.topic, depth, parentId });
      walk(node.children, depth + 1, node.id);
    }
  };
  walk(course.mindMap?.nodeData?.children || [], 0, course.mindMap?.nodeData?.id || "");
  return items;
}

function collectTree(course) {
  const nodes = new Map();
  const duplicates = new Set();
  const walk = (node, parentId = "", depth = 0, trail = []) => {
    if (!node?.id) return;
    const nextTrail = [...trail, node.topic];
    if (nodes.has(node.id)) duplicates.add(node.id);
    nodes.set(node.id, { node, parentId, depth, trail: nextTrail });
    for (const child of node.children || []) walk(child, node.id, depth + 1, nextTrail);
  };
  walk(course.mindMap?.nodeData);
  return { nodes, duplicates };
}

function nodeStructureSignature(node) {
  return JSON.stringify({
    id: node?.id,
    topic: node?.topic,
    children: (node?.children || []).map(nodeStructureSignature)
  });
}

function validateKnownFinanceTree(course, nodes) {
  const expectedNodes = {
    ea5c26347b08f32c: { parentId: "ea567e2d8636b864", depth: 1 },
    ea787c1406945de2: { parentId: "ea5c26347b08f32c", depth: 2 },
    ea68e4a203b8914d: { parentId: "ea567e2d8636b864", depth: 1 },
    eab5fe90c669192f: { parentId: "ea68e4a203b8914d", depth: 2 },
    eab60236a3cf478e: { parentId: "eab5fe90c669192f", depth: 3 },
    eab63520c37a9d2b: { parentId: "eab61e99bec96681", depth: 5, topic: "条件" },
    eab6358b910f7a3a: { parentId: "eab61e99bec96681", depth: 5, topic: "原则" },
    eab6319f49ac7c7f: { parentId: "eab62ad3f1c30afe", depth: 5, topic: "条件" },
    eab632bb9f14a202: { parentId: "eab62ad3f1c30afe", depth: 5, topic: "顺序" }
  };

  for (const [id, expected] of Object.entries(expectedNodes)) {
    const actual = nodes.get(id);
    if (!actual) {
      note(`${course.title || course.id}: known finance node has been removed or rebuilt: ${id}`);
      continue;
    }
    if (actual.parentId !== expected.parentId || actual.depth !== expected.depth) {
      fail(
        `${course.title || course.id}: node ${id} parent/depth changed: actual=${actual.parentId}/${actual.depth}, expected=${expected.parentId}/${expected.depth}`
      );
    }
    if (expected.topic && actual.node.topic !== expected.topic) {
      fail(
        `${course.title || course.id}: node ${id} topic changed: actual=${actual.node.topic}, expected=${expected.topic}`
      );
    }
  }
}

function validateTestCourseReference(course, nodes) {
  const logicNode = nodes.get(courseLogicNodeId);
  if (!logicNode) {
    fail("test course: missing course-library logic reference node");
    return;
  }

  const content = `${stripHtml(course.knowledgePoints?.[courseLogicNodeId])} ${documentText(
    course.knowledgeDocuments?.[courseLogicNodeId]
  )}`;
  const requiredTerms = [
    ["course library", "\u8bfe\u7a0b\u5e93"],
    ["outline hierarchy", "\u7236\u5b50\u7ea7"],
    ["knowledge point", "\u77e5\u8bc6\u70b9"],
    ["knowledge notes", "\u77e5\u8bc6\u7b14\u8bb0"],
    ["mind map", "\u601d\u7ef4\u5bfc\u56fe"],
    ["sync", "\u540c\u6b65"],
    ["collapse", "\u6298\u53e0"]
  ];

  for (const [label, term] of requiredTerms) {
    if (!content.includes(term)) fail(`test course: logic reference is missing ${label} rule`);
  }

  const referenceMarkdown = read(courseLogicReferencePath);
  const referenceRules = extractReferenceRules(referenceMarkdown);
  const normalizedContent = normalizeContractText(content);
  for (const rule of referenceRules) {
    if (!normalizedContent.includes(rule)) {
      fail(`test course: logic reference does not include required rule: ${rule}`);
    }
  }
}

function validateImplementationRules() {
  const fileCache = new Map();
  for (const rule of implementationRules) {
    if (!fileCache.has(rule.file)) fileCache.set(rule.file, read(rule.file));
    const content = fileCache.get(rule.file);
    for (const marker of rule.markers) {
      if (!content.includes(marker)) {
        fail(`Implementation rule is missing: ${rule.label}; marker=${marker}`);
      }
    }
  }

  const rendererText = fileCache.get("src/main.tsx") ?? read("src/main.tsx");
  for (const marker of forbiddenDirectCoursePatchMarkers) {
    if (rendererText.includes(marker)) {
      fail(`Renderer bypasses centralized course state patch helpers; marker=${marker}`);
    }
  }
}

function validateCourse(course, index) {
  const label = course.title || course.id || `course[${index}]`;
  if (!course.mindMap?.nodeData?.id) {
    fail(`${label}: missing mindMap.nodeData`);
    return;
  }

  const { nodes, duplicates } = collectTree(course);
  if (duplicates.size > 0) {
    fail(`${label}: duplicate mind map node ids: ${[...duplicates].join(", ")}`);
  }

  const outlineById = new Map(buildOutline(course).map((item) => [item.id, item]));
  for (const item of course.numberedOutlineSnapshot || []) {
    const current = outlineById.get(item.id);
    if (!current) continue;
    if (item.parentId !== current.parentId || item.depth !== current.depth) {
      fail(
        `${label}: numberedOutlineSnapshot re-parents ${item.topic || item.id}; snapshot=${item.parentId}/${item.depth}, tree=${current.parentId}/${current.depth}`
      );
    }
  }

  for (const id of course.collapsedOutlineIds || []) {
    if (!nodes.has(id)) fail(`${label}: collapsedOutlineIds contains missing node id ${id}`);
  }

  for (const [id, html] of Object.entries(course.knowledgePoints || {})) {
    if (!nodes.has(id)) fail(`${label}: knowledgePoints contains orphan node id ${id}`);
    if (isGeneratedBranchOutline(html)) fail(`${label}: knowledgePoints[${id}] stores generated branch outline content`);
  }

  for (const [id, document] of Object.entries(course.knowledgeDocuments || {})) {
    if (!nodes.has(id)) fail(`${label}: knowledgeDocuments contains orphan node id ${id}`);
    if (isGeneratedBranchOutline(document)) fail(`${label}: knowledgeDocuments[${id}] stores generated branch outline content`);
  }

  for (const [id, branchMap] of Object.entries(course.branchMindMaps || {})) {
    const current = nodes.get(id)?.node;
    if (!current) {
      fail(`${label}: branchMindMaps contains orphan node id ${id}`);
      continue;
    }
    if (branchMap?.nodeData?.id !== id) {
      fail(`${label}: branchMindMaps[${id}] root id is ${branchMap?.nodeData?.id || "missing"}`);
    }
    if (branchMap?.nodeData?.topic !== current.topic) {
      fail(`${label}: branchMindMaps[${id}] topic "${branchMap?.nodeData?.topic}" does not match tree topic "${current.topic}"`);
    }
    if (nodeStructureSignature(branchMap?.nodeData) !== nodeStructureSignature(current)) {
      note(`${label}: branchMindMaps[${id}] keeps an isolated or stale subtree cache; runtime must reject it before normal sync reuse`);
    }
  }

  if (course.id === "f13e3aac-2b6d-4f7e-8b0a-860bf416a0e1") {
    validateKnownFinanceTree(course, nodes);
  }

  if (course.id === testCourseId) {
    validateTestCourseReference(course, nodes);
  }

  note(`${label}: ${JSON.stringify(summarizeCourse(course))}`);
}

async function compareMysqlIfAvailable(localCourses) {
  const dataDir = path.join(process.env.APPDATA || "", "aistudy", "data");
  const mysqlConfigPath = path.join(dataDir, "mysql.json");
  if (!fs.existsSync(mysqlConfigPath)) {
    note("MySQL comparison skipped: mysql.json is missing.");
    return;
  }

  let mysql;
  try {
    mysql = await import("mysql2/promise");
  } catch {
    note("MySQL comparison skipped: mysql2 is unavailable.");
    return;
  }

  try {
    const rawMysqlConfig = readJson(mysqlConfigPath);
    const { autoStartServer, serverRoot, ...mysqlConfig } = rawMysqlConfig;
    const mysqlClient = mysql.default ?? mysql;
    const connection = await mysqlClient.createConnection(mysqlConfig);
    const [rows] = await connection.query("SELECT id, payload_json FROM courses");
    await connection.end();
    const mysqlCourses = new Map(rows.map((row) => [row.id, JSON.parse(row.payload_json)]));
    for (const course of localCourses) {
      const mysqlCourse = mysqlCourses.get(course.id);
      if (!mysqlCourse) {
        fail(`MySQL is missing course ${course.title || course.id}`);
        continue;
      }
      const localSummary = summarizeCourse(course);
      const mysqlSummary = summarizeCourse(mysqlCourse);
      if (JSON.stringify(localSummary) !== JSON.stringify(mysqlSummary)) {
        fail(`MySQL summary differs for ${course.title || course.id}: local=${JSON.stringify(localSummary)}, mysql=${JSON.stringify(mysqlSummary)}`);
      }
    }
    note("MySQL course payload summaries match local JSON.");
  } catch (error) {
    note(`MySQL comparison skipped: ${error.message}`);
  }
}

async function main() {
  const rendererText = read("src/main.tsx");
  const mindMapText = read("src/domain/mindMap.ts");
  const branchSyncText = read("src/domain/courseBranchSync.ts");
  validateImplementationRules();

  const requiredRendererMarkers = [
    ["manual collapse guard", "manualCollapseGuardRef"],
    ["auto outline flag", "isAutoOutline"],
    ["auto outline machine marker", generatedBranchMarker],
    ["stale branch document guard", "isStaleGeneratedBranchDocument"]
  ];
  for (const [label, marker] of requiredRendererMarkers) {
    if (!rendererText.includes(marker)) fail(`Renderer course logic marker is missing: ${label}`);
  }

  if (!mindMapText.includes("if (item.depth < outlineDirectoryFreezeDepth) return item")) {
    fail("Frozen outline snapshot must not override parent/depth for non-frozen levels.");
  }
  if (!branchSyncText.includes("activeBranchCanvasId && activeBranchCanvasId === canvasRootId")) {
    fail("Branch sync logic must keep edits bound to the active branch root.");
  }
  if (rendererText.includes("outlineParentIds.has(id)") && rendererText.includes("openIsolatedBranchMindMap(id")) {
    fail("Mind-map branch opening must not be limited to parent nodes only.");
  }
  if (rendererText.includes("focusMindNode(selectedPageId);")) {
    fail("Mind-map mode must not fall back to focusing selected nodes on the main map.");
  }
  if (mindMapText.includes("topic: frozenItem.topic")) {
    fail("Frozen outline snapshot must not freeze node titles; existing titles must follow mind map edits.");
  }

  const dataDir = path.join(process.env.APPDATA || "", "aistudy", "data");
  const coursesPath = path.join(dataDir, "courses.json");
  if (!fs.existsSync(coursesPath)) {
    note("Course data check skipped: courses.json is missing.");
  } else {
    const payload = readJson(coursesPath);
    const courses = Array.isArray(payload.courses) ? payload.courses : [];
    if (courses.length === 0) fail("courses.json contains no courses.");
    courses.forEach(validateCourse);
    await compareMysqlIfAvailable(courses);
  }

  if (failures.length > 0) {
    console.error("AIstudy course library logic check failed:");
    failures.forEach((message) => console.error(`- ${message}`));
    process.exitCode = 1;
  } else {
    console.log("AIstudy course library logic check passed.");
    notes.forEach((message) => console.log(`- ${message}`));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
