from __future__ import annotations

import os
import tempfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent
PYCACHE_ROOT = PROJECT_ROOT / "_pycache_folder"
PYTEST_TEMP_ROOT = PYCACHE_ROOT / "pytest-temp"

PYTEST_TEMP_ROOT.mkdir(parents=True, exist_ok=True)

temp_path = str(PYTEST_TEMP_ROOT)
os.environ["TMP"] = temp_path
os.environ["TEMP"] = temp_path
os.environ["TMPDIR"] = temp_path
tempfile.tempdir = temp_path
