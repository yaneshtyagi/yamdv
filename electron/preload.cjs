const {contextBridge,ipcRenderer,webUtils}=require('electron');
const listen=(channel,fn)=>{const handler=(_,value)=>fn(value);ipcRenderer.on(channel,handler);return()=>ipcRenderer.removeListener(channel,handler);};
contextBridge.exposeInMainWorld('yamdv',{
 pickFiles:()=>ipcRenderer.invoke('pick-files'),pickFolder:()=>ipcRenderer.invoke('pick-folder'),
 readFile:path=>ipcRenderer.invoke('read-file',path),fileStatus:path=>ipcRenderer.invoke('file-status',path),
 droppedFile:file=>{const path=webUtils.getPathForFile(file);return path?ipcRenderer.invoke('dropped-file',path):Promise.resolve(null);},
 openExternal:url=>ipcRenderer.invoke('external',url),newWindow:()=>ipcRenderer.invoke('new-window'),
 getLibrary:()=>ipcRenderer.invoke('get-library'),mutateLibrary:op=>ipcRenderer.invoke('mutate-library',op),
 onLibrary:fn=>listen('library',fn),onCommand:fn=>listen('command',fn),commandState:ctx=>ipcRenderer.invoke('command-state',ctx)
});
