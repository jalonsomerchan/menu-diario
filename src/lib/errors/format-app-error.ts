export type ErrorLabels = Record<string, string>;

type ErrorLabelFallback = {
  key: string;
  aliases: string[];
};

const technicalErrorMap: Record<string, string> = {
  'Firebase public config is missing. Check .env.example.': 'errors.firebaseMissingConfig',
  'Firebase App Check is required for AI requests but is not ready.': 'errors.appCheckUnavailable',
  'group-not-found': 'errors.groupNotFound',
  'invite-not-found': 'errors.inviteNotFound',
  'dish-invalid-name': 'errors.dishInvalidName',
  'dish-duplicate': 'errors.dishDuplicate',
  'dish-duplicate-global': 'errors.dishDuplicateGlobal',
  'dish-not-editable': 'errors.dishNotEditable',
  'dish-not-global': 'errors.dishNotEditable',
  'permission-denied': 'errors.permissionDenied',
  unavailable: 'errors.unavailable',
};

const fallbackLabels: ErrorLabelFallback[] = [
  { key: 'errors.firebaseMissingConfig', aliases: ['firebaseMissing', 'configMissing'] },
  { key: 'errors.appCheckUnavailable', aliases: ['aiAppCheck', 'appCheckUnavailable'] },
  { key: 'errors.groupNotFound', aliases: ['notFoundMenu', 'notFound', 'configMissing'] },
  { key: 'errors.inviteNotFound', aliases: ['joinError', 'configMissing'] },
  { key: 'errors.dishInvalidName', aliases: ['invalid'] },
  { key: 'errors.dishDuplicate', aliases: ['duplicate'] },
  { key: 'errors.dishDuplicateGlobal', aliases: ['duplicateGlobal'] },
  { key: 'errors.dishNotEditable', aliases: ['notEditable'] },
  { key: 'errors.permissionDenied', aliases: ['permissionsError'] },
  { key: 'errors.unavailable', aliases: ['genericError', 'configMissing'] },
  { key: 'errors.generic', aliases: ['genericError', 'configMissing'] },
];

function extractErrorCode(error: unknown) {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return '';

  const candidate = error as { code?: unknown; message?: unknown };
  return String(candidate.code || candidate.message || '');
}

function findLabel(labels: ErrorLabels, key: string) {
  const direct = labels[key];
  if (direct) return direct;

  const fallback = fallbackLabels.find((item) => item.key === key);
  return fallback?.aliases.map((alias) => labels[alias]).find(Boolean);
}

export function getAppErrorKey(error: unknown) {
  const code = extractErrorCode(error);
  if (!code) return 'errors.generic';

  const normalizedCode = code.replace(/^firebase\//, '');
  if (code.toLowerCase().includes('permission')) return 'errors.permissionDenied';

  return technicalErrorMap[code] || technicalErrorMap[normalizedCode] || 'errors.generic';
}

export function formatAppError(error: unknown, labels: ErrorLabels) {
  const key = getAppErrorKey(error);
  return findLabel(labels, key) || findLabel(labels, 'errors.generic') || 'No se ha podido completar la acción.';
}
