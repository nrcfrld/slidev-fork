/**
 * Runs in the page before any of its scripts: replaces the clock, timers and
 * animation frames with a virtual time that only moves when the video exporter
 * advances it, so every frame of the video can be rendered, however slowly.
 *
 * CSS transitions and animations (view transitions included) run on the
 * browser's own clock, so they are paused and seeked to the virtual time.
 *
 * Must stay self-contained: it is serialized into the page.
 */
export function installVirtualClock() {
  interface Timer {
    fn: TimerHandler
    args: unknown[]
    at: number
    interval?: number
  }

  let now = 0
  const baseDate = Date.now()
  const timers = new Map<number, Timer>()
  const frameCallbacks = new Map<number, FrameRequestCallback>()
  let nextId = 1

  function addTimer(fn: TimerHandler, ms: number | undefined, args: unknown[], repeat: boolean) {
    const id = nextId++
    const delay = Math.max(0, Number(ms) || 0)
    timers.set(id, {
      fn,
      args,
      at: now + delay,
      interval: repeat
        ? Math.max(1, delay)
        : undefined,
    })
    return id
  }

  const w = window as any
  w.setTimeout = (fn: TimerHandler, ms?: number, ...args: unknown[]) => addTimer(fn, ms, args, false)
  w.setInterval = (fn: TimerHandler, ms?: number, ...args: unknown[]) => addTimer(fn, ms, args, true)
  w.clearTimeout = (id: number) => timers.delete(id)
  w.clearInterval = (id: number) => timers.delete(id)
  w.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = nextId++
    frameCallbacks.set(id, cb)
    return id
  }
  w.cancelAnimationFrame = (id: number) => frameCallbacks.delete(id)
  performance.now = () => now
  Date.now = () => baseDate + now

  function run(fn: TimerHandler, args: unknown[]) {
    try {
      if (typeof fn === 'function')
        fn(...args)
      else
        // eslint-disable-next-line no-new-func
        new Function(fn)()
    }
    catch (e) {
      console.error(e)
    }
  }

  // Virtual time at which each animation started
  const started = new WeakMap<Animation, number>()

  function syncAnimations() {
    for (const animation of document.getAnimations()) {
      if (!started.has(animation)) {
        started.set(animation, now - (Number(animation.currentTime) || 0))
        animation.pause()
      }
      const time = now - started.get(animation)!
      const end = Number(animation.effect?.getComputedTiming().endTime)
      // Finishing fires the events (such as `transitionend`) that end Vue transitions
      if (Number.isFinite(end) && time >= end)
        animation.finish()
      else
        animation.currentTime = time
    }
  }

  const settle = () => new Promise<void>(resolve => queueMicrotask(resolve))

  w.__slidevVideoClock = {
    async advance(ms: number) {
      const target = now + ms
      // Run due timers in order, letting promises settle in between
      while (true) {
        let next: [number, Timer] | undefined
        for (const entry of timers) {
          if (entry[1].at <= target && (!next || entry[1].at < next[1].at))
            next = entry
        }
        if (!next)
          break
        const [id, timer] = next
        now = Math.max(now, timer.at)
        if (timer.interval)
          timer.at += timer.interval
        else
          timers.delete(id)
        run(timer.fn, timer.args)
        await settle()
      }
      now = target
      const callbacks = [
        ...frameCallbacks.values(),
      ]
      frameCallbacks.clear()
      for (const cb of callbacks)
        run(cb, [now])
      await settle()
      syncAnimations()
    },
  }
}
