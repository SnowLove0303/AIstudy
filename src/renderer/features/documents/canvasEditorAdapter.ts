import type { IEditorData, IElement, IRangeStyle } from "@hufe921/canvas-editor";
import type {
  KnowledgeDocumentContent,
  KnowledgeDocumentEditorHandle,
  KnowledgeDocumentFormatState,
  KnowledgeDocumentSnapshot
} from "./knowledgeDocumentTypes";
import { AISTUDY_CORE_CONTRACT } from "../../domain/coreContracts";

const DOCUMENT_EDITOR_VERSION = "canvas-editor@0.9.135";
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_COLOR = "#1f2937";
const DOCUMENT_EDITOR = AISTUDY_CORE_CONTRACT.editors.knowledgeDocument;
const LANDSCAPE_PAGE_RATIO = 794 / 1123;
const DOCUMENT_PAGE_GUTTER = 32;
const MIN_LANDSCAPE_PAGE_WIDTH = 960;

type CanvasEditorModule = typeof import("@hufe921/canvas-editor");
type CanvasEditorInstance = InstanceType<CanvasEditorModule["default"]>;

type CanvasDocumentEvents = {
  onSnapshotChanged?: (snapshot: KnowledgeDocumentSnapshot) => void;
  onFormatChanged?: (state: KnowledgeDocumentFormatState) => void;
  onAskAi?: (selectedText: string) => void;
};

function loadCanvasEditor() {
  if (import.meta.env.DEV) {
    return import("@hufe921/canvas-editor");
  }

  const moduleUrl = import.meta.url;
  const assetsIndex = moduleUrl.lastIndexOf("/assets/");
  const vendorUrl = assetsIndex >= 0 ? `${moduleUrl.slice(0, assetsIndex)}/vendor/canvas-editor.js` : "./vendor/canvas-editor.js";
  return import(/* @vite-ignore */ vendorUrl) as Promise<CanvasEditorModule>;
}

function normalizeElementList(value: unknown): IElement[] {
  if (!Array.isArray(value)) return [{ value: "" } as IElement];
  const list = value.filter((item): item is IElement => Boolean(item && typeof item === "object"));
  return list.length > 0 ? list : [{ value: "" } as IElement];
}

function normalizeEditorData(content: KnowledgeDocumentContent | null | undefined): IEditorData {
  return {
    header: Array.isArray(content?.header) ? (content?.header as IElement[]) : undefined,
    main: normalizeElementList(content?.main),
    footer: Array.isArray(content?.footer) ? (content?.footer as IElement[]) : undefined,
    graffiti: Array.isArray(content?.graffiti) ? (content?.graffiti as IEditorData["graffiti"]) : undefined
  };
}

function normalizeSnapshot(value: unknown): KnowledgeDocumentSnapshot {
  if (value && typeof value === "object") {
    const candidate = value as Partial<KnowledgeDocumentSnapshot>;
    return {
      schemaVersion: 1,
      editor: DOCUMENT_EDITOR,
      editorVersion: typeof candidate.editorVersion === "string" ? candidate.editorVersion : DOCUMENT_EDITOR_VERSION,
      content: normalizeEditorData(candidate.content as KnowledgeDocumentContent | undefined) as KnowledgeDocumentContent,
      updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString()
    };
  }

  return createEmptyKnowledgeDocumentSnapshot();
}

export function createEmptyKnowledgeDocumentSnapshot(): KnowledgeDocumentSnapshot {
  return {
    schemaVersion: 1,
    editor: DOCUMENT_EDITOR,
    editorVersion: DOCUMENT_EDITOR_VERSION,
    content: {
      main: [{ value: "" }]
    },
    updatedAt: new Date().toISOString()
  };
}

function toSnapshot(editor: CanvasEditorInstance): KnowledgeDocumentSnapshot {
  const value = editor.command.getValue();
  return {
    schemaVersion: 1,
    editor: DOCUMENT_EDITOR,
    editorVersion: DOCUMENT_EDITOR_VERSION,
    content: normalizeEditorData(value.data) as KnowledgeDocumentContent,
    updatedAt: new Date().toISOString()
  };
}

function toFormatState(payload: IRangeStyle): KnowledgeDocumentFormatState {
  return {
    fontSize: Number.isFinite(payload.size) ? payload.size : DEFAULT_FONT_SIZE,
    color: payload.color || DEFAULT_COLOR,
    bold: Boolean(payload.bold),
    italic: Boolean(payload.italic),
    underline: Boolean(payload.underline)
  };
}

function getLandscapePageSize(container: HTMLDivElement) {
  const availableWidth = container.parentElement?.clientWidth ?? container.clientWidth;
  const width = Math.max(MIN_LANDSCAPE_PAGE_WIDTH, Math.floor(availableWidth - DOCUMENT_PAGE_GUTTER));
  return {
    width,
    height: Math.round(width * LANDSCAPE_PAGE_RATIO)
  };
}

export async function createCanvasDocumentEditor(
  container: HTMLDivElement,
  snapshot: KnowledgeDocumentSnapshot,
  events: CanvasDocumentEvents
): Promise<KnowledgeDocumentEditorHandle> {
  const { default: Editor, EditorMode, PageMode, PaperDirection, RenderMode } = await loadCanvasEditor();
  const pageSize = getLandscapePageSize(container);
  const editor = new Editor(container, normalizeEditorData(normalizeSnapshot(snapshot).content), {
    mode: EditorMode.EDIT,
    pageMode: PageMode.CONTINUITY,
    paperDirection: PaperDirection.HORIZONTAL,
    renderMode: RenderMode.SPEED,
    defaultFont: "Microsoft YaHei",
    defaultSize: DEFAULT_FONT_SIZE,
    defaultColor: DEFAULT_COLOR,
    minSize: 10,
    maxSize: 72,
    historyMaxRecordCount: 60,
    pageGap: 16,
    width: pageSize.height,
    height: pageSize.width,
    margins: [64, 64, 64, 64]
  });

  editor.listener.contentChange = () => {
    events.onSnapshotChanged?.(toSnapshot(editor));
  };
  editor.listener.rangeStyleChange = (payload) => {
    events.onFormatChanged?.(toFormatState(payload));
  };
  editor.register.contextMenuList([
    {
      key: "aistudy-ask-ai",
      name: "问 AI",
      when: (context) => context.editorHasSelection,
      callback: () => {
        const selectedText = editor.command.getRangeText().trim();
        if (selectedText) events.onAskAi?.(selectedText);
      }
    }
  ]);

  return {
    getSnapshot: () => toSnapshot(editor),
    getSelectedText: () => {
      try {
        return editor.command.getRangeText().trim();
      } catch {
        return "";
      }
    },
    exec: (command) => {
      if (command === "undo") editor.command.executeUndo();
      if (command === "redo") editor.command.executeRedo();
      if (command === "bold") editor.command.executeBold();
      if (command === "italic") editor.command.executeItalic();
      if (command === "underline") editor.command.executeUnderline();
      if (command === "save") events.onSnapshotChanged?.(toSnapshot(editor));
    },
    setFontSize: (size) => {
      editor.command.executeSize(size);
    },
    setColor: (color) => {
      editor.command.executeColor(color);
    },
    focus: () => {
      editor.command.executeFocus();
    },
    destroy: () => {
      try {
        editor.destroy();
      } catch {
        // canvas-editor removes its own container during destroy. During rapid
        // mode/node switches that container may already be detached by React.
      }
    }
  };
}
