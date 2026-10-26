import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../api'
import VaLogo from './VaLogo'
import LoadingOverlay from './LoadingOverlay'

const SPEEDS = [1, 2, 5, 10]
const MAX_POINT_MARKERS = 400
const MAX_TABLE_ROWS = 1000
const MAX_PICKER_ROWS = 200
const PAKISTAN_CENTER = [30.3753, 69.3451]

const PRIMARY_BTN =
  'btn-shine relative overflow-hidden rounded-full bg-gradient-to-r from-green-700 to-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-700/25 transition-all duration-200 hover:from-green-600 hover:to-green-500 hover:shadow-lg hover:shadow-green-700/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'

const INPUT_CLASS =
  'mt-1.5 block w-full rounded-lg border border-green-200 bg-white px-3.5 py-2.5 text-sm text-ink transition-all duration-200 hover:border-green-300 focus:border-green-700 focus:ring-2 focus:ring-green-700/20 focus:outline-none'

const LABEL_CLASS =
  'text-[10px] font-semibold tracking-wider text-green-700 uppercase'

function pad(value) {
  return String(value).padStart(2, '0')
}

function toLocalInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function recordValue(point) {
  return (
    point?.recordDateTime ??
    point?.recordDate ??
    point?.gpsDateTime ??
    point?.dateTime ??
    point?.rptDateTime ??
    point?.date ??
    null
  )
}

function timeOf(point) {
  const raw = recordValue(point)
  if (!raw) return null
  const time = new Date(raw).getTime()
  return Number.isFinite(time) ? time : null
}

function parseCoord(point) {
  const lat = parseFloat(point?.lat ?? point?.latitude ?? point?.Lat ?? '')
  const lon = parseFloat(
    point?.lon ?? point?.lng ?? point?.longitude ?? point?.Lng ?? '',
  )
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return [lat, lon]
}

function sortPoints(list) {
  const indexed = list.map((point, index) => ({
    point,
    index,
    time: timeOf(point),
  }))
  if (!indexed.every((item) => item.time !== null)) return list.slice()
  return indexed
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map((item) => item.point)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function pointLabel(point) {
  return (
    point?.landMark ??
    point?.location ??
    point?.address ??
    point?.regNo ??
    point?.alias ??
    '—'
  )
}

function pointPopupHtml(point) {
  const rows = [
    ['Vehicle', point?.alias ?? point?.regNo],
    ['Location', pointLabel(point)],
    ['Date/Time', recordValue(point)],
    ['Speed', point?.speed != null ? `${point.speed} km/h` : null],
    ['Mileage', point?.mileage ?? point?.odometer],
    ['Heading', point?.direction != null ? `${point.direction}°` : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '')

  return `
    <div style="min-width:190px;line-height:1.5;font-size:12px">
      ${rows
        .map(
          ([label, value]) =>
            `<div><span style="color:#6b7280">${escapeHtml(label)}:</span> <strong>${escapeHtml(
              label === 'Date/Time' ? formatDateTime(value) : value,
            )}</strong></div>`,
        )
        .join('')}
    </div>
  `
}

function circleIcon(label, color) {
  return L.divIcon({
    className: 'trip-history-pin',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);color:#fff;font-size:11px;font-weight:700;line-height:1">${escapeHtml(
      label,
    )}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

function vehicleIcon(direction) {
  const degrees = Number.isFinite(Number(direction)) ? Number(direction) : 0
  return L.divIcon({
    className: 'trip-history-vehicle',
    html: `<div style="width:34px;height:34px;display:grid;place-items:center;border-radius:9999px;background:#15803d;border:3px solid #fff;box-shadow:0 3px 12px rgba(21,128,61,.55)">
      <span style="display:inline-block;transform:rotate(${degrees}deg);color:#fff;font-size:17px;line-height:1">\u25B2</span>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  })
}

function Meta({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-wider text-green-700 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-green-900">
        {value}
      </dd>
    </div>
  )
}

function StatCard({ label, value, invert = false }) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${
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
      <p className="mt-1 truncate text-lg font-bold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  )
}

export default function TripHistoryTab({ token }) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const layersRef = useRef(null)
  const pickerRef = useRef(null)
  const progressRef = useRef(0)

  const [units, setUnits] = useState([])
  const [loadingUnits, setLoadingUnits] = useState(true)
  const [unitsError, setUnitsError] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const [fromDate, setFromDate] = useState(() => toLocalInput(startOfToday()))
  const [toDate, setToDate] = useState(() => toLocalInput(new Date()))

  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stamp, setStamp] = useState(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [loadedRange, setLoadedRange] = useState(null)

  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(5)

  useEffect(() => {
    let cancelled = false
    async function loadUnits() {
      try {
        const data = await api('/vehicle/getlist', { token })
        if (cancelled) return
        const list = data?.data ?? []
        setUnits(list)
        if (list.length > 0) setSelectedUnitId(String(list[0].unitID))
      } catch (err) {
        if (!cancelled) setUnitsError(err.message)
      } finally {
        if (!cancelled) setLoadingUnits(false)
      }
    }
    loadUnits()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!pickerOpen) return undefined
    function onPointerDown(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [pickerOpen])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      preferCanvas: true,
    }).setView(PAKISTAN_CENTER, 5)

    const streets = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      },
    )
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri',
      },
    )

    streets.addTo(map)
    L.control
      .layers({ Streets: streets, Satellite: satellite }, null, {
        position: 'topright',
      })
      .addTo(map)
    L.control.scale({ imperial: false }).addTo(map)

    const trackGroup = L.layerGroup().addTo(map)
    const pointGroup = L.layerGroup().addTo(map)
    const playback = L.marker(PAKISTAN_CENTER, {
      icon: vehicleIcon(0),
      zIndexOffset: 1000,
      keyboard: false,
    })

    mapRef.current = map
    layersRef.current = { trackGroup, pointGroup, playback }

    const resize = () => map.invalidateSize()
    const timer = setTimeout(resize, 80)
    window.addEventListener('resize', resize)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', resize)
      map.remove()
      mapRef.current = null
      layersRef.current = null
    }
  }, [])

  const selectedUnit = useMemo(
    () =>
      units.find((unit) => String(unit.unitID) === String(selectedUnitId)) ??
      null,
    [units, selectedUnitId],
  )

  const filteredUnits = useMemo(() => {
    const query = vehicleSearch.trim().toLowerCase()
    if (!query) return units.slice(0, MAX_PICKER_ROWS)
    return units
      .filter((unit) =>
        [unit.alias, unit.unitID, unit.regNo, unit.region].some((field) =>
          String(field ?? '')
            .toLowerCase()
            .includes(query),
        ),
      )
      .slice(0, MAX_PICKER_ROWS)
  }, [units, vehicleSearch])

  const validPoints = useMemo(
    () =>
      points
        .map((point) => ({
          point,
          coord: parseCoord(point),
          time: timeOf(point),
        }))
        .filter((entry) => entry.coord !== null),
    [points],
  )

  const latlngs = useMemo(
    () => validPoints.map((entry) => entry.coord),
    [validPoints],
  )

  const times = useMemo(
    () => validPoints.map((entry) => entry.time),
    [validPoints],
  )

  const hasTimes =
    times.length > 0 && times.every((time) => time !== null)

  const firstTime = hasTimes ? times[0] : null
  const lastTime = hasTimes ? times[times.length - 1] : null

  const currentIndex = useMemo(() => {
    if (validPoints.length === 0) return 0
    if (hasTimes && lastTime > firstTime) {
      const target = firstTime + (lastTime - firstTime) * (progress / 100)
      let low = 0
      let high = times.length - 1
      while (low < high) {
        const mid = (low + high) >> 1
        if (times[mid] < target) low = mid + 1
        else high = mid
      }
      return low
    }
    return Math.min(
      validPoints.length - 1,
      Math.round((progress / 100) * (validPoints.length - 1)),
    )
  }, [validPoints.length, hasTimes, firstTime, lastTime, progress, times])

  const currentEntry = validPoints[currentIndex] ?? null

  const currentTimeLabel = useMemo(() => {
    if (!currentEntry) return '—'
    if (hasTimes && lastTime > firstTime) {
      const ms = firstTime + (lastTime - firstTime) * (progress / 100)
      return formatDateTime(new Date(ms).toISOString())
    }
    return currentEntry.time
      ? formatDateTime(new Date(currentEntry.time).toISOString())
      : formatDateTime(recordValue(currentEntry.point))
  }, [
    currentEntry,
    firstTime,
    hasTimes,
    lastTime,
    progress,
  ])

  const stats = useMemo(() => {
    if (points.length === 0) return null
    const mileage = points[0]?.mileage ?? points[points.length - 1]?.mileage
    const maxSpeed = points.reduce(
      (max, point) => Math.max(max, Number(point?.speed) || 0),
      0,
    )
    return {
      mileage,
      maxSpeed,
      duration:
        hasTimes && lastTime > firstTime
          ? formatDuration(lastTime - firstTime)
          : '—',
    }
  }, [points, hasTimes, firstTime, lastTime])

  useEffect(() => {
    if (!playing) return undefined
    const timer = setInterval(() => {
      const next = Math.min(100, progressRef.current + speed / 2)
      progressRef.current = next
      setProgress(next)
      if (next >= 100) setPlaying(false)
    }, 100)
    return () => clearInterval(timer)
  }, [playing, speed])

  useEffect(() => {
    const map = mapRef.current
    const layers = layersRef.current
    if (!map || !layers) return

    const { trackGroup, pointGroup, playback } = layers
    trackGroup.clearLayers()
    pointGroup.clearLayers()
    playback.remove()

    if (validPoints.length === 0) {
      map.setView(PAKISTAN_CENTER, 5)
      return
    }

    L.polyline(latlngs, {
      color: '#15803d',
      weight: 4,
      opacity: 0.9,
      lineJoin: 'round',
    }).addTo(trackGroup)

    const first = validPoints[0]
    const last = validPoints[validPoints.length - 1]

    L.marker(first.coord, { icon: circleIcon('S', '#15803d') })
      .bindPopup(pointPopupHtml(first.point))
      .addTo(pointGroup)
    L.marker(last.coord, { icon: circleIcon('E', '#b91c1c') })
      .bindPopup(pointPopupHtml(last.point))
      .addTo(pointGroup)

    if (validPoints.length <= MAX_POINT_MARKERS) {
      validPoints.forEach((entry, index) => {
        if (index === 0 || index === validPoints.length - 1) return
        L.circleMarker(entry.coord, {
          radius: 3,
          color: '#166534',
          weight: 1,
          fillColor: '#22c55e',
          fillOpacity: 0.8,
        })
          .bindPopup(pointPopupHtml(entry.point))
          .addTo(pointGroup)
      })
    }

    const bounds = L.latLngBounds(latlngs)
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.15), { maxZoom: 16 })
    }

    playback
      .setLatLng(first.coord)
      .setIcon(vehicleIcon(first.point?.direction))
      .addTo(map)
  }, [validPoints, latlngs])

  useEffect(() => {
    const map = mapRef.current
    const playback = layersRef.current?.playback
    if (!map || !playback || !currentEntry) return
    playback.setLatLng(currentEntry.coord)
    playback.setIcon(vehicleIcon(currentEntry.point?.direction))
  }, [currentEntry])

  const loadHistory = useCallback(
    async (event) => {
      event?.preventDefault()
      setError('')

      if (!selectedUnitId) {
        setError('Select a vehicle first.')
        return
      }
      if (!fromDate || !toDate) {
        setError('Select both From and To date/time.')
        return
      }

      const from = new Date(fromDate)
      const to = new Date(toDate)
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        setError('Enter a valid date range.')
        return
      }
      if (to <= from) {
        setError('To must be later than From.')
        return
      }

      setLoading(true)
      setPlaying(false)
      progressRef.current = 0
      setProgress(0)
      setPoints([])
      setHasLoaded(true)

      try {
        const result = await api('/vehicle/gethistory', {
          token,
          body: {
            unitID: String(selectedUnitId),
            fromDateTime: from.toISOString(),
            toDateTime: to.toISOString(),
          },
        })
        const raw = result?.points ?? result?.data ?? []
        const list = Array.isArray(raw) ? raw : []
        setPoints(sortPoints(list))
        setLoadedRange({ from: fromDate, to: toDate })
        setStamp(new Date())
      } catch (err) {
        setError(err.message)
        setPoints([])
      } finally {
        setLoading(false)
      }
    },
    [token, selectedUnitId, fromDate, toDate],
  )

  function togglePlay() {
    if (validPoints.length === 0) return
    if (progress >= 100) {
      progressRef.current = 0
      setProgress(0)
    }
    setPlaying((value) => !value)
  }

  function restartPlayback() {
    if (validPoints.length === 0) return
    progressRef.current = 0
    setProgress(0)
    setPlaying(true)
  }

  const tablePoints = points.slice(0, MAX_TABLE_ROWS)
  const playbackEnabled = validPoints.length > 0
  const noCoords = hasLoaded && points.length > 0 && validPoints.length === 0

  return (
    <div className="overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-sm">
      {loading && <LoadingOverlay label="Loading vehicle history…" />}
      <div className="h-1.5 w-full bg-green-700" />

      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-neutral-200 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-4">
          <VaLogo className="h-11 w-11" />
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
              Vehicle Automation
            </p>
            <h3 className="text-lg font-bold tracking-tight text-ink">
              Trip History
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Replay a vehicle&apos;s route on the map for any date range
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3.5">
          <Meta
            label="Vehicle"
            value={selectedUnit?.alias ?? selectedUnitId ?? '—'}
          />
          <Meta label="Points" value={hasLoaded ? points.length : '—'} />
        </dl>
      </div>

      <form
        onSubmit={loadHistory}
        className="border-b border-neutral-200 px-4 py-5 sm:px-6"
      >
        <div className="flex flex-wrap items-end gap-4">
          <div ref={pickerRef} className="relative w-full sm:w-72">
            <label className={LABEL_CLASS}>Vehicle</label>
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              aria-expanded={pickerOpen}
              aria-haspopup="listbox"
              className={`${INPUT_CLASS} flex items-center justify-between gap-2 text-left`}
            >
              <span className="truncate">
                {selectedUnit
                  ? `${selectedUnit.alias ?? selectedUnit.unitID} (${selectedUnit.unitID})`
                  : loadingUnits
                    ? 'Loading vehicles…'
                    : 'Select a vehicle'}
              </span>
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 shrink-0 text-green-700 transition-transform ${
                  pickerOpen ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {pickerOpen && (
              <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-green-200 bg-white shadow-xl">
                <div className="border-b border-green-100 p-2">
                  <input
                    autoFocus
                    type="text"
                    value={vehicleSearch}
                    onChange={(event) => setVehicleSearch(event.target.value)}
                    placeholder="Search vehicle, unit ID, region…"
                    className="w-full rounded-md border border-green-200 px-3 py-2 text-sm focus:border-green-700 focus:ring-2 focus:ring-green-700/20 focus:outline-none"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {loadingUnits && (
                    <p className="px-3 py-2 text-sm text-neutral-500">
                      Loading vehicles…
                    </p>
                  )}
                  {!loadingUnits && filteredUnits.length === 0 && (
                    <p className="px-3 py-2 text-sm text-neutral-500">
                      No vehicles match this search.
                    </p>
                  )}
                  {filteredUnits.map((unit) => {
                    const active =
                      String(unit.unitID) === String(selectedUnitId)
                    return (
                      <button
                        key={unit.unitID}
                        type="button"
                        onClick={() => {
                          setSelectedUnitId(String(unit.unitID))
                          setPickerOpen(false)
                          setVehicleSearch('')
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-green-50 ${
                          active ? 'bg-green-100' : ''
                        }`}
                      >
                        <span className="truncate font-semibold text-ink">
                          {unit.alias ?? unit.unitID}
                        </span>
                        <span className="shrink-0 text-xs text-neutral-500">
                          {unit.unitID}
                          {unit.region ? ` · ${unit.region}` : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {!vehicleSearch.trim() &&
                  units.length > MAX_PICKER_ROWS && (
                    <p className="border-t border-green-100 px-3 py-2 text-[11px] text-neutral-500">
                      Showing first {MAX_PICKER_ROWS} of {units.length}. Type to
                      search.
                    </p>
                  )}
              </div>
            )}

            {unitsError && (
              <p className="mt-2 text-xs font-medium text-red-600">
                {unitsError}
              </p>
            )}
          </div>

          <label className={`${LABEL_CLASS} w-full sm:w-auto`}>
            From
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              required
              className={INPUT_CLASS}
            />
          </label>

          <label className={`${LABEL_CLASS} w-full sm:w-auto`}>
            To
            <input
              type="datetime-local"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              required
              className={INPUT_CLASS}
            />
          </label>

          <button
            type="submit"
            disabled={loading || loadingUnits}
            className={PRIMARY_BTN}
          >
            {loading ? 'Loading…' : 'Show History'}
          </button>
        </div>

        {error && (
          <p className="mt-4 border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </form>

      {stats && (
        <div className="grid grid-cols-2 gap-3 border-b border-neutral-200 px-4 py-4 sm:grid-cols-4 sm:px-6">
          <StatCard label="Track Points" value={points.length} invert />
          <StatCard label="Duration" value={stats.duration} />
          <StatCard label="Max Speed" value={`${stats.maxSpeed} km/h`} />
          <StatCard
            label="Mileage"
            value={stats.mileage != null && stats.mileage !== '' ? stats.mileage : '—'}
          />
        </div>
      )}

      <div className="border-b border-neutral-200 px-4 py-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              disabled={!playbackEnabled}
              className="grid h-10 w-10 place-items-center rounded-full bg-green-700 text-white shadow-md shadow-green-700/25 transition-all hover:bg-green-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={playing ? 'Pause playback' : 'Play history'}
            >
              {playing ? (
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="ml-0.5 h-5 w-5"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={restartPlayback}
              disabled={!playbackEnabled}
              className="grid h-10 w-10 place-items-center rounded-full border border-green-200 bg-white text-green-700 transition-colors hover:border-green-600 hover:bg-green-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Restart playback"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 3v6h6" />
              </svg>
            </button>

            <label className="ml-1 flex items-center gap-2 text-xs font-medium text-neutral-500">
              Speed
              <select
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                className="rounded-md border border-green-200 bg-white px-2 py-1.5 text-xs font-semibold text-green-800 focus:border-green-700 focus:outline-none"
              >
                {SPEEDS.map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-semibold tracking-wider text-green-700 uppercase">
              Playback time
            </p>
            <p className="text-sm font-semibold tabular-nums text-green-900">
              {playbackEnabled ? currentTimeLabel : '—'}
            </p>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progress}
          disabled={!playbackEnabled}
          onChange={(event) => {
            setPlaying(false)
            const value = Number(event.target.value)
            progressRef.current = value
            setProgress(value)
          }}
          aria-label="History playback position"
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-green-100 accent-green-700 disabled:cursor-not-allowed disabled:opacity-40"
        />

        <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
          <span>
            {loadedRange
              ? formatDateTime(loadedRange.from)
              : validPoints.length > 0 && validPoints[0].time
                ? formatDateTime(new Date(validPoints[0].time).toISOString())
                : '—'}
          </span>
          <span>
            {loadedRange
              ? formatDateTime(loadedRange.to)
              : validPoints.length > 0 &&
                  validPoints[validPoints.length - 1].time
                ? formatDateTime(
                    new Date(
                      validPoints[validPoints.length - 1].time,
                    ).toISOString(),
                  )
                : '—'}
          </span>
        </div>
      </div>

      <div className="relative px-4 py-4 sm:px-6">
        <div
          ref={mapContainerRef}
          className="relative z-0 h-[420px] w-full overflow-hidden rounded-xl border border-green-200 sm:h-[560px]"
        />
        {noCoords && (
          <p className="mt-3 border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            The history response did not include valid latitude/longitude
            values.
          </p>
        )}
        {!hasLoaded && (
          <p className="mt-3 rounded-xl border border-dashed border-green-200 bg-green-50/60 px-4 py-3 text-center text-sm text-green-800/80">
            Choose a vehicle and date range, then select{' '}
            <strong>Show History</strong> to plot the route.
          </p>
        )}
        {hasLoaded && points.length === 0 && !loading && !error && (
          <p className="mt-3 text-sm text-neutral-500">
            No history found for the selected vehicle and date range.
          </p>
        )}
      </div>

      {points.length > 0 && (
        <div className="border-t border-neutral-200 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
              History Points
            </h4>
            <p className="text-xs text-neutral-500">
              {points.length > MAX_TABLE_ROWS
                ? `Showing first ${MAX_TABLE_ROWS} of ${points.length}`
                : `${points.length} point${points.length === 1 ? '' : 's'}`}
            </p>
          </div>

          <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-neutral-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-green-700 text-[10px] tracking-wider text-white uppercase">
                  <th className="px-4 py-2.5 font-semibold">#</th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    Date/Time
                  </th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    Location
                  </th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    Speed
                  </th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    Mileage
                  </th>
                  <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                    Heading
                  </th>
                </tr>
              </thead>
              <tbody>
                {tablePoints.map((point, index) => (
                  <tr
                    key={`${recordValue(point) ?? 'point'}-${index}`}
                    className={`border-b border-neutral-100 transition-colors last:border-0 hover:bg-green-100 ${
                      index % 2 === 1 ? 'bg-green-50' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 text-neutral-400">
                      {index + 1}
                    </td>
                    <td className="border-l border-neutral-200 px-4 py-2.5 whitespace-nowrap tabular-nums text-neutral-600">
                      {formatDateTime(recordValue(point))}
                    </td>
                    <td
                      className="max-w-xs truncate border-l border-neutral-200 px-4 py-2.5 text-neutral-600"
                      title={pointLabel(point)}
                    >
                      {pointLabel(point)}
                    </td>
                    <td className="border-l border-neutral-200 px-4 py-2.5 tabular-nums text-neutral-600">
                      {point?.speed != null ? `${point.speed} km/h` : '—'}
                    </td>
                    <td className="border-l border-neutral-200 px-4 py-2.5 text-neutral-600">
                      {point?.mileage ?? point?.odometer ?? '—'}
                    </td>
                    <td className="border-l border-neutral-200 px-4 py-2.5 tabular-nums text-neutral-600">
                      {point?.direction != null ? `${point.direction}°` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-green-200 bg-green-50 px-4 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-green-900/80">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-700" />
            Green line — route travelled · S / E — start and end
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-neutral-400" />
            Drag the slider or press play to replay the trip
          </span>
        </div>
        <p className="text-[11px] text-green-800">
          Source: TrackingWorld · Generated{' '}
          {stamp ? formatDateTime(stamp.toISOString()) : '—'}
        </p>
      </div>
      <div className="h-1 w-full bg-green-700" />
    </div>
  )
}
