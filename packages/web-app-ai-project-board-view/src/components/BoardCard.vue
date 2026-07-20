<template>
  <div class="board-card oc-rounded oc-p-s oc-mb-s" data-testid="board-card">
    <div class="oc-flex oc-flex-middle oc-gap-xs">
      <resource-icon :resource="resource" size="small" />
      <span class="board-card-name oc-text-truncate" :title="resource.name">
        {{ resource.name }}
      </span>
    </div>
    <p class="board-card-mdate oc-text-muted oc-my-rm oc-mt-xs">
      {{ lastModifiedLabel }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { ResourceIcon } from '@ownclouders/web-pkg'
import type { Resource } from '@ownclouders/web-client'

const props = defineProps<{ resource: Resource }>()

const { $gettext, current: currentLanguage } = useGettext()

function formatMDate(mdate?: string): string | undefined {
  if (!mdate) {
    return undefined
  }
  const date = new Date(mdate)
  if (isNaN(date.getTime())) {
    return undefined
  }
  return date.toLocaleDateString(currentLanguage, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const lastModifiedLabel = computed(() => {
  const formatted = formatMDate(props.resource.mdate)
  return formatted
    ? $gettext('Modified %{date}', { date: formatted })
    : $gettext('Modification date unknown')
})
</script>

<style scoped>
.board-card {
  border: 1px solid var(--oc-color-border, #e0e0e0);
  background-color: var(--oc-color-background-default, #fff);
}
.board-card-name {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
}
.board-card-mdate {
  font-size: 0.8rem;
}
</style>
