"""Shared outbound HTTP transport for upstream APIs.

Every call made through this module is bounded by an explicit timeout, reuses
pooled connections, and is retried only when it is safe to do so.
"""

import copy
import hashlib
import json
import logging
import os
import threading
import time

import requests
from cachetools import TTLCache
from flask import jsonify
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

UPSTREAM_CONNECT_TIMEOUT = float(os.environ.get('UPSTREAM_CONNECT_TIMEOUT', '3.05'))
UPSTREAM_READ_TIMEOUT = float(os.environ.get('UPSTREAM_READ_TIMEOUT', '10'))
UPSTREAM_TIMEOUT = (UPSTREAM_CONNECT_TIMEOUT, UPSTREAM_READ_TIMEOUT)
UPSTREAM_RETRY_BACKOFF = float(os.environ.get('UPSTREAM_RETRY_BACKOFF', '0.2'))
UPSTREAM_CACHE_TTL = float(os.environ.get('UPSTREAM_CACHE_TTL', '20'))
UPSTREAM_CACHE_MAXSIZE = int(os.environ.get('UPSTREAM_CACHE_MAXSIZE', '256'))


def _build_session():
    # Retries are limited to idempotent methods: POSTs may mutate state, so the
    # caller must opt in via request(read_only=True).
    retry = Retry(
        total=1,
        connect=1,
        read=1,
        status=1,
        backoff_factor=UPSTREAM_RETRY_BACKOFF,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({'GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'TRACE'}),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(pool_connections=20, pool_maxsize=20, max_retries=retry)
    session = requests.Session()
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    return session


session = _build_session()


def request(method, url, *, read_only=False, **kwargs):
    """Perform an upstream request with a hard timeout.

    ``read_only`` must be True for POSTs that only query data and never mutate
    upstream state; those are retried once on a timeout/connection failure.
    """
    attempts = 2 if read_only else 1
    for attempt in range(attempts):
        try:
            return session.request(method, url, timeout=UPSTREAM_TIMEOUT, **kwargs)
        except (requests.Timeout, requests.ConnectionError):
            if attempt + 1 >= attempts:
                raise
            time.sleep(UPSTREAM_RETRY_BACKOFF)


def error_response(exc, endpoint):
    """Map an upstream transport failure to a clean JSON response."""
    timed_out = isinstance(exc, requests.Timeout)
    status = 504 if timed_out else 502
    message = 'Upstream API timed out' if timed_out else 'Upstream API is unreachable'
    logger.warning('upstream %s failed: %s', endpoint, type(exc).__name__)
    return jsonify({'error': message}), status


_cache = TTLCache(maxsize=UPSTREAM_CACHE_MAXSIZE, ttl=UPSTREAM_CACHE_TTL)
_cache_lock = threading.Lock()


def cache_key(scope, token, body):
    """Build a per-user cache key: token and body can never collide."""
    token_hash = hashlib.sha256((token or '').encode()).hexdigest()
    body_hash = hashlib.sha256(
        json.dumps(body, sort_keys=True, default=str).encode()
    ).hexdigest()
    return (scope, token_hash, body_hash)


def cache_get(key):
    with _cache_lock:
        value = _cache.get(key)
    return copy.deepcopy(value) if value is not None else None


def cache_set(key, value):
    with _cache_lock:
        _cache[key] = copy.deepcopy(value)


def clear_cache():
    with _cache_lock:
        _cache.clear()
