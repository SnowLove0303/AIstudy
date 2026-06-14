import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("aistudy", {
  appName: "AIstudy",
  version: "0.1.0",
  courses: {
    load: () => ipcRenderer.invoke("courses:load"),
    save: (courses: unknown) => ipcRenderer.invoke("courses:save", courses),
    storageStatus: () => ipcRenderer.invoke("courses:storage-status")
  },
  developerDocuments: {
    load: () => ipcRenderer.invoke("developer-documents:load"),
    save: (documents: unknown) => ipcRenderer.invoke("developer-documents:save")
  },
  mcp: {
    notionImportStatus: () => ipcRenderer.invoke("mcp:notion-import-status")
  },
  debug: {
    appendKnowledgeFormatLog: (entry: unknown) => ipcRenderer.invoke("debug:knowledge-format-log", entry),
    knowledgeFormatLogPath: () => ipcRenderer.invoke("debug:knowledge-format-log-path")
  },
  ai: {
    chat: (payload: unknown) => ipcRenderer.invoke("ai:chat", payload),
    systemContext: () => ipcRenderer.invoke("ai:system-context")
  },
  ports: {
    status: () => ipcRenderer.invoke("ports:status"),
    openLoginWindow: (platformId: unknown) => ipcRenderer.invoke("ports:open-login-window", platformId),
    startService: (platformId: unknown) => ipcRenderer.invoke("ports:start-service", platformId)
  },
  aiDaily: {
    latest: () => ipcRenderer.invoke("ai-daily:latest"),
    run: (payload: unknown) => ipcRenderer.invoke("ai-daily:run", payload),
    openArtifact: (filePath: unknown) => ipcRenderer.invoke("ai-daily:open-artifact", filePath)
  },
  updates: {
    status: () => ipcRenderer.invoke("updates:status"),
    check: () => ipcRenderer.invoke("updates:check"),
    download: () => ipcRenderer.invoke("updates:download"),
    install: () => ipcRenderer.invoke("updates:install"),
    openReleasePage: () => ipcRenderer.invoke("updates:open-release-page"),
    onStatus: (callback: (status: unknown) => void) => {
      const listener = (_event: unknown, status: unknown) => callback(status);
      ipcRenderer.on("updates:status", listener);
      return () => ipcRenderer.removeListener("updates:status", listener);
    }
  }
});
