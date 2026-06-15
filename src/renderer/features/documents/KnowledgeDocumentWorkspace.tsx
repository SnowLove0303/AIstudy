import React from "react";
import { Bold, Bot, Italic, Redo2, Save, Type, Underline, Undo2 } from "lucide-react";
import { createCanvasDocumentEditor, createEmptyKnowledgeDocumentSnapshot } from "./canvasEditorAdapter";
import { AiAssistantPanel } from "../assistant/AiAssistantPanel";
import { createKnowledgeDocumentBinding } from "../../domain/coreContracts";
import { registerBeforeCloseSave } from "../../lib/saveDrain";
import { readLocalSnapshot, writeLocalSnapshot } from "../../lib/localSnapshotStore";
import {
  EMPTY_VIEWPORT_SCROLL_STATE,
  ViewportScrollbars,
  type ViewportScrollAxis,
  type ViewportScrollState
} from "../../lib/ViewportScrollbars";
import type {
  KnowledgeDocumentEditorHandle,
  KnowledgeDocumentFormatState,
  KnowledgeDocumentRecord,
  KnowledgeDocumentSaveInput,
  KnowledgeDocumentSnapshot
} from "./knowledgeDocumentTypes";
import type { MindMapSelectedNode } from "../mindmap/mindMapTypes";

type KnowledgeDocumentWorkspaceProps = {
  courseId: string | null;
  mindMapId: string | null;
  selectedNode: MindMapSelectedNode;
};

type StorageMode = "mysql" | "local" | "none";
type PendingDocumentSave = KnowledgeDocumentSaveInput;

type LoadRequest = {
  courseId: string;
  mindMapId: string;
  nodeId: string;
};

type AiContextMenuState = {
  x: number;
  y: number;
  text?: string;
};

const SAVE_DEBOUNCE_MS = 900;
const DOCUMENT_STORAGE_PREFIX = "aistudy:knowledge-document:v1:";
const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32];
const COLOR_OPTIONS = ["#1f2937", "#2563eb", "#0f766e", "#d97706", "#dc2626", "#7c3aed"];
const AI_CONTEXT_PANEL_WIDTH = 430;
const AI_CONTEXT_PANEL_HEIGHT = 560;

declare global {
  interface Window {
    aistudyKnowledgeDocuments?: {
      load: (request: LoadRequest) => Promise<KnowledgeDocumentRecord | null>;
      save: (input: KnowledgeDocumentSaveInput) => Promise<KnowledgeDocumentRecord>;
    };
  }
}

function getStorageKey(courseId: string, mindMapId: string, nodeId: string) {
  return `${DOCUMENT_STORAGE_PREFIX}${courseId}:${mindMapId}:${nodeId}`;
}

function formatSavedAt() {
  return new Date().toLocaleTimeString();
}

async function loadLocalDocument(courseId: string, mindMapId: string, nodeId: string): Promise<KnowledgeDocumentSnapshot | null> {
  const storageKey = getStorageKey(courseId, mindMapId, nodeId);
  try {
    const snapshot = await readLocalSnapshot<KnowledgeDocumentSnapshot>(storageKey);
    if (snapshot) return snapshot;
  } catch {
    // IndexedDB failure should not block legacy localStorage recovery.
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as KnowledgeDocumentSnapshot;
    void writeLocalSnapshot(storageKey, "document", snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

async function saveLocalDocument(input: KnowledgeDocumentSaveInput) {
  await writeLocalSnapshot(getStorageKey(input.courseId, input.mindMapId, input.nodeId), "document", input.snapshot);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? `${fallback}: ${error.message}` : fallback;
}

function clampPercent(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function readNativeScrollState(element: HTMLElement): ViewportScrollState {
  const verticalSize = element.scrollHeight > 0 ? clampPercent((element.clientHeight / element.scrollHeight) * 100) : 100;
  const horizontalSize = element.scrollWidth > 0 ? clampPercent((element.clientWidth / element.scrollWidth) * 100) : 100;
  const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
  const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
  const maxVerticalPosition = Math.max(0, 100 - verticalSize);
  const maxHorizontalPosition = Math.max(0, 100 - horizontalSize);

  return {
    vertical: {
      position:
        maxScrollTop > 0
          ? clampPercent((element.scrollTop / maxScrollTop) * maxVerticalPosition, 0, maxVerticalPosition)
          : 0,
      size: verticalSize,
      enabled: element.scrollHeight > element.clientHeight + 1
    },
    horizontal: {
      position:
        maxScrollLeft > 0
          ? clampPercent((element.scrollLeft / maxScrollLeft) * maxHorizontalPosition, 0, maxHorizontalPosition)
          : 0,
      size: horizontalSize,
      enabled: element.scrollWidth > element.clientWidth + 1
    }
  };
}

function readDomSelectedText(container: HTMLElement | null) {
  const selectionText = window.getSelection()?.toString().trim() ?? "";
  if (selectionText) return selectionText;

  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLInputElement
  ) {
    if (container && !container.contains(activeElement)) return "";
    const start = activeElement.selectionStart ?? 0;
    const end = activeElement.selectionEnd ?? 0;
    if (end > start) return activeElement.value.slice(start, end).trim();
  }

  return "";
}

function clampAiPanelPoint(point: { x: number; y: number }) {
  const margin = 12;
  const maxX = Math.max(margin, window.innerWidth - AI_CONTEXT_PANEL_WIDTH - margin);
  const maxY = Math.max(margin, window.innerHeight - AI_CONTEXT_PANEL_HEIGHT - margin);
  return {
    x: Math.min(Math.max(margin, point.x), maxX),
    y: Math.min(Math.max(margin, point.y), maxY)
  };
}

export function KnowledgeDocumentWorkspace({ courseId, mindMapId, selectedNode }: KnowledgeDocumentWorkspaceProps) {
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const toolbarAiButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const latestContextMenuPointRef = React.useRef({ x: 0, y: 0 });
  const editorRef = React.useRef<KnowledgeDocumentEditorHandle | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const pendingSaveRef = React.useRef<PendingDocumentSave | null>(null);
  const activeSaveRef = React.useRef<Promise<KnowledgeDocumentRecord | null>>(Promise.resolve(null));
  const latestSnapshotRef = React.useRef<KnowledgeDocumentSnapshot | null>(null);
  const loadSequenceRef = React.useRef(0);
  const [snapshot, setSnapshot] = React.useState<KnowledgeDocumentSnapshot | null>(null);
  const [formatState, setFormatState] = React.useState<KnowledgeDocumentFormatState>({
    fontSize: 16,
    color: "#1f2937",
    bold: false,
    italic: false,
    underline: false
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isEditorReady, setIsEditorReady] = React.useState(false);
  const [storageMode, setStorageMode] = React.useState<StorageMode>("none");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [documentViewportState, setDocumentViewportState] =
    React.useState<ViewportScrollState>(EMPTY_VIEWPORT_SCROLL_STATE);
  const [assistantDraft, setAssistantDraft] = React.useState("");
  const [aiContextMenu, setAiContextMenu] = React.useState<AiContextMenuState | null>(null);

  const documentBinding = React.useMemo(
    () => createKnowledgeDocumentBinding(courseId, mindMapId, selectedNode.id),
    [courseId, mindMapId, selectedNode.id]
  );
  const canUseDocument = Boolean(documentBinding && snapshot);

  const updateDocumentViewportState = React.useCallback(() => {
    const mount = mountRef.current;
    setDocumentViewportState(mount ? readNativeScrollState(mount) : EMPTY_VIEWPORT_SCROLL_STATE);
  }, []);

  const resetDocumentViewportToStart = React.useCallback(() => {
    const mount = mountRef.current;
    if (!mount) {
      setDocumentViewportState(EMPTY_VIEWPORT_SCROLL_STATE);
      return;
    }

    mount.scrollTop = 0;
    mount.scrollLeft = 0;
    mount.querySelectorAll<HTMLElement>("*").forEach((element) => {
      if (element.scrollTop !== 0) element.scrollTop = 0;
      if (element.scrollLeft !== 0) element.scrollLeft = 0;
    });
    setDocumentViewportState(readNativeScrollState(mount));
  }, []);

  const persistDocument = React.useCallback(
    async (input: PendingDocumentSave, silent = false): Promise<KnowledgeDocumentRecord | null> => {
      if (!silent) setIsSaving(true);
      try {
        if (!window.aistudyKnowledgeDocuments) {
          try {
            await saveLocalDocument(input);
            if (!silent) {
              setStorageMode("local");
              setSavedAt(formatSavedAt());
              setError("");
            }
            return null;
          } catch (localError) {
            if (!silent) {
              setStorageMode("none");
              setError(getErrorMessage(localError, "文档本地缓存失败"));
            }
            return null;
          }
        }

        const document = await window.aistudyKnowledgeDocuments.save(input);
        if (!silent) {
          setStorageMode("mysql");
          setSavedAt(formatSavedAt());
          setError("");
        }
        return document;
      } catch (error) {
        try {
          await saveLocalDocument(input);
          if (!silent) {
            setStorageMode("local");
            setSavedAt(formatSavedAt());
            setError(getErrorMessage(error, "文档保存失败，已保存到本地副本"));
          }
          return null;
        } catch (localError) {
          if (!silent) {
            setStorageMode("none");
            setError(`${getErrorMessage(error, "文档保存失败")}；${getErrorMessage(localError, "本地副本也保存失败")}`);
          }
          return null;
        }
      } finally {
        if (!silent) setIsSaving(false);
      }
    },
    []
  );

  const flushPendingSave = React.useCallback(
    (silent = false): Promise<KnowledgeDocumentRecord | null> => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (!pending) {
        return activeSaveRef.current;
      }

      const saveTask = activeSaveRef.current
        .catch(() => null)
        .then(() => persistDocument(pending, silent));
      activeSaveRef.current = saveTask.catch(() => null);
      return saveTask;
    },
    [persistDocument]
  );

  const queueSnapshotSave = React.useCallback(
    (nextSnapshot: KnowledgeDocumentSnapshot) => {
      if (!documentBinding) return;
      latestSnapshotRef.current = nextSnapshot;
      pendingSaveRef.current = {
        ...documentBinding,
        title: selectedNode.title || "未命名",
        snapshot: nextSnapshot
      };
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => flushPendingSave(false), SAVE_DEBOUNCE_MS);
    },
    [documentBinding, flushPendingSave, selectedNode.title]
  );

  React.useEffect(() => {
    void flushPendingSave(true);
    editorRef.current?.destroy();
    editorRef.current = null;
    setIsEditorReady(false);
    setSnapshot(null);
    setDocumentViewportState(EMPTY_VIEWPORT_SCROLL_STATE);
    resetDocumentViewportToStart();
    latestSnapshotRef.current = null;
    setSavedAt(null);
    setError("");

    const sequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = sequence;

    if (!documentBinding) {
      setIsLoading(false);
      setStorageMode("none");
      return;
    }

    setIsLoading(true);
    const request: LoadRequest = documentBinding;
    void (async () => {
      const fallbackSnapshot =
        (await loadLocalDocument(documentBinding.courseId, documentBinding.mindMapId, documentBinding.nodeId)) ??
        createEmptyKnowledgeDocumentSnapshot();
      if (loadSequenceRef.current !== sequence) return;

      if (!window.aistudyKnowledgeDocuments) {
        setSnapshot(fallbackSnapshot);
        latestSnapshotRef.current = fallbackSnapshot;
        setStorageMode("local");
        setIsLoading(false);
        return;
      }

      try {
        const document = await window.aistudyKnowledgeDocuments.load(request);
        if (loadSequenceRef.current !== sequence) return;
        const nextSnapshot = document?.snapshot ?? fallbackSnapshot;
        setSnapshot(nextSnapshot);
        latestSnapshotRef.current = nextSnapshot;
        setStorageMode(document ? "mysql" : "none");
      } catch (error) {
        if (loadSequenceRef.current !== sequence) return;
        setSnapshot(fallbackSnapshot);
        latestSnapshotRef.current = fallbackSnapshot;
        setStorageMode("local");
        setError(getErrorMessage(error, "文档读取失败，已打开本地副本"));
      } finally {
        if (loadSequenceRef.current === sequence) {
          setIsLoading(false);
        }
      }
    })();
  }, [documentBinding, flushPendingSave, resetDocumentViewportToStart]);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !snapshot || !canUseDocument) return undefined;
    let isDisposed = false;
    let isCreating = false;
    let frameId: number | null = null;

    const createEditor = () => {
      if (isDisposed || isCreating || editorRef.current) return;
      const rect = mount.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      isCreating = true;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        if (isDisposed || editorRef.current) {
          isCreating = false;
          return;
        }
        const nextRect = mount.getBoundingClientRect();
        if (nextRect.width <= 0 || nextRect.height <= 0) {
          isCreating = false;
          return;
        }
        resetDocumentViewportToStart();
        mount.replaceChildren();
        setIsEditorReady(false);
        const editorSurface = document.createElement("div");
        editorSurface.className = "document-editor-surface";
        mount.appendChild(editorSurface);
        createCanvasDocumentEditor(editorSurface, snapshot, {
          onSnapshotChanged: (nextSnapshot) => {
            queueSnapshotSave(nextSnapshot);
            window.requestAnimationFrame(updateDocumentViewportState);
          },
          onFormatChanged: setFormatState,
          onAskAi: (selectedText) => {
            const point = latestContextMenuPointRef.current;
            setAssistantDraft(selectedText);
            setAiContextMenu({
              ...clampAiPanelPoint(point),
              text: selectedText
            });
          }
        })
          .then((editor) => {
            if (isDisposed || editorRef.current || editorSurface.parentElement !== mount) {
              editor.destroy();
              editorSurface.remove();
              return;
            }
            editorRef.current = editor;
            setIsEditorReady(true);
            window.requestAnimationFrame(() => {
              if (isDisposed) return;
              resetDocumentViewportToStart();
              window.setTimeout(() => {
                if (!isDisposed) resetDocumentViewportToStart();
              }, 0);
            });
          })
          .catch((error) => {
            if (!isDisposed) {
              editorSurface.remove();
              setIsEditorReady(false);
              setError(getErrorMessage(error, "文档编辑器加载失败"));
            }
          })
          .finally(() => {
            isCreating = false;
          });
      });
    };

    editorRef.current?.destroy();
    editorRef.current = null;
    setIsEditorReady(false);
    mount.replaceChildren();
    const resizeObserver = new ResizeObserver(createEditor);
    resizeObserver.observe(mount);
    createEditor();

    return () => {
      isDisposed = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      resizeObserver.disconnect();
      editorRef.current?.destroy();
      editorRef.current = null;
      setIsEditorReady(false);
      mount.replaceChildren();
    };
  }, [canUseDocument, queueSnapshotSave, resetDocumentViewportToStart, snapshot, updateDocumentViewportState]);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !canUseDocument) {
      setDocumentViewportState(EMPTY_VIEWPORT_SCROLL_STATE);
      return undefined;
    }

    let frameId: number | null = null;
    const update = () => updateDocumentViewportState();
    const resizeObserver = new ResizeObserver(update);
    mount.addEventListener("scroll", update, { passive: true });
    resizeObserver.observe(mount);

    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      const surface = mount.firstElementChild;
      if (surface) resizeObserver.observe(surface);
      update();
    });

    return () => {
      mount.removeEventListener("scroll", update);
      resizeObserver.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [canUseDocument, snapshot, updateDocumentViewportState]);

  React.useEffect(() => {
    return () => {
      void flushPendingSave(true);
      editorRef.current?.destroy();
    };
  }, [flushPendingSave]);

  React.useEffect(() => registerBeforeCloseSave(() => flushPendingSave(true)), [flushPendingSave]);

  const saveNow = React.useCallback(() => {
    if (!documentBinding) return Promise.resolve(null);
    const nextSnapshot = editorRef.current?.getSnapshot() ?? latestSnapshotRef.current ?? snapshot;
    if (!nextSnapshot) return Promise.resolve(null);
    latestSnapshotRef.current = nextSnapshot;
    pendingSaveRef.current = {
      ...documentBinding,
      title: selectedNode.title || "未命名",
      snapshot: nextSnapshot
    };
    return flushPendingSave(false);
  }, [documentBinding, flushPendingSave, selectedNode.title, snapshot]);

  const storageText = storageMode === "mysql" ? "已连接" : storageMode === "local" ? "本地副本" : "未保存";

  const scrollDocumentViewport = React.useCallback(
    (axis: ViewportScrollAxis, position: number) => {
      const mount = mountRef.current;
      if (!mount) return;
      const axisState = axis === "vertical" ? documentViewportState.vertical : documentViewportState.horizontal;
      const maxPosition = Math.max(0, 100 - axisState.size);
      const nextPosition = clampPercent(position, 0, maxPosition);
      if (axis === "vertical") {
        const maxScrollTop = Math.max(0, mount.scrollHeight - mount.clientHeight);
        mount.scrollTop = maxPosition <= 0 ? 0 : (nextPosition / maxPosition) * maxScrollTop;
      } else {
        const maxScrollLeft = Math.max(0, mount.scrollWidth - mount.clientWidth);
        mount.scrollLeft = maxPosition <= 0 ? 0 : (nextPosition / maxPosition) * maxScrollLeft;
      }
      updateDocumentViewportState();
    },
    [documentViewportState.horizontal, documentViewportState.vertical, updateDocumentViewportState]
  );

  const readSelectedText = React.useCallback(() => {
    return editorRef.current?.getSelectedText() || readDomSelectedText(mountRef.current);
  }, []);

  const openAssistantPanel = React.useCallback((point: { x: number; y: number }, text?: string) => {
    const selectedText = text?.trim() || readSelectedText().trim();
    setAssistantDraft(selectedText);
    setAiContextMenu({
      ...clampAiPanelPoint(point),
      text: selectedText
    });
  }, [readSelectedText]);

  const rememberContextMenuPoint = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    latestContextMenuPointRef.current = {
      x: event.clientX,
      y: event.clientY
    };
  }, []);

  React.useEffect(() => {
    if (!aiContextMenu) return undefined;
    const closeMenu = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      setAiContextMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAiContextMenu(null);
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [aiContextMenu]);

  return (
    <div className="document-workspace">
      <div className="document-local-toolbar" aria-label="文档编辑工具栏">
        <button type="button" title="撤销" onClick={() => editorRef.current?.exec("undo")} disabled={!canUseDocument}>
          <Undo2 size={15} />
        </button>
        <button type="button" title="重做" onClick={() => editorRef.current?.exec("redo")} disabled={!canUseDocument}>
          <Redo2 size={15} />
        </button>
        <span className="mindmap-toolbar-separator" />
        <button
          type="button"
          title="加粗"
          className={formatState.bold ? "format-button active" : "format-button"}
          onClick={() => editorRef.current?.exec("bold")}
          disabled={!canUseDocument}
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          title="斜体"
          className={formatState.italic ? "format-button active" : "format-button"}
          onClick={() => editorRef.current?.exec("italic")}
          disabled={!canUseDocument}
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          title="下划线"
          className={formatState.underline ? "format-button active" : "format-button"}
          onClick={() => editorRef.current?.exec("underline")}
          disabled={!canUseDocument}
        >
          <Underline size={15} />
        </button>
        <span className="mindmap-toolbar-separator" />
        <label className="document-size-control" title="字号">
          <Type size={15} />
          <select
            value={formatState.fontSize}
            onChange={(event) => editorRef.current?.setFontSize(Number(event.target.value))}
            disabled={!canUseDocument}
          >
            {FONT_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="document-color-swatches" aria-label="文字颜色">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              className={formatState.color.toLowerCase() === color.toLowerCase() ? "document-color-swatch active" : "document-color-swatch"}
              style={{ backgroundColor: color }}
              title={color}
              aria-label={`文字颜色 ${color}`}
              onClick={() => editorRef.current?.setColor(color)}
              disabled={!canUseDocument}
            />
          ))}
        </div>
        <span className="mindmap-toolbar-spacer" />
        <button
          type="button"
          title="AI 助手"
          ref={toolbarAiButtonRef}
          className={aiContextMenu ? "document-ai-toolbar-button active" : "document-ai-toolbar-button"}
          onClick={() => {
            const rect = toolbarAiButtonRef.current?.getBoundingClientRect();
            openAssistantPanel({
              x: rect ? rect.left : window.innerWidth - 460,
              y: rect ? rect.bottom + 6 : 96
            });
          }}
          disabled={!canUseDocument}
        >
          <Bot size={15} />
          <span>AI</span>
        </button>
        <button type="button" title="保存文档" onClick={saveNow} disabled={!canUseDocument || isSaving}>
          <Save size={15} />
          <span>{isSaving ? "保存中" : "保存"}</span>
        </button>
      </div>

      <div className="document-editor-shell" onContextMenu={rememberContextMenuPoint}>
        <div ref={mountRef} className="document-editor-host" aria-hidden={!canUseDocument} />
        <ViewportScrollbars
          className="document-viewport-scrollbars"
          state={documentViewportState}
          onChange={scrollDocumentViewport}
        />
        <div className={canUseDocument && isEditorReady ? "document-placeholder is-hidden" : "document-placeholder"}>
          <strong>{isLoading || canUseDocument ? "正在打开文档" : "请选择目录节点"}</strong>
        </div>
      </div>

      {aiContextMenu ? (
        <div
          className="document-ai-context-menu is-chat"
          style={{ left: aiContextMenu.x, top: aiContextMenu.y }}
          role="dialog"
          onClick={(event) => event.stopPropagation()}
        >
          <AiAssistantPanel
            compact
            title="文档 AI 助手"
            initialInput={assistantDraft}
            onInitialInputConsumed={() => setAssistantDraft("")}
            onClose={() => setAiContextMenu(null)}
          />
        </div>
      ) : null}

      <div className="document-status-strip">
        <span>{canUseDocument ? selectedNode.title || "未命名" : "未选择节点"}</span>
        <span>{storageText}</span>
        {savedAt ? <span>已保存 {savedAt}</span> : null}
        {error ? <span className="mindmap-error">{error}</span> : null}
      </div>
    </div>
  );
}
