import type React from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import type { CourseWorkspaceMode, OutlineItem } from "../domain/types";

type CourseOutlinePanelProps = {
  activePageId: string;
  collapsedOutlineIds: string[];
  draggingOutlineId: string | null;
  hideParentKnowledgePages: boolean;
  isOutlineResizing: boolean;
  mode: CourseWorkspaceMode;
  outline: OutlineItem[];
  outlineDropTargetId: string | null;
  outlineListRef: React.RefObject<HTMLDivElement | null>;
  outlineParentIds: Set<string>;
  outlineRef: React.RefObject<HTMLElement | null>;
  outlineScroll: number;
  rootNodeId: string;
  visibleOutline: OutlineItem[];
  focusOutlineNode: (nodeId: string) => void;
  focusRootMindMap: () => void;
  reorderOutlineNode: (draggedId: string, targetId: string) => void;
  scrollOutlineBy: (delta: number) => void;
  setDraggingOutlineId: React.Dispatch<React.SetStateAction<string | null>>;
  setOutlineDropTargetId: React.Dispatch<React.SetStateAction<string | null>>;
  slideOutlineTo: (value: number) => void;
  startOutlineResize: (event: React.MouseEvent<HTMLDivElement>) => void;
  toggleOutlineCollapse: (nodeId: string) => void;
  updateOutlineScroll: () => void;
};

export function CourseOutlinePanel({
  activePageId,
  collapsedOutlineIds,
  draggingOutlineId,
  hideParentKnowledgePages,
  isOutlineResizing,
  mode,
  outline,
  outlineDropTargetId,
  outlineListRef,
  outlineParentIds,
  outlineRef,
  outlineScroll,
  rootNodeId,
  visibleOutline,
  focusOutlineNode,
  focusRootMindMap,
  reorderOutlineNode,
  scrollOutlineBy,
  setDraggingOutlineId,
  setOutlineDropTargetId,
  slideOutlineTo,
  startOutlineResize,
  toggleOutlineCollapse,
  updateOutlineScroll
}: CourseOutlinePanelProps) {
  return (
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
              const parentKnowledgePageDisabled = mode !== "mindmap" && hideParentKnowledgePages && hasChildren;

              return (
                <div
                  className={[
                    "outline-item",
                    `depth-${Math.min(item.depth, 5)}`,
                    item.numbering ? "has-numbering" : "",
                    hasChildren ? "has-children" : "",
                    parentKnowledgePageDisabled ? "knowledge-page-disabled" : "",
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
                    if (parentKnowledgePageDisabled) {
                      toggleOutlineCollapse(item.id);
                      return;
                    }
                    focusOutlineNode(item.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    if (parentKnowledgePageDisabled) {
                      toggleOutlineCollapse(item.id);
                      return;
                    }
                    focusOutlineNode(item.id);
                  }}
                  title={parentKnowledgePageDisabled ? "父级知识点页已关闭" : item.topic}
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
  );
}
