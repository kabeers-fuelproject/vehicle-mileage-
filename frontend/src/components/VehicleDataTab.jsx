import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import VaLogo from './VaLogo'
import LoadingOverlay from './LoadingOverlay'
import { vehicleTypeOf } from '../vehicleTypes'
import { usedForOf } from '../usedFor'
import { driverOf } from '../drivers'
import { supervisorOf } from '../supervisors'

const PRIMARY_BTN =
  'btn-shine relative overflow-hidden rounded-full bg-gradient-to-r from-green-700 to-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-700/25 transition-all duration-200 hover:from-green-600 hover:to-green-500 hover:shadow-lg hover:shadow-green-700/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'

const SECONDARY_BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-full border border-green-200 bg-white px-4 py-2 text-xs font-semibold text-green-700 transition-colors hover:border-green-600 hover:bg-green-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'

const INPUT_CLASS =
  'w-full rounded-lg border border-green-200 bg-white px-3.5 py-2.5 pr-9 text-sm text-ink transition-all duration-200 placeholder:text-neutral-400 hover:border-green-300 focus:border-green-700 focus:ring-2 focus:ring-green-700/20 focus:outline-none'

const SIM_FALSE_POSITIVES = ['simple', 'similar', 'simulat', 'simult', 'assimil']

const STATUS_TONES = {
  Reporting: 'border-green-700 bg-green-700 text-white',
  Moving: 'border-green-700 bg-green-700 text-white',
  'Not Reporting': 'border-amber-300 bg-amber-100 text-amber-900',
  'Excess Idling': 'border-amber-300 bg-amber-100 text-amber-900',
  Idle: 'border-neutral-300 bg-white text-neutral-600',
  Parked: 'border-neutral-200 bg-neutral-100 text-neutral-600',
}

function normalizeKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function isSimKey(key) {
  const normalized = normalizeKey(key)
  if (!normalized) return false
  if (SIM_FALSE_POSITIVES.some((token) => normalized.includes(token))) return false
  return (
    normalized.includes('sim') ||
    normalized.includes('iccid') ||
    normalized.includes('imsi') ||
    normalized.includes('imei') ||
    normalized.includes('msisdn') ||
    normalized.includes('gsm') ||
    normalized.includes('mobile') ||
    normalized.includes('phone') ||
    normalized.includes('cellno') ||
    normalized.includes('cellnumber') ||
    normalized.includes('cellphone') ||
    normalized === 'cell' ||
    /contact(no|number|phone|mobile)/.test(normalized)
  )
}

function pathHasSimKey(path) {
  return String(path ?? '')
    .split('.')
    .map((segment) => segment.replace(/\[\d+\]/g, ''))
    .some(isSimKey)
}

function lastSegment(path) {
  const parts = String(path ?? '').split('.')
  return parts[parts.length - 1].replace(/\[\d+\]/g, '')
}

function humanize(key) {
  return String(key ?? '')
    .replace(/\[\d+\]/g, '')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function isBlank(value) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  )
}

function flattenFields(value, prefix = '', depth = 0, out = []) {
  if (isBlank(value) || depth > 8) return out

  if (Array.isArray(value)) {
    if (value.length === 0) return out
    const primitive = value.every(
      (item) => item === null || typeof item !== 'object',
    )
    if (primitive) {
      const text = value
        .filter((item) => !isBlank(item))
        .map((item) => String(item).trim())
        .join(', ')
      if (text) {
        out.push({
          path: prefix || 'value',
          label: humanize(lastSegment(prefix) || 'Value'),
          value: text,
        })
      }
      return out
    }
    value.forEach((item, index) => {
      if (item !== null && typeof item === 'object') {
        flattenFields(
          item,
          prefix ? `${prefix}[${index}]` : `[${index}]`,
          depth + 1,
          out,
        )
      }
    })
    return out
  }

  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      if (isBlank(child)) return
      const path = prefix ? `${prefix}.${key}` : key
      if (child !== null && typeof child === 'object') {
        flattenFields(child, path, depth + 1, out)
      } else {
        out.push({
          path,
          label: humanize(key),
          value: typeof child === 'string' ? child.trim() : child,
        })
      }
    })
    return out
  }

  out.push({
    path: prefix || 'value',
    label: humanize(lastSegment(prefix) || 'Value'),
    value: typeof value === 'string' ? value.trim() : value,
  })
  return out
}

function collectFields(data, source) {
  if (!data) return []
  return flattenFields(data).map((field) => ({ ...field, source }))
}

function digitCount(value) {
  return String(value ?? '').replace(/\D/g, '').length
}

function pickPrimarySim(fields) {
  if (fields.length === 0) return null
  const score = (field) => {
    const key = normalizeKey(field.path)
    let result = 0
    if (key.includes('sim')) result += 5
    if (/(iccid|imsi|imei|msisdn)/.test(key)) result += 3
    if (/(number|num|serial|no$)/.test(key)) result += 2
    if (key.includes('phone') || key.includes('mobile')) result += 1
    if (digitCount(field.value) >= 5) result += 4
    if (typeof field.value === 'boolean') result -= 6
    return result
  }
  return fields.reduce(
    (best, field) => (score(field) > score(best) ? field : best),
    fields[0],
  )
}

function matchKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

function extractUnitList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.vehicles)) return payload.data.vehicles
  if (Array.isArray(payload?.data?.vehicleList)) return payload.data.vehicleList
  if (Array.isArray(payload?.data?.unitList)) return payload.data.unitList
  if (Array.isArray(payload?.data?.units)) return payload.data.units
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  if (Array.isArray(payload?.vehicles)) return payload.vehicles
  return []
}

function extractStatusList(payload) {
  if (Array.isArray(payload?.vehicles)) return payload.vehicles
  if (Array.isArray(payload?.data?.vehicleStatuses)) {
    return payload.data.vehicleStatuses
  }
  if (Array.isArray(payload?.vehicleStatuses)) return payload.vehicleStatuses
  return []
}

function makeRow(unit, status, index) {
  const code =
    unit?.alias ??
    unit?.vehicleRegNumber ??
    unit?.regNo ??
    status?.regNo ??
    ''
  const unitID =
    unit?.unitID ??
    unit?.unitId ??
    unit?.id ??
    status?.unitID ??
    status?.unitId ??
    ''
  const regNo = unit?.regNo ?? unit?.vehicleRegNumber ?? status?.regNo ?? code
  const region = unit?.region ?? unit?.regionName ?? status?.region ?? ''
  const unitFields = collectFields(unit, 'Vehicle record')
  const statusFields = collectFields(status, 'Live status')
  const allFields = [...unitFields, ...statusFields]
  const simFields = allFields.filter((field) => pathHasSimKey(field.path))
  const primarySim = pickPrimarySim(simFields)
  const simNumber =
    primarySim && digitCount(primarySim.value) >= 5 ? primarySim : null
  const type =
    vehicleTypeOf(code) || unit?.vehicleType || unit?.vehType || unit?.type || ''
  const usedFor = usedForOf(code) || unit?.usedFor || unit?.usage || ''
  const driver = driverOf(code) || unit?.driver || unit?.driverName || ''
  const supervisor =
    supervisorOf(code) || unit?.supervisor || unit?.supervisorName || ''
  const statusText =
    status?.statusText ??
    status?.reportingStatus ??
    unit?.status ??
    unit?.reason ??
    ''
  const reportingStatus = status?.reportingStatus ?? unit?.reportingStatus ?? ''
  const reportedAt =
    status?.reportingDateTime ??
    unit?.reportingDateTime ??
    unit?.recordDateTime ??
    unit?.lastReported ??
    unit?.lastReportingDateTime ??
    ''
  const location =
    status?.location ??
    unit?.location ??
    unit?.landMark ??
    unit?.address ??
    unit?.addressText ??
    ''
  const battery = status?.batteryStatus ?? unit?.batteryStatus ?? ''
  const wiring = status?.wirringStatus ?? unit?.wirringStatus ?? ''
  const searchText = [
    code,
    unitID,
    regNo,
    region,
    type,
    usedFor,
    driver,
    supervisor,
    statusText,
    reportingStatus,
    reportedAt,
    location,
    battery,
    wiring,
    ...simFields.map((field) => `${field.label} ${field.value}`),
    ...allFields.map((field) => `${field.path} ${field.label} ${field.value}`),
  ]
    .filter((part) => !isBlank(part))
    .join(' ')
    .toLowerCase()

  return {
    id: `${unitID || code || 'vehicle'}-${index}`,
    code,
    unitID,
    regNo,
    region,
    type,
    usedFor,
    driver,
    supervisor,
    status,
    unit,
    unitFields,
    statusFields,
    simFields,
    simNumber,
    statusText,
    reportingStatus,
    reportedAt,
    location,
    battery,
    wiring,
    searchText,
  }
}

function buildRows(units, statuses) {
  const byKey = new Map()
  statuses.forEach((status) => {
    ;[
      status?.unitID,
      status?.unitId,
      status?.regNo,
      status?.alias,
      status?.vehicleRegNumber,
    ]
      .map(matchKey)
      .filter(Boolean)
      .forEach((key) => {
        if (!byKey.has(key)) byKey.set(key, status)
      })
  })

  const matched = new Set()
  const rows = units.map((unit, index) => {
    const keys = [
      unit?.unitID,
      unit?.unitId,
      unit?.id,
      unit?.alias,
      unit?.regNo,
      unit?.vehicleRegNumber,
    ]
      .map(matchKey)
      .filter(Boolean)
    let status = null
    for (const key of keys) {
      if (byKey.has(key)) {
        status = byKey.get(key)
        matched.add(key)
        break
      }
    }
    return makeRow(unit, status, index)
  })

  statuses.forEach((status, index) => {
    const keys = [
      status?.unitID,
      status?.unitId,
      status?.regNo,
      status?.alias,
      status?.vehicleRegNumber,
    ]
      .map(matchKey)
      .filter(Boolean)
    if (keys.some((key) => matched.has(key))) return
    rows.push(makeRow(null, status, units.length + index))
  })

  rows.sort((a, b) =>
    String(a.code).localeCompare(String(b.code), undefined, { numeric: true }),
  )
  return rows
}

function formatValue(value) {
  if (isBlank(value)) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function formatDateTime(value) {
  if (isBlank(value)) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(date) {
  if (!date) return '—'
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function csvCell(value) {
  const text = isBlank(value) ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function downloadCsv(rows) {
  const baseHeaders = [
    'Vehicle',
    'Unit ID',
    'Reg No',
    'Region',
    'Vehicle Type',
    'Used For',
    'Driver',
    'Supervisor',
    'SIM Number',
    'Status',
    'Reporting Status',
    'Last Reported',
    'Location',
    'Battery',
    'Wiring',
  ]
  const headers = [...baseHeaders]
  const headerSet = new Set(headers)
  const records = rows.map((row) => {
    const record = {
      Vehicle: row.code,
      'Unit ID': row.unitID,
      'Reg No': row.regNo,
      Region: row.region,
      'Vehicle Type': row.type,
      'Used For': row.usedFor,
      Driver: row.driver,
      Supervisor: row.supervisor,
      'SIM Number': row.simNumber?.value ?? '',
      Status: row.statusText,
      'Reporting Status': row.reportingStatus,
      'Last Reported': row.reportedAt,
      Location: row.location,
      Battery: row.battery,
      Wiring: row.wiring,
    }
    row.simFields.forEach((field) => {
      const header = `SIM field: ${field.path}`
      record[header] = field.value
      if (!headerSet.has(header)) {
        headerSet.add(header)
        headers.push(header)
      }
    })
    row.unitFields.forEach((field) => {
      const header = `Vehicle: ${field.path}`
      record[header] = field.value
      if (!headerSet.has(header)) {
        headerSet.add(header)
        headers.push(header)
      }
    })
    row.statusFields.forEach((field) => {
      const header = `Live: ${field.path}`
      record[header] = field.value
      if (!headerSet.has(header)) {
        headerSet.add(header)
        headers.push(header)
      }
    })
    return record
  })

  const csv = [
    headers.map(csvCell).join(','),
    ...records.map((record) =>
      headers.map((header) => csvCell(record[header])).join(','),
    ),
  ].join('\r\n')

  const blob = new Blob(['\ufeff' + csv], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `vehicle-data-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  textarea.remove()
  return ok
}

function StatCard({ label, value, invert = false }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        invert
          ? 'border-green-700 bg-green-700 text-white'
          : 'border-green-200 bg-white text-green-900'
      }`}
    >
      <p
        className={`text-[10px] font-semibold tracking-wider uppercase ${
          invert ? 'text-green-100' : 'text-green-700'
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  )
}

function StatusBadge({ value }) {
  if (isBlank(value)) return <span className="text-neutral-400">—</span>
  const label = String(value)
  const tone = STATUS_TONES[label]
  if (!tone) {
    return (
      <span className="inline-block rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold tracking-wide whitespace-nowrap text-neutral-600">
        {label}
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase ${tone}`}
    >
      {label}
    </span>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <section>
      <div className="mb-2">
        <h4 className="text-xs font-bold tracking-wider text-green-700 uppercase">
          {title}
        </h4>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  )
}

function EmptyNote({ children }) {
  return (
    <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500">
      {children}
    </p>
  )
}

function FieldGrid({ entries }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[10px] font-semibold tracking-wider text-green-700 uppercase">
            {label}
          </dt>
          <dd className="mt-0.5 break-words text-sm font-medium text-ink">
            {formatValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function FieldTable({ fields }) {
  if (fields.length === 0) return <EmptyNote>No fields returned.</EmptyNote>
  return (
    <div className="max-h-60 overflow-auto rounded-lg border border-neutral-200">
      <table className="w-full text-left text-[11px]">
        <thead className="sticky top-0 bg-neutral-100 text-[9px] tracking-wider text-neutral-500 uppercase">
          <tr>
            <th className="px-3 py-2 font-semibold">Field</th>
            <th className="px-3 py-2 font-semibold">Value</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr
              key={`${field.path}-${index}`}
              className="border-t border-neutral-100 align-top"
            >
              <td className="w-2/5 px-3 py-1.5 font-mono text-neutral-500">
                {field.path}
              </td>
              <td className="break-all px-3 py-1.5 font-medium text-ink">
                {formatValue(field.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VehicleDetailModal({ row, onClose }) {
  const [copied, setCopied] = useState('')

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(''), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const simText = row.simFields
    .map((field) => `${field.label}: ${field.value}`)
    .join('\n')
  const jsonText = JSON.stringify(
    {
      vehicle: row.unit,
      liveStatus: row.status,
      simFields: row.simFields.map(({ label, path, source, value }) => ({
        label,
        path,
        source,
        value,
      })),
    },
    null,
    2,
  )

  async function copy(text, key) {
    const ok = await copyToClipboard(text)
    setCopied(ok ? key : 'error')
  }

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto px-3 py-6 sm:px-4 sm:py-10">
      <button
        type="button"
        aria-label="Close vehicle details"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-black/40 backdrop-blur-sm"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Vehicle data for ${row.code || row.regNo || 'vehicle'}`}
        className="anim-fade-up relative z-10 mx-auto w-full max-w-4xl overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-2xl"
      >
        <div className="h-1.5 w-full bg-green-700" />

        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
              Vehicle Data
            </p>
            <h3 className="truncate text-lg font-bold tracking-tight text-ink">
              {formatValue(row.code)}
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              {formatValue(row.regNo)} · Unit {formatValue(row.unitID)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close vehicle details"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-neutral-200 text-lg leading-none text-neutral-500 transition-colors hover:border-green-600 hover:bg-green-50 hover:text-green-700"
          >
            ×
          </button>
        </div>

        <div className="max-h-[68vh] space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <Section title="Fleet record">
            <FieldGrid
              entries={[
                ['Vehicle', row.code],
                ['Unit ID', row.unitID],
                ['Reg No', row.regNo],
                ['Region', row.region],
                ['Vehicle type', row.type],
                ['Used for', row.usedFor],
                ['Driver', row.driver],
                ['Supervisor', row.supervisor],
              ]}
            />
          </Section>

          <Section
            title="SIM / connectivity"
            subtitle={`Detected by matching field names for SIM, ICCID, IMEI, IMSI, MSISDN, GSM, mobile, phone, and cell. ${row.simFields.length} field(s) found.`}
          >
            {row.simFields.length > 0 ? (
              <div className="space-y-2">
                {row.simFields.map((field, index) => (
                  <div
                    key={`${field.source}-${field.path}-${index}`}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold tracking-wider text-green-700 uppercase">
                        {field.label}
                      </p>
                      <p className="mt-0.5 break-all font-mono text-sm font-semibold text-green-900">
                        {formatValue(field.value)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-neutral-500">
                        {field.source} · {field.path}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(String(field.value), `field-${index}`)}
                      className="shrink-0 rounded-full border border-green-200 bg-white px-3 py-1 text-[10px] font-semibold text-green-700 transition-colors hover:border-green-600 hover:bg-green-100"
                    >
                      {copied === `field-${index}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyNote>
                No SIM, ICCID, IMEI, IMSI, MSISDN, GSM, mobile, or phone fields
                were returned for this vehicle.
              </EmptyNote>
            )}
          </Section>

          <Section
            title="Live status"
            subtitle="Latest record matched from the live vehicle status feed."
          >
            {row.status ? (
              <FieldGrid
                entries={[
                  ['Reported at', formatDateTime(row.status.reportingDateTime)],
                  ['Location', row.status.location],
                  ['Reporting status', row.status.reportingStatus],
                  ['Status text', row.status.statusText],
                  ['Battery', row.status.batteryStatus],
                  ['Wiring', row.status.wirringStatus],
                ]}
              />
            ) : (
              <EmptyNote>No live status record matched this vehicle.</EmptyNote>
            )}
          </Section>

          <Section
            title="All API fields"
            subtitle="Every field returned for the vehicle record and its matched live status record."
          >
            <div className="space-y-4">
              <div>
                <h5 className="mb-1.5 text-[11px] font-bold text-ink">
                  Vehicle record{' '}
                  <span className="font-normal text-neutral-400">
                    ({row.unitFields.length} fields)
                  </span>
                </h5>
                <FieldTable fields={row.unitFields} />
              </div>
              <div>
                <h5 className="mb-1.5 text-[11px] font-bold text-ink">
                  Live status record{' '}
                  <span className="font-normal text-neutral-400">
                    ({row.statusFields.length} fields)
                  </span>
                </h5>
                <FieldTable fields={row.statusFields} />
              </div>
            </div>
          </Section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3 sm:px-6">
          <p className="text-[11px] text-neutral-500">
            {copied === 'error'
              ? 'Could not copy to clipboard.'
              : copied
                ? 'Copied to clipboard.'
                : 'Values come directly from the vehicle API.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => copy(simText, 'sim')}
              disabled={row.simFields.length === 0}
              className={SECONDARY_BTN}
            >
              {copied === 'sim' ? 'Copied!' : 'Copy SIM'}
            </button>
            <button
              type="button"
              onClick={() => copy(jsonText, 'json')}
              className={SECONDARY_BTN}
            >
              {copied === 'json' ? 'Copied!' : 'Copy JSON'}
            </button>
            <button type="button" onClick={onClose} className={PRIMARY_BTN}>
              Close
            </button>
          </div>
        </div>

        <div className="h-1 w-full bg-green-700" />
      </div>
    </div>
  )
}

export default function VehicleDataTab({ token }) {
  const [units, setUnits] = useState([])
  const [statuses, setStatuses] = useState([])
  const [stamp, setStamp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState([])
  const [search, setSearch] = useState('')
  const [regionFilter, setRegionFilter] = useState('all')
  const [simOnly, setSimOnly] = useState(false)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setWarnings([])

    try {
      const [unitResult, statusResult] = await Promise.allSettled([
        api('/vehicle/getlist', { token }),
        api('/vehicle/getstatus', { token }),
      ])
      const nextWarnings = []
      let nextUnits = []
      let nextStatuses = []

      if (unitResult.status === 'fulfilled') {
        nextUnits = extractUnitList(unitResult.value)
        if (nextUnits.length === 0) {
          nextWarnings.push('The vehicle list API returned no records.')
        }
      } else {
        nextWarnings.push(
          `Vehicle list unavailable: ${unitResult.reason?.message ?? 'request failed'}`,
        )
      }

      if (statusResult.status === 'fulfilled') {
        nextStatuses = extractStatusList(statusResult.value)
      } else {
        nextWarnings.push(
          `Live status unavailable: ${statusResult.reason?.message ?? 'request failed'}`,
        )
      }

      if (
        unitResult.status === 'rejected' &&
        statusResult.status === 'rejected'
      ) {
        setError(
          unitResult.reason?.message ??
            statusResult.reason?.message ??
            'Unable to load vehicle data',
        )
      }

      setUnits(nextUnits)
      setStatuses(nextStatuses)
      setWarnings(nextWarnings)
    } catch (err) {
      setError(err?.message ?? 'Unable to load vehicle data')
    } finally {
      setLoading(false)
      setStamp(new Date())
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => buildRows(units, statuses), [units, statuses])
  const regions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.region)
            .filter((region) => !isBlank(region)),
        ),
      ).sort((a, b) => String(a).localeCompare(String(b))),
    [rows],
  )
  const simNumberCount = useMemo(
    () => rows.filter((row) => row.simNumber).length,
    [rows],
  )
  const simFieldCount = useMemo(
    () => rows.reduce((count, row) => count + row.simFields.length, 0),
    [rows],
  )
  const hasSimFields = simFieldCount > 0

  const filteredRows = useMemo(() => {
    let list = rows
    if (regionFilter !== 'all') {
      list = list.filter((row) => row.region === regionFilter)
    }
    if (simOnly) {
      list = list.filter((row) => Boolean(row.simNumber))
    }
    const query = search.trim().toLowerCase()
    if (query) {
      list = list.filter((row) => row.searchText.includes(query))
    }
    return list
  }, [rows, regionFilter, simOnly, search])

  const closeDetails = useCallback(() => setSelected(null), [])

  return (
    <>
      <div className="overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-sm">
        {loading && <LoadingOverlay label="Refreshing vehicle data…" />}
        <div className="h-1.5 w-full bg-green-700" />

        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-neutral-200 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <VaLogo className="h-11 w-11" />
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
                Vehicle Automation
              </p>
              <h3 className="text-lg font-bold tracking-tight text-ink">
                Vehicle Data
              </h3>
              <p className="mt-0.5 text-xs text-neutral-500">
                Complete fleet records, including any SIM / connectivity fields
                returned by the API
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3.5">
              <div>
                <dt className="text-[10px] font-semibold tracking-wider text-green-700 uppercase">
                  Generated
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-green-900">
                  {formatTime(stamp)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold tracking-wider text-green-700 uppercase">
                  Vehicles
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-green-900">
                  {rows.length}
                </dd>
              </div>
            </dl>
            <button
              onClick={load}
              disabled={loading}
              title="Refresh"
              aria-label="Refresh vehicle data"
              className="btn-shine relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-green-700 to-green-600 text-white shadow-md shadow-green-700/25 transition-all duration-200 hover:from-green-600 hover:to-green-500 hover:shadow-lg hover:shadow-green-700/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-5 w-5 ${loading ? 'anim-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <p className="mx-4 mt-5 border-l-4 border-green-700 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 sm:mx-6">
            {error}
          </p>
        )}

        {warnings.length > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6">
            <p className="text-[11px] font-bold tracking-wider text-amber-900 uppercase">
              Partial data
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-amber-900/90">
              {warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-b border-neutral-200 px-4 py-5 sm:grid-cols-4 sm:px-6">
          <StatCard label="Vehicles" value={rows.length} invert />
          <StatCard label="SIM numbers" value={simNumberCount} />
          <StatCard label="SIM fields" value={simFieldCount} />
          <StatCard label="Live records" value={statuses.length} />
        </div>

        {!loading && rows.length > 0 && simFieldCount === 0 && (
          <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600 sm:px-6">
            <span className="font-semibold text-neutral-800">
              SIM numbers:
            </span>{' '}
            none of the vehicle records returned a SIM, ICCID, IMEI, GSM,
            mobile, or phone field. This tab will show them automatically when
            the API includes them.
          </div>
        )}

        {!loading && simFieldCount > 0 && simNumberCount === 0 && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:px-6">
            <span className="font-semibold">
              SIM fields found, but no numeric SIM number.
            </span>{' '}
            Open a vehicle to inspect the connectivity fields returned by the
            API.
          </div>
        )}

        {loading && rows.length === 0 && (
          <div className="flex items-center gap-3 px-4 py-8 text-sm text-neutral-500 sm:px-6">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
            Loading vehicle data...
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              {regions.length > 1 && (
                <select
                  value={regionFilter}
                  onChange={(event) => setRegionFilter(event.target.value)}
                  aria-label="Filter by region"
                  className="rounded-lg border border-green-200 bg-white px-3 py-2 text-xs font-semibold text-green-800 transition-colors hover:border-green-300 focus:border-green-700 focus:ring-2 focus:ring-green-700/20 focus:outline-none"
                >
                  <option value="all">All regions ({regions.length})</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              )}
              {hasSimFields && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-xs font-semibold text-green-800 transition-colors hover:border-green-300">
                  <input
                    type="checkbox"
                    checked={simOnly}
                    onChange={(event) => setSimOnly(event.target.checked)}
                    className="h-3.5 w-3.5 accent-green-700"
                  />
                  SIM only
                </label>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {search.trim() && (
                <p className="text-xs font-medium text-neutral-500">
                  Showing {filteredRows.length} of {rows.length}
                </p>
              )}
              <div className="relative w-full max-w-xs sm:w-72">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search any vehicle field..."
                  aria-label="Search vehicle data"
                  className={INPUT_CLASS}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-2.5 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-sm leading-none text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-green-700"
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => downloadCsv(filteredRows)}
                disabled={filteredRows.length === 0}
                className={SECONDARY_BTN}
                title="Export the current view to CSV"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="px-4 py-8 text-sm text-neutral-500 sm:px-6">
            No vehicle data was returned.
          </p>
        )}

        {rows.length > 0 && filteredRows.length === 0 && (
          <p className="px-4 py-8 text-sm text-neutral-500 sm:px-6">
            No vehicles match the current filters.
          </p>
        )}

        {filteredRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] text-left text-sm">
              <thead>
                <tr className="bg-green-700 text-[10px] tracking-wider text-white uppercase">
                  <th className="px-4 py-2.5 font-semibold">Vehicle</th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    Unit ID
                  </th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    Reg No
                  </th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    Region
                  </th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    Vehicle Type
                  </th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    Used For
                  </th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    SIM Number
                  </th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    Status
                  </th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    Last Reported
                  </th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    Location
                  </th>
                  <th className="border-l border-white/25 px-4 py-2.5 text-right font-semibold">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className={`cursor-pointer border-b border-neutral-100 transition-colors last:border-0 hover:bg-green-100 ${
                      index % 2 === 1 ? 'bg-green-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-ink">
                      <div className="flex flex-col">
                        <span>{formatValue(row.code)}</span>
                        {(row.driver || row.usedFor) && (
                          <span className="mt-0.5 text-[10px] font-normal text-neutral-500">
                            {row.driver || row.usedFor}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border-l border-neutral-300 px-4 py-3 font-mono text-xs text-neutral-600">
                      {formatValue(row.unitID)}
                    </td>
                    <td className="border-l border-neutral-300 px-4 py-3 font-medium text-neutral-700">
                      {formatValue(row.regNo)}
                    </td>
                    <td className="border-l border-neutral-300 px-4 py-3 text-neutral-600">
                      {formatValue(row.region)}
                    </td>
                    <td className="border-l border-neutral-300 px-4 py-3 text-neutral-600">
                      {formatValue(row.type)}
                    </td>
                    <td className="border-l border-neutral-300 px-4 py-3 text-neutral-600">
                      {formatValue(row.usedFor)}
                    </td>
                    <td className="border-l border-neutral-300 px-4 py-3">
                      {row.simNumber ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="max-w-[190px] truncate font-mono text-xs font-semibold text-green-900"
                            title={String(row.simNumber.value)}
                          >
                            {String(row.simNumber.value)}
                          </span>
                          {row.simFields.length > 1 && (
                            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                              {row.simFields.length}
                            </span>
                          )}
                        </div>
                      ) : row.simFields.length > 0 ? (
                        <span className="text-[10px] font-semibold text-green-700">
                          Detected
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="border-l border-neutral-300 px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <StatusBadge value={row.statusText} />
                        {row.reportingStatus &&
                          row.reportingStatus !== row.statusText && (
                            <span className="text-[10px] text-neutral-500">
                              {row.reportingStatus}
                            </span>
                          )}
                      </div>
                    </td>
                    <td className="border-l border-neutral-300 px-4 py-3 text-xs whitespace-nowrap tabular-nums text-neutral-600">
                      {formatDateTime(row.reportedAt)}
                    </td>
                    <td
                      className="max-w-xs truncate border-l border-neutral-300 px-4 py-3 text-neutral-500"
                      title={formatValue(row.location)}
                    >
                      {formatValue(row.location)}
                    </td>
                    <td className="border-l border-neutral-300 px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelected(row)
                        }}
                        className="rounded-full border border-green-200 bg-white px-3 py-1 text-[11px] font-semibold text-green-700 transition-colors hover:border-green-600 hover:bg-green-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-green-200 bg-green-50 px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-green-900/80">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-700" />
              SIM fields are detected automatically from the API response
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Amber means partial or missing data
            </span>
          </div>
          <p className="text-[11px] text-green-800">
            Source: TrackingWorld · Generated {formatTime(stamp)}
          </p>
        </div>
        <div className="h-1 w-full bg-green-700" />
      </div>

      {selected && (
        <VehicleDetailModal row={selected} onClose={closeDetails} />
      )}
    </>
  )
}
