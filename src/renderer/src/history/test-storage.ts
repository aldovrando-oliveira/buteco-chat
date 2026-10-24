/**
 * `Storage` em memória para os testes, com cota em caracteres (chaves + valores) e falhas configuráveis. Lança
 * `QuotaExceededError` como o Chromium.
 */
export class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>()
  /** Total de caracteres (chaves + valores) aceito; `Infinity` sem limite. */
  quota = Infinity
  /** Falha de `getItem`/`setItem` com um erro qualquer (armazenamento indisponível). */
  broken = false
  setItemCalls: { key: string; value: string }[] = []

  get length(): number {
    return this.items.size
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    if (this.broken) throw new Error('indisponível')
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.broken) throw new Error('indisponível')
    this.setItemCalls.push({ key, value })
    const previous = this.items.get(key)
    const size = this.used() - (previous === undefined ? 0 : key.length + previous.length) + key.length + value.length
    if (size > this.quota) throw new DOMException('cheio', 'QuotaExceededError')
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }

  clear(): void {
    this.items.clear()
  }

  used(): number {
    let total = 0
    for (const [key, value] of this.items) total += key.length + value.length
    return total
  }
}
