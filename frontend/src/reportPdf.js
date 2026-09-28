import { jsPDF } from 'jspdf'

const MARGIN = 18
const TEXT = [28, 25, 23]
const MUTED = [113, 113, 113]
const LINE = [0, 0, 0]
const WHITE = [255, 255, 255]

const HEADER_FONT = 8
const HEADER_LINE = HEADER_FONT * 1.3
const MIN_FONT = 6.5

const CELL_PAD_X = 2
const ROW_PAD = 3
const GRID_WIDTH = 0.6

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

  const topH = title || subtitle ? 19 + (title ? 15 : 0) + (subtitle ? 12 : 0) + 6 : 0
  const tableTop = MARGIN + topH

  let size = 8.5
  let colXs = []
  let tableLeft = MARGIN
  let tableRight = MARGIN

  function layoutColumns(s) {
    const natural = columns.map((col, colIndex) => {
      let w = 0
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(HEADER_FONT)
      w = Math.max(w, pdf.getTextWidth(String(col.label ?? '')))
      if (col.widthSample != null) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(s)
        w = Math.max(w, pdf.getTextWidth(String(col.widthSample)))
      } else {
        const scan = (cell) => {
          if (!cell) return
          if (cell.badge) {
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(s - 0.5)
            w = Math.max(w, pdf.getTextWidth(String(cell.badge.text)) + 8)
            return
          }
          const text = String(cell.text ?? '')
          if (!text) return
          pdf.setFont('helvetica', cell.bold ? 'bold' : 'normal')
          pdf.setFontSize(s)
          w = Math.max(w, pdf.getTextWidth(text))
        }
        for (const row of rows) scan(row.cells[colIndex])
        scan(footer?.cells[colIndex])
      }
      return w + CELL_PAD_X * 2
    })
    const sum = natural.reduce((total, w) => total + w, 0)
    const shrink = sum > usableW ? usableW / sum : 1
    const left = (pageW - sum * shrink) / 2
    const xs = []
    let cursor = left
    for (const w of natural) {
      xs.push({ x: cursor, w: w * shrink })
      cursor += w * shrink
    }
    colXs = xs
    tableLeft = left
    tableRight = cursor
  }

  layoutColumns(size)

  function linesFor(text, colIndex, size, bold = false) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    if (columns[colIndex].noWrap) return [String(text ?? '')]
    const width = Math.max(6, colXs[colIndex].w - CELL_PAD_X * 2)
    return pdf.splitTextToSize(String(text ?? ''), width)
  }

  function measureHeader() {
    let h = HEADER_LINE + 5
    for (const [i, col] of columns.entries()) {
      const count = linesFor(String(col.label ?? ''), i, HEADER_FONT, true).length
      h = Math.max(h, count * HEADER_LINE + 5)
    }
    return h
  }

  let headerH = measureHeader()

  function measureRow(cells, size) {
    let lines = 1
    for (const [i, cell] of cells.entries()) {
      if (cell.badge) continue
      lines = Math.max(lines, linesFor(cell.text, i, size, cell.bold).length)
    }
    return Math.max(size * 1.45, lines * size * 1.25 + ROW_PAD)
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

  const capacity = () => (pageH - MARGIN - topH - headerH) * 2
  let plan = measure(size)
  while (plan.total > capacity() && size > MIN_FONT) {
    size -= 0.5
    layoutColumns(size)
    headerH = measureHeader()
    plan = measure(size)
  }

  const lh = size * 1.3

  function drawGrid(y, h) {
    const right = tableRight
    pdf.setDrawColor(...LINE)
    pdf.setLineWidth(GRID_WIDTH)
    pdf.line(tableLeft, y, right, y)
    pdf.line(tableLeft, y + h, right, y + h)
    pdf.line(tableLeft, y, tableLeft, y + h)
    pdf.line(right, y, right, y + h)
    for (let i = 1; i < colXs.length; i++) {
      const x = colXs[i].x
      pdf.line(x, y, x, y + h)
    }
  }

  function drawCellLines(lines, colIndex, y, h, color, align, bold) {
    const col = colXs[colIndex]
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
    const blockH = lines.length * lh
    let baseline = y + (h - blockH) / 2 + lh * 0.72
    const position =
      align === 'right'
        ? col.x + col.w - CELL_PAD_X
        : align === 'center'
          ? col.x + col.w / 2
          : col.x + CELL_PAD_X
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
    if (!title && !subtitle) return MARGIN
    pdf.setFillColor(...accent)
    pdf.rect(tableLeft, MARGIN, tableRight - tableLeft, 5, 'F')
    let y = MARGIN + 19
    if (title) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(13)
      pdf.setTextColor(...TEXT)
      pdf.text(title, tableLeft, y)
      y += 15
    }
    if (subtitle) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      pdf.setTextColor(100, 100, 100)
      pdf.text(subtitle, tableLeft, y)
      y += 12
    }
    return y + 6
  }

  function drawColumnHeader(y) {
    pdf.setFillColor(...accent)
    pdf.rect(tableLeft, y, tableRight - tableLeft, headerH, 'F')
    columns.forEach((col, i) => {
      const lines = linesFor(String(col.label ?? ''), i, HEADER_FONT, true)
      drawCellLines(lines, i, y, headerH, WHITE, alignOf(col.align), true)
    })
    drawGrid(y, headerH)
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
      pdf.rect(tableLeft, y, tableRight - tableLeft, h, 'F')
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
      drawGrid(y, h)
      y += h
    }
    return y
  }

  function drawFooter(y) {
    const h = plan.footerH
    if (y + h > bottomY) y = newPage()
    pdf.setFillColor(...footerBg)
    pdf.rect(tableLeft, y, tableRight - tableLeft, h, 'F')
    pdf.setFillColor(...accent)
    pdf.rect(tableLeft, y, tableRight - tableLeft, 1.2, 'F')
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
    drawGrid(y, h)
    return y + h
  }

  function drawNote(y) {
    if (!note) return y
    if (y + plan.noteH > bottomY) y = newPage()
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...MUTED)
    pdf.text(note, tableLeft, y + 9)
    return y + plan.noteH
  }

  drawTop()
  let y = drawRows()
  if (footer) y = drawFooter(y)
  drawNote(y)

  return pdf.save(filename)
}
