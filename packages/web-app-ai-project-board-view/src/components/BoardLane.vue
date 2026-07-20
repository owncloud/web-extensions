<template>
  <section
    class="board-lane oc-rounded oc-p-s oc-background-muted"
    :data-testid="`board-lane-${lane}`"
    :aria-label="label"
  >
    <header class="board-lane-header oc-flex oc-flex-middle oc-flex-between oc-mb-s">
      <div class="oc-flex oc-flex-middle oc-gap-xs">
        <oc-icon :name="icon.name" :fill-type="icon.fillType" />
        <span class="board-lane-label">{{ label }}</span>
      </div>
      <span class="board-lane-count oc-rounded oc-background-default" data-testid="board-lane-count">
        {{ resources.length }}
      </span>
    </header>

    <div class="board-lane-cards">
      <board-card v-for="resource in resources" :key="resource.id" :resource="resource" />
      <p v-if="!resources.length" class="board-lane-empty oc-text-muted">
        {{ $gettext('No files in this lane yet.') }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useGettext } from 'vue3-gettext'
import type { Resource } from '@ownclouders/web-client'
import type { IconType } from '@ownclouders/web-pkg'
import BoardCard from './BoardCard.vue'

defineProps<{
  lane: string
  label: string
  icon: IconType
  resources: Resource[]
}>()

const { $gettext } = useGettext()
</script>

<style scoped>
.board-lane {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-width: 16rem;
  min-height: 0;
}
.board-lane-label {
  font-weight: 600;
}
.board-lane-count {
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
}
.board-lane-cards {
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
}
.board-lane-empty {
  font-style: italic;
  font-size: 0.85rem;
}
</style>
