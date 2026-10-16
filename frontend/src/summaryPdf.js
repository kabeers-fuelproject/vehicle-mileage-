import { jsPDF } from 'jspdf'

const MARGIN = 28
const TITLE_TOP = 28
const BAND_H = 26
const BAND_GAP = 10
const HEADER_H = 24
const ROW_H = 24
const BOTTOM = 28

const C = {
  black: [0, 0, 0],
  headerBlue: [214, 228, 240],
  greenBand: [198, 224, 184],
  gray: [242, 242, 242],
  pink: [251, 213, 213],
  red: [192, 0, 0],
  white: [255, 255, 255],
  muted: [113, 113, 113],
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatShortDate(date) {
  return `${date.getDate()}-${MONTHS[date.getMonth()]}`
}

export function buildSummaryPdf({
  filename,
  title = 'Daily wise-Machinery Report',
  generatedAt = new Date(),
  rows = [],
  totals = null,
}) {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
    putOnlyUsedFonts: true,
    compress: true,
  })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const usable = pageW - MARGIN * 2

  const COL_W = [154, 220, 104, 100, 112]
  COL_W.push(usable - COL_W.reduce((sum, w) => sum + w, 0))
  const colXs = []
  let cursor = MARGIN
  for (const w of COL_W) {
    colXs.push(cursor)
    cursor += w
  }
  const colCenter = (i) => colXs[i] + COL_W[i] / 2

  const bandTop = TITLE_TOP + 42
  const tableTop = bandTop + BAND_H + BAND_GAP
  const contentBottom = pageH - BOTTOM

  function cellRect(x, y, w, h, fill) {
    pdf.setDrawColor(...C.black)
    pdf.setLineWidth(0.8)
    pdf.setFillColor(...fill)
    pdf.rect(x, y, w, h, 'FD')
  }

  function centerText(text, x, y, { font = 'helvetica', style = 'bold', size = 10, color = C.black } = {}) {
    pdf.setFont(font, style)
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
    pdf.text(String(text), x, y, { align: 'center' })
  }

  // ---------- page chrome (title + date band) ----------
  function drawPageTop() {
    pdf.setFont('times', 'italic')
    pdf.setFontSize(20)
    pdf.setTextColor(...C.black)
    pdf.text(title, pageW / 2, TITLE_TOP + 28, { align: 'center' })

    pdf.setFont('times', 'italic')
    pdf.setFontSize(10)
    pdf.setTextColor(...C.muted)
    pdf.text('Vehicle Automation', MARGIN + usable, TITLE_TOP + 28, { align: 'right' })

    pdf.setFillColor(...C.greenBand)
    pdf.rect(MARGIN, bandTop, usable, BAND_H, 'F')
    pdf.setFont('times', 'bolditalic')
    pdf.setFontSize(12)
    pdf.setTextColor(...C.black)
    pdf.text('Date', MARGIN + 16, bandTop + 17)
    pdf.text(formatShortDate(generatedAt), MARGIN + usable - 16, bandTop + 17, {
      align: 'right',
    })
  }

  // ---------- table header (blue labels + gray totals row) ----------
  function drawTableHeader(withTotals) {
    const labels = ['Total Machinery', 'Total', 'Hired', 'Threshold', '%']
    labels.forEach((label, idx) => {
      const i = idx + 1
      cellRect(colXs[i], tableTop, COL_W[i], HEADER_H, C.headerBlue)
      centerText(label, colCenter(i), tableTop + HEADER_H / 2 + 3.5, { size: 10 })
    })
    // left column header area is part of the merged side cell (white)

    if (!withTotals) return tableTop + HEADER_H

    const y = tableTop + HEADER_H
    // values[i] must line up with header column i: 1 = name (blank
    // here), 2 = Total, 3 = Hired, 4 = Threshold, 5 = %.
    const values = totals
      ? [null, null, totals.totalMachinery, totals.hired, totals.thresholdMet, totals.thresholdPercentage ?? 0]
      : [null, null, 0, 0, 0, 0]
    for (let i = 1; i <= 5; i++) {
      const isPct = i === 5
      const value = values[i]
      const meets = isPct && Number(value) >= 100
      const fill = isPct && !meets ? C.pink : C.gray
      cellRect(colXs[i], y, COL_W[i], ROW_H, fill)
      if (value === null || value === undefined) continue
      centerText(value, colCenter(i), y + ROW_H / 2 + 3.5, {
        size: 10,
        color: isPct && !meets ? C.red : C.black,
      })
    }
    return y + ROW_H
  }

  // ---------- merged side cell ----------
  function drawSideCell(top, height) {
    cellRect(MARGIN, top, COL_W[0], height, C.white)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(...C.black)
    const midY = top + height / 2
    pdf.text('Machinery', MARGIN + COL_W[0] / 2, midY - 4, { align: 'center' })
    pdf.text('Field', MARGIN + COL_W[0] / 2, midY + 12, { align: 'center' })
  }

  // ---------- data rows ----------
  function drawRow(row, y) {
    cellRect(colXs[1], y, usable - COL_W[0], ROW_H, C.white)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(...C.black)
    const nameLines = pdf.splitTextToSize(String(row.usedFor ?? ''), COL_W[1] - 16)
    pdf.text(nameLines[0] ?? '', colCenter(1), y + ROW_H / 2 + 3.5, { align: 'center' })

    const values = [row.total ?? 0, row.hired ?? 0, row.threshold ?? 0]
    values.forEach((value, idx) => {
      centerText(value, colCenter(idx + 2), y + ROW_H / 2 + 3.5, { size: 10 })
    })
    pdf.setDrawColor(...C.black)
    pdf.setLineWidth(0.8)
    for (let i = 2; i <= 4; i++) {
      pdf.line(colXs[i], y, colXs[i], y + ROW_H)
    }

    const pct = row.thresholdPct ?? 0
    const meets = pct >= 100
    cellRect(colXs[5], y, COL_W[5], ROW_H, meets ? C.white : C.pink)
    centerText(pct, colCenter(5), y + ROW_H / 2 + 3.5, {
      size: 10,
      color: meets ? C.black : C.red,
    })
  }

  function drawEmptyRow(y) {
    cellRect(colXs[1], y, usable - COL_W[0], ROW_H, C.white)
    centerText('No data available', colXs[1] + (usable - COL_W[0]) / 2, y + ROW_H / 2 + 3.5, {
      size: 10,
      style: 'normal',
      color: C.muted,
    })
  }

  // ---------- pagination ----------
  const headerBlock = HEADER_H + (totals ? ROW_H : 0)
  const capacity = Math.max(1, Math.floor((contentBottom - tableTop - headerBlock) / ROW_H))

  const pages = []
  if (rows.length === 0) {
    pages.push({ rows: [], empty: true })
  } else {
    for (let i = 0; i < rows.length; i += capacity) {
      pages.push({ rows: rows.slice(i, i + capacity), empty: false })
    }
  }

  // ---------- render ----------
  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) pdf.addPage()
    drawPageTop()

    const withTotals = pageIndex === 0 && totals
    let bodyTop = drawTableHeader(withTotals)

    const sideH = bodyTop - tableTop + Math.max(page.rows.length, page.empty ? 1 : 0) * ROW_H
    drawSideCell(tableTop, sideH)

    if (page.empty) {
      drawEmptyRow(bodyTop)
      return
    }
    page.rows.forEach((row, i) => {
      drawRow(row, bodyTop + i * ROW_H)
    })
  })

  return pdf.save(filename)
}
