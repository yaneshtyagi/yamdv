import sharp from 'sharp';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await fs.mkdir('public',{recursive:true});await fs.mkdir('build',{recursive:true});
// Crop around the central supplied mark. The original remains byte-for-byte intact.
const crop=sharp('logo/logo.png').extract({left:920,top:315,width:900,height:900});
await crop.clone().resize(512,512).png().toFile('build/icon.png');
await crop.clone().resize(96,96).png().toFile('public/logo.png');
const png=await crop.clone().resize(256,256).png().toBuffer();
// ICO with a PNG-compressed 256px image.
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);await fs.writeFile('build/icon.ico',Buffer.concat([header,png]));await fs.copyFile('build/icon.ico','public/favicon.ico');
const chunks=[];for(const [type,size] of [['ic07',128],['ic08',256],['ic09',512],['ic10',1024]]){const data=await crop.clone().resize(size,size).png().toBuffer();const h=Buffer.alloc(8);h.write(type);h.writeUInt32BE(data.length+8,4);chunks.push(h,data);}const icns=Buffer.alloc(8);icns.write('icns');icns.writeUInt32BE(8+chunks.reduce((n,b)=>n+b.length,0),4);await fs.writeFile('build/icon.icns',Buffer.concat([icns,...chunks]));await fs.rm('build/app.iconset',{recursive:true,force:true});
for(const theme of ['light','dark']){const css=await fs.readFile(`node_modules/github-markdown-css/github-markdown-${theme}.css`,'utf8');await fs.writeFile(`src/github-${theme}.css`,css.replaceAll('.markdown-body',`:root[data-theme="${theme}"] .markdown-body`));}
