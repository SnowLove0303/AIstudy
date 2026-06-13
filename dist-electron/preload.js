"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("aistudy", {
    appName: "AIstudy",
    version: "0.1.0",
    courses: {
        load: () => electron_1.ipcRenderer.invoke("courses:load"),
        save: (courses) => electron_1.ipcRenderer.invoke("courses:save", courses),
        storageStatus: () => electron_1.ipcRenderer.invoke("courses:storage-status")
    },
    developerDocuments: {
        load: () => electron_1.ipcRenderer.invoke("developer-documents:load"),
        save: (documents) => electron_1.ipcRenderer.invoke("developer-documents:save")
    },
    mcp: {
        notionImportStatus: () => electron_1.ipcRenderer.invoke("mcp:notion-import-status")
    },
    debug: {
        appendKnowledgeFormatLog: (entry) => electron_1.ipcRenderer.invoke("debug:knowledge-format-log", entry),
        knowledgeFormatLogPath: () => electron_1.ipcRenderer.invoke("debug:knowledge-format-log-path")
    },
    ai: {
        chat: (payload) => electron_1.ipcRenderer.invoke("ai:chat", payload),
        systemContext: () => electron_1.ipcRenderer.invoke("ai:system-context")
    },
    ports: {
        status: () => electron_1.ipcRenderer.invoke("ports:status"),
        openLoginWindow: (platformId) => electron_1.ipcRenderer.invoke("ports:open-login-window", platformId),
        startService: (platformId) => electron_1.ipcRenderer.invoke("ports:start-service", platformId)
    },
    aiDaily: {
        latest: () => electron_1.ipcRenderer.invoke("ai-daily:latest"),
        run: (payload) => electron_1.ipcRenderer.invoke("ai-daily:run", payload),
        openArtifact: (filePath) => electron_1.ipcRenderer.invoke("ai-daily:open-artifact", filePath)
    }
});
