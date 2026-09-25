from flask import Flask, request, jsonify
import requests
import json

app = Flask(__name__)

TOKEN_URL = 'http://wmc.trackingworld.com.pk/api/generate-token'
STATUS_URL = 'http://wmc.trackingworld.com.pk/api/vehicle/getstatuscount'
VEHICLE_LIST_URL = 'http://wmc.trackingworld.com.pk/api/vehicle/getstatus'
VEHICLE_UNIT_LIST_URL = 'http://wmc.trackingworld.com.pk/api/vehicle/getlist'
VEHICLE_TYPE_LIST_URL = 'http://wmc.trackingworld.com.pk/api/vehicletype/getlist'
DISTANCE_PREVIEW_URL = 'http://wmc.trackingworld.com.pk/api/report/distance/preview'

VEHICLE_STATUS_COLUMNS = (
    'regNo',
    'region',
    'reportingDateTime',
    'location',
    'reportingStatus',
    'statusText',
    'batteryStatus',
    'wirringStatus',
)

DISTANCE_SUMMARY_COLUMNS = (
    's_No',
    'vehicleRegNumber',
    'vehType',
    'town',
    'mileage',
    'igONTime',
    'fuelAllocated',
)

def bearer_token():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    return auth_header.split(' ')[1]

def external_response(resp):
    try:
        return jsonify(resp.json()), resp.status_code
    except ValueError:
        return jsonify({'error': 'External API returned an invalid response'}), resp.status_code

@app.route('/api/generate-token', methods=['POST'])
def generate_token():
    payload = request.get_json(silent=True)
    if not payload or 'username' not in payload or 'password' not in payload:
        return jsonify({'error': 'username and password are required'}), 400

    headers = {'Content-Type': 'application/json'}
    resp = requests.post(TOKEN_URL, json=payload, headers=headers)
    return external_response(resp)

@app.route('/api/vehicle/getstatuscount', methods=['POST'])
def vehicle_getstatuscount():
    token = bearer_token()
    if token is None:
        return jsonify({'error': 'Missing or invalid Authorization header'}), 401

    status_headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }

    body = request.get_json(silent=True)
    if body is None:
        body = {}

    resp = requests.post(STATUS_URL, json=body, headers=status_headers)
    return external_response(resp)

@app.route('/api/vehicle/getstatus', methods=['POST'])
def vehicle_getstatus():
    token = bearer_token()
    if token is None:
        return jsonify({'error': 'Missing or invalid Authorization header'}), 401

    status_headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }

    body = request.get_json(silent=True)
    if body is None:
        body = {}

    resp = requests.post(VEHICLE_LIST_URL, json=body, headers=status_headers)
    if resp.status_code != 200:
        return external_response(resp)

    try:
        payload = resp.json()
    except ValueError:
        return jsonify({'error': 'External API returned an invalid response'}), resp.status_code

    data = payload.get('data') or {}
    vehicles = data.get('vehicleStatuses') or []
    extracted = [
        {column: vehicle.get(column) for column in VEHICLE_STATUS_COLUMNS}
        for vehicle in vehicles
    ]

    return jsonify({
        'succeeded': payload.get('succeeded'),
        'counts': data.get('vehicleStatusesCount'),
        'vehicles': extracted,
    }), resp.status_code

@app.route('/api/vehicle/getlist', methods=['POST'])
def vehicle_getlist():
    token = bearer_token()
    if token is None:
        return jsonify({'error': 'Missing or invalid Authorization header'}), 401

    status_headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }

    body = request.get_json(silent=True)
    if body is None:
        body = {}

    resp = requests.post(VEHICLE_UNIT_LIST_URL, json=body, headers=status_headers)
    return external_response(resp)

@app.route('/api/vehicletype/getlist', methods=['GET'])
def vehicle_type_getlist():
    token = bearer_token()
    if token is None:
        return jsonify({'error': 'Missing or invalid Authorization header'}), 401

    headers = {'Authorization': f'Bearer {token}'}
    resp = requests.get(VEHICLE_TYPE_LIST_URL, headers=headers)
    return external_response(resp)

@app.route('/api/report/distance/preview', methods=['POST'])
def report_distance_preview():
    token = bearer_token()
    if token is None:
        return jsonify({'error': 'Missing or invalid Authorization header'}), 401

    body = request.get_json(silent=True) or {}

    unit_ids = body.get('UnitIDs')
    if not isinstance(unit_ids, list) or not unit_ids:
        return jsonify({'error': 'UnitIDs is required and must be a non-empty list'}), 400
    unit_ids = [str(unit_id) for unit_id in unit_ids]

    if not body.get('FromDate') or not body.get('ToDate'):
        return jsonify({'error': 'FromDate and ToDate are required'}), 400

    forwarded = dict(body, UnitIDs=unit_ids)

    status_headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }

    resp = requests.post(DISTANCE_PREVIEW_URL, json=forwarded, headers=status_headers)
    if resp.status_code != 200:
        return external_response(resp)

    try:
        payload = resp.json()
    except ValueError:
        return jsonify({'error': 'External API returned an invalid response'}), resp.status_code

    data = payload.get('data') or {}
    summary = data.get('summary') or []
    extracted = [
        {column: row.get(column) for column in DISTANCE_SUMMARY_COLUMNS}
        for row in summary
    ]

    return jsonify({
        'succeeded': payload.get('succeeded'),
        'summary': extracted,
    }), resp.status_code

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)