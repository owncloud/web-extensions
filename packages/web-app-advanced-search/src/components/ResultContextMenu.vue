<template>
  <Teleport to="body">
    <div v-if="visible" ref="menuRef" class="context-menu" :style="menuPosition">
      <button class="menu-item" @click="handleAction('download')">
        <span class="menu-icon">⬇️</span>
        <span>{{ $gettext('Download') }}</span>
      </button>
      <button class="menu-item" @click="handleAction('openInFiles')">
        <span class="menu-icon">📁</span>
        <span>{{ $gettext('Open in Files') }}</span>
      </button>
      <button class="menu-item" @click="handleAction('copyLink')">
        <span class="menu-icon">🔗</span>
        <span>{{ $gettext('Copy Link') }}</span>
      </button>
      <div class="menu-divider"></div>
      <button class="menu-item menu-item-danger" @click="handleAction('delete')">
        <span class="menu-icon">🗑️</span>
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
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.875rem;
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

.menu-icon {
  width: 1.25rem;
  text-align: center;
}

.menu-divider {
  height: 1px;
  background: var(--oc-color-border, #e0e0e0);
  margin: 0.5rem 0;
}

</style>
