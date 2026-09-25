export const THRESHOLDS = [
  { vehType: 'Arm Roller', mileage: 25, workingHours: '6:00:00' },
  { vehType: 'Compactor', mileage: 20, workingHours: '6:00:00' },
  { vehType: 'Dumper', mileage: 35, workingHours: '6:00:00' },
  { vehType: 'Front Blade Tractor', mileage: 2, workingHours: '6:00:00' },
  { vehType: 'Front End Loader', mileage: 2, workingHours: '6:00:00' },
  { vehType: 'Loader Rickshaw', mileage: 12, workingHours: '6:00:00' },
  { vehType: 'Mechanical Sweeper', mileage: 10, workingHours: '6:00:00' },
  { vehType: 'Mini Tipper', mileage: 10, workingHours: '6:00:00' },
  { vehType: 'Road Washer', mileage: 10, workingHours: '6:00:00' },
  { vehType: 'Tractor Trolley', mileage: 20, workingHours: '6:00:00' },
  { vehType: 'Container-Repair Vehicle', mileage: 3, workingHours: '6:00:00' },
  { vehType: 'Drain Cleaner', mileage: 2, workingHours: '6:00:00' },
]

export function findThreshold(vehType) {
  if (!vehType) return null
  const normalized = vehType.trim().toLowerCase().replace(/[\s-]+/g, ' ')
  const exact = THRESHOLDS.find(
    (t) => t.vehType.toLowerCase() === normalized,
  )
  if (exact) return exact
  // e.g. "Mini Tipper Petrol" → "Mini Tipper"
  return THRESHOLDS.find((t) => normalized.startsWith(t.vehType.toLowerCase())) ?? null
}
