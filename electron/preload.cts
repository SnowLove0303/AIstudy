import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("aistudyWindow", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  close: () => ipcRenderer.invoke("window:close")
});

contextBridge.exposeInMainWorld("aistudyCourses", {
  load: () => ipcRenderer.invoke("courses:load"),
  save: (store: unknown) => ipcRenderer.invoke("courses:save", store)
});

contextBridge.exposeInMainWorld("aistudyMindMaps", {
  load: (courseId: string) => ipcRenderer.invoke("mindmaps:load", courseId),
  save: (document: unknown) => ipcRenderer.invoke("mindmaps:save", document)
});

contextBridge.exposeInMainWorld("aistudyKnowledgeDocuments", {
  load: (request: unknown) => ipcRenderer.invoke("knowledge-documents:load", request),
  save: (request: unknown) => ipcRenderer.invoke("knowledge-documents:save", request)
});

contextBridge.exposeInMainWorld("aistudyChromePorts", {
  status: () => ipcRenderer.invoke("chrome-ports:status"),
  openLogin: (platformId: unknown) => ipcRenderer.invoke("chrome-ports:open-login", platformId)
});

contextBridge.exposeInMainWorld("aistudyAssistant", {
  send: (request: unknown) => ipcRenderer.invoke("ai-chat:send", request)
});

contextBridge.exposeInMainWorld("aistudyLifecycle", {
  onBeforeClose: (callback: () => Promise<unknown> | unknown) => {
    const listener = async (_event: IpcRendererEvent, token: string) => {
      try {
        await callback();
      } finally {
        await ipcRenderer.invoke("app:before-close-complete", token);
      }
    };

    ipcRenderer.on("app:before-close", listener);
    return () => {
      ipcRenderer.off("app:before-close", listener);
    };
  }
});

contextBridge.exposeInMainWorld("aistudyUpdates", {
  loadInfo: () => ipcRenderer.invoke("updates:info"),
  openRepository: () => ipcRenderer.invoke("updates:open-repository"),
  openIndex: () => ipcRenderer.invoke("updates:open-index"),
  openReleaseDir: () => ipcRenderer.invoke("updates:open-release-dir"),
  check: () => ipcRenderer.invoke("updates:check"),
  download: (downloadUrl: string) => ipcRenderer.invoke("updates:download", downloadUrl),
  install: (filePath: string) => ipcRenderer.invoke("updates:install", filePath),
  openReleasePage: (releaseUrl: string) => ipcRenderer.invoke("updates:open-release-page", releaseUrl)
});
