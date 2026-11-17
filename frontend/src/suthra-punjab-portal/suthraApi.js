import { api } from '../api'

function activeOfficeId() {
  try {
    return String(JSON.parse(localStorage.getItem('suthra_user') || 'null')?.active_office_id ?? '')
  } catch {
    return ''
  }
}

function activeDesignationId() {
  try {
    return String(JSON.parse(localStorage.getItem('suthra_user') || 'null')?.active_designation_id ?? '')
  } catch {
    return ''
  }
}

function suthraHeaders() {
  return {
    'X-Active-Office-Id': activeOfficeId(),
    'X-Active-Designation-Id': activeDesignationId(),
  }
}

export function suthraLogin(body) {
  return api('/suthra/login', { body })
}

export function getSuthraContractorMetaData(token) {
  return api('/suthra/solid-waste/contractor-meta-data', {
    method: 'GET',
    token,
    headers: suthraHeaders(),
  })
}

export function getSuthraGlobalAclBaseMetadata(token, body = {}) {
  return api('/suthra/get-global-acl-base-metadata', {
    body,
    token,
    headers: suthraHeaders(),
  })
}

export function getSuthraAclOfficesMetadata(token) {
  return getSuthraGlobalAclBaseMetadata(token, {
    app_module_id: 39547,
    offices_filter: 'office_type_id in (76,3,73,6,24,9,21,12,18,15)',
    include_ucs: false,
    data_fields: ['divisions', 'districts', 'offices', 'tehsils'],
  })
}

export function searchSuthraLoaderRickshawBeatReport(token, tehsilId, body) {
  return api(
    `/suthra/solid-waste/loader-rickshaw-beat-performance-report/tehsil/${tehsilId}/search`,
    { body, token, headers: suthraHeaders() },
  )
}
