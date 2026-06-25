// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../../src/utils/markdown'

describe('renderMarkdown', () => {
  it('renders Markdown while removing executable HTML', () => {
    const html = renderMarkdown(
      '**Safe** <img src="x" onerror="alert(1)"><script>alert(2)</script>'
    )

    expect(html).toContain('<strong>Safe</strong>')
    expect(html).toContain('<img src="x">')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<script')
  })
})
