# Indice de archivos del proyecto

Este documento sirve como mapa rapido del repositorio. Debe actualizarse cuando se anadan, muevan, renombren o eliminen archivos relevantes.

No incluye artefactos locales o generados como `.env`, `.astro/`, `dist/`, `node_modules/` o `.DS_Store`.

## Raiz del repositorio

- `.env.example`: plantilla de variables de entorno publicas y privadas necesarias para desarrollo.
- `.gitignore`: ficheros y carpetas que no deben versionarse.
- `.nvmrc`: version de Node recomendada para el proyecto.
- `.prettierignore`: rutas excluidas del formateo con Prettier.
- `.prettierrc`: configuracion de Prettier.
- `README.md`: descripcion general del proyecto y primeros pasos.
- `agents.md`: reglas obligatorias para agentes IA y automatizaciones.
- `astro.config.mjs`: configuracion de Astro, integraciones, `site`, `base`, i18n y compatibilidad con GitHub Pages.
- `design-qa.md`: informe de QA visual del ultimo rediseño realizado con Product Design.
- `firestore.rules`: reglas de seguridad de Firestore.
- `package.json`: scripts, dependencias y metadatos del paquete.
- `package-lock.json`: bloqueo de versiones instaladas con npm.
- `tsconfig.json`: configuracion TypeScript usada por Astro y el codigo fuente.

## GitHub, editor y automatizacion

- `.github/dependabot.yml`: configuracion de actualizaciones automaticas de dependencias.
- `.github/workflows/ci.yml`: workflow de CI para pull requests.
- `.github/workflows/pages.yml`: workflow de despliegue en GitHub Pages.
- `.vscode/extensions.json`: extensiones recomendadas para VS Code.
- `.vscode/launch.json`: configuracion de depuracion para VS Code.

## Documentacion

- `docs/ai-api.md`: uso de la API de IA dentro del proyecto.
- `docs/ai-checklist.md`: checklist para revisar cambios relacionados con IA.
- `docs/app-check.md`: documentacion de App Check.
- `docs/daily-options.md`: reglas y funcionamiento de opciones diarias del menu.
- `docs/design-system.md`: sistema visual, accesibilidad, modo claro/oscuro y pautas UI.
- `docs/dish-usage.md`: documentacion del uso de platos en menus.
- `docs/firebase.md`: configuracion y convenciones de Firebase.
- `docs/github-pages.md`: despliegue en GitHub Pages y compatibilidad con subrutas.
- `docs/global-dish-usage.md`: uso global de platos compartidos.
- `docs/history.md`: historial de menus y datos asociados.
- `docs/i18n-guide.md`: guia de idiomas, traducciones y rutas localizadas.
- `docs/meal-participants.md`: gestion de participantes de comida.
- `docs/navigation.md`: convenciones de navegacion.
- `docs/project-files-index.md`: este indice de archivos y responsabilidades.
- `docs/public-sharing.md`: documentacion de comparticion publica.
- `docs/statistics.md`: estadisticas y calculos asociados.
- `docs/template-usage.md`: guia para usar y modificar la base Astro.
- `docs/testing-guide.md`: criterios y comandos de tests.
- `docs/tuppers.md`: gestion de tuppers.
- `docs/user-preferences.md`: preferencias de usuario.

## Datos y scripts

- `data/global-dishes.seed.json`: datos semilla de platos globales.
- `scripts/clean.mjs`: limpieza de artefactos generados por el proyecto.

## Archivos publicos

- `public/CNAME`: dominio personalizado para GitHub Pages.
- `public/apple-touch-icon.png`: icono para dispositivos Apple.
- `public/favicon-96x96.png`: favicon PNG.
- `public/favicon.ico`: favicon clasico.
- `public/favicon.svg`: favicon vectorial.
- `public/og-image.svg`: imagen Open Graph por defecto.
- `public/site.webmanifest`: manifest estatico heredado o auxiliar.
- `public/web-app-manifest-192x192.png`: icono PWA de 192 px.
- `public/web-app-manifest-512x512.png`: icono PWA de 512 px.

## Configuracion de `src`

- `src/config/firebase-public-env.mjs`: lectura y validacion de variables publicas de Firebase.
- `src/config/site.ts`: configuracion central del sitio, idiomas, navegacion y metadatos.
- `src/utils/paths.ts`: helpers para rutas con `base`, URLs absolutas y despliegues en subruta.

## Layouts

- `src/layouts/BaseLayout.astro`: layout HTML base con SEO, Open Graph, header, footer y estilos globales.

## Componentes Astro

- `src/components/AboutPage.astro`: pagina publica de informacion del proyecto.
- `src/components/AdminGlobalDishesApp.astro`: interfaz de administracion de platos globales.
- `src/components/AppPageShell.astro`: estructura comun para paginas privadas de aplicacion.
- `src/components/AuthGate.astro`: puerta de autenticacion para vistas que requieren usuario.
- `src/components/Breadcrumb.astro`: migas de pan.
- `src/components/Button.astro`: boton reutilizable.
- `src/components/ConfiguratorApp.astro`: interfaz de configuracion del menu.
- `src/components/ConfirmDialog.astro`: dialogo reutilizable de confirmacion.
- `src/components/Container.astro`: contenedor de layout reutilizable.
- `src/components/DashboardApp.astro`: panel principal de la aplicacion.
- `src/components/DayEditModal.astro`: modal de edicion de dia del menu.
- `src/components/DishEditDialog.astro`: dialogo para editar platos.
- `src/components/DishRecommenderApp.astro`: recomendador de platos.
- `src/components/DishesApp.astro`: gestion de platos del usuario.
- `src/components/FaqPage.astro`: pagina publica de preguntas frecuentes.
- `src/components/Footer.astro`: pie de pagina.
- `src/components/Header.astro`: cabecera y navegacion principal.
- `src/components/HistoryApp.astro`: interfaz del historico.
- `src/components/HomeLanding.astro`: home publica del producto.
- `src/components/MenuApp.astro`: aplicacion principal del menu.
- `src/components/MobileBottomNav.astro`: navegacion inferior para movil.
- `src/components/PageHeader.astro`: encabezado reutilizable de paginas internas.
- `src/components/PlanningAiApp.astro`: planificador con asistencia IA.
- `src/components/PublicHowItWorksPage.astro`: pagina publica de funcionamiento.
- `src/components/PublicSeoPage.astro`: plantilla para paginas SEO publicas.
- `src/components/SettingsApp.astro`: ajustes de usuario y aplicacion.
- `src/components/ShoppingAiApp.astro`: asistencia IA para compras.
- `src/components/ShoppingApp.astro`: lista o flujo principal de compra.
- `src/components/ShoppingListsApp.astro`: gestion de listas de la compra.
- `src/components/StatisticsApp.astro`: interfaz de estadisticas.
- `src/components/TuppersApp.astro`: gestion de tuppers.
- `src/components/WeeklySummaryApp.astro`: resumen semanal.

## Rutas Astro

Las rutas de idioma por defecto viven directamente en `src/pages/`. Las equivalentes de idiomas secundarios viven en `src/pages/[locale]/` y deben mantenerse alineadas cuando la pagina sea traducible.

- `src/pages/index.astro` y `src/pages/[locale]/index.astro`: home publica.
- `src/pages/404.astro`: pagina de error 404.
- `src/pages/acerca-de.astro` y `src/pages/[locale]/acerca-de.astro`: pagina sobre el proyecto.
- `src/pages/ajustes.astro` y `src/pages/[locale]/ajustes.astro`: ajustes.
- `src/pages/como-funciona.astro` y `src/pages/[locale]/como-funciona.astro`: explicacion publica.
- `src/pages/compra.astro` y `src/pages/[locale]/compra.astro`: vista de compra.
- `src/pages/compras.astro` y `src/pages/[locale]/compras.astro`: listas o area de compras.
- `src/pages/configurar.astro` y `src/pages/[locale]/configurar.astro`: configuracion del menu.
- `src/pages/dashboard.astro` y `src/pages/[locale]/dashboard.astro`: panel principal.
- `src/pages/estadisticas.astro` y `src/pages/[locale]/estadisticas.astro`: estadisticas.
- `src/pages/faq.astro` y `src/pages/[locale]/faq.astro`: preguntas frecuentes.
- `src/pages/historico.astro` y `src/pages/[locale]/historico.astro`: historico.
- `src/pages/manual.astro` y `src/pages/[locale]/manual.astro`: manual o guia publica.
- `src/pages/mis-platos.astro` y `src/pages/[locale]/mis-platos.astro`: platos del usuario.
- `src/pages/organizar-menu-semanal.astro` y `src/pages/[locale]/organizar-menu-semanal.astro`: pagina SEO sobre organizacion semanal.
- `src/pages/planificacion.astro` y `src/pages/[locale]/planificacion.astro`: planificacion.
- `src/pages/planificador.astro` y `src/pages/[locale]/planificador.astro`: planificador.
- `src/pages/planificador-ai.astro` y `src/pages/[locale]/planificador-ai.astro`: planificador con IA.
- `src/pages/planificador-comidas.astro` y `src/pages/[locale]/planificador-comidas.astro`: pagina SEO o funcional de planificador de comidas.
- `src/pages/platos.astro` y `src/pages/[locale]/platos.astro`: catalogo o gestion de platos.
- `src/pages/politica-privacidad.astro` y `src/pages/[locale]/politica-privacidad.astro`: politica de privacidad.
- `src/pages/recomendador-platos.astro` y `src/pages/[locale]/recomendador-platos.astro`: recomendador de platos.
- `src/pages/resumen-semanal.astro` y `src/pages/[locale]/resumen-semanal.astro`: resumen semanal.
- `src/pages/tuppers.astro` y `src/pages/[locale]/tuppers.astro`: gestion de tuppers.
- `src/pages/admin/platos.astro` y `src/pages/[locale]/admin/platos.astro`: administracion de platos globales.
- `src/pages/manifest.webmanifest.ts`: manifest dinamico compatible con `base`.
- `src/pages/robots.txt.ts`: robots dinamico con sitemap correcto.
- `src/pages/sw.js.ts`: limpieza de service workers y caches antiguos para instalaciones previas.

## Internacionalizacion

- `src/i18n/ui.ts`: helpers principales de traduccion, locales y rutas localizadas.
- `src/i18n/planning.ts`: textos y helpers de planificacion.
- `src/i18n/statistics.ts`: textos y helpers de estadisticas.
- `src/i18n/public-pages.ts`: textos de paginas publicas.
- `src/i18n/tuppers.ts`: textos de tuppers.
- `src/i18n/shopping-actions.ts`: textos de acciones de compra.
- `src/i18n/dish-recommender.ts`: textos del recomendador de platos.
- `src/i18n/footer-projects.ts`: textos y datos de proyectos del footer.
- `src/i18n/translations/es.json`: traducciones base en espanol.
- `src/i18n/translations/en.json`: traducciones base en ingles.
- `src/i18n/translations/history/*.json`: traducciones del historico.
- `src/i18n/translations/public/*.json`: traducciones de paginas publicas.
- `src/i18n/translations/settings/*.json`: traducciones de ajustes.
- `src/i18n/translations/statistics/*.json`: traducciones de estadisticas.

## Datos de aplicacion

- `src/data/dish-tags.ts`: etiquetas y metadatos de platos.
- `src/data/public-seo-pages.ts`: definicion de paginas SEO publicas.

## Librerias de dominio

- `src/lib/ai/`: clientes, limites, errores, configuracion, recomendaciones y flujos de IA.
- `src/lib/dishes/`: helpers, renderizado, importacion y repositorio de platos.
- `src/lib/errors/`: tipos y formateo de errores de aplicacion.
- `src/lib/firebase/`: inicializacion, autenticacion, cliente y App Check de Firebase.
- `src/lib/menu/`: logica de menus, fechas, formularios, historico, grupos, invitaciones, participantes, estadisticas y repositorios.
- `src/lib/notifications/`: utilidades de notificaciones del navegador.
- `src/lib/public-sharing/`: metadatos para comparticion publica.
- `src/lib/shopping/`: normalizacion, exportacion, tipos y repositorio de compra.
- `src/lib/tuppers/`: asignacion, caducidad, estado, tipos y repositorio de tuppers.
- `src/lib/ui/`: utilidades UI compartidas para dialogos, menus, HTML, feedback, bloqueo de scroll y tareas con debounce.

## Scripts de cliente

- `src/scripts/admin-global-dishes-app.ts`: comportamiento cliente de administracion de platos globales.
- `src/scripts/app-header.ts`: interacciones de cabecera.
- `src/scripts/auth-gate.ts`: autenticacion en cliente para vistas protegidas.
- `src/scripts/configurator-app.ts`: logica cliente de configuracion.
- `src/scripts/dashboard-app.ts`: logica del dashboard.
- `src/scripts/dish-recommender-app.ts`: logica cliente del recomendador.
- `src/scripts/dishes-app.ts`: logica cliente de platos.
- `src/scripts/history-app.ts`: logica cliente del historico.
- `src/scripts/menu-app.ts`: logica cliente principal del menu.
- `src/scripts/planning-ai-app.ts`: logica del planificador IA.
- `src/scripts/planning-ai-date-range.ts`: seleccion y calculo de rangos de fechas para planificacion IA.
- `src/scripts/planning-ai-wizard.ts`: asistente guiado de planificacion IA.
- `src/scripts/settings-app.ts`: logica de ajustes.
- `src/scripts/shopping-alexa-integration.ts`: integracion de compra con Alexa.
- `src/scripts/shopping-app.ts`: logica cliente de compra.
- `src/scripts/shopping-list-actions.ts`: acciones adicionales para crear y borrar listas de compra desde la vista de compra.
- `src/scripts/shopping-lists-app.ts`: logica de listas de compra.
- `src/scripts/shopping-wizard.ts`: asistente de compra.
- `src/scripts/statistics-app.ts`: logica cliente de estadisticas.
- `src/scripts/tuppers-app.ts`: logica cliente de tuppers.
- `src/scripts/weekly-summary-app.ts`: logica del resumen semanal.

## Estilos

- `src/styles/global.css`: tokens globales, reset, base visual y utilidades comunes.
- `src/styles/day-edit-modal-layout.css`: layout del modal de edicion diaria.
- `src/styles/dish-recommender.css`: estilos del recomendador de platos.
- `src/styles/dishes.css`: estilos de platos.
- `src/styles/history.css`: estilos del historico.
- `src/styles/home-landing.css`: estilos visuales y responsive de la portada publica.
- `src/styles/meal-participants.css`: estilos de participantes.
- `src/styles/mobile-bottom-nav.css`: estilos de navegacion movil inferior.
- `src/styles/modals.css`: estilos comunes de modales.
- `src/styles/shopping-list-actions.css`: estilos de gestion y visualizacion de listas de compra.
- `src/styles/shopping-planning-wizard.css`: estilos del asistente de compra/planificacion.
- `src/styles/statistics.css`: estilos de estadisticas.
- `src/styles/toasts.css`: estilos de avisos/toasts.
- `src/styles/tuppers.css`: estilos de tuppers.
- `src/styles/weekly-summary.css`: estilos del resumen semanal.

## Tests

Los tests viven en `tests/*.test.mjs` y usan `node:test`. Cada archivo cubre una zona funcional concreta:

- `tests/smoke.test.mjs`: comprobaciones basicas de estructura, scripts y traducciones.
- `tests/*i18n*`, `tests/localized-pages-locale.test.mjs`: rutas e i18n.
- `tests/public-*.test.mjs`: paginas publicas, SEO y comparticion.
- `tests/*dishes*.test.mjs`: platos, renderizado, repositorio y recomendaciones.
- `tests/*menu*.test.mjs`, `tests/day-*.test.mjs`, `tests/weekly-*.test.mjs`: menus, dias y resumen semanal.
- `tests/*shopping*.test.mjs`: compra, listas, asistente y Alexa.
- `tests/*planning*.test.mjs`: planificacion y asistencia IA.
- `tests/*statistics*.test.mjs`: estadisticas.
- `tests/*tuppers*.test.mjs`: tuppers.
- `tests/*firebase*.test.mjs`, `tests/app-check.test.mjs`, `tests/firestore-rules.test.mjs`: Firebase, App Check y reglas.
- `tests/*group*.test.mjs`, `tests/invite-codes.test.mjs`: grupos, permisos e invitaciones.
- `tests/*settings*.test.mjs`, `tests/user-preferences.test.mjs`: ajustes y preferencias.
- `tests/ai*.test.mjs`: funciones de IA.
- `tests/app-errors.test.mjs`, `tests/debounced-task-map.test.mjs`, `tests/mobile-bottom-nav.test.mjs`, `tests/footer-projects.test.mjs`, `tests/header-eurovision-style.test.mjs`, `tests/planner-dashboard-style.test.mjs`: utilidades y validaciones UI especificas.
