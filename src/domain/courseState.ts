import type { MindElixirData } from "mind-elixir";
import type { Course, KnowledgeCanvasDocument, OutlineItem } from "./types";
import {
  buildOutline,
  cloneMindData,
  findMindMapNode,
  isBranchMindMapRootAligned,
  reconcileBranchMindMaps,
  reconcileFreshBranchMindMaps
} from "./mindMap";

function collectMindMapNodeIds(data: MindElixirData) {
  const ids = new Set<string>();
  const walk = (node: MindElixirData["nodeData"]) => {
    if (!node?.id) return;
    ids.add(node.id);
    node.children?.forEach(walk);
  };
  walk(data.nodeData);
  return ids;
}

function reconcileCollapsedOutlineIds(data: MindElixirData, collapsedOutlineIds: string[] | undefined) {
  const nodeIds = collectMindMapNodeIds(data);
  return (collapsedOutlineIds ?? []).filter((id) => nodeIds.has(id));
}

function reconcileNumberedOutlineSnapshot(data: MindElixirData, snapshot: OutlineItem[] | undefined) {
  const currentOutlineById = new Map(buildOutline(data).map((item) => [item.id, item]));
  return (snapshot ?? [])
    .map((item) => {
      const current = currentOutlineById.get(item.id);
      if (!current) return null;
      return {
        ...current,
        numbering: item.numbering || current.numbering
      };
    })
    .filter((item): item is OutlineItem => Boolean(item));
}

export function createMindMapStatePatch(course: Course, mindMap: MindElixirData): Partial<Course> {
  const nextMindMap = cloneMindData(mindMap);
  const nextPatch: Partial<Course> = {
    mindMap: nextMindMap,
    branchMindMaps: reconcileFreshBranchMindMaps(nextMindMap, course.branchMindMaps),
    collapsedOutlineIds: reconcileCollapsedOutlineIds(nextMindMap, course.collapsedOutlineIds),
    numberedOutlineSnapshot: course.syncNumberedOutline
      ? buildOutline(nextMindMap)
      : reconcileNumberedOutlineSnapshot(nextMindMap, course.numberedOutlineSnapshot)
  };
  return nextPatch;
}

export function createOutlineSyncStatePatch(
  course: Course,
  syncNumberedOutline: boolean,
  numberedOutlineSnapshot: OutlineItem[]
): Partial<Course> {
  return {
    syncNumberedOutline,
    numberedOutlineSnapshot: syncNumberedOutline
      ? buildOutline(course.mindMap)
      : reconcileNumberedOutlineSnapshot(course.mindMap, numberedOutlineSnapshot)
  };
}

export function createCollapsedOutlineStatePatch(course: Course, collapsedOutlineIds: string[]): Partial<Course> {
  return {
    collapsedOutlineIds: reconcileCollapsedOutlineIds(course.mindMap, collapsedOutlineIds)
  };
}

export function createHideParentKnowledgePagesPatch(hideParentKnowledgePages: boolean): Partial<Course> {
  return { hideParentKnowledgePages };
}

export function createBranchMindMapStatePatch(
  course: Course,
  nodeId: string,
  branchMindMap: MindElixirData | null
): Partial<Course> {
  const branchMindMaps = { ...(course.branchMindMaps ?? {}) };
  if (!branchMindMap) {
    delete branchMindMaps[nodeId];
    return { branchMindMaps };
  }

  if (findMindMapNode(course.mindMap.nodeData, nodeId) && isBranchMindMapRootAligned(course.mindMap, nodeId, branchMindMap)) {
    branchMindMaps[nodeId] = cloneMindData(branchMindMap);
  } else {
    delete branchMindMaps[nodeId];
  }

  return { branchMindMaps };
}

export function createKnowledgePointStatePatch(course: Course, nodeId: string, content: string): Partial<Course> {
  if (!findMindMapNode(course.mindMap.nodeData, nodeId)) return {};
  return {
    knowledgePoints: {
      ...(course.knowledgePoints ?? {}),
      [nodeId]: content
    }
  };
}

export function createKnowledgeDocumentStatePatch(
  course: Course,
  nodeId: string,
  document: KnowledgeCanvasDocument
): Partial<Course> {
  if (!findMindMapNode(course.mindMap.nodeData, nodeId)) return {};
  return {
    knowledgeDocuments: {
      ...(course.knowledgeDocuments ?? {}),
      [nodeId]: document
    }
  };
}

export function reconcileCourseState(course: Course): Course {
  return {
    ...course,
    branchMindMaps: reconcileBranchMindMaps(course.mindMap, course.branchMindMaps),
    collapsedOutlineIds: reconcileCollapsedOutlineIds(course.mindMap, course.collapsedOutlineIds),
    numberedOutlineSnapshot: course.syncNumberedOutline
      ? buildOutline(course.mindMap)
      : reconcileNumberedOutlineSnapshot(course.mindMap, course.numberedOutlineSnapshot)
  };
}
