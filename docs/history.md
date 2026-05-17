# Histórico

La sección **Histórico** permite consultar comidas pasadas desde móvil con filtros compactos y sin cargar más datos de los necesarios.

## Consulta Firestore

La UI usa `watchUserMenusByWeekRange` sobre el rango elegido por el usuario. La consulta se acota por semanas calculadas desde las fechas seleccionadas:

```txt
weeklyMenus
  members array-contains
  weekStart >= startWeek
  weekStart <= endWeek
  weekStart asc
```

Firestore puede pedir un índice compuesto para `members` + `weekStart`. Si la consola muestra un enlace de creación, debe apuntar a la colección `weeklyMenus` con `members array-contains` y `weekStart` ascendente.

## Filtros en cliente

La lógica vive en `src/lib/menu/history.ts` y separa:

- clasificación de días vacíos, planificados y saltados;
- construcción de filas por día y tipo de comida;
- búsqueda por texto normalizado;
- filtros por rango de fechas, día de la semana, estado, tipo de comida, plato, etiqueta, favoritos, tuppers/sobras, comidas fuera, no apuntadas y opciones personalizadas;
- ordenación por fecha reciente, fecha antigua, plato y frecuencia;
- conteo de filtros activos para chips móviles.

Los filtros detallados se aplican sobre el rango cargado para evitar combinaciones de consultas e índices difíciles de mantener.

## UI móvil

`src/components/HistoryApp.astro`, `src/scripts/history-app.ts` y `src/styles/history.css` mantienen la interfaz mobile first con:

- búsqueda compacta y botón de limpiar;
- filtros plegables que en móvil se comportan como panel inferior;
- chips horizontales para recordar filtros activos;
- tarjetas compactas con fecha, comida, platos, badges y acciones;
- `aria-live` para cambios de resultados y estados de conexión;
- carga incremental con botón de cargar más.
