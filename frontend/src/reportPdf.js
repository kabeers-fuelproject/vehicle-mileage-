import { jsPDF } from 'jspdf'

const MARGIN = 18
const TEXT = [28, 25, 23]
const MUTED = [113, 113, 113]
const LINE = [229, 229, 229]
const WHITE = [255, 255, 255]

const HEADER_FONT = 6.5
const HEADER_LINE = HEADER_FONT * 1.3
const MIN_FONT = 5

function alignOf(value) {
  return value === 'right' || value === 'center' ? value : 'left'
}

export function buildTablePdf({
  filename,
  title = '',
  subtitle = '',
  note = '',
  columns,
  rows,
  footer = null,
  accent = [21, 128, 61],
  zebra = null,
  footerBg = [240, 253, 244],
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
  const usableW = pageW - MARGIN * 2
  const bottomY = pageH - MARGIN

  const totalWeight = columns.reduce((sum, c) => sum + (c.width ?? 1), 0)
  const colXs = []
  let cursor = MARGIN
  for (const col of columns) {
    const w = ((col.width ?? 1) / totalWeight) * usableW
    colXs.push({ x: cursor, w })
    cursor += w
  }

  const topH = 19 + (title ? 15 : 0) + (subtitle ? 12 : 0) + 6
  const tableTop = MARGIN + topH

  function linesFor(text, colIndex, size, bold = false) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    const width = Math.max(6, colXs[colIndex].w - 6)
    return pdf.splitTextToSize(String(text ?? ''), width)
  }

  let headerH = HEADER_LINE + 7
  for (const [i, col] of columns.entries()) {
    const count = linesFor(String(col.label ?? '').toUpperCase(), i, HEADER_FONT, true).length
    headerH = Math.max(headerH, count * HEADER_LINE + 7)
  }

  function measureRow(cells, size) {
    let lines = 1
    for (const [i, cell] of cells.entries()) {
      if (cell.badge) continue
      lines = Math.max(lines, linesFor(cell.text, i, size, cell.bold).length)
    }
    return Math.max(size * 1.6, lines * size * 1.3 + 5)
  }

  function measure(size) {
    const heights = rows.map((row) => measureRow(row.cells, size))
    const footerH = footer ? measureRow(footer.cells, size) : 0
    const noteH = note ? 14 : 0
    return {
      heights,
      footerH,
      noteH,
      total: heights.reduce((sum, h) => sum + h, 0) + footerH + noteH,
    }
  }

  const perPage = pageH - MARGIN - topH - headerH
  const capacity = perPage * 2
  let size = 7
  let plan = measure(size)
  while (plan.total > capacity && size > MIN_FONT) {
    size -= 0.5
    plan = measure(size)
  }

  const lh = size * 1.3

  function drawCellLines(lines, colIndex, y, h, color, align, bold) {
    const col = colXs[colIndex]
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
    const blockH = lines.length * lh
    let baseline = y + (h - blockH) / 2 + lh * 0.72
    const position =
      align === 'right'
        ? col.x + col.w - 3
        : align === 'center'
          ? col.x + col.w / 2
          : col.x + 3
    for (const line of lines) {
      pdf.text(line, position, baseline, { align })
      baseline += lh
    }
  }

  function drawBadge(cell, colIndex, y, h) {
    const col = colXs[colIndex]
    const fontSize = size - 0.5
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(fontSize)
    const textW = pdf.getTextWidth(cell.badge.text)
    const w = textW + 10
    const hgt = fontSize + 5
    const x = col.x + (col.w - w) / 2
    const by = y + (h - hgt) / 2
    pdf.setFillColor(...cell.badge.bg)
    pdf.roundedRect(x, by, w, hgt, hgt / 2, hgt / 2, 'F')
    pdf.setTextColor(...cell.badge.color)
    pdf.text(cell.badge.text, x + w / 2, by + hgt / 2 + fontSize * 0.35, {
      align: 'center',
    })
  }

  function drawTop() {
    pdf.setFillColor(...accent)
    pdf.rect(MARGIN, MARGIN, usableW, 5, 'F')
    let y = MARGIN + 19
    if (title) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(13)
      pdf.setTextColor(...TEXT)
      pdf.text(title, MARGIN, y)
      y += 15
    }
    if (subtitle) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      pdf.setTextColor(100, 100, 100)
      pdf.text(subtitle, MARGIN, y)
      y += 12
    }
    return y + 6
  }

  function drawColumnHeader(y) {
    pdf.setFillColor(...accent)
    pdf.rect(MARGIN, y, usableW, headerH, 'F')
    columns.forEach((col, i) => {
      const lines = linesFor(String(col.label ?? '').toUpperCase(), i, HEADER_FONT, true)
      drawCellLines(lines, i, y, headerH, WHITE, alignOf(col.align), true)
    })
    return y + headerH
  }

  function newPage() {
    pdf.addPage()
    const y = drawTop()
    return drawColumnHeader(y)
  }

  function drawRows() {
    let y = drawColumnHeader(tableTop)
    for (const [index, row] of rows.entries()) {
      const h = plan.heights[index]
      if (y + h > bottomY) y = newPage()
      const bg = row.bg ?? (zebra && index % 2 === 0 ? zebra : WHITE)
      pdf.setFillColor(...bg)
      pdf.rect(MARGIN, y, usableW, h, 'F')
      row.cells.forEach((cell, i) => {
        const align = alignOf(cell.align ?? columns[i].align)
        if (cell.badge) drawBadge(cell, i, y, h)
        else if (String(cell.text ?? '') !== '') {
          drawCellLines(
            linesFor(cell.text, i, size, cell.bold),
            i,
            y,
            h,
            cell.color ?? TEXT,
            align,
            cell.bold,
          )
        }
      })
      pdf.setDrawColor(...LINE)
      pdf.setLineWidth(0.4)
      pdf.line(MARGIN, y + h, MARGIN + usableW, y + h)
      y += h
    }
    return y
  }

  function drawFooter(y) {
    const h = plan.footerH
    if (y + h > bottomY) y = newPage()
    pdf.setFillColor(...footerBg)
    pdf.rect(MARGIN, y, usableW, h, 'F')
    pdf.setFillColor(...accent)
    pdf.rect(MARGIN, y, usableW, 1.2, 'F')
    footer.cells.forEach((cell, i) => {
      const align = alignOf(cell.align ?? columns[i].align)
      if (String(cell.text ?? '') !== '') {
        drawCellLines(
          linesFor(cell.text, i, size, true),
          i,
          y,
          h,
          cell.color ?? TEXT,
          align,
          true,
        )
      }
    })
    return y + h
  }

  function drawNote(y) {
    if (!note) return y
    if (y + plan.noteH > bottomY) y = newPage()
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...MUTED)
    pdf.text(note, MARGIN, y + 9)
    return y + plan.noteH
  }

  drawTop()
  let y = drawRows()
  if (footer) y = drawFooter(y)
  drawNote(y)

  return pdf.save(filename)
}
