# ViFirmware Frame Protocol — VF1 (experimental v1)

Status: experimental *transport framing*, NOT a new Unicode normalization form and NOT proof that CVNSS4.0 is injective.

## Normative message form
ASCII text: \`VF1|CODE|TRITS|HEX|CRC\` (exactly five pipe-delimited fields).

- \`CODE\`: 1–1024 characters, each from U+0020 (SPACE) or ASCII A–Z. On ingress, the official CVNSS4.0 converter may generate it from NFC CQN; STRICT mode rejects any other character, including punctuation or lower-case. Byte for letter is its uppercase ASCII value.
- \`TRITS\`: exactly \`3 × CODE.length\` characters, each 0,1,2. Use alphabet \`" ABCDEFGHIJKLMNOPQRSTUVWXYZ"\`, with SPACE=0, A=1, Z=26. For each value v (0..26): digits = floor(v/9), floor(v/3)%3, v%3. Example: SPACE→000; A→001; Z→222.
- \`HEX\`: uppercase ASCII hexadecimal, two digits per byte, possibly empty, representing **the original unmodified UTF-8 byte sequence** (a lossless sidecar).
- \`CRC\`: exactly eight uppercase hexadecimal digits, IEEE CRC-32 of \`CODE bytes || 0x00 || original bytes\`, initial state 0xFFFFFFFF, reflected polynomial 0xEDB88320, final XOR 0xFFFFFFFF.
- Frame rejects invalid field count, bad alphabet, incorrect trits, invalid hex, invalid checksum, malformed UTF-8 when a textual client requires it, and overly long CODE. Encoding applications must not silently strip unsupported characters.

## Guarantees and non-guarantees

1. For every successfully decoded VF1 frame, recovery of **original UTF-8 bytes** is exact, because those bytes are deliberately included in HEX. Formally \`decode(frame(code, raw)).raw == raw\`. This is a framing property, not CVNSS4.0 alone.
2. The CODE channel and its trits must match. CRC detects accidental mutations to CODE and HEX, but is **not authentication** or encryption.
3. The frame does **not** establish \`decode_cvnss4(encode_cvnss4(cqn)) == cqn\` for all CQN. The reference v5.0.0-audit-safe converter documents 56 groups of ambiguous codes.
4. FRAME/CODE and original RAW need not be semantically related unless an upstream audit independently asserts \`encode_cvnss4(NFC(raw_text)) == CODE\`. The browser demo carries out this audit; portable parsers guarantee only protocol integrity.
5. CVNSS4.0 may offer compact characters in some corpora; VF1 with HEX is deliberately **larger** and must not be used to claim compression.
6. 3 trits per Base27 character is a mathematical representation; ESP32-S3, Java, Python, C++ and Swift still run on binary processors.
7. Byte-exact losslessness differs from canonical text equivalence. NFC changes byte sequences of decomposed Unicode. Raw sidecar remains untouched.
8. No locale-dependent case folding is applied in VF1; input CODE must already satisfy the alphabet.

## Cross-language contract

CLI:
- \`encode "CODE" "original UTF-8 text"\` → one VF1 ASCII line (plus LF) on stdout.
- \`decode "VF1|..."\` → original raw bytes, **without** an implicit LF.
- Errors → stderr, nonzero exit code.
- All implementations use the same canonical uppercase serialization.

## Security and limits

All implementations limit CODE to at most 1024 characters and reject malformed frame fields; intended for demos. Resource-constrained production devices should additionally bound total received frame bytes, guard against replay, provision credentials and prefer authenticated transports.

## Ownership

The CVNSS4.0 script in this repository is a versioned upstream reference. VF1 and portable clients are separately authored experimental utilities, not part of the original CVNSS4.0 language rules.
