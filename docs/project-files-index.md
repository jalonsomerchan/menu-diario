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
- `docs/public-cooking-seo.md`: convenciones de las paginas publicas de recetas y consejos de cocina.
- `docs/public-sharing.md`: documentacion de comparticion publica.
- `docs/statistics.md`: estadisticas y calculos asociados.
- `docs/template-usage.md`: guia para usar y modificar la base Astro.
- `docs/testing-guide.md`: criterios y comandos de tests.
- `docs/tuppers.md`: gestion de tuppers.
- `docs/user-preferences.md`: preferencias de usuario.

## Datos y scripts

- `data/global-dishes.seed.json`: datos semilla de platos globales.
- `scripts/clean.mjs`: limpieza de artefactos generados por el proyecto.
- `src/data/public-cooking-seo-pages.ts`: catalogo y generadores de las 100 paginas publicas de recetas y consejos.

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
- `src/components/HomeCookingSeoLinks.astro`: bloque de enlaces desde la home hacia recetas y consejos publicos.
- `src/components/HomeLanding.astro`: home publica del producto.
- `src/components/MenuApp.astro`: aplicacion principal del menu.
- `src/components/MobileBottomNav.astro`: navegacion inferior para movil.
- `src/components/MoreAppPage.astro`: pagina hub de opciones para el acceso Mas del toolbar movil.
- `src/components/PageHeader.astro`: encabezado reutilizable de paginas internas.
- `src/components/PlanningAiApp.astro`: planificador con asistencia IA.
- `src/components/PublicCookingSeoIndexPage.astro`: hub publico de recetas y consejos.
- `src/components/PublicCookingSeoPage.astro`: plantilla para recetas y consejos SEO publicos.
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
- `src/pages/mas.astro` y `src/pages/[locale]/mas.astro`: pagina de Mas con todas las opciones de la app para movil.
- `src/pages/mis-platos.astro` y `src/pages/[locale]/mis-platos.astro`: platos del usuario.
- `src/pages/organizar-menu-semanal.astro` y `src/pages/[locale]/organizar-menu-semanal.astro`: pagina SEO sobre organizacion semanal.
- `src/pages/planificacion.astro` y `src/pages/[locale]/planificacion.astro`: planificacion.
- `src/pages/planificador.astro` y `src/pages/[locale]/planificador.astro`: planificador.
- `src/pages/planificador-ai.astro` y `src/pages/[locale]/planificador-ai.astro`: planificador con IA.
- `src/pages/planificador-comidas.astro` y `src/pages/[locale]/planificador-comidas.astro`: pagina SEO o funcional de planificador de comidas.
- `src/pages/platos.astro` y `src/pages/[locale]/platos.astro`: catalogo o gestion de platos.
- `src/pages/politica-privacidad.astro` y `src/pages/[locale]/politica-privacidad.astro`: politica de privacidad.
- `src/pages/recetas.astro` y `src/pages/[locale]/recipes.astro`: hub publico de recetas y consejos de cocina.
- `src/pages/recetas/[cookingSeoSlug].astro` y `src/pages/[locale]/recipes/[cookingSeoSlug].astro`: paginas publicas de detalle de recetas y consejos.
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
- `src/i18n/menu-automation-actions.ts`: textos de acciones rapidas del menu, compra automatica e historial de platos.
- `src/i18n/more-page.ts`: textos de la pagina Mas del toolbar movil.
