<template>
  <div class="vim-nav-shortcuts" tabindex="0">
    <div v-for="group in groups" :key="group.label" class="oc-mb-m">
      <h3 class="oc-text-muted oc-text-small oc-mb-xs" v-text="group.label" />
      <table class="vim-nav-shortcuts-table oc-width-1-1">
        <tbody>
          <tr v-for="shortcut in group.shortcuts" :key="shortcut.key">
            <td class="vim-nav-shortcuts-key">
              <kbd>{{ shortcut.key }}</kbd>
            </td>
            <td class="vim-nav-shortcuts-desc" v-text="shortcut.description" />
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useGettext } from 'vue3-gettext'

export default defineComponent({
  name: 'ShortcutsHelp',
  setup() {
    const { $pgettext } = useGettext()
    const ctx = 'Vim nav keyboard shortcut'

    const groups = [
      {
        label: $pgettext('Vim nav shortcuts group label', 'Navigation'),
        shortcuts: [
          { key: 'j', description: $pgettext(ctx, 'Move down') },
          { key: 'k', description: $pgettext(ctx, 'Move up') },
          { key: 'G', description: $pgettext(ctx, 'Jump to last') },
          { key: 'gg', description: $pgettext(ctx, 'Jump to first') },
          { key: 'l', description: $pgettext(ctx, 'Open selected') },
          { key: 'v', description: $pgettext(ctx, 'Toggle visual (multi-select) mode') }
        ]
      },
      {
        label: $pgettext('Vim nav shortcuts group label', 'Actions'),
        shortcuts: [
          { key: 'y', description: $pgettext(ctx, 'Copy') },
          { key: 'x', description: $pgettext(ctx, 'Cut') },
          { key: 'p', description: $pgettext(ctx, 'Paste') },
          { key: 'dd', description: $pgettext(ctx, 'Delete') },
          { key: 'yy', description: $pgettext(ctx, 'Duplicate') },
          { key: 'dw', description: $pgettext(ctx, 'Download') },
          { key: 'nd', description: $pgettext(ctx, 'New folder') },
          { key: 'nf', description: $pgettext(ctx, 'New plain file') },
          { key: 'nm', description: $pgettext(ctx, 'New Markdown file') },
          { key: 'ns', description: $pgettext(ctx, 'New space') }
        ]
      },
      {
        label: $pgettext('Vim nav shortcuts group label', 'Trash'),
        shortcuts: [
          { key: 'd', description: $pgettext(ctx, 'Delete permanently') },
          { key: 'r', description: $pgettext(ctx, 'Restore') },
          { key: 'e', description: $pgettext(ctx, 'Empty trash bin') }
        ]
      },
      {
        label: $pgettext('Vim nav shortcuts group label', 'Go to'),
        shortcuts: [
          { key: 'gp', description: $pgettext(ctx, 'Personal files') },
          { key: 'gs', description: $pgettext(ctx, 'Shared with me') },
          { key: 'gd', description: $pgettext(ctx, 'Trash') },
          { key: 'go', description: $pgettext(ctx, 'Projects') }
        ]
      },
      {
        label: $pgettext('Vim nav shortcuts group label', 'Other'),
        shortcuts: [
          { key: '/', description: $pgettext(ctx, 'Focus search') },
          { key: '?', description: $pgettext(ctx, 'Show keyboard shortcuts') }
        ]
      }
    ]

    return { groups }
  }
})
</script>

<style scoped>
.vim-nav-shortcuts:focus {
  outline: none;
}

.vim-nav-shortcuts-table {
  border-collapse: collapse;
}

.vim-nav-shortcuts-table tr + tr td {
  padding-top: 4px;
}

.vim-nav-shortcuts-key {
  width: 4rem;
  vertical-align: top;
}

.vim-nav-shortcuts-desc {
  vertical-align: top;
}

kbd {
  display: inline-block;
  padding: 1px 6px;
  border: 1px solid var(--oc-color-border);
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.85em;
  background: var(--oc-color-background-muted);
}
</style>
