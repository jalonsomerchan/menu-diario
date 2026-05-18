# Participantes por comida

Cada comida puede guardar una lista opcional de participantes en `participantIds` dentro del bloque normalizado `days.{isoDate}.meals.{breakfast|lunch|dinner}`.

```json
{
  "days": {
    "2026-05-18": {
      "meals": {
        "lunch": {
          "items": ["Lentejas"],
          "skipped": false,
          "reason": "",
          "note": "",
          "participantIds": ["uid-1", "uid-2"]
        }
      }
    }
  }
}
```

## Compatibilidad

`participantIds` es opcional para no migrar datos antiguos. Si falta el campo, la app interpreta la comida como incluida para todos los miembros activos del grupo. En el modelo actual, los miembros activos son los UID presentes en `groups/{groupId}.members`; `pendingEmails` no participa en comidas porque todavía no son miembros autorizados.

Cuando todos los participantes están seleccionados, la UI guarda la comida sin `participantIds`. Así se mantiene el documento pequeño y los menús existentes conservan el mismo significado.

## Escritura y permisos

La edición se guarda junto al día completo mediante `updateMenuDay`. Las reglas de Firestore siguen bloqueando escrituras si el usuario no pertenece al documento de menú/grupo autorizado. La UI obtiene la lista visible desde `groups/{groupId}` y filtra cualquier `participantIds` desconocido antes de guardar.

## Migración

No hace falta migración obligatoria ni reset de base de datos. Los datos antiguos sin `participantIds` ya significan “todos”.

Una migración opcional solo sería útil si se quiere materializar explícitamente el estado actual en todos los menús históricos. En ese caso habría que recorrer `weeklyMenus`, buscar comidas sin `participantIds` y escribir el array de `groups/{groupId}.members` correspondiente. No se recomienda porque aumenta el tamaño de Firestore y no aporta comportamiento nuevo.

No se recomienda resetear la base de datos para este cambio. Un reset borraría usuarios, grupos, invitaciones, platos, históricos de menús, listas de compra y tuppers; solo tendría sentido en un entorno de pruebas desechable.
