#!/usr/bin/env python3
"""Exhaustively check the VF1 27-symbol <-> three-trit bijection.

Normative alphabet is SPACE=0, A=1, ..., Z=26 as in spec/VF1.md.
This is data representation verification, not ternary hardware or compression.
"""
from itertools import product

ALPHABET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def to_trits(ch):
    value = ALPHABET.index(ch)
    return str(value // 9) + str((value // 3) % 3) + str(value % 3)


def from_trits(trits):
    if len(trits) != 3 or any(ch not in "012" for ch in trits):
        raise ValueError("Exactly three ordinary trits required")
    return ALPHABET[int(trits[0]) * 9 + int(trits[1]) * 3 + int(trits[2])]


def main():
    assert len(ALPHABET) == len(set(ALPHABET)) == 27
    codes = {to_trits(ch) for ch in ALPHABET}
    all_codes = {"".join(t) for t in product("012", repeat=3)}
    assert codes == all_codes
    assert all(from_trits(to_trits(ch)) == ch for ch in ALPHABET)
    assert all(to_trits(from_trits(t)) == t for t in all_codes)
    assert "".join(to_trits(ch) for ch in "FAIZ") == "020001100222"
    print("PASS: 27 VF1 symbols map bijectively to 27 unique three-trit strings.")
    print("FAIZ -> 020 001 100 222 (SPACE=0, A=1, ..., Z=26)")
    print("No physical ternary processor / compression advantage is implied.")


if __name__ == "__main__":
    main()
