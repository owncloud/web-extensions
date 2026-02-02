import { describe, it, expect } from 'vitest'
import {
  escapeKQL,
  buildRangeQuery,
  buildDateRangeQuery,
  escapeXML,
  buildStandardKQL,
  buildPhotoKQL,
  buildKQL,
} from '../../src/utils/kql'
import { formatDateForKQL } from '../../src/utils/format'

describe('escapeKQL', () => {
  it('escapes special characters', () => {
    expect(escapeKQL('hello world')).toBe('hello\\ world')
    expect(escapeKQL('file:name')).toBe('file\\:name')
    expect(escapeKQL('test+value')).toBe('test\\+value')
    expect(escapeKQL('(parentheses)')).toBe('\\(parentheses\\)')
  })

  it('preserves wildcards when present', () => {
    expect(escapeKQL('file*.txt')).toBe('file*.txt')
    expect(escapeKQL('doc?.pdf')).toBe('doc?.pdf')
    expect(escapeKQL('test*value')).toBe('test*value')
  })

  it('escapes other special chars but keeps wildcards', () => {
    expect(escapeKQL('file:*.txt')).toBe('file\\:*.txt')
    expect(escapeKQL('(test*)')).toBe('\\(test*\\)')
  })

  it('handles empty string', () => {
    expect(escapeKQL('')).toBe('')
  })

  it('handles string with no special chars', () => {
    expect(escapeKQL('simple')).toBe('simple')
  })
})

describe('formatDateForKQL', () => {
  it('returns valid YYYY-MM-DD dates unchanged', () => {
    expect(formatDateForKQL('2024-01-15')).toBe('2024-01-15')
    expect(formatDateForKQL('2023-12-31')).toBe('2023-12-31')
  })

  it('formats Date-parseable strings', () => {
    expect(formatDateForKQL('January 15, 2024')).toBe('2024-01-15')
  })

  it('returns null for invalid dates', () => {
    expect(formatDateForKQL('not-a-date')).toBeNull()
  })

  it('returns null for empty or whitespace input', () => {
    expect(formatDateForKQL('')).toBeNull()
    expect(formatDateForKQL('   ')).toBeNull()
  })

  it('returns null for dates that match regex but are invalid', () => {
    // These match YYYY-MM-DD format but aren't valid dates
    expect(formatDateForKQL('2023-13-45')).toBeNull()
    expect(formatDateForKQL('2023-00-01')).toBeNull()
  })
})

describe('buildRangeQuery', () => {
  it('returns null for empty range', () => {
    expect(buildRangeQuery('size', {})).toBeNull()
    expect(buildRangeQuery('size', { min: undefined, max: undefined })).toBeNull()
  })

  it('builds min-only query', () => {
    expect(buildRangeQuery('size', { min: 100 })).toBe('size>=100')
  })

  it('builds max-only query', () => {
    expect(buildRangeQuery('size', { max: 1000 })).toBe('size<=1000')
  })

  it('builds full range query with parentheses', () => {
    expect(buildRangeQuery('size', { min: 100, max: 1000 })).toBe('(size>=100 AND size<=1000)')
  })

  it('handles zero values', () => {
    expect(buildRangeQuery('size', { min: 0 })).toBe('size>=0')
    expect(buildRangeQuery('size', { min: 0, max: 0 })).toBe('(size>=0 AND size<=0)')
  })

  it('works with different field names', () => {
    expect(buildRangeQuery('photo.iso', { min: 100, max: 800 })).toBe('(photo.iso>=100 AND photo.iso<=800)')
  })
})

describe('buildDateRangeQuery', () => {
  it('returns null for empty range', () => {
    expect(buildDateRangeQuery('mtime', { start: '', end: '' })).toBeNull()
  })

  it('builds start-only query', () => {
    expect(buildDateRangeQuery('mtime', { start: '2024-01-01', end: '' })).toBe('mtime>=2024-01-01')
  })

  it('builds end-only query', () => {
    expect(buildDateRangeQuery('mtime', { start: '', end: '2024-12-31' })).toBe('mtime<=2024-12-31')
  })

  it('builds full range query with parentheses', () => {
    expect(buildDateRangeQuery('mtime', { start: '2024-01-01', end: '2024-12-31' }))
      .toBe('(mtime>=2024-01-01 AND mtime<=2024-12-31)')
  })

  it('works with photo date field', () => {
    expect(buildDateRangeQuery('photo.takendatetime', { start: '2023-06-01', end: '2023-06-30' }))
      .toBe('(photo.takendatetime>=2023-06-01 AND photo.takendatetime<=2023-06-30)')
  })
})

describe('escapeXML', () => {
  it('escapes ampersand', () => {
    expect(escapeXML('a & b')).toBe('a &amp; b')
  })

  it('escapes less than', () => {
    expect(escapeXML('a < b')).toBe('a &lt; b')
  })

  it('escapes greater than', () => {
    expect(escapeXML('a > b')).toBe('a &gt; b')
  })

  it('escapes quotes', () => {
    expect(escapeXML('"quoted"')).toBe('&quot;quoted&quot;')
    expect(escapeXML("'single'")).toBe('&apos;single&apos;')
  })

  it('escapes multiple characters', () => {
    expect(escapeXML('size>=100 AND size<=1000')).toBe('size&gt;=100 AND size&lt;=1000')
  })
})

describe('buildStandardKQL', () => {
  const emptyFilters = {}

  it('returns empty array for empty filters', () => {
    expect(buildStandardKQL(emptyFilters, '')).toEqual([])
  })

  it('builds search term query for single word', () => {
    expect(buildStandardKQL(emptyFilters, 'vacation')).toEqual(['name:*vacation*'])
  })

  it('builds quoted search term query for multi-word phrases', () => {
    expect(buildStandardKQL(emptyFilters, 'List of CIOs')).toEqual(['name:"*List of CIOs*"'])
  })

  it('passes through terms with field prefix', () => {
    expect(buildStandardKQL(emptyFilters, 'content:report')).toEqual(['content:report'])
  })

  it('builds name filter with wildcards', () => {
    expect(buildStandardKQL({ name: '*.pdf' }, '')).toEqual(['name:*.pdf'])
  })

  it('builds name filter for single word', () => {
    expect(buildStandardKQL({ name: 'document' }, '')).toEqual(['name:*document*'])
  })

  it('builds name filter for multi-word phrase', () => {
    expect(buildStandardKQL({ name: 'annual report' }, '')).toEqual(['name:"*annual report*"'])
  })

  it('builds type filter for files', () => {
    expect(buildStandardKQL({ type: 'file' }, '')).toEqual(['Type:1'])
  })

  it('builds type filter for folders', () => {
    expect(buildStandardKQL({ type: 'folder' }, '')).toEqual(['Type:2'])
  })

  it('builds size range filter', () => {
    expect(buildStandardKQL({ sizeRange: { min: 1000, max: 10000 } }, ''))
      .toEqual(['(size>=1000 AND size<=10000)'])
  })

  it('builds modified date range filter', () => {
    expect(buildStandardKQL({ modifiedRange: { start: '2024-01-01', end: '2024-12-31' } }, ''))
      .toEqual(['(mtime>=2024-01-01 AND mtime<=2024-12-31)'])
  })

  it('builds media type filter', () => {
    // Note: / is escaped even with wildcards present
    expect(buildStandardKQL({ mediaType: 'image/*' }, '')).toEqual(['mediatype:image\\/*'])
  })

  it('builds single tag filter (quoted)', () => {
    expect(buildStandardKQL({ tags: 'important' }, '')).toEqual(['tags:"important"'])
  })

  it('builds multiple tags with OR (quoted)', () => {
    expect(buildStandardKQL({ tags: 'vacation, photos' }, ''))
      .toEqual(['(tags:"vacation" OR tags:"photos")'])
  })

  it('builds tag filter with spaces (quoted)', () => {
    expect(buildStandardKQL({ tags: 'my tag' }, ''))
      .toEqual(['tags:"my tag"'])
  })

  it('builds tag filter with colons (quoted to preserve special chars)', () => {
    expect(buildStandardKQL({ tags: 'exif:make:HP' }, ''))
      .toEqual(['tags:"exif:make:HP"'])
  })

  it('builds content filter for single word', () => {
    expect(buildStandardKQL({ content: 'report' }, ''))
      .toEqual(['content:report'])
  })

  it('builds quoted content filter for multi-word phrase', () => {
    expect(buildStandardKQL({ content: 'annual report' }, ''))
      .toEqual(['content:"annual report"'])
  })

  it('combines multiple filters', () => {
    const filters = {
      type: 'file' as const,
      mediaType: 'image/*',
    }
    expect(buildStandardKQL(filters, 'photo')).toEqual([
      'name:*photo*',
      'Type:1',
      'mediatype:image\\/*',
    ])
  })
})

describe('buildPhotoKQL', () => {
  const emptyFilters = {}

  it('returns empty array for empty filters', () => {
    expect(buildPhotoKQL(emptyFilters)).toEqual([])
  })

  it('builds camera make filter', () => {
    expect(buildPhotoKQL({ cameraMake: 'Canon' })).toEqual(['photo.cameramake:Canon'])
  })

  it('builds camera model filter for single word', () => {
    expect(buildPhotoKQL({ cameraModel: 'R5' })).toEqual(['photo.cameramodel:R5'])
  })

  it('builds camera model filter with spaces (quoted)', () => {
    expect(buildPhotoKQL({ cameraModel: 'EOS R5' })).toEqual(['photo.cameramodel:"EOS R5"'])
  })

  it('builds taken date range filter', () => {
    expect(buildPhotoKQL({ takenDateRange: { start: '2024-01-01', end: '2024-06-30' } }))
      .toEqual(['(photo.takendatetime>=2024-01-01 AND photo.takendatetime<=2024-06-30)'])
  })

  it('builds ISO range filter', () => {
    expect(buildPhotoKQL({ isoRange: { min: 100, max: 800 } }))
      .toEqual(['(photo.iso>=100 AND photo.iso<=800)'])
  })

  it('builds f-number range filter', () => {
    expect(buildPhotoKQL({ fNumberRange: { min: 1.4, max: 2.8 } }))
      .toEqual(['(photo.fnumber>=1.4 AND photo.fnumber<=2.8)'])
  })

  it('builds focal length range filter', () => {
    expect(buildPhotoKQL({ focalLengthRange: { min: 24, max: 70 } }))
      .toEqual(['(photo.focallength>=24 AND photo.focallength<=70)'])
  })

  it('builds orientation filter', () => {
    expect(buildPhotoKQL({ orientation: 6 })).toEqual(['photo.orientation:6'])
  })

  it('ignores zero orientation', () => {
    expect(buildPhotoKQL({ orientation: 0 })).toEqual([])
  })

  it('combines multiple photo filters', () => {
    const filters = {
      cameraMake: 'Nikon',
      isoRange: { min: 100, max: 400 },
    }
    expect(buildPhotoKQL(filters)).toEqual([
      'photo.cameramake:Nikon',
      '(photo.iso>=100 AND photo.iso<=400)',
    ])
  })
})

describe('buildKQL', () => {
  it('returns * for empty filters', () => {
    const filters = {
      term: '',
      scope: 'allFiles' as const,
      standard: {},
      photo: {},
    }
    expect(buildKQL(filters)).toBe('*')
  })

  it('builds query from term only', () => {
    const filters = {
      term: 'vacation',
      scope: 'allFiles' as const,
      standard: {},
      photo: {},
    }
    expect(buildKQL(filters)).toBe('name:*vacation*')
  })

  it('combines standard and photo filters', () => {
    const filters = {
      term: '',
      scope: 'allFiles' as const,
      standard: { mediaType: 'image/*' },
      photo: { cameraMake: 'Canon' },
    }
    expect(buildKQL(filters)).toBe('mediatype:image\\/* AND photo.cameramake:Canon')
  })

  it('builds complex query with multiple filters', () => {
    const filters = {
      term: 'sunset',
      scope: 'allFiles' as const,
      standard: {
        type: 'file' as const,
        mediaType: 'image/*',
      },
      photo: {
        cameraMake: 'Canon',
        isoRange: { max: 800 },
      },
    }
    expect(buildKQL(filters)).toBe(
      'name:*sunset* AND Type:1 AND mediatype:image\\/* AND photo.cameramake:Canon AND photo.iso<=800'
    )
  })
})
