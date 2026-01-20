/**
 * Simple i18n composable for the photo addon
 *
 * Provides a translation function that returns localized strings.
 * Currently supports English only, but designed for easy expansion.
 */

import { ref, computed } from 'vue'

// Supported locales
export type Locale = 'en' | 'de' | 'fr' | 'es'

// Translation keys type for type safety
export interface TranslationKeys {
  // App header
  'app.title': string
  'app.photosInView': string
  'app.photoCount': string
  'app.allPhotosLoaded': string

  // View selector
  'view.calendar': string
  'view.map': string

  // Date filter
  'filter.jumpTo': string
  'filter.today': string
  'filter.exifOnly': string
  'filter.year': string
  'filter.month': string
  'view.selector': string

  // Loading states
  'loading.status': string
  'loading.more': string
  'loading.recentPhotos': string
  'loading.searchingAll': string

  // Empty states
  'empty.noPhotos': string
  'empty.hint': string
  'empty.noGpsPhotos': string

  // Lightbox
  'lightbox.close': string
  'lightbox.previous': string
  'lightbox.next': string
  'lightbox.photoOptions': string
  'lightbox.photoCounter': string

  // Metadata labels
  'metadata.dateTaken': string
  'metadata.camera': string
  'metadata.aperture': string
  'metadata.focalLength': string
  'metadata.iso': string
  'metadata.exposure': string
  'metadata.orientation': string
  'metadata.location': string
  'metadata.altitude': string
  'metadata.fileSize': string
  'metadata.type': string

  // Orientation labels
  'orientation.normal': string
  'orientation.flippedH': string
  'orientation.rotated180': string
  'orientation.flippedV': string
  'orientation.rotated90cwFlipped': string
  'orientation.rotated90cw': string
  'orientation.rotated90ccwFlipped': string
  'orientation.rotated90ccw': string

  // Context menu
  'menu.download': string
  'menu.openInFiles': string
  'menu.copyLink': string
  'menu.delete': string
  'menu.viewOnMap': string

  // Confirmations and alerts
  'confirm.delete': string
  'alert.linkCopied': string
  'alert.linkCopyFailed': string
  'alert.downloadFailed': string
  'alert.deleteFailed': string

  // Date formatting
  'date.today': string
  'date.yesterday': string

  // Stack
  'stack.morePhotos': string
  'stack.ariaLabel': string

  // Map
  'map.photosInView': string
  'map.photos': string

  // Months (for dropdowns)
  'month.january': string
  'month.february': string
  'month.march': string
  'month.april': string
  'month.may': string
  'month.june': string
  'month.july': string
  'month.august': string
  'month.september': string
  'month.october': string
  'month.november': string
  'month.december': string

  // Group modes
  'groupMode.day': string
  'groupMode.week': string
  'groupMode.month': string
  'groupMode.year': string

  // Error titles
  'error.searchUnavailable': string
  'error.connection': string
  'error.storageNotFound': string
  'error.authentication': string
  'error.unableToLoad': string

  // Error suggestions
  'error.thingsToTry': string
  'error.tryAgain': string
  'error.searchRestarting': string
  'error.waitAndRetry': string
  'error.contactAdmin': string
  'error.checkConnection': string
  'error.serverUnavailable': string
  'error.refreshPage': string
  'error.storageNotFoundHint': string
  'error.logOutAndIn': string
  'error.sessionExpired': string

  // Date source badges
  'date.exifBadge': string
  'date.modTimeBadge': string

  // Fallbacks
  'fallback.untitled': string
  'fallback.noPreview': string
}

// English translations (default)
const en: TranslationKeys = {
  // App header
  'app.title': 'Photos',
  'app.photosInView': '{visible} of {total} in view',
  'app.photoCount': '{count}',
  'app.allPhotosLoaded': 'All photos loaded',

  // View selector
  'view.calendar': 'Calendar',
  'view.map': 'Map',

  // Date filter
  'filter.jumpTo': 'Jump to:',
  'filter.today': 'Today',
  'filter.exifOnly': 'EXIF only',
  'filter.year': 'Select year',
  'filter.month': 'Select month',
  'view.selector': 'View mode',

  // Loading states
  'loading.status': 'Loading {range}... {count} photos',
  'loading.more': 'Loading more photos...',
  'loading.recentPhotos': 'Loading recent photos...',
  'loading.searchingAll': 'Searching all photos...',

  // Empty states
  'empty.noPhotos': 'No photos found',
  'empty.hint': 'Photos will appear here after EXIF tags are synced',
  'empty.noGpsPhotos': 'No photos with GPS data found',

  // Lightbox
  'lightbox.close': 'Close',
  'lightbox.previous': 'Previous photo',
  'lightbox.next': 'Next photo',
  'lightbox.photoOptions': 'Photo options',
  'lightbox.photoCounter': 'Photo {current} of {total}',

  // Metadata labels
  'metadata.dateTaken': 'Date Taken',
  'metadata.camera': 'Camera',
  'metadata.aperture': 'Aperture',
  'metadata.focalLength': 'Focal Length',
  'metadata.iso': 'ISO',
  'metadata.exposure': 'Exposure',
  'metadata.orientation': 'Orientation',
  'metadata.location': 'Location',
  'metadata.altitude': 'Altitude',
  'metadata.fileSize': 'File Size',
  'metadata.type': 'Type',

  // Orientation labels
  'orientation.normal': 'Normal',
  'orientation.flippedH': 'Flipped horizontally',
  'orientation.rotated180': 'Rotated 180°',
  'orientation.flippedV': 'Flipped vertically',
  'orientation.rotated90cwFlipped': 'Rotated 90° CW + flipped',
  'orientation.rotated90cw': 'Rotated 90° CW',
  'orientation.rotated90ccwFlipped': 'Rotated 90° CCW + flipped',
  'orientation.rotated90ccw': 'Rotated 90° CCW',

  // Context menu
  'menu.download': 'Download',
  'menu.openInFiles': 'Open in Files',
  'menu.copyLink': 'Copy Link',
  'menu.delete': 'Delete',
  'menu.viewOnMap': 'View on Map',

  // Confirmations and alerts
  'confirm.delete': 'Are you sure you want to delete "{name}"?\n\nThe file will be moved to the recycle bin.',
  'alert.linkCopied': 'Link copied to clipboard!',
  'alert.linkCopyFailed': 'Failed to copy link. Please try again.',
  'alert.downloadFailed': 'Failed to download photo. Please try again.',
  'alert.deleteFailed': 'Failed to delete photo. Please try again.',

  // Date formatting
  'date.today': 'Today',
  'date.yesterday': 'Yesterday',

  // Stack
  'stack.morePhotos': '+{count} more',
  'stack.ariaLabel': '{name}, stack of {count} photos',

  // Map
  'map.photosInView': '{visible} of {total} photos in view',
  'map.photos': '{count} photos',

  // Months
  'month.january': 'January',
  'month.february': 'February',
  'month.march': 'March',
  'month.april': 'April',
  'month.may': 'May',
  'month.june': 'June',
  'month.july': 'July',
  'month.august': 'August',
  'month.september': 'September',
  'month.october': 'October',
  'month.november': 'November',
  'month.december': 'December',

  // Group modes
  'groupMode.day': 'Day',
  'groupMode.week': 'Week',
  'groupMode.month': 'Month',
  'groupMode.year': 'Year',

  // Error titles
  'error.searchUnavailable': 'Search Service Unavailable',
  'error.connection': 'Connection Error',
  'error.storageNotFound': 'Storage Not Found',
  'error.authentication': 'Authentication Error',
  'error.unableToLoad': 'Unable to Load Photos',

  // Error suggestions
  'error.thingsToTry': 'Things to try:',
  'error.tryAgain': 'Try Again',
  'error.searchRestarting': 'The search service may be restarting or under maintenance',
  'error.waitAndRetry': 'Wait a moment and try again',
  'error.contactAdmin': 'Contact your administrator if this persists',
  'error.checkConnection': 'Check your internet connection',
  'error.serverUnavailable': 'The server may be temporarily unavailable',
  'error.refreshPage': 'Try refreshing the page',
  'error.storageNotFoundHint': 'Your personal storage space could not be found',
  'error.logOutAndIn': 'Try logging out and back in',
  'error.sessionExpired': 'Your session may have expired',

  // Date source badges
  'date.exifBadge': '(EXIF)',
  'date.modTimeBadge': '(Mod time)',

  // Fallbacks
  'fallback.untitled': 'Untitled',
  'fallback.noPreview': 'No preview',
}

// German translations
const de: Partial<TranslationKeys> = {
  'app.title': 'Fotos',
  'app.allPhotosLoaded': 'Alle Fotos geladen',
  'view.calendar': 'Kalender',
  'view.map': 'Karte',
  'filter.jumpTo': 'Gehe zu:',
  'filter.today': 'Heute',
  'filter.exifOnly': 'Nur EXIF',
  'loading.more': 'Lade mehr Fotos...',
  'empty.noPhotos': 'Keine Fotos gefunden',
  'empty.noGpsPhotos': 'Keine Fotos mit GPS-Daten gefunden',
  'lightbox.close': 'Schließen',
  'metadata.dateTaken': 'Aufnahmedatum',
  'metadata.camera': 'Kamera',
  'metadata.aperture': 'Blende',
  'metadata.focalLength': 'Brennweite',
  'metadata.exposure': 'Belichtung',
  'metadata.location': 'Standort',
  'metadata.altitude': 'Höhe',
  'metadata.fileSize': 'Dateigröße',
  'menu.download': 'Herunterladen',
  'menu.openInFiles': 'In Dateien öffnen',
  'menu.copyLink': 'Link kopieren',
  'menu.delete': 'Löschen',
  'menu.viewOnMap': 'Auf Karte zeigen',
  'alert.linkCopied': 'Link in Zwischenablage kopiert!',
  'date.today': 'Heute',
  'date.yesterday': 'Gestern',
  'month.january': 'Januar',
  'month.february': 'Februar',
  'month.march': 'März',
  'month.april': 'April',
  'month.may': 'Mai',
  'month.june': 'Juni',
  'month.july': 'Juli',
  'month.august': 'August',
  'month.september': 'September',
  'month.october': 'Oktober',
  'month.november': 'November',
  'month.december': 'Dezember',
  'groupMode.day': 'Tag',
  'groupMode.week': 'Woche',
  'groupMode.month': 'Monat',
  'groupMode.year': 'Jahr',

  // Error titles
  'error.searchUnavailable': 'Suchdienst nicht verfügbar',
  'error.connection': 'Verbindungsfehler',
  'error.storageNotFound': 'Speicher nicht gefunden',
  'error.authentication': 'Authentifizierungsfehler',
  'error.unableToLoad': 'Fotos konnten nicht geladen werden',

  // Error suggestions
  'error.thingsToTry': 'Versuchen Sie Folgendes:',
  'error.tryAgain': 'Erneut versuchen',
  'error.searchRestarting': 'Der Suchdienst wird möglicherweise neu gestartet',
  'error.waitAndRetry': 'Warten Sie einen Moment und versuchen Sie es erneut',
  'error.contactAdmin': 'Kontaktieren Sie Ihren Administrator, wenn das Problem weiterhin besteht',
  'error.checkConnection': 'Überprüfen Sie Ihre Internetverbindung',
  'error.serverUnavailable': 'Der Server ist möglicherweise vorübergehend nicht verfügbar',
  'error.refreshPage': 'Versuchen Sie, die Seite zu aktualisieren',
  'error.storageNotFoundHint': 'Ihr persönlicher Speicherplatz konnte nicht gefunden werden',
  'error.logOutAndIn': 'Versuchen Sie, sich ab- und wieder anzumelden',
  'error.sessionExpired': 'Ihre Sitzung ist möglicherweise abgelaufen',

  // Date source badges
  'date.exifBadge': '(EXIF)',
  'date.modTimeBadge': '(Änderungszeit)',

  // Fallbacks
  'fallback.untitled': 'Unbenannt',
  'fallback.noPreview': 'Keine Vorschau',
}

// French translations
const fr: Partial<TranslationKeys> = {
  'app.title': 'Photos',
  'app.allPhotosLoaded': 'Toutes les photos chargées',
  'view.calendar': 'Calendrier',
  'view.map': 'Carte',
  'filter.jumpTo': 'Aller à:',
  'filter.today': "Aujourd'hui",
  'filter.exifOnly': 'EXIF seulement',
  'loading.more': 'Chargement de plus de photos...',
  'empty.noPhotos': 'Aucune photo trouvée',
  'empty.noGpsPhotos': 'Aucune photo avec données GPS trouvée',
  'lightbox.close': 'Fermer',
  'metadata.dateTaken': 'Date de prise',
  'metadata.camera': 'Appareil photo',
  'metadata.aperture': 'Ouverture',
  'metadata.focalLength': 'Focale',
  'metadata.exposure': 'Exposition',
  'metadata.location': 'Lieu',
  'metadata.altitude': 'Altitude',
  'metadata.fileSize': 'Taille du fichier',
  'menu.download': 'Télécharger',
  'menu.openInFiles': 'Ouvrir dans Fichiers',
  'menu.copyLink': 'Copier le lien',
  'menu.delete': 'Supprimer',
  'menu.viewOnMap': 'Voir sur la carte',
  'alert.linkCopied': 'Lien copié !',
  'date.today': "Aujourd'hui",
  'date.yesterday': 'Hier',
  'month.january': 'Janvier',
  'month.february': 'Février',
  'month.march': 'Mars',
  'month.april': 'Avril',
  'month.may': 'Mai',
  'month.june': 'Juin',
  'month.july': 'Juillet',
  'month.august': 'Août',
  'month.september': 'Septembre',
  'month.october': 'Octobre',
  'month.november': 'Novembre',
  'month.december': 'Décembre',
  'groupMode.day': 'Jour',
  'groupMode.week': 'Semaine',
  'groupMode.month': 'Mois',
  'groupMode.year': 'Année',

  // Error titles
  'error.searchUnavailable': 'Service de recherche indisponible',
  'error.connection': 'Erreur de connexion',
  'error.storageNotFound': 'Stockage introuvable',
  'error.authentication': "Erreur d'authentification",
  'error.unableToLoad': 'Impossible de charger les photos',

  // Error suggestions
  'error.thingsToTry': 'Essayez ceci:',
  'error.tryAgain': 'Réessayer',
  'error.searchRestarting': 'Le service de recherche est peut-être en cours de redémarrage',
  'error.waitAndRetry': 'Attendez un moment et réessayez',
  'error.contactAdmin': 'Contactez votre administrateur si le problème persiste',
  'error.checkConnection': 'Vérifiez votre connexion Internet',
  'error.serverUnavailable': 'Le serveur est peut-être temporairement indisponible',
  'error.refreshPage': 'Essayez de rafraîchir la page',
  'error.storageNotFoundHint': 'Votre espace de stockage personnel est introuvable',
  'error.logOutAndIn': 'Essayez de vous déconnecter et de vous reconnecter',
  'error.sessionExpired': 'Votre session a peut-être expiré',

  // Date source badges
  'date.exifBadge': '(EXIF)',
  'date.modTimeBadge': '(Date modif.)',

  // Fallbacks
  'fallback.untitled': 'Sans titre',
  'fallback.noPreview': 'Pas d\'aperçu',
}

// All translations
const translations: Record<Locale, TranslationKeys | Partial<TranslationKeys>> = {
  en,
  de,
  fr,
  es: {} // Spanish placeholder
}

// Current locale (reactive)
const currentLocale = ref<Locale>('en')

// Cache for compiled regex patterns (avoids creating new RegExp on every translation call)
const paramRegexCache = new Map<string, RegExp>()

/**
 * Get a cached regex for parameter substitution.
 * Avoids creating a new RegExp on every translation call.
 * @param param - The parameter name to match (e.g., "count" matches "{count}")
 */
function getParamRegex(param: string): RegExp {
  let regex = paramRegexCache.get(param)
  if (!regex) {
    regex = new RegExp(`\\{${param}\\}`, 'g')
    paramRegexCache.set(param, regex)
  }
  return regex
}

/**
 * Detect browser locale
 */
function detectLocale(): Locale {
  const browserLang = navigator.language.split('-')[0]
  if (browserLang in translations) {
    return browserLang as Locale
  }
  return 'en'
}

/**
 * i18n composable
 */
export function useI18n() {
  /**
   * Set the current locale
   */
  function setLocale(locale: Locale) {
    currentLocale.value = locale
  }

  /**
   * Get the current locale
   */
  const locale = computed(() => currentLocale.value)

  /**
   * Translate a key with optional parameter substitution
   * @param key - Translation key
   * @param params - Optional parameters for substitution (e.g., { count: 5 })
   */
  function t(key: keyof TranslationKeys, params?: Record<string, string | number>): string {
    const localeTranslations = translations[currentLocale.value]
    const localeText = (localeTranslations as any)[key]
    const fallbackText = (translations.en as any)[key]
    let text = localeText || fallbackText || key

    // Warn in development if translation is missing for non-English locale
    if (import.meta.env.DEV && !localeText && currentLocale.value !== 'en') {
      console.warn(`Missing ${currentLocale.value} translation for: ${key}`)
    }

    // Parameter substitution: {name} -> value (using cached regex)
    if (params) {
      for (const [param, value] of Object.entries(params)) {
        const regex = getParamRegex(param)
        regex.lastIndex = 0  // Reset for global regex
        text = text.replace(regex, String(value))
      }
    }

    return text
  }

  /**
   * Get month names array for the current locale
   */
  function getMonthNames(): string[] {
    return [
      t('month.january'),
      t('month.february'),
      t('month.march'),
      t('month.april'),
      t('month.may'),
      t('month.june'),
      t('month.july'),
      t('month.august'),
      t('month.september'),
      t('month.october'),
      t('month.november'),
      t('month.december'),
    ]
  }

  /**
   * Get orientation label
   */
  function getOrientationLabel(orientation: number): string {
    const labels: Record<number, keyof TranslationKeys> = {
      1: 'orientation.normal',
      2: 'orientation.flippedH',
      3: 'orientation.rotated180',
      4: 'orientation.flippedV',
      5: 'orientation.rotated90cwFlipped',
      6: 'orientation.rotated90cw',
      7: 'orientation.rotated90ccwFlipped',
      8: 'orientation.rotated90ccw'
    }
    const key = labels[orientation]
    return key ? t(key) : String(orientation)
  }

  // Initialize with browser locale
  if (currentLocale.value === 'en') {
    currentLocale.value = detectLocale()
  }

  return {
    t,
    locale,
    setLocale,
    getMonthNames,
    getOrientationLabel,
    detectLocale
  }
}
