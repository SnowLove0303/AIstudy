import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("aistudy", {
  appName: "AIstudy",
  version: "0.1.0"
});
