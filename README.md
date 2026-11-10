# ViFirmware · CVNSS4.0 × BilaScript × Embedded Data Verification

**An evidence-first, multilingual research laboratory** for Vietnamese text representation, Base27/trits and embedded-oriented data transport. Website: `docs/index.html` (GitHub Pages; enable **Deploy from a branch → main → /docs** in Settings → Pages).

## What this repository does

- Imports the upstream **CVNSS4.0 v5.0.0-audit-safe** JavaScript reference converter with attribution.
- Demonstrates CVNSS4.0 ↔ CQN, candidate ambiguity and canonical decoding **without claiming universal losslessness**.
- Defines **VF1**: a deliberately explicit, testable transport frame combining an uppercase A–Z + SPACE CVNSS4.0 channel, its 3-trit Base27 representation, plus a raw UTF-8 hex sidecar and CRC32. When verified, sidecar bytes round-trip exactly. This **does not** prove CVNSS4.0 alone is injective and **does not** compress data.
- Provides independent **C++, Java, Python, Swift** implementations for frame construction/validation, trits and exact UTF-8 byte recovery. Portable parsers do not pretend to implement the entire CVNSS4.0 linguistic rules.
- Shows a native BilaScript sample; full BilaScript v4 emits JavaScript, not native C++/Java/Python/Swift.
- Provides reproducible tests and a GitHub Pages lab.

## Quickstart

```bash
python3 portable/python/vifirmware.py encode "TOIY" "tôi"
python3 portable/python/vifirmware.py decode 'VF1|TOIY|...'
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

## Publish the website

Go to **Settings → Pages → Build and deployment → Deploy from a branch → main → /docs → Save**. Once GitHub activates Pages, open https://xulytiengviet.github.io/vifirmware/. Repository settings are required; repository write access alone does not activate Pages.

## Embedded reference

An interactive on-device Unicode ↔ CVNSS4.0 native C++ codec is in [`firmware/esp32s3/`](firmware/esp32s3/). The native core has host parity evidence; physical board operation, broad Unicode normalization, strict and lossless escaping remain unverified or incomplete.

## Đánh giá đưa toàn bộ CVNSS4.0 lên ESP32-S3

- [Trang đánh giá ưu/nhược, lựa chọn kiến trúc và cổng nghiệm thu](docs/embedded.html)
- [Báo cáo kỹ thuật full codec ESP32-S3](docs/FULL_CODEC_ESP32S3.md)

**Phân biệt:** hiện có firmware VF1 dùng code CVNSS4.0 tính sẵn; **chưa** có full encoder/decoder CVNSS4.0 chạy trên MCU, không có kết quả Flash/RAM/latency đo trên ESP32-S3. Giải mã canonical CVNSS4.0 không bảo đảm khôi phục mọi CQN do có nhóm nhập nhằng.

Khuyến nghị: cổng phát hành dựa trên parity với converter v5 → xuất golden corpus → core C++ sinh bảng tĩnh Flash → build/flash ESP32-S3 → đo bộ nhớ/độ trễ → fuzz/OTA. BilaScript v4 là frontend biên dịch JavaScript, **không** phải compiler native Xtensa.


## Native ESP32-S3 CVNSS4.0 proof-of-concept (2026-11-10)

**[Trực quan hóa & Web Serial thực nghiệm](docs/native-lab.html)** · [Native C++ core](native/src/cvnss_codec.cpp) · [ESP-IDF UART0 firmware](firmware/esp32s3/main/main.cpp) · [Host parity CI](.github/workflows/native.yml) · [ESP32 cross-build CI](.github/workflows/esp-idf.yml)

- Runtime trên MCU là C++ độc lập, không cần JavaScript/cloud, tự đọc Unicode UTF-8 qua UART0 và mã hóa/giải mã.
- Bảng C++ sinh tái lập từ CVNSS4.0 v5, gồm 1.094 mapping rows; xử lý tiếng Việt NFC/NFD trong miền đã định nghĩa, không tuyên bố ICU/Unicode NFC tổng quát.
- Đối chiếu JS ↔ native host: **1.467 input strings; 1.467 encode + 1.467 canonical decode + 12 candidate cases, 0 mismatches** (CI 42775545642); tập mẫu không phải mọi Unicode.
- ESP-IDF trong CI đã tạo file \`vifirmware_esp32s3.bin\` (0x3CDB0 byte ở lần biên dịch đầu); cần kiểm tra artifact workflow phiên bản mới và chạy flash trên board để chứng minh vận hành thật.
- **Chưa có log board thật**, chưa đo latency/heap thực của thiết bị, chưa có strict byte-exact từ CVNSS4.0 không metadata.
