# oCIS Advanced Search - Backlog

**Last Updated:** January 18, 2026

---

## Priority Legend
- 🔴 High - Core functionality or UX issues
- 🟡 Medium - Nice to have improvements
- 🟢 Low - Future considerations

---

## 🚨 Critical Bugs

### 🔴 BUG: "Open in Files" Fails for Non-Previewable Files
- [ ] **Fix context menu "Open" action for non-image files**
- Clicking "Open" on files without preview handler (e.g., .xlsx, .docx) shows spinning page
- Preview URL only works for images/PDFs
- **Fix:** Detect file type and use appropriate URL:
  - Preview for images/PDFs
  - Navigate to folder location for other files
- **Impact:** Users can't navigate to office documents from search results

---

## Upstream Contribution Status

### 🟡 Web Extensions Contribution
- [x] Included in proposal to `owncloud/web-extensions` repo
- [x] Received positive response from maintainer - "this is awesome, please go ahead!"
- [ ] Wait for maintainer feedback on clarifying questions
- [ ] Restructure to `web-app-advanced-search`
- [ ] Update license from Apache-2.0 to AGPL-3.0
- [ ] Submit PR after photo-addon PR and backend PR merge

### 🟡 Deployment Example Updates
- [ ] **Update `ocis_full` deployment example** after web-extensions PR accepted
- [ ] Add `.env` entry: `#ADVANCEDSEARCH=:web_extensions/advancedsearch.yml`
- [ ] Create `web_extensions/advancedsearch.yml` with init container config
- [ ] Test deployment with Docker Compose
- **Reference:** https://github.com/owncloud/ocis/blob/master/deployments/examples/ocis_full/

---

## Phase 2: UI/UX Improvements

### 🟡 Results View Options
- [ ] Grid view for image results (thumbnails)
- [ ] Table view with sortable columns
- [ ] Toggle between view modes

### 🟡 Filter Enhancements
- [ ] Camera Make/Model autocomplete from known values
- [ ] Smart defaults / presets

### 🟡 Search Refinement
- [ ] Search within results (refine)
- [ ] Faceted navigation (auto-suggest filters based on results)

---

## Phase 3: Saved Searches & History

### 🟡 Search History
- [x] Basic search history tracking (useSearchHistory.ts exists)
- [ ] Search history dropdown with autocomplete
- [ ] Clear history option

### 🟡 Saved Search Sharing
- [ ] Share saved searches via URL
- [ ] Import shared search from URL

---

## Phase 4: Advanced Features

### 🟢 Export & Bulk Actions
- [ ] Export results to CSV
- [ ] Bulk download selected files
- [ ] Bulk tag selected files
- [ ] Bulk move/copy selected files

### 🟢 Integration with Photo-Addon
- [ ] "Open in Photos" action for image results
- [ ] View search results in PhotoView gallery
- [ ] Map view for geotagged results

### 🟢 Dynamic Filter Population
- [ ] Populate Camera Make/Model dropdowns from indexed values
- [ ] Would need faceted search API or probing approach
- [ ] WebDAV doesn't return photo-camera-make in property responses

---

## Technical Debt

- [x] Add unit tests for useAdvancedSearch composable (64 tests in `src/composables/useAdvancedSearch.test.ts`)
- [x] Add unit tests for KQL query builder (51 tests in `src/utils/kql.test.ts`)
- [ ] Add e2e tests for search flows
- [ ] Accessibility audit (keyboard navigation, screen readers)
- [x] i18n/localization support (vue3-gettext integration, all UI strings wrapped with `$gettext`)
- [ ] Mobile responsiveness improvements
- [x] **Code complexity audit** - Review functions for cognitive complexity (target: <15 per function)
  - Extracted `buildStandardKQL()` and `buildPhotoKQL()` helpers
  - Replaced `removeFilter` switch with registry-based lookup
  - Created generic `updateRange()` helper in SearchFilters.vue
  - Extracted URL helpers (`getServerUrl`, `encodePath`, `buildDavUrl`) in AdvancedSearchView.vue

---

## Completed ✅

### Core Functionality
- [x] Extension scaffolding with Vue 3 + TypeScript
- [x] AMD module build configuration
- [x] oCIS app manifest
- [x] Deployment to core-faure.ca

### Components Built
- [x] AdvancedSearchView.vue - Main search interface
- [x] SearchFilters.vue - Comprehensive filter panel
- [x] FilterChip.vue - Active filter display
- [x] FilterControl.vue - Individual filter input
- [x] SearchResults.vue - Results list display
- [x] SearchResultItem.vue - Individual result row
- [x] SearchStats.vue - Search statistics panel

### Composables
- [x] useAdvancedSearch.ts - Search logic & KQL building
- [x] useSearchHistory.ts - Search history tracking

### Search Fields Supported
- [x] Standard: name, type, size, mtime, mediatype, tags, content, hidden
- [x] Photo/EXIF: cameraMake, cameraModel, takenDateTime, fNumber, focalLength, iso, orientation, exposure

### UI/UX
- [x] Collapsible filter sections (progressive disclosure)
- [x] Save searches with name
- [x] Load saved searches
- [x] Delete saved searches
