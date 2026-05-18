export type ErrorLabels = Record<string, string>;

const technicalErrorMap: Record<string, string> = {
  'Firebase public config is missing. Check .env.example.': 'errors.firebaseMissingConfig',
  'Firebase App Check is required for AI requests but is not ready.': 'errors.appCheckUnavailable',
  'group-not-found': 'errors.groupNotFound',
  'invite-not-found': 'errors.inviteNotFound',
  'dish-invalid-name': 'errors.dishInvalidName',
  'dish-duplicate': 'errors.dishDuplicate',
  'dish-duplicate-global': 'errors.dishDuplicateGlobal',
  'dish-not-editable': 'errors.dishNotEditable',
  'permission-denied': 'errors.permissionDenied',
  unavailable: 'errors.unavailable',
};

function extractErrorCode(error: unknown) {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return '';

  const candidate = error as { code?: unknown; message?: unknown };
  return String(candidate.code || candidate.message || '');
}

export function getAppErrorKey(error: unknown) {
  const code = extractErrorCode(error);
  if (!code) return 'errors.generic';

  const normalizedCode = code.replace(/^firebase\//, '');
  return technicalErrorMap[code] || technicalErrorMap[normalizedCode] || 'errors.generic';
}

export function formatAppError(error: unknown, labels: ErrorLabels) {
  const key = getAppErrorKey(error);
  return labels[key] || labels['errors.generic'] || 'No se ha podido completar la acción.';
}
