#!/usr/bin/env python3
"""VF1 reference transport client. Not an implementation of CVNSS4.0 spelling rules."""
import re
import sys
import zlib

ALPHABET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ"
CODE_RE = re.compile(r"[A-Z ]{1,1024}\Z", re.ASCII)
HEX_RE = re.compile(r"(?:[0-9A-F]{2})*\Z", re.ASCII)

def trits(code: str) -> str:
    if not CODE_RE.fullmatch(code):
        raise ValueError("CODE accepts only 1..1024 ASCII A-Z or SPACE characters")
    return "".join(f"{ALPHABET.index(c)//9}{ALPHABET.index(c)//3%3}{ALPHABET.index(c)%3}" for c in code)

def checksum(code: str, raw: bytes) -> str:
    return f"{zlib.crc32(code.encode('ascii') + b'\x00' + raw) & 0xFFFFFFFF:08X}"

def encode(code: str, original: str) -> str:
    raw = original.encode("utf-8")
    return f"VF1|{code}|{trits(code)}|{raw.hex().upper()}|{checksum(code, raw)}"

def decode(frame: str) -> bytes:
    fields = frame.split("|")
    if len(fields) != 5 or fields[0] != "VF1":
        raise ValueError("expected exactly five VF1 fields")
    _, code, digits, hexbytes, crc = fields
    if digits != trits(code):
        raise ValueError("CODE and TRITS mismatch")
    if HEX_RE.fullmatch(hexbytes) is None:
        raise ValueError("HEX must contain uppercase byte pairs")
    if re.fullmatch(r"[0-9A-F]{8}", crc, re.ASCII) is None:
        raise ValueError("CRC must contain eight uppercase hex digits")
    raw = bytes.fromhex(hexbytes)
    if checksum(code, raw) != crc:
        raise ValueError("CRC32 mismatch")
    raw.decode("utf-8", "strict")
    return raw

def main(argv: list[str]) -> int:
    try:
        if len(argv) == 4 and argv[1] == "encode":
            print(encode(argv[2], argv[3]))
        elif len(argv) == 3 and argv[1] == "decode":
            sys.stdout.buffer.write(decode(argv[2]))
        else:
            print("usage: vifirmware.py encode CODE ORIGINAL | decode FRAME", file=sys.stderr)
            return 2
    except (ValueError, UnicodeError) as e:
        print("VF1 error:", e, file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
