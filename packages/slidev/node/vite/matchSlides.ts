/**
 * Match the slides of a deck after an edit to the slides before it, so a slide
 * keeps its compiled module when other slides are inserted, removed or moved.
 *
 * Slides are compared by signature, in three passes:
 * 1. slides with equal signatures are aligned in order (longest common subsequence),
 * 2. the remaining slides with equal signatures are matched anywhere, as moves,
 * 3. the slides still left between two aligned pairs are paired by position, as edits.
 *
 * @returns for each new slide, the index of the old slide it continues, or -1 for a new slide
 */
export function matchSlides(oldSigs: readonly string[], newSigs: readonly string[]): number[] {
  const result = Array.from<number>({ length: newSigs.length }).fill(-1)

  // Most edits touch one place, so the common start and end skip the table below
  let start = 0
  while (start < oldSigs.length && start < newSigs.length && oldSigs[start] === newSigs[start]) {
    result[start] = start
    start++
  }
  let oldEnd = oldSigs.length
  let newEnd = newSigs.length
  while (oldEnd > start && newEnd > start && oldSigs[oldEnd - 1] === newSigs[newEnd - 1]) {
    result[--newEnd] = --oldEnd
  }

  const anchors = alignMiddle(oldSigs, newSigs, start, oldEnd, start, newEnd)
  for (const [o, n] of anchors)
    result[n] = o
  const usedOld = new Set(anchors.map(([o]) => o))

  // Moves: leftover slides whose signature appears among the leftover old slides
  const leftoverOld = new Map<string, number[]>()
  for (let o = start; o < oldEnd; o++) {
    if (usedOld.has(o))
      continue
    const list = leftoverOld.get(oldSigs[o])
    if (list)
      list.push(o)
    else
      leftoverOld.set(oldSigs[o], [o])
  }
  for (let n = start; n < newEnd; n++) {
    if (result[n] !== -1)
      continue
    const o = leftoverOld.get(newSigs[n])?.shift()
    if (o != null) {
      result[n] = o
      usedOld.add(o)
    }
  }

  // Edits: pair what is left between two aligned pairs by position
  anchors.push([oldEnd, newEnd])
  let prevOld = start
  let prevNew = start
  for (const [anchorOld, anchorNew] of anchors) {
    const olds: number[] = []
    for (let o = prevOld; o < anchorOld; o++) {
      if (!usedOld.has(o))
        olds.push(o)
    }
    let k = 0
    for (let n = prevNew; n < anchorNew && k < olds.length; n++) {
      if (result[n] === -1)
        result[n] = olds[k++]
    }
    prevOld = anchorOld + 1
    prevNew = anchorNew + 1
  }

  return result
}

/**
 * Longest common subsequence of `old[oldStart, oldEnd)` and `new[newStart, newEnd)`,
 * as [oldIndex, newIndex] pairs in order
 */
function alignMiddle(
  oldSigs: readonly string[],
  newSigs: readonly string[],
  oldStart: number,
  oldEnd: number,
  newStart: number,
  newEnd: number,
): [number, number][] {
  const rows = oldEnd - oldStart
  const cols = newEnd - newStart
  if (!rows || !cols)
    return []

  // lengths[i][j]: LCS length of old[oldStart + i..] and new[newStart + j..]
  const width = cols + 1
  const lengths = new Uint32Array((rows + 1) * width)
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      lengths[i * width + j] = oldSigs[oldStart + i] === newSigs[newStart + j]
        ? lengths[(i + 1) * width + j + 1] + 1
        : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1])
    }
  }

  const pairs: [number, number][] = []
  let i = 0
  let j = 0
  while (i < rows && j < cols) {
    if (oldSigs[oldStart + i] === newSigs[newStart + j]) {
      pairs.push([oldStart + i, newStart + j])
      i++
      j++
    }
    else if (lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) {
      i++
    }
    else {
      j++
    }
  }
  return pairs
}
