import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// T011: tokens.css 가 스타일가이드(설계서)의 :root 와 어긋나지 않는지 지킨다(CLAUDE.md 절대 규정, R-20).
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const guide = readFileSync(here('../../../design/style-guide/스타일가이드_우리아이미술관.html'), 'utf8')
const tokens = readFileSync(here('./tokens.css'), 'utf8')

function vars(css: string): Record<string, string> {
  const root = css.match(/:root\{([\s\S]*?)\n\}/)?.[1] ?? ''
  const out: Record<string, string> = {}
  for (const m of root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

describe('디자인 토큰(T011)', () => {
  it('스타일가이드 :root 의 변수를 빠짐없이 같은 값으로 갖는다', () => {
    const g = vars(guide)
    expect(Object.keys(g).length).toBeGreaterThan(30)
    expect(vars(tokens)).toEqual(g)
  })
})
