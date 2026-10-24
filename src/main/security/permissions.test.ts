import { describe, expect, it, vi } from 'vitest'
import { denyAllPermissions } from './permissions'

describe('denyAllPermissions', () => {
  it('nega pedidos e verificações de permissão', () => {
    let requestHandler: ((...args: unknown[]) => void) | null = null
    let checkHandler: ((...args: unknown[]) => boolean) | null = null
    const session = {
      setPermissionRequestHandler: vi.fn((handler) => {
        requestHandler = handler
      }),
      setPermissionCheckHandler: vi.fn((handler) => {
        checkHandler = handler
      })
    }

    denyAllPermissions(session)

    for (const permission of ['notifications', 'media', 'geolocation', 'clipboard-read', 'clipboard-sanitized-write']) {
      const callback = vi.fn()
      requestHandler!({}, permission, callback, {})
      expect(callback).toHaveBeenCalledWith(false)
      expect(checkHandler!({}, permission, 'file://', {})).toBe(false)
    }
  })
})
