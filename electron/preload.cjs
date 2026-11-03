const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('yamdv',{
  pickFiles:()=>ipcRenderer.invoke('pick-files'),
  pickFolder:()=>ipcRenderer.invoke('pick-folder'),
  readFile:path=>ipcRenderer.invoke('read-file',path),
  openExternal:url=>ipcRenderer.invoke('external',url)
});
