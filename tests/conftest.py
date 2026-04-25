from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = PROJECT_ROOT / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

os.environ["APP_ENV"] = "testing"

from app import create_app
from config.settings import TestingConfig


@pytest.fixture
def client() -> TestClient:
    app = create_app(TestingConfig())
    return TestClient(app)
