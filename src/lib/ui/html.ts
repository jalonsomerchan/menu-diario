const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

export function escapeHtml(value = '') {
  return value.replace(/[&<>\"]/g, (character) => htmlEscapes[character] ?? character);
}
