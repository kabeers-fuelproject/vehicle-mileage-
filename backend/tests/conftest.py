import os
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

# Keep tests fast and deterministic: a slow upstream should time out in
# milliseconds, not the production 10s read timeout.
os.environ['UPSTREAM_CONNECT_TIMEOUT'] = '0.25'
os.environ['UPSTREAM_READ_TIMEOUT'] = '0.25'
os.environ['UPSTREAM_RETRY_BACKOFF'] = '0.01'
os.environ['UPSTREAM_CACHE_TTL'] = '30'

import upstream  # noqa: E402


@pytest.fixture(autouse=True)
def clear_upstream_cache():
    upstream.clear_cache()
    yield
    upstream.clear_cache()
