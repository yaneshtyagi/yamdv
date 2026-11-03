const { app, BrowserWindow, dialog, ipcMain, shell, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const allowed = new Set();
const assets = new Set();
const markdown = p => /\.(md|markdown|mdown|mkd)$/i.test(p);
protocol.registerSchemesAsPrivileged([{scheme:'yamdv-asset',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
async function describe(p) { allowed.add(p); assets.add(path.dirname(p)); return {id:p,path:p,name:path.basename(p),relative:path.basename(p)}; }
async function scan(root, dir=root) {
  const result=[];
  for (const entry of await fs.readdir(dir,{withFileTypes:true})) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const p=path.join(dir,entry.name);
    if(entry.isDirectory()) result.push(...await scan(root,p));
    else if(entry.isFile() && markdown(p)) result.push({...await describe(p),relative:path.relative(root,p).split(path.sep).join('/')});
  }
  return result;
}
app.whenReady().then(()=>{
  protocol.handle('yamdv-asset', async request=>{
    try {
      const p=await fs.realpath(decodeURIComponent(new URL(request.url).pathname));
      const ok=[...assets].some(root=>p.startsWith(root+path.sep));
      if(!ok || !/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(p)) return new Response('Forbidden',{status:403});
      return net.fetch(pathToFileURL(p).href);
    } catch { return new Response('Not found',{status:404}); }
  });
  ipcMain.handle('pick-files',async()=>{
    const result=await dialog.showOpenDialog({properties:['openFile','multiSelections'],filters:[{name:'Markdown',extensions:['md','markdown','mdown','mkd']}]});
    return result.canceled?null:Promise.all(result.filePaths.map(describe));
  });
  ipcMain.handle('pick-folder',async()=>{
    const result=await dialog.showOpenDialog({properties:['openDirectory']});
    if(result.canceled)return null;
    return {name:path.basename(result.filePaths[0]),files:await scan(result.filePaths[0])};
  });
  ipcMain.handle('read-file',async(_,p)=>{
    if(!allowed.has(p)) throw new Error('Reopen this file or its folder to grant access.');
    return fs.readFile(p,'utf8');
  });
  ipcMain.handle('external',(_,url)=>{if(/^https?:\/\//i.test(url))return shell.openExternal(url);});
  function createWindow(){
    const win=new BrowserWindow({width:1280,height:850,minWidth:700,minHeight:500,title:'YAMDV',backgroundColor:'#f8f9fb',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',e=>e.preventDefault());
    if(process.argv.includes('--dev')) win.loadURL('http://127.0.0.1:5173');
    else win.loadFile(path.join(__dirname,'../dist/index.html'));
  }
  createWindow();
  app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
