<template>
  <section data-testid="file-comments-panel" class="file-comments-panel" :aria-label="$gettext('File comments')">
    <div class="file-comments-toolbar oc-flex oc-flex-middle oc-flex-between">
      <p class="oc-my-rm oc-text-muted">
        {{ $gettext('Discuss this item with everyone who can edit it.') }}
      </p>
      <oc-button
        v-oc-tooltip="$gettext('Refresh comments')"
        appearance="raw"
        :aria-label="$gettext('Refresh comments')"
        :disabled="isLoading || isSaving"
        @click="load"
      >
        <oc-icon name="refresh" fill-type="line" size="small" />
      </oc-button>
    </div>

    <p v-if="error" class="file-comments-error" role="alert">{{ error }}</p>

    <div v-if="isLoading" class="file-comments-state oc-text-center oc-text-muted">
      {{ $gettext('Loading comments…') }}
    </div>

    <div v-else-if="comments.length === 0" class="file-comments-state oc-text-center oc-text-muted">
      <oc-icon name="chat-3" fill-type="line" size="large" />
      <p>{{ $gettext('No comments yet.') }}</p>
    </div>

    <ol v-else class="file-comments-list oc-m-rm oc-p-rm">
      <li v-for="comment in comments" :key="comment.id" class="file-comment">
        <header class="file-comment-header oc-flex oc-flex-middle oc-flex-between">
          <div>
            <strong>{{ comment.authorName }}</strong>
            <time class="oc-ml-xs oc-text-muted" :datetime="comment.createdAt">
              {{ formatDate(comment.createdAt) }}
            </time>
            <span v-if="comment.updatedAt" class="oc-ml-xs oc-text-muted">
              {{ $gettext('(edited)') }}
            </span>
          </div>
          <div v-if="isAuthor(comment) && editingId !== comment.id" class="file-comment-actions oc-flex">
            <oc-button
              v-oc-tooltip="$gettext('Edit comment')"
              appearance="raw"
              :aria-label="$gettext('Edit comment')"
              :disabled="isSaving"
              @click="startEditing(comment)"
            >
              <oc-icon name="edit-2" fill-type="line" size="small" />
            </oc-button>
            <oc-button
              v-oc-tooltip="$gettext('Delete comment')"
              appearance="raw"
              :aria-label="$gettext('Delete comment')"
              :disabled="isSaving"
              @click="deleteComment(comment)"
            >
              <oc-icon name="delete-bin-7" fill-type="line" size="small" />
            </oc-button>
          </div>
        </header>

        <template v-if="editingId === comment.id">
          <oc-textarea
            v-model="editBody"
            class="oc-mt-s"
            :label="$gettext('Edit comment')"
            :submit-on-enter="false"
            :disabled="isSaving"
            maxlength="10000"
            rows="5"
          />
          <div class="oc-flex oc-flex-right oc-mt-s">
            <oc-button appearance="raw" size="small" :disabled="isSaving" @click="cancelEditing">
              {{ $gettext('Cancel') }}
            </oc-button>
            <oc-button
              class="oc-ml-s"
              variation="primary"
              size="small"
              :disabled="isSaving || !editBody.trim()"
              @click="saveEdit(comment)"
            >
              {{ $gettext('Save') }}
            </oc-button>
          </div>
        </template>
        <!-- The rendered Markdown is sanitized with DOMPurify before insertion. -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else class="file-comment-body" v-html="renderMarkdown(comment.body)" />
      </li>
    </ol>

    <form class="file-comments-composer" @submit.prevent="submitComment">
      <oc-textarea
        v-model="newComment"
        :label="$gettext('Add a comment')"
        :description-message="$gettext('Markdown is supported.')"
        :submit-on-enter="false"
        :disabled="isSaving"
        maxlength="10000"
        rows="5"
      />
      <div class="oc-flex oc-flex-right oc-mt-s">
        <oc-button
          data-testid="file-comments-submit"
          variation="primary"
          size="small"
          submit="submit"
          :disabled="isSaving || !newComment.trim()"
        >
          {{ isSaving ? $gettext('Saving…') : $gettext('Comment') }}
        </oc-button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import type { Resource } from '@ownclouders/web-client'
import { ref, toRef } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useModals } from '@ownclouders/web-pkg'
import { useFileComments } from '../composables/useFileComments'
import type { FileComment } from '../services/commentFormat'
import { renderMarkdown } from '../utils/markdown'

const props = defineProps<{ resource?: Resource | null }>()
const { $gettext } = useGettext()
const { dispatchModal } = useModals()
const newComment = ref('')
const editBody = ref('')
const editingId = ref<string | null>(null)
const { comments, isLoading, isSaving, error, currentUserId, load, add, update, remove } =
  useFileComments(toRef(props, 'resource'))

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  )

const isAuthor = (comment: FileComment): boolean => comment.authorId === currentUserId()

const runMutation = async (mutation: () => Promise<void>): Promise<boolean> => {
  try {
    await mutation()
    return true
  } catch {
    return false
  }
}

const submitComment = async () => {
  const body = newComment.value.trim()
  if (!body) {
    return
  }
  if (await runMutation(() => add(body))) {
    newComment.value = ''
  }
}

const startEditing = (comment: FileComment) => {
  editingId.value = comment.id
  editBody.value = comment.body
}

const cancelEditing = () => {
  editingId.value = null
  editBody.value = ''
}

const saveEdit = async (comment: FileComment) => {
  const body = editBody.value.trim()
  if (!body) {
    return
  }
  if (await runMutation(() => update(comment, body))) {
    cancelEditing()
  }
}

const deleteComment = (comment: FileComment) => {
  // Use the ODS modal (consistent with other extensions and automatable in
  // Playwright) instead of window.confirm, which auto-dismisses in headless runs.
  dispatchModal({
    title: $gettext('Delete comment'),
    message: $gettext('Are you sure you want to delete this comment? This cannot be undone.'),
    confirmText: $gettext('Delete'),
    onConfirm: async () => {
      // Failure surfaces through the panel error banner via the composable.
      await runMutation(() => remove(comment))
    }
  })
}
</script>

<style scoped>
.file-comments-panel {
  padding: var(--oc-space-medium);
}

.file-comments-toolbar {
  gap: var(--oc-space-small);
}

.file-comments-toolbar p {
  line-height: 1.4;
}

.file-comments-state {
  padding: var(--oc-space-large) 0;
}

.file-comments-list {
  list-style: none;
}

.file-comment {
  border-bottom: 1px solid var(--oc-color-border);
  padding: var(--oc-space-medium) 0;
}

.file-comment-header {
  gap: var(--oc-space-small);
  line-height: 1.4;
}

.file-comment-header time,
.file-comment-header span {
  font-size: 0.875rem;
}

.file-comment-actions {
  flex: 0 0 auto;
}

.file-comment-body {
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.file-comment-body :deep(> :last-child) {
  margin-bottom: 0;
}

.file-comment-body :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  padding: var(--oc-space-small);
}

.file-comment-body :deep(img) {
  height: auto;
  max-width: 100%;
}

.file-comments-composer {
  margin-top: var(--oc-space-medium);
}

.file-comments-error {
  color: var(--oc-color-swatch-danger-default);
}
</style>
