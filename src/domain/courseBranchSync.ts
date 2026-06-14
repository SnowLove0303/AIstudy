import type { MindElixirData, NodeObj } from "mind-elixir";
import {
  cloneMindData,
  createBranchMindMapFromNode,
  findMindMapNode,
  isBranchMindMapFresh,
  reconcileFreshBranchMindMaps,
  updateMindMapBranch
} from "./mindMap";

export type BranchMindMapRegistry = Record<string, MindElixirData>;

export function getBranchMindDataForNode(
  mainMindMap: MindElixirData,
  branchMindMaps: BranchMindMapRegistry,
  nodeId: string,
  preferMainSnapshot = false
) {
  const branchNode = findMindMapNode(mainMindMap.nodeData, nodeId);
  if (preferMainSnapshot && branchNode) {
    return { mindMap: createBranchMindMapFromNode(branchNode), staleBranchId: null };
  }

  const storedBranch = branchMindMaps[nodeId];
  if (storedBranch) {
    if (isBranchMindMapFresh(mainMindMap, nodeId, storedBranch)) {
      return { mindMap: cloneMindData(storedBranch), staleBranchId: null };
    }
    return {
      mindMap: branchNode ? createBranchMindMapFromNode(branchNode) : null,
      staleBranchId: nodeId
    };
  }

  return {
    mindMap: branchNode ? createBranchMindMapFromNode(branchNode) : null,
    staleBranchId: null
  };
}

export function saveBranchMindMapInRegistry(
  branchMindMaps: BranchMindMapRegistry,
  nodeId: string,
  nextData: MindElixirData
) {
  return {
    ...branchMindMaps,
    [nodeId]: cloneMindData(nextData)
  };
}

export function getDescendantBranchMindMapUpdates(
  branchRoot: NodeObj,
  branchMindMaps: BranchMindMapRegistry,
  downstreamBranchIsolation: boolean
) {
  if (downstreamBranchIsolation) return [];

  const updates: Array<{ nodeId: string; data: MindElixirData }> = [];
  const walk = (node: NodeObj) => {
    node.children?.forEach((child) => {
      if (branchMindMaps[child.id]) {
        updates.push({ nodeId: child.id, data: createBranchMindMapFromNode(child) });
      }
      walk(child);
    });
  };

  walk(branchRoot);
  return updates;
}

export function getFreshBranchMindMapState(
  mainMindMap: MindElixirData,
  branchMindMaps: BranchMindMapRegistry
) {
  const branchMindMapsNext = reconcileFreshBranchMindMaps(mainMindMap, branchMindMaps);
  const staleIds = Object.keys(branchMindMaps).filter((nodeId) => !branchMindMapsNext[nodeId]);
  return { branchMindMaps: branchMindMapsNext, staleIds };
}

export function getPersistingBranchCanvasId(
  mainMindMap: MindElixirData,
  activeBranchCanvasId: string | null,
  nextData: MindElixirData
) {
  const canvasRootId = nextData.nodeData.id;
  if (activeBranchCanvasId && activeBranchCanvasId === canvasRootId) return activeBranchCanvasId;
  return canvasRootId !== mainMindMap.nodeData.id ? canvasRootId : null;
}

export function applyBranchToMainMindMap(
  mainMindMap: MindElixirData,
  branchCanvasId: string,
  branchData: MindElixirData
) {
  return updateMindMapBranch(mainMindMap, branchCanvasId, branchData.nodeData);
}
