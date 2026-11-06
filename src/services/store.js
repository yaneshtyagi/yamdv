import * as library from '../../shared/library.mjs';
export const {normalize,applyOperation,findNode,collectFiles}=library;
export const desktop=typeof window!=='undefined'&&typeof window.yamdv?.pickFiles==='function'?window.yamdv:null;
let dbPromise;
export function database(){return dbPromise??=new Promise((resolve,reject)=>{const req=indexedDB.open('yamdv',1);req.onupgradeneeded=()=>{req.result.createObjectStore('library');req.result.createObjectStore('handles');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function browserOperation(op){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('library','readwrite'),store=tx.objectStore('library');let state;const req=store.get('shared');req.onsuccess=()=>{try{state=applyOperation(req.result,op);store.put(state,'shared');}catch(e){reject(e);tx.abort();}};tx.oncomplete=()=>resolve(state);tx.onerror=()=>reject(tx.error);});}
export async function getLibrary(){if(desktop)return desktop.getLibrary();const db=await database();return new Promise((resolve,reject)=>{const req=db.transaction('library').objectStore('library').get('shared');req.onsuccess=()=>resolve(normalize(req.result));req.onerror=()=>reject(req.error);});}
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('yamdv-library'):null;
export async function mutate(op){const state=desktop?await desktop.mutateLibrary(op):await browserOperation(op);channel?.postMessage(state.revision);return state;}
export function subscribe(fn){if(desktop)return desktop.onLibrary(fn);const listener=()=>getLibrary().then(fn);channel?.addEventListener('message',listener);return()=>channel?.removeEventListener('message',listener);}
export function legacy(){function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}return {favorites:read('yamdv.favorites',[]),history:read('yamdv.history',[]),theme:read('yamdv.theme','system')};}
export async function handleStore(id,value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('handles',value?'readwrite':'readonly'),s=tx.objectStore('handles');const req=value?s.put(value,id):s.get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
