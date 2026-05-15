# Firebase para Menu Diario

Esta webapp usa Firebase Auth y Firestore desde el navegador. Las variables `PUBLIC_FIREBASE_*` son públicas y deben protegerse con reglas de seguridad correctas.

## Servicios necesarios

Activa en Firebase Console:

- Authentication: Google y Anonymous.
- Firestore Database.
- Authorized domains: el dominio donde se despliegue la webapp.

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

## Reglas orientativas

Estas reglas son una base razonable para desarrollo. Revisa límites, validaciones de longitud y permisos antes de producción.

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isMember(menu) {
      return signedIn() && request.auth.uid in menu.data.members;
    }

    function willBeMember(menu) {
      return signedIn() && request.auth.uid in request.resource.data.members;
    }

    match /users/{userId} {
      allow read, write: if signedIn() && request.auth.uid == userId;
    }

    match /weeklyMenus/{menuId} {
      allow create: if signedIn()
        && request.resource.data.ownerId == request.auth.uid
        && request.auth.uid in request.resource.data.members;

      allow read: if isMember(resource);

      allow update: if isMember(resource) || willBeMember(resource);

      allow delete: if signedIn() && resource.data.ownerId == request.auth.uid;
    }
  }
}
```

## Índices

Firestore puede pedir crear índices para consultas con `members array-contains` + `weekStart desc`. Si aparece el aviso en consola, acepta el índice propuesto.

## Notificaciones

La app usa notificaciones del navegador cuando un documento escuchado en tiempo real cambia y el cambio lo hace otro usuario. No usa Firebase Cloud Messaging todavía, por lo que no envía push si el navegador no tiene la app abierta o cargada en segundo plano.
