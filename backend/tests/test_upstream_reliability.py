import socket
import threading
import time

import pytest
import requests
import responses

import app as app_module

TOKEN = 'test-token'
UNIT_LIST_URL = 'http://wmc.trackingworld.com.pk/api/vehicle/getlist'
DISTANCE_URL = 'http://wmc.trackingworld.com.pk/api/report/distance/preview'


def auth_headers(token=TOKEN):
    return {'Authorization': f'Bearer {token}'}


class SlowUpstream:
    """Accepts TCP connections but never replies, forcing a read timeout."""

    def __init__(self):
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind(('127.0.0.1', 0))
        self._sock.listen(8)
        self._sock.settimeout(0.2)
        self.port = self._sock.getsockname()[1]
        self._held = []
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self):
        while not self._stop.is_set():
            try:
                conn, _ = self._sock.accept()
            except OSError:
                continue
            self._held.append(conn)

    def url(self, path):
        return f'http://127.0.0.1:{self.port}{path}'

    def close(self):
        self._stop.set()
        for conn in self._held:
            try:
                conn.close()
            except OSError:
                pass
        self._sock.close()
        self._thread.join(timeout=1)


@pytest.fixture
def slow_upstream():
    server = SlowUpstream()
    yield server
    server.close()


def test_health_makes_no_upstream_calls():
    with responses.RequestsMock() as mock:
        resp = app_module.app.test_client().get('/health')
        assert resp.status_code == 200
        assert resp.get_json() == {'status': 'ok'}
        assert len(mock.calls) == 0


def test_slow_getlist_returns_504_within_timeout(slow_upstream, monkeypatch):
    monkeypatch.setattr(
        app_module, 'VEHICLE_UNIT_LIST_URL', slow_upstream.url('/api/vehicle/getlist')
    )
    client = app_module.app.test_client()

    started = time.monotonic()
    resp = client.post('/api/vehicle/getlist', json={}, headers=auth_headers())
    elapsed = time.monotonic() - started

    assert resp.status_code == 504
    assert resp.get_json() == {'error': 'Upstream API timed out'}
    assert elapsed < 3


def test_slow_fingerprint_returns_504_within_timeout(slow_upstream, monkeypatch):
    monkeypatch.setattr(
        app_module, 'DISTANCE_PREVIEW_URL', slow_upstream.url('/api/report/distance/preview')
    )
    client = app_module.app.test_client()
    body = {
        'UnitIDs': ['V1'],
        'FromDate': '2026-01-01',
        'ToDate': '2026-01-02',
    }

    started = time.monotonic()
    resp = client.post('/api/mileage/fingerprint', json=body, headers=auth_headers())
    elapsed = time.monotonic() - started

    assert resp.status_code == 504
    assert resp.get_json() == {'error': 'Upstream API timed out'}
    assert elapsed < 3


@responses.activate
def test_getlist_cache_returns_same_payload_on_second_call():
    responses.add(
        responses.POST,
        UNIT_LIST_URL,
        json={'succeeded': True, 'data': [{'unitID': 'V1'}]},
        status=200,
    )
    client = app_module.app.test_client()
    body = {'OfficeID': 7}

    first = client.post('/api/vehicle/getlist', json=body, headers=auth_headers())
    second = client.post('/api/vehicle/getlist', json=body, headers=auth_headers())

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.get_json() == second.get_json()
    assert len(responses.calls) == 1


@responses.activate
def test_cache_key_includes_token():
    responses.add(responses.POST, UNIT_LIST_URL, json={'data': 'a'}, status=200)
    responses.add(responses.POST, UNIT_LIST_URL, json={'data': 'b'}, status=200)
    client = app_module.app.test_client()

    from_a = client.post('/api/vehicle/getlist', json={}, headers=auth_headers('token-a'))
    from_b = client.post('/api/vehicle/getlist', json={}, headers=auth_headers('token-b'))

    assert from_a.get_json() == {'data': 'a'}
    assert from_b.get_json() == {'data': 'b'}
    assert len(responses.calls) == 2


@responses.activate
def test_connection_failure_returns_502():
    def refuse(_request):
        raise requests.ConnectionError('connection refused')

    responses.add_callback(responses.POST, UNIT_LIST_URL, callback=refuse)
    client = app_module.app.test_client()

    resp = client.post('/api/vehicle/getlist', json={}, headers=auth_headers())

    assert resp.status_code == 502
    assert resp.get_json() == {'error': 'Upstream API is unreachable'}


@responses.activate
def test_read_only_post_retries_once_then_succeeds():
    responses.add(
        responses.POST,
        UNIT_LIST_URL,
        body=requests.Timeout('slow'),
    )
    responses.add(
        responses.POST,
        UNIT_LIST_URL,
        json={'succeeded': True, 'data': []},
        status=200,
    )
    client = app_module.app.test_client()

    resp = client.post('/api/vehicle/getlist', json={}, headers=auth_headers())

    assert resp.status_code == 200
    assert resp.get_json() == {'succeeded': True, 'data': []}
    assert len(responses.calls) == 2
