import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown, parseBlocks, stripMarkdown } from './markdown'

const html = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }))

describe('Markdown renderer', () => {
  it('renders the common syntax', () => {
    const out = html('# Title\n\nSome **bold** and _italic_ and `code`.\n\n- one\n- [x] done\n\n1. first\n\n> quote\n\n| a | b |\n|---|---|\n| 1 | 2 |')
    expect(out).toContain('<h1>Title</h1>')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('<em>italic</em>')
    expect(out).toContain('<code>code</code>')
    expect(out).toContain('<li class="task">')
    expect(out).toContain('<ol>')
    expect(out).toContain('<blockquote>')
    expect(out).toContain('<td>2</td>')
  })

  it('never injects HTML or unsafe links', () => {
    const out = html('<img src=x onerror=alert(1)> [click](javascript:alert(1)) [ok](https://example.com)')
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;img')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('parses blocks and strips syntax for previews', () => {
    expect(parseBlocks('a\nb\n\n- x').map((b) => b.t)).toEqual(['p', 'ul'])
    expect(stripMarkdown('## Hi\n- **bold** [link](https://x)')).toBe('Hi bold link')
  })
})
