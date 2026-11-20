import { queryPath, readData } from './workspace'

export async function loadReferenceEntries(base, { signal } = {}) {
  const items = []
  const seen = new Set()
  let after
  do {
    const page = await readData(queryPath(base, { status: 'active', limit: 50, after }), { signal })
    items.push(...page.items)
    after = page.next
    if (after && seen.has(after)) throw new Error('The list changed while loading. Refresh and try again.')
    seen.add(after)
  } while (after)
  return items
}

// Prefer a single position update. Equal or exhausted positions need a small
// run of following entries to move too, so the server returns the same order.
export function planReferenceMove(items, fromId, toId) {
  const from = items.findIndex((item) => item.id === fromId)
  const to = items.findIndex((item) => item.id === toId)
  if (from < 0 || to < 0) throw new Error('This list changed. Reload it before reordering.')
  if (from === to) return { items, updates: [] }
  const ordered = [...items]
  const [moved] = ordered.splice(from, 1)
  ordered.splice(to, 0, moved)
  const before = ordered[to - 1]?.sortOrder ?? -1
  const after = ordered[to + 1]?.sortOrder ?? 10001
  if (after - before > 1) {
    const sortOrder = to === ordered.length - 1
      ? Math.min(10000, before + 100)
      : Math.floor((before + after) / 2)
    return {
      items: ordered,
      updates: [{ id: moved.id, expectedRevision: moved.revision, sortOrder }],
    }
  }
  let previous = -1
  let positions = ordered.map((item) => {
    previous = Math.max(item.id === moved.id ? before + 1 : item.sortOrder, previous + 1)
    return previous
  })
  if (previous > 10000) {
    const spacing = Math.max(1, Math.floor(10000 / ordered.length))
    positions = ordered.map((_, index) => index * spacing)
  }
  return {
    items: ordered,
    updates: ordered.flatMap((item, index) => item.sortOrder === positions[index] ? [] : [{
      id: item.id, expectedRevision: item.revision, sortOrder: positions[index],
    }]),
  }
}
