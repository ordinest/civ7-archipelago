"""Validate the modinfo XML parses cleanly."""
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "mod" / "archipelago.modinfo"
try:
    ET.parse(path)
    print("OK")
except ET.ParseError as e:
    print(f"FAIL: {e}")
    sys.exit(1)
