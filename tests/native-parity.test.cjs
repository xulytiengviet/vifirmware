#!/usr/bin/env node
/* Differential test: external C++ native executable vs canonical JS v5.
 * This is a host simulation/proof of algorithm parity, not ESP32-S3 flashing.
 */
"use strict";
const assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process");
const fs=require("node:fs"), path=require("node:path");
const reference=require("../docs/assets/cvnss-converter.js");
const exe=process.env.CVNSS_NATIVE || "./build/cvnss_native";
const src=fs.readFileSync(path.resolve(__dirname,"../docs/assets/cvnss-converter.js"),"utf8");
function readRows(name){
  const m=new RegExp("const\\s+"+name+"\\s*=\\s*Object\\.freeze\\(\\s*").exec(src);
  if(!m)throw Error("Missing source "+name);
  let start=m.index+m[0].length,depth=0,quote=false,esc=false;
  for(let i=start;i<src.length;i++){
    const c=src[i];
    if(quote){if(esc)esc=false;else if(c==="\\")esc=true;else if(c==='"')quote=false;continue;}
    if(c==='"'){quote=true;continue;}
    if(c==="["||c==="{")depth++;
    if(c==="]"||c==="}"){depth--;if(depth===0)return JSON.parse(src.slice(start,i+1));}
  }
  throw Error("Invalid source table");
}
function native(action,input){
  return execFileSync(exe,[action,input],{encoding:"utf8",maxBuffer:1024*1024}).replace(/\r?\n$/,"");
}
const entries=[...readRows("BASE_ROWS"),...readRows("PATCH_54"),...readRows("PATCH_56")];
const samples=new Set(["tôi","Tôi","TÔI","Tôi yêu tiếng Việt","tôi yêu tiếng việt",
  "Nguyễn", "NGUYỄN","nghiêng","nguyễn", "điện", "ệ", "e\u0323\u0302", "hoà", "hòa",
  "sẽ", "hề", "mồ", "mộ", "võ", "abc", "kiên","giếng","quyết"]);
for(const row of entries)samples.add(row[0]);
for(const row of entries.filter((_,i)=>i%19===0)){
  for(const onset of ["t","h","ng","ph","qu","gi","g","đ","c","k"]){
    samples.add(onset+row[0]);
  }
}
const failed=[],counts={encode:0,decode:0,inspect:0};
for(const text of samples){
  const expected=reference.fromCqn(text).cvss;
  let actual;
  try{actual=native("encode",text);}catch(error){failed.push({kind:"encode-exception",text,error:String(error)});continue;}
  counts.encode++;
  if(actual!==expected)failed.push({kind:"encode",text,expected,actual});
  const fromRef=reference.fromCvss(expected).cqn;
  let decoded;
  try{decoded=native("decode",expected);}catch(error){failed.push({kind:"decode-exception",text,expected,error:String(error)});continue;}
  counts.decode++;
  if(decoded!==fromRef)failed.push({kind:"decode",text,cvss:expected,expected:fromRef,actual:decoded});
}
for(const code of ["es","ed","os","od","of","ily","izb","iwy","toiy","vidf","ws","tiyb"]){
  const expected=reference.inspectWord(code);
  const got=JSON.parse(native("inspect",code));
  counts.inspect++;
  if(got.selected!==expected.selected || JSON.stringify(got.candidates)!==JSON.stringify(expected.candidates)){
    failed.push({kind:"inspect",code,expected:{selected:expected.selected,candidates:expected.candidates},got});
  }
}
const summary={
  reference:reference.VERSION,
  entries:entries.length,
  sampleCount:samples.size,
  counts,
  mismatches:failed.length,
  examples:failed.slice(0,18),
  evidence:"HOST native simulation only — no actual ESP32-S3 board measurements"
};
console.log(JSON.stringify(summary,null,2));
fs.mkdirSync("build",{recursive:true});
fs.writeFileSync("build/native-parity-report.json",JSON.stringify(summary,null,2)+"\n");
assert.equal(failed.length,0, "Native CVNSS parity mismatch; inspect JSON report");
console.log("PASS: native on-host C++ CVNSS encoder/decoder agrees with JS reference on tested samples");
