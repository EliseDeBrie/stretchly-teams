import 'chai/register-should'
import { describe, expect, it, vi } from 'vitest'
import createRunOnce from '../app/utils/runOnce.js'

describe('runOnce', () => {
  it('runs the wrapped action on the first call', async () => {
    const runOnce = createRunOnce()
    const action = vi.fn()
    await runOnce(action)()
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('ignores subsequent calls for the same guard', async () => {
    const runOnce = createRunOnce()
    const action = vi.fn()
    const handler = runOnce(action)
    await handler()
    await handler()
    await handler()
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('ignores calls to different actions once one has run', async () => {
    const runOnce = createRunOnce()
    const close = vi.fn()
    const postpone = vi.fn()
    await runOnce(close)()
    await runOnce(postpone)()
    expect(close).toHaveBeenCalledTimes(1)
    expect(postpone).not.toHaveBeenCalled()
  })

  it('blocks a concurrent second call while the first is awaiting', async () => {
    const runOnce = createRunOnce()
    let resolveAction
    const action = vi.fn(() => new Promise(resolve => { resolveAction = resolve }))
    const handler = runOnce(action)
    const first = handler()
    const second = handler()
    resolveAction()
    await Promise.all([first, second])
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('stays locked after the action rejects', async () => {
    const runOnce = createRunOnce()
    const failing = vi.fn(() => Promise.reject(new Error('boom')))
    const handler = runOnce(failing)
    await expect(handler()).rejects.toThrow('boom')
    await handler()
    expect(failing).toHaveBeenCalledTimes(1)
  })

  it('isolates state between separate guards', async () => {
    const runOnceA = createRunOnce()
    const runOnceB = createRunOnce()
    const actionA = vi.fn()
    const actionB = vi.fn()
    await runOnceA(actionA)()
    await runOnceB(actionB)()
    expect(actionA).toHaveBeenCalledTimes(1)
    expect(actionB).toHaveBeenCalledTimes(1)
  })
})
