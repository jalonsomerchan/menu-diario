# Paginas publicas de recetas y consejos

El bloque de SEO publico de cocina genera paginas estaticas para captar busquedas long-tail relacionadas con recetas, consejos de cocina, menu semanal, tuppers, compra y organizacion familiar.

## Archivos principales

- `src/data/public-cooking-seo-pages.ts`: catalogo base y generadores de las primeras 100 paginas publicas.
- `src/data/public-cooking-seo-catalog.ts`: catalogo extendido usado por rutas publicas, con 100 recetas adicionales generadas desde combinaciones de recetas semilla.
- `src/components/HomeCookingSeoLinks.astro`: bloque de enlaces desde la home hacia el hub y paginas destacadas.
- `src/components/PublicCookingSeoIndexPage.astro`: hub publico de recetas y consejos.
- `src/components/PublicRecipeIndexPage.astro`: indice alfabetico publico de recetas.
- `src/components/PublicCookingSeoPage.astro`: plantilla de detalle para cada receta o consejo.
- `src/pages/recetas.astro`: hub del idioma principal.
- `src/pages/recetas/indice.astro`: indice alfabetico de recetas del idioma principal.
- `src/pages/recetas/[cookingSeoSlug].astro`: rutas estaticas de detalle del idioma principal.
- `src/pages/[locale]/recipes.astro`: hub localizado para idiomas secundarios.
- `src/pages/[locale]/recipes/recipe-index.astro`: indice alfabetico localizado para idiomas secundarios.
- `src/pages/[locale]/recipes/[cookingSeoSlug].astro`: rutas estaticas localizadas.

## Convenciones

- Las paginas no tienen JavaScript de cliente.
- Cada pagina usa `BaseLayout` para titulo, descripcion, canonical y Open Graph.
- Los enlaces internos se generan con `getLocalizedPath` para conservar compatibilidad con dominio raiz, subrutas y GitHub Pages.
- La home enlaza el hub y varias paginas destacadas desde `HomeCookingSeoLinks`.
- El footer enlaza el hub de recetas y consejos; el hub enlaza el indice de recetas, y el indice enlaza todas las recetas.
- Las rutas de detalle se generan desde `getPublicCookingSeoPages`, por lo que el sitemap incluye el catalogo extendido.
- Cada pagina recomienda usar Menu Diario desde una seccion propia y CTA hacia dashboard o planificador.
