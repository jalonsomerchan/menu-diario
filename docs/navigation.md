# Navegación

## Header único

La app usa un único header principal reutilizable: `src/components/Header.astro`.

`BaseLayout.astro` es el único lugar que debe renderizar ese header principal. Las páginas públicas y privadas no deben añadir otro `<header>` de navegación ni volver a importar `AppHeader.astro` o equivalentes, para evitar landmarks duplicados y enlaces repetidos.

## Rutas y base path

Todos los enlaces internos del header deben generarse con `getLocalizedPath(path, locale)`. Esto mantiene compatibilidad con:

- dominio raíz `/`;
- subrutas como `/menu-diario/`;
- GitHub Pages;
- rutas localizadas como `/en/`.

Rutas principales actuales de la app autenticada:

- `/dashboard`: inicio privado del menú.
- `/configurar`: edición de próximos días.
- `/compra`: lista de la compra con IA, edición manual y exportación ligera.
- `/resumen-semanal`: resumen semanal con estadísticas, comparación histórica y recomendaciones básicas no-IA.
- `/tuppers`: gestión de tuppers.
- `/mis-platos`: catálogo de platos visibles.
- `/historico`: consulta y edición de menús anteriores.
- `/ajustes`: preferencias y grupo.

La ruta `/resumen-semanal` también existe localizada como `/{locale}/resumen-semanal`. La pantalla usa datos ya existentes de `weeklyMenus` y `dishes`; no añade campos nuevos a Firestore. Los cálculos viven en `src/lib/menu/weekly-stats.mjs` para mantenerlos testeables y preparados para integrarse con el recomendador inteligente y Mis platos.

## Comportamiento responsive

En escritorio, el header muestra la navegación principal directamente cuando hay espacio suficiente.

En móvil, el header usa un botón hamburguesa accesible con:

- `aria-expanded`;
- `aria-controls`;
- `aria-label` traducido;
- cierre con `Escape`;
- cierre al pulsar un enlace del menú.

El panel móvil respeta `safe-area-inset-top` y `safe-area-inset-bottom` para evitar problemas en móviles con notch o barras del sistema.

## Acciones de sesión y tema

El selector de tema vive en el header único. El botón de cerrar sesión se muestra solo cuando Firebase está configurado y hay usuario autenticado.

## Convención para futuras barras móviles

Si se añade una barra inferior móvil, debe complementar al header y no duplicar todos los enlaces principales. La navegación principal y las acciones globales siguen perteneciendo al header único.
