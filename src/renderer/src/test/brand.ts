import { expect } from 'vitest'

/** Marca (barra-de-status-e-marca, D5): o `AppIcon` do tamanho pedido antes de "Buteco", sem balão de conversa. */
export function expectBrand(container: HTMLElement, size: number): void {
  const buteco = [...container.querySelectorAll('span')].find((span) => span.textContent === 'Buteco')!
  const group = buteco.closest('.mantine-Group-root')!
  const icon = group.firstElementChild!

  expect(icon.tagName.toLowerCase()).toBe('svg')
  expect(icon.getAttribute('width')).toBe(String(size))
  expect(icon.getAttribute('aria-hidden')).toBe('true')
  expect(icon.compareDocumentPosition(buteco) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(container.querySelector('.tabler-icon-message-circle')).toBeNull()
}

/** Nenhum `<img>` e nenhum atributo com `data:` (CSP, identidade-visual 'Ícone do app na interface'). */
export function expectNoImageNorDataUrl(container: HTMLElement): void {
  expect(container.querySelector('img')).toBeNull()
  for (const element of container.querySelectorAll('*')) {
    for (const attribute of element.attributes) expect(attribute.value, attribute.name).not.toMatch(/data:/i)
  }
}
