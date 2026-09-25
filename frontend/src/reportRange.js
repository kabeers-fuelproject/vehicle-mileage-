function toDate(value) {
  if (value instanceof Date) return value
  const [year, month, day] = String(value).split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfDay(value) {
  const date = toDate(value)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
}

function endOfDay(value) {
  const date = toDate(value)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
}

export function dayRange(from, to = from) {
  return {
    FromDate: startOfDay(from).toISOString(),
    ToDate: endOfDay(to).toISOString(),
  }
}
