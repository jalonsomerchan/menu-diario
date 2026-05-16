const basePath = import.meta.env.BASE_URL || '/';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${basePath}sw.js`, { scope: basePath })
      .catch((error) => console.warn('[pwa]', 'service-worker', { error: error instanceof Error ? error.name : 'unknown' }));
  });
}
