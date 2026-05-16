import { normalizeDishName, normalizeStringList } from './helpers.mjs';

function toLines(input = '') {
  return String(input)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mapRawEntry(entry) {
  if (typeof entry === 'string') {
    return {
      name: entry,
      tags: [],
      quickTags: [],
      archived: false,
    };
  }

  return {
    name: String(entry?.name ?? ''),
    tags: normalizeStringList(entry?.tags),
    quickTags: normalizeStringList(entry?.quickTags),
    archived: Boolean(entry?.archived),
  };
}

function parseLineEntry(line) {
  return mapRawEntry(line);
}

function parseCsvEntry(line, delimiter) {
  const [name = '', tags = '', quickTags = '', archived = ''] = line.split(delimiter).map((item) => item.trim());
  return mapRawEntry({
    name,
    tags: tags.split('|'),
    quickTags: quickTags.split('|'),
    archived: archived === '1' || archived.toLowerCase() === 'true' || archived.toLowerCase() === 'yes',
  });
}

export function parseGlobalDishImport(input, format = 'text') {
  if (format === 'json') {
    const parsed = JSON.parse(input);
    const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
    return entries.map(mapRawEntry).filter((entry) => normalizeDishName(entry.name).length >= 2);
  }

  if (format === 'csv') {
    const lines = toLines(input);
    const delimiter = lines[0]?.includes(';') ? ';' : ',';
    const content = lines[0]?.toLowerCase().startsWith('name') ? lines.slice(1) : lines;
    return content.map((line) => parseCsvEntry(line, delimiter)).filter((entry) => normalizeDishName(entry.name).length >= 2);
  }

  return toLines(input).map(parseLineEntry).filter((entry) => normalizeDishName(entry.name).length >= 2);
}

export function buildGlobalDishImportPreview(entries, existingDishes, strategy = 'skip') {
  const existingByNormalized = new Map(existingDishes.map((dish) => [dish.normalizedName, dish]));
  const seen = new Set();

  const items = entries.map((entry) => {
    const cleanName = entry.name.trim().replace(/\s+/g, ' ');
    const normalizedName = normalizeDishName(cleanName);
    const duplicate = existingByNormalized.get(normalizedName);
    const repeatedInImport = seen.has(normalizedName);
    seen.add(normalizedName);

    let action = 'create';
    if (repeatedInImport || (duplicate && strategy === 'manual')) action = 'review';
    else if (duplicate && strategy === 'skip') action = 'skip';
    else if (duplicate && strategy === 'update-tags') action = 'update';

    return {
      ...entry,
      name: cleanName,
      normalizedName,
      duplicate,
      repeatedInImport,
      action,
    };
  });

  return {
    items,
    canImport: items.length > 0 && items.every((item) => item.action !== 'review'),
  };
}
