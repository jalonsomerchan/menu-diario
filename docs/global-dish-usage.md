# Uso privado de platos generales

Los platos con `scope: global` son catálogo administrado. La UI normal de usuario puede leerlos y usarlos como sugerencias, pero no debe escribir estadísticas privadas en esos documentos.

## Decisión actual

Cuando un usuario o grupo usa en un menú un nombre que coincide con un plato global y todavía no existe un plato propio con ese `normalizedName`, `recordMenuDishUsage()` crea o actualiza un plato propio en el contexto del usuario o grupo:

- `scope: group` si el usuario tiene `groupId`;
- `scope: user` como fallback sin grupo;
- `source: duplicated-global`;
- `duplicatedFrom` con el id del plato global original;
- `timesUsed` y `lastUsedAt` en el documento propio, no en el global;
- `tags` y `quickTags` copiadas del global como punto de partida.

Así, el documento global sigue siendo una plantilla administrada y no mezcla contadores personales, familiares o de grupo.

## Motivo

Este modelo evita errores de permisos para usuarios normales, porque las reglas Firestore pueden mantener los platos globales como escritura solo admin. También evita que los hábitos privados de un grupo alteren estadísticas o metadatos compartidos con todo el catálogo.

## Flujo esperado

1. El usuario escribe o aplica un plato en el menú.
2. Si ya existe plato propio visible, se incrementa ese documento propio.
3. Si no existe propio pero sí global, se crea el propio con `duplicatedFrom`.
4. Si no existe ninguno, se crea un plato propio con `source: menu`.

Las recomendaciones IA y los formularios de menú deben seguir usando `recordMenuDishUsage()` para mantener esta semántica centralizada.
