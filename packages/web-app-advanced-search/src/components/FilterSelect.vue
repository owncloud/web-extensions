<template>
  <div class="item-filter" :class="`item-filter-${label.toLowerCase().replace(/\s+/g, '-')}`">
    <oc-filter-chip
      :filter-label="label"
      :selected-item-names="selectedItemNames"
      :close-on-click="!allowCustom"
      @clear-filter="clear"
      @show-drop="onShowDrop"
    >
      <div v-if="allowCustom" class="filter-select-custom">
        <input
          :id="`filter-custom-${label.toLowerCase().replace(/\s+/g, '-')}`"
          ref="customInput"
          type="text"
          class="filter-select-custom-input"
          :value="customText"
          :placeholder="customPlaceholder || label"
          :aria-label="customPlaceholder || label"
          @input="customText = ($event.target as HTMLInputElement).value"
          @keyup.enter="applyCustom"
          @click.stop
        />
        <button
          v-if="customText"
          type="button"
          class="oc-button oc-rounded oc-button-s oc-button-justify-content-center oc-button-gap-m oc-button-primary oc-button-primary-filled filter-select-custom-apply"
          @click.stop="applyCustom"
        >
          <span>OK</span>
        </button>
      </div>
      <oc-list class="item-filter-list">
        <li v-for="opt in filteredOptions" :key="String(opt.value)" class="oc-my-xs">
          <oc-button
            class="item-filter-list-item oc-flex oc-flex-middle oc-width-1-1 oc-p-xs oc-flex-between"
            :class="{ 'item-filter-list-item-active': String(opt.value) === String(modelValue) }"
            justify-content="space-between"
            appearance="raw"
            @click="select(opt.value)"
          >
            <div class="oc-flex oc-flex-middle oc-text-truncate">
              <oc-checkbox
                size="large"
                class="item-filter-checkbox oc-mr-s"
                :label="opt.label"
                :model-value="String(opt.value) === String(modelValue)"
                :label-hidden="true"
                @update:model-value="select(opt.value)"
                @click.stop
              />
              <div v-if="opt.icon">
                <oc-icon :name="opt.icon" :color="opt.iconColor" size="large" />
              </div>
              <div class="oc-text-truncate oc-ml-s">
                <span>{{ opt.label }}</span>
              </div>
            </div>
            <div class="oc-flex">
              <oc-icon
                v-if="String(opt.value) === String(modelValue)"
                name="check"
              />
            </div>
          </oc-button>
        </li>
      </oc-list>
    </oc-filter-chip>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string | number
  options: Array<{ value: string | number; label: string; icon?: string; iconColor?: string }>
  label: string
  defaultValue?: string | number
  ariaLabel?: string
  allowCustom?: boolean
  customPlaceholder?: string
}>(), {
  defaultValue: undefined,
  ariaLabel: undefined,
  allowCustom: false,
  customPlaceholder: undefined,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

const customInput = ref<HTMLInputElement>()
const customText = ref('')

const selectedItemNames = computed(() => {
  if (props.defaultValue === undefined) return []
  if (String(props.modelValue) === String(props.defaultValue)) return []
  const selected = props.options.find(o => String(o.value) === String(props.modelValue))
  if (selected) return [selected.label]
  if (props.modelValue) return [String(props.modelValue)]
  return []
})

const filteredOptions = computed(() => {
  if (!props.allowCustom || !customText.value) return props.options
  const search = customText.value.toLowerCase()
  return props.options.filter(o => String(o.label).toLowerCase().includes(search))
})

function select(value: string | number) {
  emit('update:modelValue', value)
  customText.value = ''
}

function applyCustom() {
  if (customText.value.trim()) {
    emit('update:modelValue', customText.value.trim())
    customText.value = ''
  }
}

function clear() {
  if (props.defaultValue !== undefined) {
    emit('update:modelValue', props.defaultValue)
  }
  customText.value = ''
}

function onShowDrop() {
  customText.value = ''
  if (props.allowCustom) {
    nextTick(() => customInput.value?.focus())
  }
}
</script>

<style lang="scss">
.item-filter {
  &-list {
    li {
      &:first-child {
        margin-top: 0 !important;
      }
      &:last-child {
        margin-bottom: 0 !important;
      }
    }

    &-item {
      line-height: 1.5;
      gap: 8px;

      &:hover,
      &-active {
        background-color: var(--oc-color-background-hover) !important;
      }
    }
  }
}

.filter-select-custom {
  display: flex;
  gap: 4px;
  padding: 0 4px 8px;
  border-bottom: 1px solid var(--oc-color-border, #e0e0e0);
  margin-bottom: 4px;
}

.filter-select-custom-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--oc-color-border, #ccc);
  border-radius: 4px;
  font-size: var(--oc-font-size-xsmall, 0.75rem);
  font-family: inherit;
  background: var(--oc-color-background-default, #fff);
  color: var(--oc-color-text-default, #333);
  outline: none;
}

.filter-select-custom-input:focus {
  border-color: var(--oc-color-swatch-primary-default, #0070c0);
}

.filter-select-custom-apply {
  flex-shrink: 0;
}
</style>
