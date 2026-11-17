from flask import Blueprint, jsonify, request
import base64
import hashlib
import hmac
import json
import time
import uuid
from urllib.parse import parse_qsl, quote, urlparse

import requests

suthra_bp = Blueprint('suthra', __name__, url_prefix='/api/suthra')

SUTHRA_API_BASE = 'https://suthra.punjab.gov.pk/suthra-punjab/backend/public/api'
SUTHRA_LOGIN_URL = SUTHRA_API_BASE + '/login'
CONTRACTOR_META_DATA_URL = SUTHRA_API_BASE + '/solid-waste/contractor-meta-data'
GLOBAL_ACL_METADATA_URL = SUTHRA_API_BASE + '/get-global-acl-base-metadata'
LOADER_RICKSHAW_REPORT_SEARCH_URL = (
    SUTHRA_API_BASE
    + '/solid-waste/loader-rickshaw-beat-performance-report/tehsil/{tehsil_id}/search'
)

PORTAL_PAGE_URL = (
    'https://suthra.punjab.gov.pk/portal/solid-waste/'
    'loader-rickshaw-beat-performance-report'
)

WEB_KEY = 'suthra-web-v1'
REQUEST_GUARD_FALLBACK = 'suthra-web-request-guard-v1'


def _bearer_token():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    return auth_header.split(' ')[1]


def _active_office_id():
    return request.headers.get('X-Active-Office-Id', '')


def _active_designation_id():
    return request.headers.get('X-Active-Designation-Id', '')


def _normalized_api_path(url):
    path = urlparse(url).path.lstrip('/')
    idx = path.find('api/')
    return path[idx:] if idx >= 0 else path


def _canonical_query(url):
    pairs = sorted(parse_qsl(urlparse(url).query), key=lambda kv: (kv[0], kv[1]))
    return '&'.join(
        quote(key, safe='') + '=' + quote(value, safe='')
        for key, value in pairs
    )


def _signed_headers(token, method, url, body_text=''):
    body_hash = hashlib.sha256(body_text.encode()).hexdigest()
    timestamp = str(round(time.time() * 1000))
    nonce = uuid.uuid4().hex
    message = '\n'.join([
        'SUTHRA_WEB_V1',
        method.upper(),
        _normalized_api_path(url),
        _canonical_query(url),
        timestamp,
        nonce,
        body_hash,
        WEB_KEY,
    ])
    signature = hmac.new(token.encode(), message.encode(), hashlib.sha256).hexdigest()
    return {
        'Authorization': f'Bearer {token}',
        'Active-Office-Id': _active_office_id(),
        'Active-Designation-Id': _active_designation_id(),
        'CPL': 'W',
        'urlAccessed': PORTAL_PAGE_URL,
        'request-form': 'web',
        'X-Web-Key': WEB_KEY,
        'X-Time': timestamp,
        'X-Web-Nonce': nonce,
        'X-Body-SHA256': body_hash,
        'X-Signature': signature,
    }


def _suthra_request(method, url, token, body=None):
    body_text = json.dumps(body) if body is not None else ''
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    headers.update(_signed_headers(token, method, url, body_text))
    return requests.request(
        method,
        url,
        data=body_text if body is not None else None,
        headers=headers,
        timeout=30,
    )


def _decode_data(data):
    if not isinstance(data, str):
        return data
    try:
        return json.loads(base64.b64decode(data[::-1]).decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return data


def _suthra_json(resp):
    try:
        payload = resp.json()
    except ValueError:
        return jsonify({'error': 'Suthra API returned an invalid response'}), (
            resp.status_code or 502
        )

    if resp.status_code != 200 or not isinstance(payload, dict) or not payload.get('success'):
        message = payload.get('message') if isinstance(payload, dict) else None
        return jsonify({'error': message or 'Suthra API request failed'}), (
            resp.status_code or 502
        )

    payload['data'] = _decode_data(payload.get('data'))
    return jsonify(payload), resp.status_code


def _require_token():
    token = _bearer_token()
    if token is None:
        return None, (jsonify({'error': 'Missing or invalid Authorization header'}), 401)
    return token, None


@suthra_bp.route('/login', methods=['POST'])
def login():
    payload = request.get_json(silent=True)
    if not payload or not payload.get('cnic') or not payload.get('password'):
        return jsonify({'error': 'CNIC and password are required'}), 400

    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }

    try:
        resp = requests.post(
            SUTHRA_LOGIN_URL,
            json=payload,
            headers=headers,
            timeout=30,
        )
    except requests.RequestException:
        return jsonify({'error': 'Could not reach the Suthra Punjab portal'}), 502

    try:
        data = resp.json()
    except ValueError:
        data = None

    if resp.status_code != 200 or not isinstance(data, dict) or not data.get('success'):
        message = (data or {}).get('message') or 'Invalid CNIC or password'
        return jsonify({'error': message}), resp.status_code if resp.status_code else 502

    return jsonify(data), resp.status_code


@suthra_bp.route('/solid-waste/contractor-meta-data', methods=['GET'])
def contractor_meta_data():
    token, error = _require_token()
    if error:
        return error

    try:
        resp = _suthra_request('GET', CONTRACTOR_META_DATA_URL, token)
    except requests.RequestException:
        return jsonify({'error': 'Could not reach the Suthra Punjab portal'}), 502

    return _suthra_json(resp)


@suthra_bp.route('/get-global-acl-base-metadata', methods=['POST'])
def global_acl_base_metadata():
    token, error = _require_token()
    if error:
        return error

    body = request.get_json(silent=True)
    if body is None:
        body = {}

    try:
        resp = _suthra_request('POST', GLOBAL_ACL_METADATA_URL, token, body)
    except requests.RequestException:
        return jsonify({'error': 'Could not reach the Suthra Punjab portal'}), 502

    return _suthra_json(resp)


@suthra_bp.route(
    '/solid-waste/loader-rickshaw-beat-performance-report/tehsil/<int:tehsil_id>/search',
    methods=['POST'],
)
def loader_rickshaw_beat_performance_report(tehsil_id):
    token, error = _require_token()
    if error:
        return error

    body = request.get_json(silent=True)
    if not body or not body.get('date'):
        return jsonify({'error': 'date is required'}), 400

    forwarded = dict(body, date=str(body['date']))

    url = LOADER_RICKSHAW_REPORT_SEARCH_URL.format(tehsil_id=tehsil_id)
    try:
        resp = _suthra_request('POST', url, token, forwarded)
    except requests.RequestException:
        return jsonify({'error': 'Could not reach the Suthra Punjab portal'}), 502

    return _suthra_json(resp)
