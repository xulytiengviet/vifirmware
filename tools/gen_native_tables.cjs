#!/usr/bin/env node
/* Deterministic CVNSS4.0 v5 -> embedded C++ static data.
 * Reads the V5 reference source; does not guess linguistic rules.
 * node tools/gen_native_tables.cjs
 */
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const root=path.resolve(__dirname,"..");
const input=path.join(root,"docs/assets/cvnss-converter.js");
const output=path.join(root,"native/include/cvnss_tables.generated.h");
const src=fs.readFileSync(input,"utf8");
function readConst(name) {
  const match=new RegExp("const\\s+"+name+"\\s*=\\s*Object\\.freeze\\(\\s*").exec(src);
  if(!match)throw Error("Missing reference array: "+name);
  let i=match.index+match[0].length,begin=i,depth=0,inString=false,escaped=false;
  for(;i<src.length;i++){
    const c=src[i];
    if(inString){if(escaped)escaped=false;else if(c==="\\")escaped=true;else if(c==='"')inString=false;continue;}
    if(c==='"'){inString=true;continue;}
    if(c==="["||c==="{")depth++;
    if(c==="]"||c==="}"){depth--;if(depth===0)return JSON.parse(src.slice(begin,i+1));}
  }
  throw Error("Unterminated reference table: "+name);
}
const base=readConst("BASE_ROWS");
const patch54=readConst("PATCH_54"),patch56=readConst("PATCH_56");
const initials=readConst("INITIAL_PAIRS");
const preferred=readConst("CANONICAL_PREFERRED");
const aliases=readConst("LEGACY_FORWARD_ALIASES");
const groups=readConst("BASE_VOWEL_GROUPS");
if(base.length!==758||patch54.length+patch56.length!==336||Object.keys(preferred).length!==56)
 throw Error("Reference mapping changed: manual audit required");
const rows=[...base,...patch54,...patch56].map(x=>[x[0],x.length===3?x[2]:x[1]]);
const codeInitials=[...new Set(initials.map(x=>x[1]))].sort((a,b)=>b.length-a.length);
const sortInitials=[...initials].sort((a,b)=>b[0].length-a[0].length);
const lowerMap=[],baseMap=[],nfdMap=[],seenLower=new Set(),seenNfd=new Set();
for(const g of groups){
  const baseChar=Array.from(g)[0];
  for(const ch of Array.from(g)){
    if(!seenLower.has(ch)){baseMap.push([ch,baseChar]);seenLower.add(ch);}
    const upper=ch.toLocaleUpperCase("vi-VN");
    if(ch!==upper&&!lowerMap.some(x=>x[0]===upper))lowerMap.push([upper,ch]);
    for(const form of [ch,upper]){
      const d=form.normalize("NFD");
      if(d!==form&&!seenNfd.has(form)){nfdMap.push([form,d]);seenNfd.add(form);}
    }
  }
}
lowerMap.push(["Đ","đ"]);
const i2y=[["i","y"],["ì","ỳ"],["ỉ","ỷ"],["ĩ","ỹ"],["í","ý"],["ị","ỵ"]];
const q=x=>JSON.stringify(x);
const arr=(type,name,items,fn)=>"static constexpr "+type+" "+name+"[] = {\n"+items.map(fn).join("\n")+"\n};\n";
let h="// AUTO GENERATED from docs/assets/cvnss-converter.js. DO NOT EDIT.\n";
h+="// converter v5.0.0-audit-safe / Source SHA256 "+crypto.createHash("sha256").update(src).digest("hex")+"\n";
h+="#pragma once\n#include <cstddef>\nnamespace cvnss_data {\n";
h+="struct Pair { const char* from; const char* to; };\n";
h+=arr("Pair","kRules",rows,x=>"  {"+q(x[0])+", "+q(x[1])+"},");
h+=arr("Pair","kAliases",aliases,x=>"  {"+q(x[0])+", "+q(x[1])+"},");
h+=arr("Pair","kInitials",sortInitials,x=>"  {"+q(x[0])+", "+q(x[1])+"},");
h+=arr("const char*","kCodeInitials",codeInitials,x=>"  "+q(x)+",");
h+=arr("Pair","kPreferred",Object.entries(preferred),x=>"  {"+q(x[0])+", "+q(x[1])+"},");
h+=arr("Pair","kLower",lowerMap,x=>"  {"+q(x[0])+", "+q(x[1])+"},");
h+=arr("Pair","kBaseVowel",baseMap,x=>"  {"+q(x[0])+", "+q(x[1])+"},");
h+=arr("Pair","kDecompositions",nfdMap,x=>"  {"+q(x[0])+", "+q(x[1])+"},");
h+=arr("Pair","kIToY",i2y,x=>"  {"+q(x[0])+", "+q(x[1])+"},");
h+="static constexpr const char* kReferenceVersion=\"5.0.0-audit-safe\";\n";
h+="static constexpr size_t kRuleCount=sizeof(kRules)/sizeof(kRules[0]);\n";
h+="} // namespace cvnss_data\n";
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,h,"utf8");
process.stdout.write("Generated "+rows.length+" CVNSS rows, "+nfdMap.length+" Unicode compositions, "+lowerMap.length+" case mappings. "+h.length+" characters.\n");
