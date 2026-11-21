import { describe, expect, it } from 'vitest'
import { fitBox, getActiveKeyframe, getCameraTransform, normalizeKeyframes, resolvePosition } from '../packages/client/logic/camera'

describe('camera', () => {
  it('numbers keyframes without `at` after the previous one', () => {
    expect(normalizeKeyframes([
      {},
      { at: 3 },
      {},
    ]).map(k => k.at)).toEqual([1, 3, 4])
  })

  it('picks the last keyframe at or before the clicks', () => {
    const keyframes = normalizeKeyframes([
      { zoom: 2 },
      { at: 3, zoom: 3 },
    ])
    expect(getActiveKeyframe(keyframes, 0)).toBeUndefined()
    expect(getActiveKeyframe(keyframes, 1)?.zoom).toBe(2)
    expect(getActiveKeyframe(keyframes, 2)?.zoom).toBe(2)
    expect(getActiveKeyframe(keyframes, 5)?.zoom).toBe(3)
  })

  it('resolves positions in pixels or percent', () => {
    expect(resolvePosition('25%', 800)).toBe(200)
    expect(resolvePosition(120, 800)).toBe(120)
    expect(resolvePosition(undefined, 800)).toBe(400)
  })

  it('frames a box with a margin', () => {
    const view = fitBox({
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    }, 1000, 500)
    expect(view.x).toBe(200)
    expect(view.y).toBe(150)
    expect(view.zoom).toBeCloseTo(500 / 115)
  })

  it('never zooms out past the whole slide', () => {
    expect(fitBox({
      x: 0,
      y: 0,
      width: 2000,
      height: 1000,
    }, 1000, 500).zoom).toBe(1)
  })

  it('centers the view, kept inside the slide', () => {
    expect(getCameraTransform({ zoom: 2, x: 500, y: 250 }, 1000, 500)).toEqual({ zoom: 2, translateX: -500, translateY: -250 })
    // A corner would show empty space past the edge, so it is clamped
    expect(getCameraTransform({ zoom: 2, x: 0, y: 0 }, 1000, 500)).toEqual({ zoom: 2, translateX: 0, translateY: 0 })
    expect(getCameraTransform({ zoom: 2, x: 1000, y: 500 }, 1000, 500)).toEqual({ zoom: 2, translateX: -1000, translateY: -500 })
    expect(getCameraTransform({ zoom: 1, x: 500, y: 250 }, 1000, 500)).toEqual({ zoom: 1, translateX: 0, translateY: 0 })
  })
})
