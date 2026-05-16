# Checklist rápida para IA

Usa esta lista antes de terminar cualquier tarea en este template.

## 1. Antes de tocar código

- Lee `agents.md`.
- Lee `docs/template-usage.md`.
- Si hay textos o idiomas, lee `docs/i18n-guide.md`.
- Si hay rutas, assets o deploy, lee `docs/github-pages.md`.
- Si hay estructura o configuración, lee `docs/testing-guide.md`.
- Si hay diseño, componentes o CSS, lee `docs/design-system.md`.
- Si hay Firebase, Firestore, App Check o Firebase AI Logic, lee `docs/firebase.md` y `docs/app-check.md`.

## 2. Arquitectura

- ¿El cambio mantiene el template reutilizable?
- ¿Evita convertir la plantilla en un proyecto demasiado concreto?
- ¿Reutiliza `BaseLayout.astro` cuando corresponde?
- ¿Reutiliza componentes existentes antes de crear nuevos?
- ¿Evita dependencias innecesarias?

## 3. i18n

- ¿Los textos visibles de UI están en JSON?
- ¿Se añadieron las claves en todos los idiomas?
- ¿Los JSON mantienen las mismas claves?
- ¿Se usa `useTranslations(locale)`?
- ¿Las rutas internas usan `getLocalizedPath(path, locale)` cuando corresponde?

## 4. GitHub Pages

- ¿No hay rutas absolutas problemáticas como `/favicon.svg` o `/en/` en componentes compartidos?
- ¿Los assets manuales respetan `import.meta.env.BASE_URL`?
- ¿La web sigue pudiendo vivir en `/nombre-repo/`?
- ¿`robots.txt` y `manifest.webmanifest` siguen siendo dinámicos?

## 5. SEO y accesibilidad

- ¿La página tiene un único `h1`?
- ¿El título y la description son correctos?
- ¿El HTML es semántico?
- ¿Los enlaces y botones tienen propósito claro?
- ¿Hay buen contraste?
- ¿Los estados focus son visibles?

## 6. Diseño

- ¿Es mobile first?
- ¿Respeta `docs/design-system.md`?
- ¿Funciona en light y dark mode si el componente lo requiere?
- ¿Usa system fonts?
- ¿Evita animaciones o JS innecesarios?

## 7. Firebase, App Check e IA

- ¿Las variables nuevas viven en `.env.example` sin secretos?
- ¿App Check se inicializa antes de usar Firestore, Auth o Firebase AI Logic cuando aplica?
- ¿La IA sigue detrás de feature flags y con límites básicos de cliente?
- ¿Los errores de App Check/Firebase AI tienen estados traducibles?
- ¿La nueva función reutiliza `src/lib/ai/` en lugar de crear otra integración paralela?
- ¿El prompt evita emails, UID, miembros del grupo, códigos de invitación y notas sensibles innecesarias?
- ¿La documentación explica localhost, GitHub Pages, dominio propio, activación gradual y depuración?

## 8. Tests y documentación

- ¿Hace falta actualizar `tests/smoke.test.mjs` o añadir checks estáticos?
- ¿Hace falta actualizar README?
- ¿Hace falta actualizar algún documento de `docs/`?
- ¿Los workflows siguen ejecutando `npm test` y `npm run build`?

## 9. Comandos recomendados

```sh
npm test
npm run build
```

Si también se tocó formato:

```sh
npm run format:check
```

## 10. Errores comunes que debes evitar

- Añadir texto solo en español en componentes compartidos.
- Crear rutas que funcionan en local pero fallan en GitHub Pages.
- Añadir una dependencia para algo que se resuelve con HTML/CSS/Astro.
- Borrar tests porque fallan.
- Duplicar páginas por idioma sin necesidad.
- Cambiar `base` o `site` sin revisar el despliegue.
- Meter fuentes externas.
- Meter JavaScript de cliente sin necesidad real.
- Activar App Check enforcement o IA en producción sin fase de monitorización.
