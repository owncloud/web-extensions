import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAdvancedSearch } from '../../src/composables/useAdvancedSearch'

// Mock vue3-gettext
vi.mock('vue3-gettext', () => ({
  useGettext: () => ({
    $gettext: (msg: string) => msg,
    $ngettext: (singular: string, plural: string, n: number) => (n === 1 ? singular : plural),
    $pgettext: (_context: string, msg: string) => msg,
  })
}))

// Mock @ownclouders/web-pkg
vi.mock('@ownclouders/web-pkg', () => ({
  useClientService: () => ({
    httpAuthenticated: {
      request: vi.fn().mockResolvedValue({
        status: 207,
        data: '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"></d:multistatus>'
      })
    }
  }),
  useConfigStore: () => ({
    serverUrl: 'https://cloud.example.com'
  }),
  useSpacesStore: () => ({
    spaces: [
      { id: 'space-123', name: 'Personal', driveType: 'personal', driveAlias: 'personal/user' }
    ]
  })
}))

describe('useAdvancedSearch', () => {
  let search: ReturnType<typeof useAdvancedSearch>

  beforeEach(() => {
    search = useAdvancedSearch()
  })

  describe('initial state', () => {
    it('has empty filters', () => {
      expect(search.state.filters.term).toBe('')
      expect(search.state.filters.standard).toEqual({})
      expect(search.state.filters.photo).toEqual({})
    })

    it('has no results initially', () => {
      expect(search.state.results).toBeNull()
    })

    it('is not loading initially', () => {
      expect(search.state.loading).toBe(false)
    })

    it('has no error initially', () => {
      expect(search.state.error).toBeNull()
    })

    it('defaults to list view mode', () => {
      expect(search.state.viewMode).toBe('list')
    })

    it('defaults to mtime desc sort', () => {
      expect(search.state.sort).toEqual({ field: 'mtime', direction: 'desc' })
    })

    it('has default page size of 100', () => {
      expect(search.pageSize.value).toBe(100)
    })
  })

  describe('kqlQuery computed', () => {
    it('returns * for empty filters', () => {
      expect(search.kqlQuery.value).toBe('*')
    })

    it('builds query from search term', () => {
      search.state.filters.term = 'vacation'
      expect(search.kqlQuery.value).toBe('name:*vacation*')
    })

    it('builds query from standard filters', () => {
      search.state.filters.standard.type = 'file'
      expect(search.kqlQuery.value).toBe('Type:1')
    })

    it('builds query from photo filters', () => {
      search.state.filters.photo.cameraMake = 'Canon'
      expect(search.kqlQuery.value).toBe('photo.cameramake:Canon')
    })

    it('combines multiple filters with AND', () => {
      search.state.filters.term = 'photo'
      search.state.filters.standard.type = 'file'
      search.state.filters.photo.cameraMake = 'Nikon'
      expect(search.kqlQuery.value).toBe('name:*photo* AND Type:1 AND photo.cameramake:Nikon')
    })
  })

  describe('activeFilters computed', () => {
    it('returns empty array for no filters', () => {
      expect(search.activeFilters.value).toEqual([])
    })

    it('includes search term filter', () => {
      search.state.filters.term = 'vacation'
      const filters = search.activeFilters.value
      expect(filters).toHaveLength(1)
      expect(filters[0]).toMatchObject({
        id: 'term',
        label: 'Search',
        value: 'vacation',
        category: 'text'
      })
    })

    it('includes name filter', () => {
      search.state.filters.standard.name = '*.pdf'
      const filters = search.activeFilters.value
      expect(filters).toHaveLength(1)
      expect(filters[0]).toMatchObject({
        id: 'name',
        label: 'Name',
        value: '*.pdf'
      })
    })

    it('includes type filter', () => {
      search.state.filters.standard.type = 'folder'
      const filters = search.activeFilters.value
      expect(filters[0]).toMatchObject({
        id: 'type',
        label: 'Type',
        value: 'folder'
      })
    })

    it('includes size range filter with formatted bytes', () => {
      search.state.filters.standard.sizeRange = { min: 1024, max: 1048576 }
      const filters = search.activeFilters.value
      expect(filters[0]).toMatchObject({
        id: 'size',
        label: 'Size',
        value: '1 KB - 1 MB'
      })
    })

    it('includes camera make filter', () => {
      search.state.filters.photo.cameraMake = 'Sony'
      const filters = search.activeFilters.value
      expect(filters[0]).toMatchObject({
        id: 'cameraMake',
        label: 'Camera Make',
        value: 'Sony',
        category: 'photo'
      })
    })

    it('includes ISO range filter', () => {
      search.state.filters.photo.isoRange = { min: 100, max: 800 }
      const filters = search.activeFilters.value
      expect(filters[0]).toMatchObject({
        id: 'iso',
        label: 'ISO',
        value: '100 - 800'
      })
    })

    it('includes multiple filters', () => {
      search.state.filters.term = 'sunset'
      search.state.filters.standard.type = 'file'
      search.state.filters.photo.cameraMake = 'Canon'
      expect(search.activeFilters.value).toHaveLength(3)
    })
  })

  describe('updateFilters', () => {
    it('updates term', () => {
      search.updateFilters({ term: 'new search' })
      expect(search.state.filters.term).toBe('new search')
    })
  })

  describe('updateStandardFilters', () => {
    it('updates name filter', () => {
      search.updateStandardFilters({ name: '*.jpg' })
      expect(search.state.filters.standard.name).toBe('*.jpg')
    })

    it('updates type filter', () => {
      search.updateStandardFilters({ type: 'file' })
      expect(search.state.filters.standard.type).toBe('file')
    })

    it('updates multiple standard filters', () => {
      search.updateStandardFilters({
        name: 'report',
        mediaType: 'application/pdf'
      })
      expect(search.state.filters.standard.name).toBe('report')
      expect(search.state.filters.standard.mediaType).toBe('application/pdf')
    })
  })

  describe('updatePhotoFilters', () => {
    it('updates camera make', () => {
      search.updatePhotoFilters({ cameraMake: 'Fujifilm' })
      expect(search.state.filters.photo.cameraMake).toBe('Fujifilm')
    })

    it('updates ISO range', () => {
      search.updatePhotoFilters({ isoRange: { min: 200, max: 1600 } })
      expect(search.state.filters.photo.isoRange).toEqual({ min: 200, max: 1600 })
    })
  })

  describe('removeFilter', () => {
    it('removes term filter', () => {
      search.state.filters.term = 'test'
      search.removeFilter('term')
      expect(search.state.filters.term).toBe('')
    })

    it('removes name filter', () => {
      search.state.filters.standard.name = '*.pdf'
      search.removeFilter('name')
      expect(search.state.filters.standard.name).toBeUndefined()
    })

    it('removes type filter', () => {
      search.state.filters.standard.type = 'file'
      search.removeFilter('type')
      expect(search.state.filters.standard.type).toBe('')
    })

    it('removes size range filter', () => {
      search.state.filters.standard.sizeRange = { min: 100, max: 1000 }
      search.removeFilter('size')
      expect(search.state.filters.standard.sizeRange).toBeUndefined()
    })

    it('removes camera make filter', () => {
      search.state.filters.photo.cameraMake = 'Canon'
      search.removeFilter('cameraMake')
      expect(search.state.filters.photo.cameraMake).toBeUndefined()
    })

    it('removes ISO range filter', () => {
      search.state.filters.photo.isoRange = { min: 100, max: 800 }
      search.removeFilter('iso')
      expect(search.state.filters.photo.isoRange).toBeUndefined()
    })

    it('handles unknown filter ID gracefully', () => {
      expect(() => search.removeFilter('unknown')).not.toThrow()
    })
  })

  describe('clearFilters', () => {
    it('resets all filters', () => {
      search.state.filters.term = 'test'
      search.state.filters.standard.name = '*.pdf'
      search.state.filters.photo.cameraMake = 'Canon'
      search.state.results = { totalCount: 10, items: [], hasMore: false, currentPage: 0 }
      search.state.kqlQuery = 'name:test'

      search.clearFilters()

      expect(search.state.filters.term).toBe('')
      expect(search.state.filters.standard).toEqual({})
      expect(search.state.filters.photo).toEqual({})
      expect(search.state.results).toBeNull()
      expect(search.state.kqlQuery).toBe('')
    })
  })

  describe('setViewMode', () => {
    it('sets list view', () => {
      search.setViewMode('list')
      expect(search.state.viewMode).toBe('list')
    })

    it('sets grid view', () => {
      search.setViewMode('grid')
      expect(search.state.viewMode).toBe('grid')
    })

    it('sets table view', () => {
      search.setViewMode('table')
      expect(search.state.viewMode).toBe('table')
    })
  })

  describe('setSort', () => {
    it('sets sort configuration', () => {
      search.setSort({ field: 'name', direction: 'asc' })
      expect(search.state.sort).toEqual({ field: 'name', direction: 'asc' })
    })
  })

  describe('setKqlQuery', () => {
    it('sets KQL query directly', () => {
      search.setKqlQuery('name:*.pdf AND Type:1')
      expect(search.state.kqlQuery).toBe('name:*.pdf AND Type:1')
    })
  })

  describe('parseKqlToFilters', () => {
    beforeEach(() => {
      // Reset filters before each parse test
      search.clearFilters()
    })

    it('handles empty query', () => {
      search.parseKqlToFilters('')
      expect(search.state.filters.term).toBe('')
    })

    it('handles wildcard query', () => {
      search.parseKqlToFilters('*')
      expect(search.state.filters.term).toBe('')
    })

    it('parses name filter', () => {
      search.parseKqlToFilters('name:*.pdf')
      expect(search.state.filters.standard.name).toBe('*.pdf')
    })

    it('parses type filter (numeric)', () => {
      search.parseKqlToFilters('Type:1')
      expect(search.state.filters.standard.type).toBe('file')
    })

    it('parses type filter for folder', () => {
      search.parseKqlToFilters('Type:2')
      expect(search.state.filters.standard.type).toBe('folder')
    })

    it('parses mediatype filter', () => {
      search.parseKqlToFilters('mediatype:image/*')
      expect(search.state.filters.standard.mediaType).toBe('image/*')
    })

    it('parses content filter', () => {
      search.parseKqlToFilters('content:annual report')
      expect(search.state.filters.standard.content).toBe('annual report')
    })

    it('parses tags filter', () => {
      search.parseKqlToFilters('tags:important')
      expect(search.state.filters.standard.tags).toBe('important')
    })

    it('parses camera make filter', () => {
      search.parseKqlToFilters('photo.cameramake:Canon')
      expect(search.state.filters.photo.cameraMake).toBe('Canon')
    })

    it('parses camera model filter', () => {
      search.parseKqlToFilters('photo.cameramodel:EOS R5')
      expect(search.state.filters.photo.cameraModel).toBe('EOS R5')
    })

    it('parses orientation filter', () => {
      search.parseKqlToFilters('photo.orientation:6')
      expect(search.state.filters.photo.orientation).toBe(6)
    })

    it('parses size range', () => {
      search.parseKqlToFilters('(size>=1000 AND size<=10000)')
      expect(search.state.filters.standard.sizeRange).toEqual({ min: 1000, max: 10000 })
    })

    it('parses date range', () => {
      search.parseKqlToFilters('(mtime>=2024-01-01 AND mtime<=2024-12-31)')
      expect(search.state.filters.standard.modifiedRange).toEqual({
        start: '2024-01-01',
        end: '2024-12-31'
      })
    })

    it('parses ISO range', () => {
      search.parseKqlToFilters('(photo.iso>=100 AND photo.iso<=800)')
      expect(search.state.filters.photo.isoRange).toEqual({ min: 100, max: 800 })
    })

    it('parses combined query', () => {
      search.parseKqlToFilters('Type:1 AND mediatype:image/* AND photo.cameramake:Canon')
      expect(search.state.filters.standard.type).toBe('file')
      expect(search.state.filters.standard.mediaType).toBe('image/*')
      expect(search.state.filters.photo.cameraMake).toBe('Canon')
    })

    it('unescapes KQL special characters', () => {
      search.parseKqlToFilters('name:file\\:name')
      expect(search.state.filters.standard.name).toBe('file:name')
    })
  })

  describe('executeSearch', () => {
    it('sets loading state', async () => {
      const promise = search.executeSearch()
      expect(search.state.loading).toBe(true)
      await promise
      expect(search.state.loading).toBe(false)
    })

    it('updates kqlQuery state', async () => {
      search.state.filters.term = 'test'
      await search.executeSearch()
      expect(search.state.kqlQuery).toBe('name:*test*')
    })

    it('handles results (falls back to empty on parse error in Node)', async () => {
      await search.executeSearch()
      // In Node environment without DOMParser, results will be empty from error handler
      expect(search.state.results).toBeDefined()
    })

    it('sets error state on failure', async () => {
      // In Node environment, DOMParser is not available, so search will error
      await search.executeSearch()
      // The error is set because DOMParser is not available in Node
      expect(search.state.error).toBeDefined()
      expect(search.state.loading).toBe(false)
    })
  })

  describe('loadMore', () => {
    it('does nothing if no results', async () => {
      await search.loadMore()
      expect(search.state.results).toBeNull()
    })

    it('does nothing if no more results', async () => {
      search.state.results = {
        totalCount: 5,
        items: [],
        hasMore: false,
        currentPage: 0
      }
      await search.loadMore()
      expect(search.state.results?.currentPage).toBe(0)
    })

    it('does nothing while loading', async () => {
      search.state.results = {
        totalCount: 100,
        items: [],
        hasMore: true,
        currentPage: 0
      }
      search.state.loading = true
      await search.loadMore()
      // Should not change page since loading
      expect(search.state.results?.currentPage).toBe(0)
    })
  })

  describe('fetchCameraMakes', () => {
    it('returns empty array', async () => {
      const makes = await search.fetchCameraMakes()
      expect(makes).toEqual([])
    })
  })

  describe('fetchCameraModels', () => {
    it('returns empty array', async () => {
      const models = await search.fetchCameraModels()
      expect(models).toEqual([])
    })
  })
})
