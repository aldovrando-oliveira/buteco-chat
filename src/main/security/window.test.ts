import { describe, expect, it, vi } from 'vitest'

const created: { options: unknown; webContents: { on: ReturnType<typeof vi.fn> }; once: ReturnType<typeof vi.fn> }[] = []

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(function (this: (typeof created)[number], options: unknown) {
    this.options = options
    this.webContents = { on: vi.fn() }
    this.once = vi.fn()
    created.push(this)
  }),
  nativeTheme: { shouldUseDarkColors: true }
}))

const { createMainWindow, secureWebPreferences, windowBackgroundColor } = await import('./window')

describe('secureWebPreferences', () => {
  it('isola o renderer e carrega só o preload do app', () => {
    expect(secureWebPreferences('/app/out/preload/index.js')).toEqual({
      preload: '/app/out/preload/index.js',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    })
  })
})

describe('windowBackgroundColor', () => {
  it('usa o fundo da página de cada esquema', () => {
    expect(windowBackgroundColor(true)).toBe('#121316')
    expect(windowBackgroundColor(false)).toBe('#f6f5f3')
  })
})

describe('createMainWindow', () => {
  it('cria a janela oculta, com o fundo do esquema e preferências seguras, e liga o console dela ao stdout', () => {
    createMainWindow('/app/out/preload/index.js')
    const window = created.at(-1)!

    expect(window.options).toMatchObject({
      show: false,
      backgroundColor: '#121316',
      webPreferences: secureWebPreferences('/app/out/preload/index.js')
    })
    expect(window.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function))
    expect(window.webContents.on).toHaveBeenCalledWith('console-message', expect.any(Function))
  })

  it('tem tamanho mínimo de 720×600 (barra-de-status-e-marca, D9)', () => {
    createMainWindow('/app/out/preload/index.js')

    expect(created.at(-1)!.options).toMatchObject({ minWidth: 720, minHeight: 600 })
  })

  it('sem ícone, não passa `icon` ao BrowserWindow', () => {
    createMainWindow('/app/out/preload/index.js')

    expect(created.at(-1)!.options).not.toHaveProperty('icon')
  })

  it('com ícone (dev), passa o caminho como `icon`', () => {
    createMainWindow('/app/out/preload/index.js', { icon: '/app/build/icon.png' })

    expect(created.at(-1)!.options).toMatchObject({ icon: '/app/build/icon.png' })
  })
})
