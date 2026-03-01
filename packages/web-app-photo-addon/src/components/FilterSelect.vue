<template>
  <div ref="root" class="filter-select">
    <button
      ref="chipBtn"
      type="button"
      class="filter-chip-btn"
      :class="{ 'filter-chip-btn-active': hasValue }"
      :aria-expanded="isOpen"
      :aria-label="ariaLabel || label"
      @click.stop="toggle"
    >
      <span v-if="hasValue" class="filter-chip-check">
        <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <path d="M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z" />
        </svg>
      </span>
      <span class="filter-chip-label">{{ displayLabel }}</span>
      <span class="filter-chip-arrow">
        <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <path d="M12 16L6 10H18L12 16Z" />
        </svg>
      </span>
    </button>
    <button
      v-if="hasValue"
      type="button"
      class="filter-chip-clear"
      aria-label="Clear"
      @click.stop="clear"
    >
      <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path d="M12 10.5858L6.70711 5.29289L5.29289 6.70711L10.5858 12L5.29289 17.2929L6.70711 18.7071L12 13.4142L17.2929 18.7071L18.7071 17.2929L13.4142 12L18.7071 6.70711L17.2929 5.29289L12 10.5858Z" />
      </svg>
    </button>
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="oc-drop oc-box-shadow-medium oc-rounded filter-select-drop"
        :style="dropdownStyle"
        role="listbox"
      >
        <div class="oc-card-body oc-background-secondary oc-p-s">
          <ul class="oc-list oc-my-rm oc-mx-rm">
            <li v-for="opt in options" :key="String(opt.value)" class="oc-my-xs">
              <button
                type="button"
                role="option"
                class="oc-button oc-rounded oc-button-m oc-button-justify-content-space-between oc-button-gap-m oc-button-passive oc-button-passive-raw oc-flex oc-flex-middle oc-p-xs filter-select-item"
                :class="{ 'filter-select-item-selected': String(opt.value) === String(modelValue) }"
                :aria-selected="String(opt.value) === String(modelValue)"
                @click.stop="select(opt.value)"
              >
                <span class="oc-flex oc-flex-middle">
                  <span class="filter-select-check oc-mr-s">
                    <svg v-if="String(opt.value) === String(modelValue)" width="16" height="16" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                      <path d="M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z" />
                    </svg>
                  </span>
                  <span>{{ opt.label }}</span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string | number
  options: Array<{ value: string | number; label: string }>
  label: string
  defaultValue?: string | number
  ariaLabel?: string
}>(), {
  defaultValue: undefined,
  ariaLabel: undefined,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

const root = ref<HTMLElement>()
const chipBtn = ref<HTMLElement>()
const isOpen = ref(false)
const dropdownPos = ref({ top: 0, left: 0 })

const hasValue = computed(() => {
  if (props.defaultValue === undefined) return false
  return String(props.modelValue) !== String(props.defaultValue)
})

const displayLabel = computed(() => {
  const selected = props.options.find(o => String(o.value) === String(props.modelValue))
  if (props.defaultValue === undefined && selected) {
    return selected.label
  }
  if (hasValue.value && selected) {
    return `${props.label}: ${selected.label}`
  }
  return props.label
})

const dropdownStyle = computed(() => ({
  position: 'fixed' as const,
  top: `${dropdownPos.value.top}px`,
  left: `${dropdownPos.value.left}px`,
  zIndex: '9999',
}))

function updatePosition() {
  if (chipBtn.value) {
    const rect = chipBtn.value.getBoundingClientRect()
    dropdownPos.value = {
      top: rect.bottom + 4,
      left: rect.left,
    }
  }
}

function toggle() {
  if (!isOpen.value) {
    updatePosition()
  }
  isOpen.value = !isOpen.value
}

function select(value: string | number) {
  emit('update:modelValue', value)
  isOpen.value = false
}

function clear() {
  if (props.defaultValue !== undefined) {
    emit('update:modelValue', props.defaultValue)
  }
  isOpen.value = false
}

function onClickOutside(e: MouseEvent) {
  if (!root.value?.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside, true))
onUnmounted(() => document.removeEventListener('click', onClickOutside, true))
</script>

<style scoped>
.filter-select {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.filter-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--oc-color-text-muted, #888);
  border-radius: 100px;
  background: var(--oc-color-background-default, #fff);
  color: var(--oc-color-text-muted, #888);
  font-size: var(--oc-font-size-xsmall, 0.75rem);
  font-family: inherit;
  font-weight: 400;
  cursor: pointer;
  white-space: nowrap;
  line-height: 1rem;
  transition: border-color 0.15s ease;
}

.filter-chip-btn:hover {
  border-color: var(--oc-color-swatch-primary-default, #0070c0);
  color: var(--oc-color-text-default, #333);
}

.filter-chip-btn-active {
  background: var(--oc-color-swatch-primary-default, #0070c0);
  color: var(--oc-color-text-inverse, #fff);
  border-color: var(--oc-color-swatch-primary-default, #0070c0);
  border-radius: 100px 0 0 100px;
}

.filter-chip-check {
  display: inline-flex;
  width: 14px;
  height: 14px;
}

.filter-chip-check svg {
  width: 14px;
  height: 14px;
  fill: var(--oc-color-text-inverse, #fff);
}

.filter-chip-arrow {
  display: inline-flex;
  width: 14px;
  height: 14px;
}

.filter-chip-arrow svg {
  width: 14px;
  height: 14px;
}

.filter-chip-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 8px;
  border: none;
  border-radius: 0 100px 100px 0;
  background: var(--oc-color-swatch-primary-default, #0070c0);
  color: var(--oc-color-text-inverse, #fff);
  cursor: pointer;
  margin-left: 1px;
}

.filter-chip-clear svg {
  width: 14px;
  height: 14px;
  fill: var(--oc-color-text-inverse, #fff);
}

.filter-chip-clear:hover {
  background: var(--oc-color-swatch-primary-hover, #005a9e);
}
</style>

<!-- Unscoped: dropdown is teleported to body, scoped attrs won't match -->
<style>
.filter-select-drop {
  max-height: 400px;
  overflow: hidden auto;
  width: auto;
  max-width: 416px;
}

.filter-select-drop .oc-card-body {
  padding: 8px;
}

.filter-select-item {
  width: 100%;
  justify-content: flex-start !important;
  cursor: pointer;
}

.filter-select-item:hover {
  background: var(--oc-color-background-hover, #f5f5f5);
}

.filter-select-item-selected {
  color: var(--oc-color-swatch-primary-default, #0070c0);
  font-weight: 600;
}

.filter-select-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.filter-select-check svg {
  color: var(--oc-color-swatch-primary-default, #0070c0);
}
</style>
