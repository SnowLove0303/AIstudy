import MindElixir, { SIDE, type MindElixirData, type NodeObj } from "mind-elixir";
import { escapeHtml } from "./html";
import type { NoteEntry, OutlineItem } from "./types";

export function createMindMap(title: string, initialBranchTitle = "开篇"): MindElixirData {
  return normalizeMindMapData(MindElixir.new(title), title, initialBranchTitle);
}

export function normalizeMindMapData(
  value: MindElixirData | null | undefined,
  title: string,
  initialBranchTitle = "开篇"
): MindElixirData {
  const source = value?.nodeData ? value : MindElixir.new(title);
  const data = JSON.parse(JSON.stringify(source)) as MindElixirData;
  data.nodeData = data.nodeData ?? MindElixir.new(title).nodeData;
  data.nodeData.id = data.nodeData.id || crypto.randomUUID();
  data.nodeData.topic = data.nodeData.topic || title;
  data.nodeData.children = Array.isArray(data.nodeData.children) ? data.nodeData.children : [];

  if (data.nodeData.children.length === 0) {
    data.nodeData.children.push({
      id: crypto.randomUUID(),
      topic: initialBranchTitle
    } as NodeObj);
  }

  return data;
}

export function buildOutline(data: MindElixirData): OutlineItem[] {
  const items: OutlineItem[] = [];

  const getNumbering = (depth: number, index: number): string => {
    if (depth === 0) return "";
    if (depth === 1) {
      const nums = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
        "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"];
      const num = index + 1;
      return num <= 20 ? `${nums[num - 1]}、` : `${num}、`;
    }
    if (depth === 2) {
      const nums = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
        "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"];
      const num = index + 1;
      return num <= 20 ? `（${nums[num - 1]}）` : `（${num}）`;
    }
    if (depth === 3) return `${index + 1}.`;
    return `${index + 1})`;
  };

  const walk = (nodes: NodeObj[] | undefined, depth: number, parentId: string) => {
    if (!nodes) return;
    nodes.forEach((node, index) => {
      const numbering = getNumbering(depth, index);
      items.push({ id: node.id, topic: node.topic, depth, parentId, numbering });
      walk(node.children, depth + 1, node.id);
    });
  };

  walk(data.nodeData.children, 0, data.nodeData.id);
  return items;
}

export const outlineDirectoryFreezeDepth = 3;
export const readableMindMapDefaultScale = 1;

export function applyNumberedOutlineSnapshot(nextOutline: OutlineItem[], snapshot: OutlineItem[]) {
  const snapshotItems = new Map(snapshot.map((item) => [item.id, item]));
  const frozenIds = new Set(
    snapshot
      .filter((item) => item.depth >= outlineDirectoryFreezeDepth)
      .map((item) => item.id)
  );

  return nextOutline
    .filter((item) => item.depth < outlineDirectoryFreezeDepth || frozenIds.has(item.id))
    .map((item) => {
      if (item.depth < outlineDirectoryFreezeDepth) return item;
      const frozenItem = snapshotItems.get(item.id);
      return frozenItem
        ? { ...item, numbering: frozenItem.numbering }
        : item;
    });
}

export function getVisibleOutline(outline: OutlineItem[], collapsedIds: string[]) {
  const collapsedSet = new Set(collapsedIds);
  const hiddenParentIds = new Set<string>();

  return outline.filter((item) => {
    if (hiddenParentIds.has(item.parentId)) {
      hiddenParentIds.add(item.id);
      return false;
    }

    if (collapsedSet.has(item.id)) {
      hiddenParentIds.add(item.id);
    }

    return true;
  });
}

export function getOutlineParentIds(outline: OutlineItem[]) {
  return new Set(outline.map((item) => item.parentId));
}

export function getOutlineAncestorIds(outline: OutlineItem[], targetId: string) {
  const byId = new Map(outline.map((item) => [item.id, item]));
  const ancestors = new Set<string>();
  let current = byId.get(targetId);

  while (current) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    ancestors.add(parent.id);
    current = parent;
  }

  return ancestors;
}

export function findMindMapNode(root: NodeObj, nodeId: string): NodeObj | null {
  if (root.id === nodeId) return root;
  for (const child of root.children ?? []) {
    const match = findMindMapNode(child, nodeId);
    if (match) return match;
  }
  return null;
}

export function cloneMindData(data: MindElixirData): MindElixirData {
  return JSON.parse(JSON.stringify(data)) as MindElixirData;
}

export function createBranchMindMapFromNode(node: NodeObj): MindElixirData {
  return {
    nodeData: JSON.parse(JSON.stringify(node)) as NodeObj,
    arrows: [],
    summaries: [],
    direction: SIDE
  } as MindElixirData;
}

function replaceMindMapNode(root: NodeObj, nodeId: string, replacement: NodeObj): NodeObj {
  if (root.id === nodeId) return JSON.parse(JSON.stringify(replacement)) as NodeObj;
  return {
    ...root,
    children: root.children?.map((child) => replaceMindMapNode(child, nodeId, replacement))
  } as NodeObj;
}

export function updateMindMapBranch(data: MindElixirData, nodeId: string, branchRoot: NodeObj): MindElixirData {
  const nextData = cloneMindData(data);
  nextData.nodeData = replaceMindMapNode(nextData.nodeData, nodeId, branchRoot);
  return nextData;
}

function renderBranchList(nodes: NodeObj[] | undefined): string {
  if (!nodes || nodes.length === 0) return "";
  return `<ul>${nodes
    .map((node) => `<li><span>${escapeHtml(node.topic)}</span>${renderBranchList(node.children)}</li>`)
    .join("")}</ul>`;
}

export function renderKnowledgeBranchHtml(branch: NodeObj): string {
  return [
    '<section class="knowledge-branch-map" contenteditable="false">',
    '<button class="branch-map-close" type="button" aria-label="Close branch mind map">&times;</button>',
    '<div class="branch-map-heading">',
    "<span>分支思维导图</span>",
    `<strong>${escapeHtml(branch.topic)}</strong>`,
    "</div>",
    renderBranchList(branch.children) || '<p class="branch-map-empty">暂无子节点</p>',
    "</section>",
    "<p><br></p>"
  ].join("");
}

function normalizeTag(tag: NonNullable<NodeObj["tags"]>[number]) {
  return typeof tag === "string" ? tag : tag.text;
}

export function buildNoteEntries(data: MindElixirData): NoteEntry[] {
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
