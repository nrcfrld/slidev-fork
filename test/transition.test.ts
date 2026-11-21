import { describe, expect, it } from 'vitest'
import { getTransitionStyle, parseTransitionString, toMilliseconds } from '../packages/client/logic/transitionOptions'

describe('parseTransitionString', () => {
  it('reads a plain name', () => {
    expect(parseTransitionString('fade')).toEqual({ name: 'fade' })
  })

  it('reads a duration and an easing after the name', () => {
    expect(parseTransitionString('zoom-in 800ms expo')).toEqual({ name: 'zoom-in', duration: '800ms', easing: 'expo' })
    expect(parseTransitionString('blur 1.2s')).toEqual({ name: 'blur', duration: '1.2s' })
    expect(parseTransitionString('rise ease-in-out')).toEqual({ name: 'rise', easing: 'ease-in-out' })
    expect(parseTransitionString('rise cubic-bezier(0.2,0,0,1) 600ms')).toEqual({ name: 'rise', duration: '600ms', easing: 'cubic-bezier(0.2,0,0,1)' })
  })

  it('keeps forward and backward pairs as the name', () => {
    expect(parseTransitionString('slide-left | fade 400ms')).toEqual({ name: 'slide-left | fade', duration: '400ms' })
  })

  it('does not treat a lone easing-like name as an easing', () => {
    expect(parseTransitionString('linear')).toEqual({ name: 'linear' })
  })
})

describe('getTransitionStyle', () => {
  it('sets the CSS variables', () => {
    expect(getTransitionStyle({ name: 'x', duration: '1.2s', easing: 'smooth' })).toEqual({
      '--slidev-transition-duration': '1200ms',
      '--slidev-transition-easing': 'cubic-bezier(0.65, 0, 0.35, 1)',
    })
    expect(getTransitionStyle({ name: 'x', duration: 300 })).toEqual({ '--slidev-transition-duration': '300ms' })
    expect(getTransitionStyle({
      name: 'x',
      duration: { enter: 300, leave: 500 },
    })).toEqual({ '--slidev-transition-duration': '500ms' })
    expect(getTransitionStyle({ name: 'x', easing: 'linear' })).toEqual({ '--slidev-transition-easing': 'linear' })
  })

  it('returns nothing without timing', () => {
    expect(getTransitionStyle({ name: 'x' })).toBeUndefined()
  })
})

it('toMilliseconds', () => {
  expect(toMilliseconds('2s')).toBe(2000)
  expect(toMilliseconds('250ms')).toBe(250)
  expect(toMilliseconds(100)).toBe(100)
  expect(toMilliseconds('fast')).toBeUndefined()
})
