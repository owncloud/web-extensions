import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { ReportData, dateTime, isoDate, sections } from './export'

// ---- PDF ----------------------------------------------------------------------------------

/** Helvetica only covers Latin-1 (WinAnsi); replace what it can't draw instead of printing garbage. */
const pdfSafe = (s: string) =>
  s
    .replace(/[–—]/g, '-')
    .replace(/≥/g, '>=')
    .replace(/[^\x20-\x7e\xa0-\xff€]/g, '?')

const ACCENT: [number, number, number] = [43, 43, 43]

export function buildPdf(data: ReportData): Blob {
  const { meta } = data
  const s = sections(data)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = margin

  const safeRows = (rows: string[][]) => rows.map((r) => r.map(pdfSafe))
  const tableDefaults = {
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 1.6, overflow: 'linebreak' as const },
    headStyles: { fillColor: ACCENT, textColor: 255, fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: [245, 245, 245] as [number, number, number] }
  }
  // header cells follow their column's alignment (autoTable applies columnStyles to the body only)
  const alignHead = (c: any) => {
    if (c.section !== 'head') return
    const halign = c.table.styles?.columnStyles?.[c.column.index]?.halign
    if (halign) c.cell.styles.halign = halign
  }
  const withHead = (fn?: (c: any) => void) => (c: any) => {
    alignHead(c)
    fn?.(c)
  }
  const nextY = () => ((doc as any).lastAutoTable?.finalY ?? y) + 8
  const heading = (text: string) => {
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage()
      y = margin
    }
    doc.setFont('helvetica', 'bold').setFontSize(12).text(pdfSafe(text), margin, y)
    y += 3
  }

  // title
  doc
    .setFont('helvetica', 'bold')
    .setFontSize(18)
    .text('Space report', margin, y + 4)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  doc.text(pdfSafe(meta.server), margin, y + 11)
  doc.setTextColor(110)
  doc.text(
    pdfSafe(`Generated ${dateTime(meta.generatedAt)} by ${meta.generatedBy || 'unknown'}`),
    margin,
    y + 16
  )
  doc.setTextColor(0)
  y += 24

  // notes
  doc.setFontSize(8.5).setTextColor(90)
  for (const n of s.notes) {
    const lines = doc.splitTextToSize(pdfSafe(`- ${n}`), pageW - 2 * margin)
    doc.text(lines, margin, y)
    y += lines.length * 3.8
  }
  doc.setTextColor(0)
  y += 4

  // overview + key figures side by side
  heading('Overview')
  const [ovHeader, ...ovRows] = s.overview
  const half = (pageW - 2 * margin - 6) / 2
  autoTable(doc, {
    ...tableDefaults,
    startY: y,
    head: [ovHeader.map(pdfSafe)],
    body: safeRows(ovRows),
    tableWidth: half + 16,
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    didParseCell: withHead((c) => {
      if (c.section === 'body' && c.row.index === ovRows.length - 1)
        c.cell.styles.fontStyle = 'bold'
    })
  })
  const overviewEnd = nextY()
  autoTable(doc, {
    ...tableDefaults,
    startY: y,
    margin: { left: margin + half + 22, right: margin },
    head: [['Key figure', 'Value']],
    body: safeRows(s.keyFigures),
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: withHead()
  })
  y = Math.max(overviewEnd, nextY())

  heading('Largest spaces')
  autoTable(doc, {
    ...tableDefaults,
    startY: y,
    head: [['#', 'Space', 'Type', 'Used']],
    body: s.largest.length ? safeRows(s.largest) : [['', 'No data', '', '']],
    columnStyles: { 0: { halign: 'right', cellWidth: 8 }, 3: { halign: 'right' } },
    didParseCell: withHead()
  })
  y = nextY()

  heading('Fullest spaces (by quota)')
  autoTable(doc, {
    ...tableDefaults,
    startY: y,
    head: [['#', 'Space', 'Type', 'Full', 'Used / Quota']],
    body: s.fullest.length ? safeRows(s.fullest) : [['', 'No spaces with a quota', '', '', '']],
    columnStyles: {
      0: { halign: 'right', cellWidth: 8 },
      3: { halign: 'right' },
      4: { halign: 'right' }
    },
    didParseCell: withHead((c) => {
      const ratio = data.summary.fullest[c.row.index]?.ratio
      if (
        c.section === 'body' &&
        c.column.index === 3 &&
        ratio !== null &&
        ratio !== undefined &&
        ratio * 100 >= meta.thresholdPercent
      ) {
        c.cell.styles.textColor = [198, 40, 40]
        c.cell.styles.fontStyle = 'bold'
      }
    })
  })
  y = nextY()

  if (s.orphanCheck) {
    heading(`Orphaned spaces (${s.orphans.length})`)
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      head: [['Type', 'Space', 'Reason', 'Used', 'Modified']],
      body: s.orphans.length ? safeRows(s.orphans) : [['', 'No orphaned spaces found', '', '', '']],
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right', cellWidth: 20 } },
      didParseCell: withHead()
    })
    y = nextY()
  }

  doc.addPage()
  y = margin
  heading(`All spaces (${s.all.length})`)
  autoTable(doc, {
    ...tableDefaults,
    startY: y,
    head: [['Type', 'Name', 'Owner', 'Used', 'Quota', 'Full', 'Modified']],
    body: safeRows(s.all),
    styles: { ...tableDefaults.styles, fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 22 },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', cellWidth: 20 }
    },
    didParseCell: withHead()
  })

  // footer on every page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(130)
    const h = doc.internal.pageSize.getHeight()
    doc.text(pdfSafe(`${meta.server} - ${isoDate(meta.generatedAt)}`), margin, h - 8)
    doc.text(`${i} / ${pages}`, pageW - margin, h - 8, { align: 'right' })
  }

  return doc.output('blob')
}
