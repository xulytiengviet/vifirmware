# ViFirmware · CVNSS4.0 × BilaScript × Embedded Data Verification

**An evidence-first, multilingual research laboratory** for Vietnamese text representation, Base27/trits and embedded-oriented data transport. Website: `docs/index.html` (GitHub Pages).

## What this repository does

- Imports the upstream **CVNSS4.0 v5.0.0-audit-safe** JavaScript reference converter with attribution.
- Demonstrates CVNSS4.0 ↔ CQN, candidate ambiguity and canonical decoding **without claiming universal losslessness**.
- Defines **VF1**: a deliberately explicit, testable transport frame combining an uppercase A–Z + SPACE CVNSS4.0 channel, its 3-trit Base27 representation, plus a raw UTF-8 hex sidecar and CRC32. When verified, sidecar bytes round-trip exactly. This **does not** prove CVNSS4.0 alone is injective and **does not** compress data.
- Provides independent **C++, Java, Python, Swift** implementations for frame construction/validation, trits and exact UTF-8 byte recovery. Portable parsers do not pretend to implement the entire CVNSS4.0 linguistic rules.
- Shows a native BilaScript sample; full BilaScript v4 emits JavaScript, not native C++/Java/Python/Swift.
- Provides reproducible tests and a GitHub Pages lab.

## Quickstart

```bash
python3 portable/python/vifirmware.py encode "XIN CHAO" "Xin chào"
python3 portable/python/vifirmware.py decode 'VF1|XIN CHAO|...'
python3 -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.cjs
```

To validate all four targets, see [docs/BUILD.md](docs/BUILD.md). Java 17+, C++17, Python 3.10+, Swift 5.7+, Node 20+ are recommended.

## Evidence policy

**Three independent claims:** (1) NFC canonical normalization preserves canonical content; (2) CVNSS4.0 v5 has known many-to-one ambiguities and canonical decoding is not universally lossless; (3) VF1 with a full raw UTF-8 sidecar recovers bytes exactly when the frame validates. The third is a transport property with overhead, not a linguistic-codec breakthrough.

No hardware build, ESP32-S3 flash, FPGA synthesis, native ternary ISA, NLP improvement, or memory saving is claimed without measured logs. The ESP-IDF example is a future integration target until flashed and tested.

## Architecture

```
NFC CQN  ──> upstream CVNSS4.0 JS ──> ASCII (A–Z + SPACE only)
    │                                       │
    └──── raw UTF-8 sidecar (hex) ──────────┤
                                            ▼
                                    VF1 + Base27/trits
                                            │
                          ┌─────────────────┼───────────────┐
                          ▼                 ▼               ▼
                        C++               Java           Python / Swift
                          └──────────── CRC32 + exact bytes ─────────┘
```

For punctuation, digits, emoji, or CVNSS output outside A–Z + SPACE, the strict frame rejects input instead of deleting information. A future version may extend the alphabet/framing scheme.

See [formal specification](spec/VF1.md), [BilaScript integration](examples/README.md), [reproducibility](docs/BUILD.md).

## Sources and rights

CVNSS4.0 originally by **Kiều Trường Lâm & Trần Tư Bình**; encoder derived from [xulytiengviet/CVNSS4.0](https://github.com/xulytiengviet/CVNSS4.0), v5.0.0-audit-safe. BilaScript frontend: [xulytiengviet/bilascript](https://github.com/xulytiengviet/bilascript). Lab additions: Long Ngo, MIT. Rights to the original CVNSS4.0 work are not changed by this repository's license.
