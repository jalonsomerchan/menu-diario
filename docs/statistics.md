# Estadísticas de menús

La ruta `/estadisticas` permite analizar menús, platos y hábitos de planificación sin crear nuevas colecciones ni campos obligatorios en Firestore.

## Rutas

```text
src/pages/estadisticas.astro
src/pages/[locale]/estadisticas.astro
```

La ruta usa `getLocalizedPath('/estadisticas', locale)` desde navegación y dashboard, por lo que mantiene compatibilidad con dominio raíz, subrutas y GitHub Pages.

## Datos usados

La pantalla reutiliza datos existentes:

- `weeklyMenus/{menuId}` para menús por semana y días planificados.
- `dishes/{dishId}` para platos, favoritos, etiquetas, uso y último uso.
- `users/{userId}` para comidas activas (`enabledMeals`) y `groupId`.

No añade modelo nuevo ni requiere migraciones.

## Consultas Firestore

La app no hace agregaciones globales ni consultas sin acotar. El cliente calcula métricas a partir de un rango temporal elegido por el usuario:

- últimos 7 días,
- últimos 30 días,
- últimos 90 días,
- rango personalizado.

Para menús se usa `watchUserMenusByWeekRange`, que consulta `weeklyMenus` por:

```txt
members array-contains uid
weekStart >= startWeek
weekStart <= endWeek
orderBy weekStart asc
```

Para platos se reutiliza `watchUserDishes`, que ya limita el catálogo visible y separa platos globales, de grupo o de usuario.

Si Firestore solicita índice compuesto, debe crearse para `weeklyMenus` con `members` y `weekStart` en orden ascendente. La consulta de histórico usa la misma colección y un rango equivalente, por lo que no se duplica lógica de acceso.

## Cálculos

Los cálculos viven en `src/lib/menu/statistics.mjs` y son testeables sin DOM ni Firebase.

Métricas actuales:

- platos más usados,
- favoritos más usados,
- platos no usados desde hace más tiempo,
- comidas planificadas por semana y mes,
- comidas fuera,
- comidas marcadas como no apuntadas,
- huecos sin planificar,
- variedad por etiquetas,
- señales de tuppers o sobras,
- días con opciones personalizadas.

La UI solo renderiza el resultado de `buildMenuStatistics`; no mezcla consultas, DOM y reglas de negocio.

## Gráficos

Los gráficos son barras HTML/CSS accesibles con `aria-label` y texto visible. No se añaden dependencias pesadas como Chart.js, D3 o Recharts.

## Estados vacíos

Cuando no hay datos suficientes en el rango seleccionado, la pantalla muestra un estado vacío y mantiene visibles los filtros para que el usuario pueda ampliar el rango.
