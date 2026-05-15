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

Menú semanal compartido.

```json
{
  "title": "13 may - 19 may",
  "ownerId": "uid",
  "members": ["uid"],
  "inviteCode": "ABC123",
  "weekStart": "2026-05-11",
  "days": {
    "2026-05-11": {
      "lunch": "Lentejas",
      "dinner": "Tortilla",
      "notes": "Comprar pan"
    }
  },
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp",
  "updatedBy": "uid"
}
```

## Reglas incluidas

La fuente de verdad está en `firestore.rules`. Copia ese fichero en Firestore Rules si configuras el proyecto desde Firebase Console.

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isSelf(userId) {
      return signedIn() && request.auth.uid == userId;
    }

    function isMenuMember() {
      return signedIn() && request.auth.uid in resource.data.members;
    }

    function createsOwnMenu() {
      return signedIn()
        && request.resource.data.ownerId == request.auth.uid
        && request.auth.uid in request.resource.data.members;
    }

    function keepsExistingMembers() {
      return request.resource.data.members.hasAll(resource.data.members);
    }

    function joinsMenu() {
      return signedIn()
        && !(request.auth.uid in resource.data.members)
        && request.auth.uid in request.resource.data.members
        && keepsExistingMembers();
    }

    match /users/{userId} {
      allow read, create, update: if isSelf(userId);
      allow delete: if false;
    }

    match /weeklyMenus/{menuId} {
      allow create: if createsOwnMenu();
      allow read: if signedIn();
      allow update: if isMenuMember() || joinsMenu();
      allow delete: if signedIn() && resource.data.ownerId == request.auth.uid;
    }
  }
}
```

## Índices

Firestore puede pedir crear índices para consultas con `members array-contains` + `weekStart desc`. Si aparece el aviso en consola, acepta el índice propuesto.

La consulta por código de invitación usa `inviteCode ==`, que normalmente no necesita índice compuesto.

## Notificaciones

La app usa notificaciones del navegador cuando un documento escuchado en tiempo real cambia y el cambio lo hace otro usuario. No usa Firebase Cloud Messaging todavía, por lo que no envía push si el navegador no tiene la app abierta o cargada en segundo plano.

## Seguridad pendiente para producción

Estas reglas están pensadas para que la app funcione en una primera versión cliente-only. Para producción conviene endurecerlas:

- Mover la unión por código a una Cloud Function para eliminar `allow read: if signedIn()` en `weeklyMenus`.
- Validar longitudes máximas de `lunch`, `dinner`, `notes`, `title` e `inviteCode`.
- Impedir que usuarios no propietarios cambien `ownerId` o eliminen miembros arbitrariamente.
- Usar códigos de invitación más largos o con caducidad.
