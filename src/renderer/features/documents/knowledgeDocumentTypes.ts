export type KnowledgeDocumentElement = unknown;

export type KnowledgeDocumentContent = {
  header?: KnowledgeDocumentElement[];
  main: KnowledgeDocumentElement[];
  footer?: KnowledgeDocumentElement[];
  graffiti?: unknown[];
};

export type KnowledgeDocumentSnapshot = {
  schemaVersion: 1;
  editor: "aistudy-word";
  editorVersion: string;
  content: KnowledgeDocumentContent;
  updatedAt: string;
};

export type KnowledgeDocumentRecord = {
  courseId: string;
  mindMapId: string;
  nodeId: string;
  documentId: string;
  title: string;
  snapshot: KnowledgeDocumentSnapshot;
  updatedAt: string | null;
  byteSize: number;
};

export type KnowledgeDocumentSaveInput = {
  courseId: string;
  mindMapId: string;
  nodeId: string;
  title: string;
  snapshot: KnowledgeDocumentSnapshot;
};

export type KnowledgeDocumentCommand = "undo" | "redo" | "bold" | "italic" | "underline" | "save";

export type KnowledgeDocumentFormatState = {
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

export type KnowledgeDocumentEditorHandle = {
  getSnapshot: () => KnowledgeDocumentSnapshot;
  getSelectedText: () => string;
  exec: (command: KnowledgeDocumentCommand) => void;
  setFontSize: (size: number) => void;
  setColor: (color: string) => void;
  focus: () => void;
  destroy: () => void;
};
