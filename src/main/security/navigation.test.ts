import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  classifyExternalUrl,
  handleWillNavigate,
  handleWindowOpen,
  installNavigationGuards,
  isDevServerNavigation,
  type NavigationPolicy
} from './navigation'

const DEV_ORIGIN = 'http://localhost:5173'

function policy(overrides: Partial<NavigationPolicy> = {}): NavigationPolicy {
  return { isPackaged: true, devOrigin: null, openExternal: vi.fn(), ...overrides }
}

function navigationEvent(url: string) {
  return { url, preventDefault: vi.fn() }
}

describe('classifyExternalUrl', () => {
  it.each(['https://exemplo.com/pagina', 'http://exemplo.com'])('abre fora do app: %s', (url) => {
    expect(classifyExternalUrl(url)).toBe('open-external')
  })

  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,<p>oi</p>',
    'buteco://qualquer',
    'não é url',
    ''
  ])('descarta: %s', (url) => {
    expect(classifyExternalUrl(url)).toBe('discard')
  })
})

describe('handleWillNavigate', () => {
  it('cancela http(s) e envia a openExternal uma vez', () => {
    const event = navigationEvent('https://exemplo.com/pagina')
    const p = policy()

    handleWillNavigate(event, p)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(p.openExternal).toHaveBeenCalledOnce()
    expect(p.openExternal).toHaveBeenCalledWith('https://exemplo.com/pagina')
  })

  it.each(['file:///etc/passwd', 'javascript:alert(1)', 'buteco://qualquer', '::malformada'])(
    'cancela sem openExternal: %s',
    (url) => {
      const event = navigationEvent(url)
      const p = policy()

      handleWillNavigate(event, p)

      expect(event.preventDefault).toHaveBeenCalledOnce()
      expect(p.openExternal).not.toHaveBeenCalled()
    }
  )

  describe('exceção só em dev', () => {
    it('em dev, navegação para a origem do dev server segue e não chama openExternal', () => {
      const event = navigationEvent('http://localhost:5173/')
      const p = policy({ isPackaged: false, devOrigin: DEV_ORIGIN })

      handleWillNavigate(event, p)

      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(p.openExternal).not.toHaveBeenCalled()
    })

    it.each(['http://localhost:5017/', 'https://exemplo.com/', 'http://127.0.0.1:5173/'])(
      'em dev, navegação para outra origem segue a política normal: %s',
      (url) => {
        const event = navigationEvent(url)
        const p = policy({ isPackaged: false, devOrigin: DEV_ORIGIN })

        handleWillNavigate(event, p)

        expect(event.preventDefault).toHaveBeenCalledOnce()
        expect(p.openExternal).toHaveBeenCalledWith(url)
      }
    )

    it('empacotado, a origem do dev server informada não abre exceção', () => {
      const event = navigationEvent('http://localhost:5173/')
      const p = policy({ isPackaged: true, devOrigin: DEV_ORIGIN })

      handleWillNavigate(event, p)

      expect(event.preventDefault).toHaveBeenCalledOnce()
    })
  })
})

describe('isDevServerNavigation', () => {
  it('vale em dev para a origem exata', () => {
    expect(isDevServerNavigation('http://localhost:5173/qualquer#x', false, DEV_ORIGIN)).toBe(true)
  })

  it('não vale para outra porta, host ou esquema', () => {
    expect(isDevServerNavigation('http://localhost:5017/', false, DEV_ORIGIN)).toBe(false)
    expect(isDevServerNavigation('http://127.0.0.1:5173/', false, DEV_ORIGIN)).toBe(false)
    expect(isDevServerNavigation('https://localhost:5173/', false, DEV_ORIGIN)).toBe(false)
  })

  it('nunca vale empacotado, nem sem origem de dev', () => {
    expect(isDevServerNavigation('http://localhost:5173/', true, DEV_ORIGIN)).toBe(false)
    expect(isDevServerNavigation('http://localhost:5173/', false, null)).toBe(false)
  })

  it('não vale para URL malformada', () => {
    expect(isDevServerNavigation('::', false, DEV_ORIGIN)).toBe(false)
  })
})

describe('handleWindowOpen', () => {
  it('nega sempre e envia http(s) a openExternal', () => {
    const openExternal = vi.fn()

    expect(handleWindowOpen({ url: 'https://exemplo.com/' }, openExternal)).toEqual({ action: 'deny' })
    expect(openExternal).toHaveBeenCalledWith('https://exemplo.com/')
  })

  it('nega outros esquemas sem openExternal', () => {
    const openExternal = vi.fn()

    expect(handleWindowOpen({ url: 'file:///tmp/x' }, openExternal)).toEqual({ action: 'deny' })
    expect(openExternal).not.toHaveBeenCalled()
  })
})

describe('installNavigationGuards', () => {
  function fakeContents() {
    const listeners = new Map<string, (event: { url?: string; preventDefault(): void }) => void>()
    let windowOpenHandler: ((details: { url: string }) => { action: string }) | undefined
    const contents = {
      on: vi.fn((name: string, listener: (event: { preventDefault(): void }) => void) => {
        listeners.set(name, listener)
      }),
      setWindowOpenHandler: vi.fn((handler: (details: { url: string }) => { action: string }) => {
        windowOpenHandler = handler
      })
    }
    return { contents: contents as unknown as WebContents, listeners, windowOpen: () => windowOpenHandler }
  }

  it('liga will-navigate, window.open e will-attach-webview', () => {
    const fake = fakeContents()
    const p = policy()

    installNavigationGuards(fake.contents, p)

    const navigate = navigationEvent('https://exemplo.com/')
    fake.listeners.get('will-navigate')?.(navigate)
    expect(navigate.preventDefault).toHaveBeenCalledOnce()
    expect(p.openExternal).toHaveBeenCalledWith('https://exemplo.com/')

    expect(fake.windowOpen()?.({ url: 'file:///tmp/x' })).toEqual({ action: 'deny' })

    const webview = { preventDefault: vi.fn() }
    fake.listeners.get('will-attach-webview')?.(webview)
    expect(webview.preventDefault).toHaveBeenCalledOnce()
  })
})
