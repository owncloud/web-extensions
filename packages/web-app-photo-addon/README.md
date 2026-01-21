# Photo Addon

A photo gallery extension for ownCloud Infinite Scale with timeline view, EXIF metadata display, and interactive map.

## Features

- **Timeline View**: Browse photos chronologically with infinite scroll
- **Date Grouping**: Group photos by day, week, month, or year with pinch-to-zoom
- **EXIF Metadata**: Display camera info, aperture, ISO, exposure, and location
- **Map View**: Interactive map showing photos with GPS coordinates using Leaflet
- **Photo Stacking**: Automatically group burst photos taken within seconds
- **Lightbox**: Full-size image viewer with swipe navigation and keyboard controls

## Requirements

- oCIS 7.0 or later
- Tika extractor enabled for EXIF metadata extraction
- Search service running for photo indexing

## Installation

### Using ocis_full Deployment Example

This extension is included in the oCIS `ocis_full` deployment example. To enable it:

1. Edit `.env` and uncomment:
   ```bash
   EXTENSIONS=:web_extensions/extensions.yml
   PHOTOADDON=:web_extensions/photo-addon.yml
   ```

2. Rebuild: `docker compose up -d`

The CSP configuration for OpenStreetMap tiles is automatically included. See the [oCIS deployment documentation](https://github.com/owncloud/ocis/tree/master/deployments/examples/ocis_full) for full details.

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/owncloud/web-extensions/releases)
2. Extract to your oCIS web assets directory:
   ```bash
   unzip photo-addon-*.zip -d /path/to/ocis/web/assets/apps/
   ```
3. Restart oCIS or wait for the web service to detect the new extension

## Configuration

### Content Security Policy (CSP)

The Photo Addon uses [Leaflet](https://leafletjs.com/) for the map view, which loads map tiles from OpenStreetMap. To enable the map feature, you must configure the Content Security Policy in your oCIS deployment.

Add the following CSP directives to your oCIS configuration:

```yaml
# In your ocis.yaml or environment variables
web:
  config:
    security:
      csp:
        img-src:
          - "'self'"
          - "data:"
          - "blob:"
          - "https://*.tile.openstreetmap.org"  # Map tiles
        connect-src:
          - "'self'"
          - "https://*.tile.openstreetmap.org"  # Map tile requests
```

Or via environment variables:

```bash
# Add OpenStreetMap tile server to allowed image sources
OCIS_WEB_CONFIG_SECURITY_CSP_IMG_SRC="'self' data: blob: https://*.tile.openstreetmap.org"
OCIS_WEB_CONFIG_SECURITY_CSP_CONNECT_SRC="'self' https://*.tile.openstreetmap.org"
```

**Note**: Without proper CSP configuration, the map view will display but map tiles will fail to load (you'll see a grey background with markers but no map imagery).

### Alternative: Disable Map View

If you cannot modify CSP settings, the calendar/timeline view will still work normally. Only the map view requires external tile loading.

## Usage

1. Navigate to any folder containing images in oCIS
2. Click the view switcher icon (top-right of file list)
3. Select "Photo View" to activate the photo gallery

### Controls

- **Pinch/Ctrl+Scroll**: Zoom in/out to change date grouping (day/week/month/year)
- **Arrow Keys**: Navigate between photos in lightbox
- **Swipe**: Navigate photos on touch devices
- **Escape**: Close lightbox

## Development

```bash
# Install dependencies
pnpm install

# Development build with watch
pnpm build:w

# Production build
pnpm build

# Type checking
pnpm check:types

# Run tests
pnpm test:unit
```

## License

AGPL-3.0 - see [LICENSE](../../LICENSE) for details.
