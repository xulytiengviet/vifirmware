#!/usr/bin/env node
"use strict";
/*
 * Build an AUDITED single-corpus JSONL from licensed lowercased Vietnamese
 * plain-text sentences (one sentence per line).
 *
 * This script is intentionally conservative:
 * - only Unicode LETTERS separated by one ASCII SPACE;
 * - NFC normalization and Vietnamese lowercasing are disclosed transformations;
 * - candidate alternatives come from the version-locked CVNSS4.0 v5 engine;
 * - every listed candidate is re-encoded, invalid alternatives are excluded;
 * - no train/dev/test splitting or unsupported ambiguity fabrication.
 *
 * CLI: node research/backprop/build_corpus.cjs input.txt corpus.jsonl
 */
const fs = require("node:fs");
const path = require("node:path");
const ref = require("../../docs/assets/cvnss-converter.js");

if (process.argv.length !== 4) {
  console.error("Usage: node research/backprop/build_corpus.cjs input.txt output.jsonl");
  process.exit(2);
}
const input = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
if (input === output) throw Error("Input and output paths must differ.");
const lines = fs.readFileSync(input, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
const rows = [];
const rejected = [];
let ambiguous = 0, totalTokens = 0, badCandidate = 0;
const alphabet = /^[A-Z]+$/;
function encode(word) {
  return ref.fromCqn(word).cvss.toUpperCase();
}
for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  if (!raw.trim()) continue;
  const text = raw.normalize("NFC").trim().toLocaleLowerCase("vi-VN");
  if (!/^\p{L}+( \p{L}+)*$/u.test(text)) {
    rejected.push({line:i+1,reason:"Only letters with exactly one ASCII SPACE between words; punctuation/digits excluded"});
    continue;
  }
  try {
    const tokens = [];
    for (const gold of text.split(" ")) {
      const code = encode(gold);
      if (!alphabet.test(code)) throw Error("Out-of-alphabet CVNSS code: " + code);
      const listed = ref.candidatesForWord(code.toLowerCase(), "cvss");
      const candidates = [];
      for (const suggestion of listed) {
        const candidate = suggestion.normalize("NFC").toLocaleLowerCase("vi-VN");
        if (encode(candidate) === code) {
          if (!candidates.includes(candidate)) candidates.push(candidate);
        } else badCandidate++;
      }
      if (encode(gold) !== code) throw Error("Reference encoder parity failed");
      if (!candidates.includes(gold)) candidates.push(gold);
      tokens.push({code, candidates, gold});
    }
    rows.push({id:path.basename(input)+":line-"+String(i+1).padStart(6,"0"),tokens});
    totalTokens += tokens.length;
    ambiguous += tokens.filter(t=>t.candidates.length>1).length;
  } catch (error) {
    rejected.push({line:i+1,reason:String(error.message||error)});
  }
}
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output,rows.map(o=>JSON.stringify(o)).join("\n")+(rows.length?"\n":""),"utf8");
const result={converterVersion:ref.VERSION||"unknown",input:input,output:output,keptSentences:rows.length,totalTokens,ambiguousTokens:ambiguous,rejectedLines:rejected.length,excludedInvalidCandidates:badCandidate,rejected};
fs.writeFileSync(output+".audit.json",JSON.stringify(result,null,2)+"\n","utf8");
console.log(JSON.stringify({...result,rejected:rejected.slice(0,10)},null,2));
if (!rows.length) {console.error("No eligible sentences; check audit file.");process.exitCode=1;}
