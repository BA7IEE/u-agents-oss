// U-API: exercise the real React Hook state, including completion, without a DOM or a networked credential store.
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { createElement, useRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { LOCALE_REGISTRY } from '@u-agents/shared/i18n'
import { useOnboarding } from '../useOnboarding'

const language = createInstance()
await language.init({ lng: 'zh-Hans', resources: { 'zh-Hans': { translation: LOCALE_REGISTRY['zh-Hans'].messages } } })
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
afterEach(() => {
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

function submitEmpty(options: { editingSlug?: string; hasExistingCredentials?: boolean }, token = '') {
  const complete = mock(() => {})
  const rpc = mock(() => { throw new Error('An empty Token must not reach credential or connection RPCs') })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { electronAPI: new Proxy({}, { get: () => rpc }) },
  })
  let observed: ReturnType<typeof useOnboarding>['state'] | undefined
  function Harness() {
    const submitted = useRef(false)
    const onboarding = useOnboarding({ initialStep: 'credentials', onComplete: complete, ...options })
    observed = onboarding.state
    if (!submitted.current) {
      submitted.current = true
      void onboarding.handleSubmitCredential({ apiKey: token, baseUrl: 'https://token.u-studio.cn/v1' })
    }
    return createElement('output', { 'data-step': onboarding.state.step },
      onboarding.state.errorMessage ?? onboarding.state.completionStatus)
  }
  const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n: language }, createElement(Harness)))
  return { state: observed!, html, complete, rpc }
}

describe('empty U-API Token completion', () => {
  for (const options of [
    {},
    { editingSlug: 'u-api-default' },
    { editingSlug: 'u-api-2', hasExistingCredentials: false },
    { hasExistingCredentials: true },
  ]) {
    it(`rejects a missing credential for ${JSON.stringify(options)}`, () => {
      const result = submitEmpty(options, '   ')
      expect(result.state.step).toBe('credentials')
      expect(result.state.credentialStatus).toBe('error')
      expect(result.html).toContain('请输入你的 U-API Token。')
      expect(result.complete).not.toHaveBeenCalled()
      expect(result.rpc).not.toHaveBeenCalled()
    })
  }

  it('finishes an authenticated empty edit immediately without saving, probing or changing catalog/cap', () => {
    const result = submitEmpty({ editingSlug: 'u-api-2', hasExistingCredentials: true })
    expect(result.state).toMatchObject({ step: 'complete', credentialStatus: 'success', completionStatus: 'complete' })
    expect(result.html).toContain('complete')
    expect(result.complete).toHaveBeenCalledTimes(1)
    expect(result.rpc).not.toHaveBeenCalled()
  })
})
