import React from "react";
import { ChevronRight } from "lucide-react";
import type { MindMapOutlineItem } from "./mindMapTypes";

type MindMapCatalogProps = {
  items: MindMapOutlineItem[];
  selectedNodeId: string | null;
  resetKey: string;
  onNodeSelect?: (item: MindMapOutlineItem) => void;
};

type CatalogRenderOptions = {
  selectedNodeId: string | null;
  collapsedPaths: ReadonlySet<string>;
  onToggle: (path: string) => void;
  onNodeSelect?: (item: MindMapOutlineItem) => void;
};

function collectCollapsiblePaths(items: MindMapOutlineItem[], paths = new Set<string>()) {
  items.forEach((item) => {
    if (item.children.length > 0) {
      paths.add(item.path);
      collectCollapsiblePaths(item.children, paths);
    }
  });
  return paths;
}

function renderCatalogItems(items: MindMapOutlineItem[], options: CatalogRenderOptions) {
  return (
    <ol className="catalog-tree">
      {items.map((item) => {
        const hasChildren = item.children.length > 0;
        const isCollapsed = hasChildren && options.collapsedPaths.has(item.path);
        const isSelected = Boolean(options.selectedNodeId && item.nodeId === options.selectedNodeId);

        return (
          <li key={item.path} className="catalog-tree-item">
            <div
              className={isSelected ? "catalog-node selected" : "catalog-node"}
              style={{ paddingLeft: 8 + item.level * 14 }}
              data-catalog-source={item.source}
              data-catalog-path={item.path}
              data-catalog-parent-path={item.parentPath ?? ""}
              data-catalog-order={item.order}
              aria-level={item.level + 1}
              aria-expanded={hasChildren ? !isCollapsed : undefined}
              aria-current={isSelected ? "true" : undefined}
              role="treeitem"
              tabIndex={0}
              onClick={() => options.onNodeSelect?.(item)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                options.onNodeSelect?.(item);
              }}
            >
              {hasChildren ? (
                <button
                  className={isCollapsed ? "catalog-toggle collapsed" : "catalog-toggle"}
                  type="button"
                  title={isCollapsed ? "展开" : "折叠"}
                  aria-label={`${isCollapsed ? "展开" : "折叠"} ${item.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    options.onToggle(item.path);
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              ) : (
                <span className="catalog-toggle-placeholder" />
              )}
              <span className="catalog-node-mark" />
              <span className="catalog-node-title">{item.title}</span>
              {item.childCount > 0 ? <span className="catalog-node-count">{item.childCount}</span> : null}
            </div>
            {hasChildren && !isCollapsed ? renderCatalogItems(item.children, options) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function MindMapCatalog({ items, selectedNodeId, resetKey, onNodeSelect }: MindMapCatalogProps) {
  const [collapsedPaths, setCollapsedPaths] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setCollapsedPaths(new Set());
  }, [resetKey]);

  React.useEffect(() => {
    setCollapsedPaths((current) => {
      if (current.size === 0) return current;
      const validPaths = collectCollapsiblePaths(items);
      const next = new Set([...current].filter((path) => validPaths.has(path)));
      return next.size === current.size ? current : next;
    });
  }, [items]);

  const togglePath = React.useCallback((path: string) => {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return renderCatalogItems(items, {
    selectedNodeId,
    collapsedPaths,
    onToggle: togglePath,
    onNodeSelect
  });
}
