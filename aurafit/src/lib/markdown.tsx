import { Fragment, type ReactNode } from 'react'

/**
 * A small, safe Markdown renderer for journal entries and coach replies.
 *
 * It builds React elements directly (never innerHTML), so user text and model output cannot
 * inject markup. Supported: headings, paragraphs, bullet / numbered / task lists, blockquotes,
 * fenced code, horizontal rules, pipe tables, **bold**, *italic*, ~~strike~~, `code` and
 * [links](https://...) (http, https and mailto only).
 */

type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul' | 'ol'; items: Array<{ text: string; task?: boolean; done?: boolean }> }
  | { t: 'quote'; text: string }
  | { t: 'code'; text: string }
  | { t: 'hr' }
  | { t: 'table'; head: string[]; rows: string[][] }

const BULLET = /^\s*[-*+]\s+(.*)$/
const ORDERED = /^\s*\d+[.)]\s+(.*)$/
const TASK = /^\[( |x|X)\]\s+(.*)$/

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    if (/^\s*```/.test(line)) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++])
      i++
      blocks.push({ t: 'code', text: body.join('\n') })
      continue
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      blocks.push({ t: 'h', level: heading[1].length, text: heading[2] })
      i++
      continue
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ t: 'hr' })
      i++
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(splitRow(lines[i++]))
      blocks.push({ t: 'table', head, rows })
      continue
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''))
      blocks.push({ t: 'quote', text: body.join('\n') })
      continue
    }
    const listKind = BULLET.test(line) ? 'ul' : ORDERED.test(line) ? 'ol' : null
    if (listKind) {
      const re = listKind === 'ul' ? BULLET : ORDERED
      const items: Array<{ text: string; task?: boolean; done?: boolean }> = []
      while (i < lines.length && (re.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        const m = re.exec(lines[i])
        if (m) {
          const task = TASK.exec(m[1])
          items.push(task ? { text: task[2], task: true, done: task[1] !== ' ' } : { text: m[1] })
        } else {
          items[items.length - 1].text += ' ' + lines[i].trim()
        }
        i++
      }
      blocks.push({ t: listKind, items })
      continue
    }
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !ORDERED.test(lines[i])
    ) {
      para.push(lines[i++])
    }
    blocks.push({ t: 'p', text: para.join('\n') })
  }
  return blocks
}

const SAFE_URL = /^(https?:\/\/|mailto:)/i

/** Inline formatting: returns React nodes. Exported for tests. */
export function renderInline(text: string, keyBase = 'i'): ReactNode[] {
  const out: ReactNode[] = []
  // Order matters: code first (its content is literal), then links, then emphasis.
  const re = /(`[^`]+`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*|__([^_]+)__)|(~~([^~]+)~~)|(\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)|(\n)/g
  let last = 0
  let k = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${keyBase}-${k++}`
    if (m[1]) out.push(<code key={key}>{m[1].slice(1, -1)}</code>)
    else if (m[2]) {
      const href = m[4]
      out.push(
        SAFE_URL.test(href) ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {renderInline(m[3], key)}
          </a>
        ) : (
          <Fragment key={key}>{m[3]}</Fragment>
        ),
      )
    } else if (m[5]) out.push(<strong key={key}>{renderInline(m[6] ?? m[7], key)}</strong>)
    else if (m[8]) out.push(<del key={key}>{renderInline(m[9], key)}</del>)
    else if (m[10]) out.push(<em key={key}>{renderInline(m[11] ?? m[12], key)}</em>)
    else if (m[13]) out.push(<br key={key} />)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text)
  return (
    <div className={className ? `md ${className}` : 'md'}>
      {blocks.map((b, i) => {
        const key = `b${i}`
        switch (b.t) {
          case 'h': {
            const Tag = (['h1', 'h2', 'h3', 'h4', 'h4', 'h4'] as const)[b.level - 1]
            return <Tag key={key}>{renderInline(b.text, key)}</Tag>
          }
          case 'p':
            return <p key={key}>{renderInline(b.text, key)}</p>
          case 'quote':
            return <blockquote key={key}>{renderInline(b.text, key)}</blockquote>
          case 'code':
            return (
              <pre key={key}>
                <code>{b.text}</code>
              </pre>
            )
          case 'hr':
            return <hr key={key} />
          case 'table':
            return (
              <div key={key} className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      {b.head.map((c, j) => (
                        <th key={j}>{renderInline(c, `${key}h${j}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((c, j) => (
                          <td key={j}>{renderInline(c, `${key}r${r}c${j}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'ul':
          case 'ol': {
            const Tag = b.t
            return (
              <Tag key={key}>
                {b.items.map((it, j) => (
                  <li key={j} className={it.task ? 'task' : undefined}>
                    {it.task && <span aria-hidden>{it.done ? '☑︎ ' : '☐ '}</span>}
                    {renderInline(it.text, `${key}-${j}`)}
                  </li>
                ))}
              </Tag>
            )
          }
        }
      })}
    </div>
  )
}

/** Plain-text preview (for list rows): strips Markdown syntax. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+(\[[ xX]\]\s+)?/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|~~|`|\*|_)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
