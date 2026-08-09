"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const sidecarAPI = {
    getStatus: () => electron_1.ipcRenderer.invoke('sidecar:status'),
    getHealth: () => electron_1.ipcRenderer.invoke('sidecar:health'),
    restart: () => electron_1.ipcRenderer.invoke('sidecar:restart'),
    getPorts: () => electron_1.ipcRenderer.invoke('sidecar:ports'),
};
const fileSyncAPI = {
    writeFiles: (params) => electron_1.ipcRenderer.invoke('fileSync:writeFiles', params),
};
electron_1.contextBridge.exposeInMainWorld('sidecar', sidecarAPI);
electron_1.contextBridge.exposeInMainWorld('fileSync', fileSyncAPI);
