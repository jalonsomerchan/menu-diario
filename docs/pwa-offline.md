# PWA y modo offline

Menu Diario incluye una PWA ligera pensada para móvil, instalación básica y consulta del último menú aunque la conexión sea mala.

## Instalación y metadatos móviles

La app expone `manifest.webmanifest` desde Astro para respetar `BASE_URL`, dominio raíz, subrutas y GitHub Pages. El manifest define:

- `start_url`, `scope` e `id` usando el `base` real.
- `display: standalone` y orientación vertical.
- `theme_color`, `background_color`, iconos SVG y accesos rápidos a dashboard y configurador.

`BaseLayout.astro` añade los metadatos móviles y Apple necesarios para que la instalación sea más consistente en navegadores móviles compatibles.

## Service worker

`src/pages/sw.js.ts` genera un service worker en `/sw.js` o en la subruta correspondiente cuando se despliega con `base`. La estrategia es pequeña y sin dependencias:

- Precache de rutas principales, manifest e iconos.
- Cache de navegación con network-first y fallback a caché.
- Cache de assets GET del mismo origen y dentro de `BASE_URL`.
- Limpieza de cachés antiguas por versión.

El registro vive en `src/scripts/pwa-register.ts` y usa `import.meta.env.BASE_URL` como `scope`, por lo que funciona tanto en `/` como en `/menu-diario/`.

## Último menú sin conexión

El dashboard guarda en `localStorage` una copia versionada del último menú cargado correctamente. La copia incluye solo datos necesarios para consulta:

- `userId` y `menuId`.
- `WeekMenu` mostrado.
- Preferencias mínimas del perfil: nombre, comidas activas y tema.
- Fecha `savedAt` de guardado.

El helper principal está en `src/lib/pwa/offline-cache.ts` y usa claves con versión para poder invalidar estructuras antiguas.

## Estado offline visible

`DashboardApp.astro` muestra un aviso accesible con `role="status"` y `aria-live="polite"`. Los textos están en `src/i18n/translations/*.json` bajo claves `pwa.*`.

Cuando no hay conexión:

- Si existe caché local, se muestra el último menú guardado.
- Si no existe caché local, se muestra un error claro.
- Los botones de edición y borrado quedan desactivados.
- Si el usuario intenta editar desde un modal abierto, la acción se bloquea y se muestra el aviso traducido.

## Edición offline

En esta fase no se permite editar offline. La app queda en modo solo lectura para evitar conflictos silenciosos al recuperar conexión y descubrir que Firestore tiene cambios remotos.

No se implementa cola de cambios local todavía. Si más adelante se añade, debe incluir:

- Cola versionada con operaciones pequeñas.
- Comparación de `updatedAt`/`updatedBy` antes de aplicar cambios.
- Aviso visible de sincronización pendiente.
- Resolución explícita cuando haya cambios remotos incompatibles.

## Límites reales

La caché offline vive en el navegador del usuario. No debe considerarse copia de seguridad ni fuente de verdad. Firestore sigue siendo el origen principal cuando vuelve la conexión.

El service worker solo cachea contenido del mismo origen y dentro de `BASE_URL`; no intenta cachear llamadas externas del SDK de Firebase ni datos privados de Firestore fuera del almacenamiento local versionado.

## Comprobación manual

1. Ejecuta `npm run build` y `npm run preview`.
2. Abre la app, inicia sesión y carga el dashboard.
3. Comprueba en DevTools que `sw.js` está registrado.
4. Activa modo offline en DevTools.
5. Recarga el dashboard: debe aparecer el último menú guardado en solo lectura.
6. Vuelve a online: debe mostrarse el aviso de conexión recuperada y volver a sincronizar desde Firestore.
