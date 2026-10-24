import type { Session } from 'electron'

/** Nenhuma permissão do Chromium é concedida ao renderer (design D8). */
export function denyAllPermissions(
  session: Pick<Session, 'setPermissionRequestHandler' | 'setPermissionCheckHandler'>
): void {
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.setPermissionCheckHandler(() => false)
}
