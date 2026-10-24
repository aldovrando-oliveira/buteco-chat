import { describe, expect, it } from 'vitest'
import { isGuid, isTaskOrContextId } from './ids'

describe('isGuid', () => {
  it.each(['3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5f', '3A7D9F10-1B2C-4D5E-8F90-0A1B2C3D4E5F'])('aceita %s', (value) => {
    expect(isGuid(value)).toBe(true)
  })

  it.each([
    '../auth/login',
    'x/y',
    'x?y',
    '%2e%2e',
    '3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5f/',
    '3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5',
    '3a7d9f101b2c4d5e8f900a1b2c3d4e5f',
    '',
    42,
    null
  ])('recusa %s', (value) => {
    expect(isGuid(value)).toBe(false)
  })
})

describe('isTaskOrContextId', () => {
  it.each(['t-1', 'ctx.1:a_b', '3a7d9f10-1b2c-4d5e-8f90-0a1b2c3d4e5f', 'a'.repeat(128)])('aceita %s', (value) => {
    expect(isTaskOrContextId(value)).toBe(true)
  })

  it.each(['', 'a'.repeat(129), 'a/b', 'a b', 'a?b', 'a%2f', 'ação', '../x/y', 1, undefined])('recusa %s', (value) => {
    expect(isTaskOrContextId(value)).toBe(false)
  })
})
