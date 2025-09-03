const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, minimal API to the renderer (React)
contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  versions: process.versions
});
