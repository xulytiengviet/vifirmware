# ESP32-S3 firmware reference

An experimental ESP-IDF C++ target that uses the **precomputed** CVNSS4.0 v5 vector \`tôi → TOIY\`. It creates and verifies a VF1 frame (Base27 trits, raw UTF-8 sidecar, CRC32), and reports timing and free heap over serial.

**Scope:** on-device transport validation of a known CVNSS4.0 symbol sequence, not the complete Vietnamese orthography converter. Neither the binary build nor board flash has been verified yet.

## Build with ESP-IDF 5.x

\`\`\`sh
cd firmware/esp32s3
idf.py set-target esp32s3
idf.py build
idf.py -p COM5 flash monitor
\`\`\`

Replace COM5 with the actual board serial port. No Wi-Fi, external sensors, or GPIO wiring required.

## Required acceptance evidence

Publish the git SHA, ESP-IDF and board versions, \`idf.py size\` output, firmware binary SHA256, serial PASS/FAIL logs, measured time and free heap, and repeated golden-vector tests. Do not assign hardware TRL based on the existence of this source code alone.
