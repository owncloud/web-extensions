<template>
  <Teleport to="body">
    <div v-if="visible" class="context-menu" :style="menuPosition" ref="menuRef">
      <button class="menu-item" @click="handleAction('download')">
        <span class="menu-icon">&#x2B07;</span>
        <span>{{ t('menu.download') }}</span>
      </button>
      <button class="menu-item" @click="handleAction('openInFiles')">
        <span class="menu-icon">&#x1F4C1;</span>
        <span>{{ t('menu.openInFiles') }}</span>
      </button>
      <button class="menu-item" @click="handleAction('copyLink')">
        <span class="menu-icon">&#x1F517;</span>
        <span>{{ t('menu.copyLink') }}</span>
      </button>
      <div class="menu-divider"></div>
      <button class="menu-item menu-item-danger" @click="handleAction('delete')">
        <span class="menu-icon">&#x1F5D1;</span>
        <span>{{ t('menu.delete') }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from '../composables/useI18n'

interface Props {
  visible: boolean
  photo: any
  position: { x: number, y: number }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'action', action: string, photo: any): void
}>()

const { t } = useI18n()

const menuRef = ref<HTMLElement | null>(null)
const canClose = ref(false)

const menuPosition = computed(() => ({
  top: `${props.position.y}px`,
  left: `${props.position.x}px`
}))

function handleAction(action: string) {
  emit('action', action, props.photo)
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

// When menu becomes visible, wait for next tick before allowing close
watch(() => props.visible, (visible) => {
  if (visible) {
    canClose.value = false
    nextTick(() => {
      setTimeout(() => {
        canClose.value = true
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
})
</script>

<style>
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
