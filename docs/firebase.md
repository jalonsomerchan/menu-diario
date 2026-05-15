# Firebase para Menu Diario

Esta webapp usa Firebase Auth y Firestore desde el navegador. Las variables `PUBLIC_FIREBASE_*` son públicas y deben protegerse con reglas de seguridad correctas.

## Servicios necesarios

Activa en Firebase Console:

- Authentication: Google y Anonymous.
- Firestore Database.
- Authorized domains: el dominio donde se despliegue la webapp.

## Error `Missing or insufficient permissions`

Si al iniciar sesión con Google aparece `Missing or insufficient permissions`, normalmente Google Auth sí ha funcionado, pero Firestore ha rechazado la lectura o escritura posterior.

Para solucionarlo, publica las reglas del fichero `firestore.rules` en Firebase Console:

```txt
Firebase Console > Firestore Database > Rules
```

Después pulsa **Publish**. La app necesita permiso para:

- Crear o actualizar `users/{uid}` del usuario autenticado.
- Crear un `weeklyMenus/{menuId}` propio.
- Leer menús estando autenticado, porque la unión por código usa una consulta por `inviteCode`.
- Editar menús donde el usuario sea miembro.
- Crear y actualizar platos reutilizables en `dishes` para sugerencias y estadísticas.
- Añadirse como miembro cuando conoce un código de invitación.

## Colecciones

### `users/{userId}`

Perfil mínimo del usuario autenticado.

```json
{
  "displayName": "Jorge",
  "updatedAt": "serverTimestamp"
}
```

### `weeklyMenus/{menuId}`

Menú semanal compartido. Cada día permite varios platos de comida y también marcar que ese día no se apunta comida.

```json
{
  "title": "13 may - 19 may",
  "ownerId": "uid",
  "members": ["uid"],
  "inviteCode": "ABC123",
  "weekStart": "2026-05-11",
  "days": {
    "2026-05-11": {
      "lunchItems": ["Lentejas", "Ensalada"],
      "noLunch": false,
      "noLunchReason": "",
      "noLunchDescription": "",
      "notes": "Comprar pan"
    },
    "2026-05-12": {
      "lunchItems": [],
      "noLunch": true,
      "noLunchReason": "eating-out",
      "noLunchDescription": "Comida de trabajo",
      "notes": ""
    }
  },
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp",
  "updatedBy": "uid"
}
```

### `dishes/{dishId}`

Catálogo de platos reutilizables. Se alimenta automáticamente cuando se añaden platos a un día.

```json
{
  "name": "Lentejas",
  "normalizedName": "lentejas",
  "createdBy": "uid",
  "members": ["uid"],
  "timesUsed": 3,
  "createdAt": "serverTimestamp",
  "lastUsedAt": "serverTimestamp"
}
```

## Reglas incluidas

La fuente de verdad está en `firestore.rules`. Copia ese fichero en Firestore Rules si configuras el proyecto desde Firebase Console.

## Índices

Firestore puede pedir crear índices para estas consultas:

```txt
weeklyMenus
  members array-contains
  weekStart desc
```

La lista de platos reutilizables usa `createdBy == uid` y se ordena en el navegador por `timesUsed`, así que no necesita el índice compuesto `members + timesUsed`.

La consulta por código de invitación usa `inviteCode ==`, que normalmente no necesita índice compuesto.

## Notificaciones

La app usa notificaciones del navegador cuando un documento escuchado en tiempo real cambia y el cambio lo hace otro usuario. No usa Firebase Cloud Messaging todavía, por lo que no envía push si el navegador no tiene la app abierta o cargada en segundo plano.

## Seguridad pendiente para producción

Estas reglas están pensadas para que la app funcione en una primera versión cliente-only. Para producción conviene endurecerlas:

- Mover la unión por código a una Cloud Function para eliminar `allow read: if signedIn()` en `weeklyMenus`.
- Validar longitudes máximas de `lunchItems`, `notes`, `title`, `inviteCode`, `name` y `noLunchDescription`.
- Impedir que usuarios no propietarios cambien `ownerId` o eliminen miembros arbitrariamente.
- Usar códigos de invitación más largos o con caducidad.
