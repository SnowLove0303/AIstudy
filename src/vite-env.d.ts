/// <reference types="vite/client" />

interface Window {
  aistudy: {
    appName: string;
    version: string;
    courses?: {
      load: () => Promise<unknown>;
      save: (courses: unknown) => Promise<void>;
      storageStatus: () => Promise<unknown>;
    };
    developerDocuments?: {
      load: () => Promise<unknown>;
      save: (documents: unknown) => Promise<void>;
    };
    mcp?: {
      notionImportStatus: () => Promise<unknown>;
    };
    debug?: {
      appendKnowledgeFormatLog: (entry: unknown) => Promise<void>;
      knowledgeFormatLogPath: () => Promise<string>;
    };
    ai?: {
      chat: (payload: unknown) => Promise<unknown>;
      systemContext: () => Promise<unknown>;
    };
    ports?: {
      status: () => Promise<unknown>;
      openLoginWindow: (platformId: unknown) => Promise<unknown>;
      startService: (platformId: unknown) => Promise<unknown>;
    };
    aiDaily?: {
      latest: () => Promise<unknown>;
      run: (payload: unknown) => Promise<unknown>;
      openArtifact: (filePath: unknown) => Promise<unknown>;
    };
  };
}
