import DOMPurify from 'dompurify'
import { marked } from 'marked'

export const renderMarkdown = (body: string): string => {
  const html = marked.parse(body, { async: false, breaks: true, gfm: true }) as string
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}
