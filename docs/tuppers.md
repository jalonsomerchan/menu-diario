# Tuppers

La página prioritaria de Tuppers permite gestionar comidas ya preparadas, controlar su caducidad y asignarlas a próximas comidas del menú.

## Ruta

- Español: `/tuppers`.
- Idiomas secundarios: `/{locale}/tuppers`.

La ruta usa `getLocalizedPath`, por lo que funciona en dominio raíz, subrutas y GitHub Pages.

## Datos guardados

Los tuppers se guardan en la colección `tuppers`.

```json
{
  "name": "Lentejas del domingo",
  "normalizedName": "lentejas del domingo",
  "dishId": "uid_lentejas",
  "createdBy": "uid",
  "groupId": "group-id",
  "members": ["uid"],
  "preparedAt": "2026-05-16",
  "expiresAt": "2026-05-18",
  "portions": 2,
  "location": "fridge",
  "notes": "Guardar para el lunes",
  "status": "active",
  "assignedMenuId": "menu-id",
  "assignedDay": "2026-05-17",
  "assignedMeal": "lunch",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

## Estados

Estados persistidos:

- `active`: disponible para asignar.
- `assigned`: vinculado a una comida próxima.
- `consumed`: ya comido.
- `discarded`: descartado.
- `archived`: oculto del flujo principal sin borrar histórico.

Estados calculados de caducidad:

- `fresh`: caduca más tarde del umbral.
- `expiring`: caduca hoy o dentro del umbral razonable por defecto, actualmente 2 días.
- `expired`: ya caducó.
- `done`: consumido, descartado o archivado.

## Filtros

La UI mobile first permite filtrar por:

- Todos activos.
- Próximos a caducar.
- Caducados.
- Congelador.
- Nevera.
- Consumidos/asignados.

## Asignación al menú

Al asignar un tupper se busca o crea el menú de la semana correspondiente y se añade una entrada con el formato:

```text
Tupper: nombre del tupper
```

La asignación no sobrescribe platos existentes. Si la comida ya contiene platos, la UI pide confirmación antes de añadir el tupper a la lista. Si el día o la comida están marcados como no configurables, la asignación se bloquea.

Si un tupper ya estaba asignado a otra comida, la UI pide confirmación antes de moverlo. También permite quitar una asignación concreta y devolver el tupper al estado activo sin borrarlo del histórico.

## Integración futura con IA, ingredientes y compra

Los helpers de caducidad priorizan tuppers próximos a caducar. Cuando existan recomendador inteligente, ingredientes o lista de la compra, deben usar `getTupperExpiryState`, `sortTuppersByPriority` y `filterTuppers` para:

- Priorizar tuppers que caducan pronto.
- Evitar recomendar comprar algo que ya está preparado.
- Mostrar avisos antes de generar nuevas sugerencias.

## Seguridad

Las reglas de Firestore permiten crear tuppers propios y leer o actualizar documentos donde el usuario sea miembro. En esta primera fase, los tuppers se guardan por usuario con `members: [uid]`; `groupId` queda preparado para una sincronización grupal más completa.

## Archivos principales

```text
src/components/TuppersApp.astro     UI accesible y traducida
src/scripts/tuppers-app.ts          Lógica cliente
src/lib/tuppers/types.ts            Tipos del dominio
src/lib/tuppers/expiry.ts           Caducidad y prioridad
src/lib/tuppers/state.ts            Filtros y estados
src/lib/tuppers/assignment.ts       Asignación segura a comidas
src/lib/tuppers/repository.ts       Firestore
src/i18n/tuppers.ts                 Textos ES/EN de Tuppers
src/styles/tuppers.css              Estilos mobile first
```
