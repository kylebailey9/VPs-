const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('frameflowDesktop', Object.freeze({
  platform: 'windows-desktop',
  openImages: () => ipcRenderer.invoke('images:open'),
  saveFile: (payload) => ipcRenderer.invoke('file:save', payload),
  print: () => ipcRenderer.invoke('window:print'),
  picturesPath: () => ipcRenderer.invoke('app:location')
}));
