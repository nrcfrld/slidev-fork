import type { CameraKeyframe } from '@slidev/types'

export interface CameraView {
  zoom: number
  /**
   * Point at the center of the view, in slide pixels
   */
  x: number
  y: number
}

export interface CameraTransform {
  zoom: number
  translateX: number
  translateY: number
}

/**
 * Keyframes with their click resolved: a missing `at` follows the previous keyframe
 */
export function normalizeKeyframes(keyframes: CameraKeyframe[]): (CameraKeyframe & { at: number })[] {
  let previous = 0
  return keyframes.map((keyframe) => {
    const at = keyframe.at ?? previous + 1
    previous = at
    return { ...keyframe, at }
  })
}

/**
 * The keyframe for a number of clicks: the last one at or before it, if any
 */
export function getActiveKeyframe<T extends { at: number }>(keyframes: T[], clicks: number): T | undefined {
  let active: T | undefined
  for (const keyframe of keyframes) {
    if (keyframe.at <= clicks && (!active || keyframe.at >= active.at))
      active = keyframe
  }
  return active
}

/**
 * A position given as a percentage of the slide (`'25%'`) or in pixels
 */
export function resolvePosition(value: number | string | undefined, size: number): number {
  if (value == null)
    return size / 2
  if (typeof value === 'string' && value.trim().endsWith('%'))
    return Number.parseFloat(value) / 100 * size
  return Number(value)
}

/**
 * A view that frames a box, leaving a margin around it
 */
export function fitBox(box: { x: number, y: number, width: number, height: number }, width: number, height: number, margin = 0.15): CameraView {
  return {
    zoom: Math.max(1, Math.min(width / (box.width * (1 + margin)), height / (box.height * (1 + margin)))),
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }
}

/**
 * Transform that shows a view, kept inside the slide so no empty edge shows
 */
export function getCameraTransform(view: CameraView, width: number, height: number): CameraTransform {
  const zoom = Math.max(view.zoom, 1)
  const clamp = (value: number, size: number) => Math.min(0, Math.max(size - zoom * size, value))
  return {
    zoom,
    translateX: clamp(width / 2 - zoom * view.x, width),
    translateY: clamp(height / 2 - zoom * view.y, height),
  }
}
