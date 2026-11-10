import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("vf1", ROOT / "portable/python/vifirmware.py")
vf1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vf1)

class TransportTests(unittest.TestCase):
    def test_three_trits(self):
        self.assertEqual(vf1.trits("A Z"), "001000222")
        self.assertEqual(len(vf1.trits("ABCDEFGHIJKLMNOPQRSTUVWXYZ ")), 81)

    def test_roundtrip_raw_utf8(self):
        for raw in ("Xin chào", "ệ", "e\u0323\u0302", "", "Tôi yêu tiếng Việt"):
            f = vf1.encode("XIN CHAO", raw)
            self.assertEqual(vf1.decode(f), raw.encode("utf-8"))

    def test_reject_invalid(self):
        with self.assertRaises(ValueError):
            vf1.encode("HELLO!", "x")
        frame = vf1.encode("VIET NAM", "Tiếng Việt")
        with self.assertRaises(ValueError):
            vf1.decode(frame[:-1] + ("0" if frame[-1] != "0" else "1"))
        with self.assertRaises(ValueError):
            vf1.decode(frame.replace("001", "002", 1))

if __name__ == "__main__":
    unittest.main()
