import { describe, expect, it } from 'vitest'
import { matchSlides } from './matchSlides'

describe('matchSlides', () => {
  it('keeps every slide when nothing changed', () => {
    expect(matchSlides(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([0, 1, 2])
  })

  it('treats a changed slide as an edit of the slide in its place', () => {
    expect(matchSlides(['a', 'b', 'c'], ['a', 'B', 'c'])).toEqual([0, 1, 2])
  })

  it('follows slides after an insert', () => {
    expect(matchSlides(['a', 'b', 'c'], ['x', 'a', 'b', 'c'])).toEqual([-1, 0, 1, 2])
    expect(matchSlides(['a', 'b', 'c'], ['a', 'x', 'b', 'c'])).toEqual([0, -1, 1, 2])
    expect(matchSlides(['a', 'b', 'c'], ['a', 'b', 'c', 'x'])).toEqual([0, 1, 2, -1])
  })

  it('follows slides after a removal', () => {
    expect(matchSlides(['a', 'b', 'c', 'd'], ['a', 'c', 'd'])).toEqual([0, 2, 3])
    expect(matchSlides(['a', 'b', 'c'], ['b', 'c'])).toEqual([1, 2])
  })

  it('follows a moved slide', () => {
    expect(matchSlides(['a', 'b', 'c', 'd'], ['a', 'c', 'd', 'b'])).toEqual([0, 2, 3, 1])
  })

  it('pairs an edit next to an insert by position', () => {
    // b was edited to B, and x inserted after it
    expect(matchSlides(['a', 'b', 'c'], ['a', 'B', 'x', 'c'])).toEqual([0, 1, -1, 2])
  })

  it('handles duplicate slides', () => {
    expect(matchSlides(['a', 'a', 'b'], ['a', 'a', 'a', 'b'])).toEqual([0, 1, -1, 2])
  })

  it('handles empty decks', () => {
    expect(matchSlides([], ['a'])).toEqual([-1])
    expect(matchSlides(['a'], [])).toEqual([])
  })

  it('stays fast for a large edit', () => {
    const old = Array.from({ length: 2000 }, (_, i) => `s${i}`)
    const next = old.toReversed()
    const start = performance.now()
    const result = matchSlides(old, next)
    expect(performance.now() - start).toBeLessThan(1000)
    // Every slide is kept, either by alignment or paired by position
    expect(result.every(i => i >= 0)).toBe(true)
    expect(new Set(result).size).toBe(2000)
  })
})
