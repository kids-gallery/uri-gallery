import { describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'

describe('웹 골격(T004)', () => {
  it('앱이 마운트되고 첫 화면이 그려진다', async () => {
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [createPinia(), router] } })
    await flushPromises()
    expect(wrapper.find('h1').text()).toBe('우리 아이 미술관')
  })
})
