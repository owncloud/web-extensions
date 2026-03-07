<template>
  <Teleport to="body">
    <div v-if="visible" ref="menuRef" class="context-menu" :style="menuPosition">
      <button class="oc-button-reset menu-item" @click="handleAction('download')">
        <span class="oc-icon oc-icon-m oc-icon-passive" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 19H21V21H3V19ZM13 13.172L19.071 7.1L20.485 8.514L12 17L3.515 8.514L4.929 7.1L11 13.172V2H13V13.172Z" /></svg></span>
        <span>{{ $gettext('Download') }}</span>
      </button>
      <button class="oc-button-reset menu-item" @click="handleAction('openInFiles')">
        <span class="oc-icon oc-icon-m oc-icon-passive" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M10 6V8H5V19H16V14H18V20C18 20.5523 17.5523 21 17 21H4C3.44772 21 3 20.5523 3 20V7C3 6.44772 3.44772 6 4 6H10ZM21 3V11H19V6.413L11.207 14.207L9.793 12.793L17.585 5H13V3H21Z" /></svg></span>
        <span>{{ $gettext('Open in Files') }}</span>
      </button>
      <button class="oc-button-reset menu-item" @click="handleAction('copyLink')">
        <span class="oc-icon oc-icon-m oc-icon-passive" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 7H13V5H17C19.7614 5 22 7.23858 22 10C22 12.7614 19.7614 15 17 15H13V13H17C18.6569 13 20 11.6569 20 10C20 8.34315 18.6569 7 17 7ZM7 17H11V19H7C4.23858 19 2 16.7614 2 14C2 11.2386 4.23858 9 7 9H11V11H7C5.34315 11 4 12.3431 4 14C4 15.6569 5.34315 17 7 17ZM8 13H16V11H8V13Z" /></svg></span>
        <span>{{ $gettext('Copy Link') }}</span>
      </button>
      <div class="menu-divider"></div>
      <button class="oc-button-reset menu-item menu-item-danger" @click="handleAction('delete')">
        <span class="oc-icon oc-icon-m oc-icon-passive" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 11H11V17H9V11ZM13 11H15V17H13V11ZM9 4V6H15V4H9Z" /></svg></span>
        <span>{{ $gettext('Delete') }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { Resource } from '@ownclouders/web-client'
import { useTranslations } from '../composables/useTranslations'

const { $gettext } = useTranslations()

interface Props {
  visible: boolean
  item: Resource | null
  position: { x: number, y: number }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'action', action: string, item: Resource): void
}>()

const menuRef = ref<HTMLElement | null>(null)

/**
 * Controls whether click-outside should close the menu.
 * Set to false initially and for 100ms after opening to prevent the
 * same click that opened the menu from immediately closing it.
 */
const canClose = ref(false)

const adjustedPosition = ref({ x: 0, y: 0 })

/** Timeout ID for the close delay - stored for cleanup on unmount */
let closeDelayTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Adjust menu position to keep it within viewport bounds.
 *
 * Uses approximate dimensions (200x180) that match the CSS styling.
 * If the menu styling changes significantly, update these values.
 *
 * Algorithm:
 * 1. Start at click position (props.position)
 * 2. If menu would overflow right edge, shift left
 * 3. If menu would overflow bottom edge, shift up
 * 4. Ensure position isn't negative (edge case for small screens)
 */
function adjustMenuPosition() {
  nextTick(() => {
    if (!menuRef.value) return

    // Approximate dimensions - should match CSS min-width and content height
    // Update these if menu styling changes significantly
    const menuWidth = 200
    const menuHeight = 180
    const padding = 10 // Margin from viewport edges

    let x = props.position.x
    let y = props.position.y

    // Shift left if menu would overflow right edge
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding
    }

    // Shift up if menu would overflow bottom edge
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding
    }

    // Clamp to viewport (handles small screens)
    x = Math.max(padding, x)
    y = Math.max(padding, y)

    adjustedPosition.value = { x, y }
  })
}

const menuPosition = computed(() => ({
  top: `${adjustedPosition.value.y}px`,
  left: `${adjustedPosition.value.x}px`
}))

function handleAction(action: string) {
  if (props.item) {
    emit('action', action, props.item)
  }
  emit('close')
}

// Close menu when clicking outside (but not on the initial click that opened it)
function handleClickOutside(event: MouseEvent) {
  if (!canClose.value) return
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

// Close menu on escape key
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

/**
 * Handle menu visibility changes.
 *
 * When menu opens:
 * 1. Disable click-outside closing (canClose = false)
 * 2. Adjust position to fit in viewport
 * 3. After 100ms delay, enable click-outside closing
 *
 * The 100ms delay prevents the click that opened the menu from
 * immediately triggering click-outside and closing it. This is a
 * common UX pattern for context menus.
 */
watch(() => props.visible, (visible) => {
  // Clear any pending timeout (prevents memory leak if menu closes before timeout fires)
  if (closeDelayTimeout) {
    clearTimeout(closeDelayTimeout)
    closeDelayTimeout = null
  }

  if (visible) {
    canClose.value = false
    adjustMenuPosition()
    // Delay before allowing click-outside to close
    nextTick(() => {
      closeDelayTimeout = setTimeout(() => {
        canClose.value = true
        closeDelayTimeout = null
      }, 100)
    })
  } else {
    canClose.value = false
  }
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
  document.removeEventListener('keydown', handleKeydown)
  // Clear pending timeout to prevent memory leak
  if (closeDelayTimeout) {
    clearTimeout(closeDelayTimeout)
    closeDelayTimeout = null
  }
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: var(--oc-color-background-default, #fff);
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 180px;
  padding: 0.5rem 0;
  z-index: 99999;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.6rem 1rem;
  cursor: pointer;
  font-size: var(--oc-font-size-default, 0.875rem);
  color: var(--oc-color-text-default, #333);
  text-align: left;
  transition: background 0.15s;
}

.menu-item:hover {
  background: var(--oc-color-background-muted, #f5f5f5);
}

.menu-item-danger {
  color: var(--oc-color-swatch-danger-default, #c00);
}

.menu-item-danger:hover {
  background: rgba(200, 0, 0, 0.1);
}

.menu-divider {
  height: 1px;
  background: var(--oc-color-border, #e0e0e0);
  margin: 0.5rem 0;
}
</style>
