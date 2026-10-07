import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
const require=createRequire(new URL('../frontend/package.json',import.meta.url)),{DOMImplementation,XMLSerializer}=require('@xmldom/xmldom');
const doc=new DOMImplementation().createDocument('http://www.w3.org/2000/svg','svg',null),create=doc.createElementNS.bind(doc);
doc.createElementNS=(...args)=>{const e=create(...args);e.style={};return e;};globalThis.document=doc;globalThis.XMLSerializer=XMLSerializer;
const {buildCharacter,characterSVG}=await import('../frontend/test-build/character-3d.mjs');let tiles=[];
const names=['Amii','Nara','Rei','Kira','Luna','Sora','Mika','Achi','Lora','Dante'];
for(let index=0;index<10;index++)for(const pose of ['idle','left','mid','right','work']){
 const rig=buildCharacter(index,pose);assert(rig.userData.totalHeight/rig.userData.headHeight>7,'Adult head-to-body ratio');
 const svg=characterSVG(index,pose);assert(svg.includes('<path'));assert(!svg.includes('NaN'));assert(!svg.includes('Infinity'));
 if(pose==='idle'){const x=20+(index%5)*150,y=10+Math.floor(index/5)*220;tiles.push(svg.replace('<svg ',`<svg x="${x}" y="${y}" `)+`<text x="${x+60}" y="${y+211}" text-anchor="middle" fill="#cde5d4" font-family="sans-serif" font-size="14">${names[index]}</text>`);}
}
if(process.argv[2])writeFileSync(process.argv[2],'<svg xmlns="http://www.w3.org/2000/svg" width="780" height="450"><rect width="100%" height="100%" fill="#1c2d28"/>'+tiles.join('')+'</svg>');
console.log('Passed: 50 3D employee poses render without invalid geometry and retain adult proportions.');
