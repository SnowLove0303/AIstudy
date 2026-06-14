import type { Course } from "./types";
import { buildOutline, createMindMap, normalizeMindMapData } from "./mindMap";
import { reconcileCourseState } from "./courseState";

export function createCourse(title: string, category: string, description: string, initialBranchTitle = "开篇"): Course {
  return {
    id: crypto.randomUUID(),
    title,
    category,
    description,
    progress: 0,
    createdAt: new Date().toISOString(),
    mindMap: createMindMap(title, initialBranchTitle),
    knowledgePoints: {},
    knowledgeDocuments: {},
    branchMindMaps: {},
    syncNumberedOutline: true,
    numberedOutlineSnapshot: [],
    collapsedOutlineIds: [],
    hideParentKnowledgePages: false
  };
}

export function normalizeCourses(value: unknown, initialBranchTitle = "开篇"): Course[] {
  if (!Array.isArray(value)) return [];
  return value.map((course) => {
    const record = course as Course;
    const mindMap = normalizeMindMapData(record.mindMap, record.title, initialBranchTitle);
    return reconcileCourseState({
      ...record,
      mindMap,
      knowledgePoints: record.knowledgePoints ?? {},
      knowledgeDocuments: record.knowledgeDocuments ?? {},
      branchMindMaps: record.branchMindMaps ?? {},
      syncNumberedOutline: record.syncNumberedOutline ?? true,
      numberedOutlineSnapshot: record.numberedOutlineSnapshot ?? buildOutline(mindMap),
      collapsedOutlineIds: record.collapsedOutlineIds ?? [],
      hideParentKnowledgePages: record.hideParentKnowledgePages ?? false
    });
  });
}
