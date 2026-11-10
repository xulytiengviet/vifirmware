# ViFirmware ESP32-S3 — native Unicode/CVNSS4.0 pre-feasibility

**This firmware now calls the actual C++ CVNSS4.0 encoder and canonical decoder on the microcontroller.** It is no longer a precomputed TOIY/VF1-only demonstration. A deterministic table generator derives 1,094 mapping rows from upstream v5.0.0-audit-safe; the generated table and code are in \`native/\`. The core runs offline without JavaScript, Python, server, or precomputed output.

**Verification boundary:** a source implementation and passing native-host CI do *not* prove that a board has been flashed. Firmware binary/heap/latency for an ESP32-S3 are not verified until a real build, flash and UART log are supplied.

## Build and flash

ESP-IDF 5.3+ suggested, a genuine ESP32-S3 board, and a working serial console.

\`\`\`bash
git clone https://github.com/xulytiengviet/vifirmware.git
cd vifirmware/firmware/esp32s3
idf.py set-target esp32s3
idf.py build
idf.py size
idf.py -p COM5 flash monitor
\`\`\`

Replace COM5 with the actual serial port. Tables are committed; Node.js is only needed for regeneration, not for MCU build.

## UART protocol

The demo listens on **UART0 at 115200, 8N1**, using the ESP-IDF UART driver. Type a full line in a UART0 terminal (send UTF-8 bytes), not just in a USB-Serial/JTAG console if it is a separate port:

\`\`\`text
HELP
INFO
ENC Tôi yêu tiếng Việt
ENC tôi
ENC ệ
DEC toiy
INS es
NFC ệ
\`\`\`

The device logs input, on-device encoded CVNSS, canonical decoded CQN, ambiguity count, encode/decode time in microseconds, free/minimum internal RAM. For supported Vietnamese accents, NFD variants normalize to Vietnamese NFC in the native subset. **This is not complete arbitrary-script Unicode NFC**.

If your board uses USB Serial/JTAG for default console instead of UART0, attach a suitable 3.3V USB-to-UART adapter to the board's UART0 RX/TX pins (verify pin assignment, avoid bootstrapping/flash pins, share ground). Never connect 5V serial voltage to GPIO.

## What counts as proof

1. Host differential test: JS v5 vs native C++ encode, canonical decode, candidate APIs on frozen test set; publish non-matching cases honestly.
2. ESP-IDF build: binary SHA256, size report, board/IDF version.
3. Actual flash and runtime logs: UART0 responses to **user-input** Unicode, not merely preloaded test cases.
4. Additional robustness: malformed UTF-8, 1024-byte max, 56 ambiguity groups, repeated input and heap low-water-mark.

## Scientific limitations

- Canonical CVNSS4.0 is many-to-one on some forms, not universally lossless; use candidates/strict/escape/sidecar for byte-exact recovery.
- Unicode normalization is limited to the Vietnamese vowel combining repertoire; it is not a full ICU-compatible normalization engine.
- ASCII text is not automatically smaller after full framing. Trits are logically encoded on binary hardware.
- C++ \`std::string\` and \`std::vector\` are permitted for this feasibility proof, but production firmware may need bounded static memory and a more compact indexed table.
