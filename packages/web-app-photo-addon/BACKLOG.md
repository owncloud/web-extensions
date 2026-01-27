# oCIS Photo Add-on - Backlog

**Last Updated:** January 18, 2026

---

## Priority Legend
- 🔴 High - Core functionality or UX issues
- 🟡 Medium - Nice to have improvements
- 🟢 Low - Future considerations

---

## 🚨 Critical Bugs

### 🟡 BUG: Intermittent First Load Failure
- [ ] **First load sometimes fails with "Failed to search photos" error**
- Second load/refresh works fine
- Suspected race condition or initialization timing issue
- May be related to oCIS service startup, authentication, or space discovery
- **Repro:** Hard refresh the page, sometimes first load fails
- **Workaround:** Refresh the page again

### 🔴 BUG: HEIC Images Not Supported (Backend)
- [ ] **Add HEIC/HEIF image format support to oCIS**
- HEIC files (Apple's default photo format since iOS 11) do not display in oCIS
- Neither thumbnails nor full images load - broken in both photo-addon AND core oCIS file browser
- **Example file:** `IMG_20251013_174320.heic`
- **Impact:** iPhone photos saved in HEIC format are completely unusable
- **Requires:** Backend changes - likely needs HEIC codec/decoder in thumbnail service
- **Possible solutions:**
  - Add libheif support to oCIS thumbnail generation
  - Server-side conversion to JPEG on upload
  - Browser-side HEIC decoding (heic2any.js) as fallback

---

## Upstream Contribution Status

### 🔴 Backend PR #11912 - Photo EXIF Metadata Search
- [x] PR submitted: https://github.com/owncloud/ocis/pull/11912
- [x] Initial review received from @kobergj (Jan 16, 2026)
- [x] Linter fix applied (commit 7500db70)
- [x] Replied to maintainer's question about map lookup logic
- [x] SonarCloud cognitive complexity fix (commit 9404bb14)
- [ ] **PENDING:** Await final approval and merge
- **Branch:** `feature/photo-metadata-search`
- **Changes:** Bleve index photo fields, KQL query support, WebDAV properties

### 🟡 Web Extensions Contribution
- [x] Draft proposal created for `owncloud/web-extensions` repo
- [x] Submitted issue to web-extensions repo proposing photo-addon and advanced-search
- [x] Received positive response from maintainer - "this is awesome, please go ahead!"
- [ ] Wait for maintainer feedback on clarifying questions
- [ ] Fork and restructure to `web-app-photos` and `web-app-advanced-search`
- [ ] Update license from Apache-2.0 to AGPL-3.0
- [ ] Submit PRs after backend PR merges

### 🔴 Deployment Example Updates (Requested by Maintainer)
- [ ] **Update `ocis_full` deployment example** after web-extensions PR accepted
- [ ] Add `.env` entry: `#PHOTOADDON=:web_extensions/photoaddon.yml`
- [ ] Create `web_extensions/photoaddon.yml` with init container config
- [ ] Add CSP configuration for Leaflet.js CDN and OpenStreetMap tiles
- [ ] Test deployment with Docker Compose
- **Reference:** https://github.com/owncloud/ocis/blob/master/deployments/examples/ocis_full/

---

## Phase 2: UI/UX Improvements

### ✅ Lightbox Date Display Cleanup (Complete)
- [x] Replace "Date Source: photo.takenDateTime" with simpler "Date Taken" label
- [x] Add small indicator badge beside date: "(EXIF)" (green) or "(Mod time)" (gray)
- [x] Cleaner, less technical presentation for end users

---

## Phase 2: Stack & Grouping Logic

### 🟡 Stack Cover Selection
- [ ] Integrate with PhotoPrism image quality scoring
- [ ] Use highest quality image as stack "face"
- [ ] Fallback to most recent if no quality data

---

## Phase 3: Photo Actions & Context Menu

### 🟡 Share Button
- [ ] Quick share button in lightbox view
- [ ] Copy link to clipboard
- [ ] Share via oCIS sharing dialog

### 🟡 Tagging in Lightbox
- [ ] View existing tags in popup
- [ ] Add new tags directly
- [ ] Remove tags
- [ ] Tag autocomplete from existing tags

---

## Phase 4: Map View

### ✅ Map Integration (Complete)
- [x] Map view UI with Leaflet.js + OpenStreetMap
- [x] Cluster markers for nearby photos
- [x] Click marker to open photo in lightbox
- [x] Click cluster to zoom in
- [x] GPS coordinates returned by backend
- [x] Map tile gap CSS fix
- [x] "View on Map" from individual photo
- [ ] Search for all files within visible map bounds (future enhancement)

---

## Phase 5: PhotoPrism Integration

### 🟢 Face Recognition
- [ ] Connect to PhotoPrism API for face detection
- [ ] Inject person tags into oCIS metadata
- [ ] Face-based photo grouping/filtering
- [ ] "People" view showing faces with photo counts

### 🟢 AI Quality Scoring
- [ ] Retrieve image quality scores from PhotoPrism
- [ ] Use for stack cover selection
- [ ] Filter/sort by quality

### Implementation Notes
- Requires PhotoPrism instance running alongside oCIS
- Need to map PhotoPrism library to oCIS file paths
- Consider webhook for automatic processing of new uploads

---

## Phase 6: Additional Features

### 🟢 Albums & Collections
- [ ] Create named albums
- [ ] Add photos to albums (without moving files)
- [ ] Album sharing
- [ ] Smart albums (auto-populated by criteria)

### 🟢 Slideshow Mode
- [ ] Full-screen slideshow
- [ ] Configurable timing
- [ ] Transition effects
- [ ] Background music support (?)

---

## Phase 7: Mobile Development

### 🟢 Mobile App Investigation
- [ ] Research Flutter vs React Native vs PWA
- [ ] Evaluate oCIS mobile SDK availability
- [ ] Consider PWA approach first (lower effort)
- [ ] Native app for iOS/Android if PWA insufficient

### Mobile-Specific Features
- [ ] Offline photo viewing (cached)
- [ ] Auto-upload from camera roll
- [ ] Background sync

---

## Technical Debt

- [x] Add unit tests for new components (48 tests in usePhotos.spec.ts)
- [x] Add E2E tests framework (Playwright) with tests for gallery, lightbox, map view
- [ ] Performance optimization for large libraries (10k+ photos)
- [ ] Accessibility audit (keyboard navigation, screen readers)
- [x] i18n/localization support (useI18n composable with EN, DE, FR translations)
- [x] **Code complexity audit** - Refactored and simplified code
  - Consolidated types into `types/index.ts`
  - Cleaned up `usePhotos.ts` - removed debug logging, extracted utility functions
  - Updated components to use centralized i18n

---

## Completed ✅

### Backend (oCIS Fork)
- [x] Photo metadata in Bleve search index with `Store=true`
- [x] KQL photo field queries (cameraMake, cameraModel, takenDateTime, etc.)
- [x] WebDAV `oc:photo-*` properties in search results
- [x] GPS coordinates exposed in WebDAV search results
- [x] PR #11912 submitted to upstream
- [x] Linter fix (commit 7500db70) - moved comment for formatting
- [x] Cognitive complexity refactor (commit 9404bb14) - extracted appendPhotoProps/appendLocationProps
- [x] Thumbnail cropping fix (aspect ratio preserved)

### Frontend (Photo-Addon)
- [x] Basic photo grid view
- [x] Date grouping by EXIF capture date
- [x] Infinite scroll (backwards in time)
- [x] Lightbox viewer with EXIF panel
- [x] Camera info display (make, model, aperture, ISO, etc.)
- [x] GPS coordinates with "View on Map" link
- [x] WebDAV Search API integration (replaced folder traversal)
- [x] Date-filtered search queries (3-month initial load)
- [x] EXIF toggle respects search query mode
- [x] Stack view: Arrow positioning fixed
- [x] Stack view: Swipe gesture navigation
- [x] Stack view: Touch responsiveness improvements
- [x] UI cleanup: Removed EXIF indicator icon
- [x] UI cleanup: Removed MDATE indicator icon
- [x] Lightbox: Display photo folder path
- [x] Context menu: Download, Open in Files, Copy Link, Delete
- [x] Map view: Full implementation with Leaflet.js
- [x] Map view: Tile gap CSS fix
- [x] Header bar z-index fix
- [x] "Open in Files" link in lightbox
- [x] Pinch-to-zoom calendar groupings (Day/Week/Month/Year views)
- [x] GPS-based stack merging (location + time grouping)
- [x] Lightbox: Simplified date display with EXIF/Upload source badge

### Performance Optimizations (Jan 2026)
- [x] Reduced thumbnail data transfer by 95% (25.8MB → 1.4MB)
- [x] Improved search response time by 83% (4s → 126ms)
- [x] Decreased total XHR data by 93%
- [x] Initial load now fetches 3 months instead of all 5,000+ photos

### Community
- [x] Web-extensions proposal submitted to owncloud/web-extensions
