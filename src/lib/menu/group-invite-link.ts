export const groupInviteQueryParam = 'groupInvite';
export const groupInviteStorageKey = 'menu-diario-group-invite';

export function normalizeGroupInviteCode(value = '') {
  return value.trim().toUpperCase();
}

export function readGroupInviteCode(search = '') {
  const params = new URLSearchParams(search);
  return normalizeGroupInviteCode(params.get(groupInviteQueryParam) ?? '');
}

export function buildGroupInvitePath(settingsPath: string, inviteCode: string) {
  const normalizedCode = normalizeGroupInviteCode(inviteCode);
  const url = new URL(settingsPath, 'https://menu-diario.local');
  if (normalizedCode) {
    url.searchParams.set(groupInviteQueryParam, normalizedCode);
  } else {
    url.searchParams.delete(groupInviteQueryParam);
  }
  return `${url.pathname}${url.search}`;
}

export function buildGroupInviteUrl(origin: string, settingsPath: string, inviteCode: string) {
  return new URL(buildGroupInvitePath(settingsPath, inviteCode), origin).toString();
}
