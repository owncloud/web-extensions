export interface CSVPreview {
  headers: string[]
  columns: string[][]
}

export function parseCSV(text: string, delimiter = ',', maxRows = 200): CSVPreview {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuote = false
  let i = 0
  const len = text.length

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    rows.push(row)
    row = []
  }

  while (i < len) {
    const ch = text[i]

    if (inQuote) {
      if (ch === '"' && i + 1 < len && text[i + 1] === '"') {
        // Escaped double-quote inside a quoted field (RFC-4180 §2 rule 7)
        field += '"'
        i += 2
      } else if (ch === '"') {
        inQuote = false
        i++
      } else {
        field += ch
        i++
      }
    } else if (ch === '"') {
      inQuote = true
      i++
    } else if (ch === delimiter) {
      pushField()
      i++
    } else if (ch === '\r') {
      pushField()
      pushRow()
      i = i + 1 < len && text[i + 1] === '\n' ? i + 2 : i + 1
      if (rows.length > maxRows) break
    } else if (ch === '\n') {
      pushField()
      pushRow()
      i++
      if (rows.length > maxRows) break
    } else {
      field += ch
      i++
    }
  }

  // Capture any trailing content not terminated by a newline
  if (row.length > 0 || field !== '') {
    row.push(field)
    rows.push(row)
  }

  if (rows.length === 0) return { headers: [], columns: [] }

  const headers = rows[0]
  const dataRows = rows.slice(1, maxRows + 1)
  const columns: string[][] = headers.map((_, ci) => dataRows.map((r) => r[ci] ?? ''))

  return { headers, columns }
}
