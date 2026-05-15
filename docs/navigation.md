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
