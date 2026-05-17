# Preferencias de usuario

Las preferencias personales viven en `users/{userId}` y se editan desde **Ajustes**.

## Intolerancias alimentarias

El campo `foodIntolerances` guarda texto libre con alergias, intolerancias o alimentos que el usuario quiere evitar.

```json
{
  "foodIntolerances": "lactosa, frutos secos, gluten"
}
```

Convenciones actuales:

- Es una preferencia personal, no de grupo.
- Se guarda en el documento del usuario autenticado.
- Se edita desde `SettingsApp` mediante un `textarea` accesible.
- Se normaliza recortando espacios y limitando el texto a 1000 caracteres en cliente.
- La planificación con IA lo incluye como restricción alimentaria dentro del prompt, recortado a 500 caracteres y sin añadir emails, UID, nombres de miembros ni códigos de invitación.
- Cualquier flujo nuevo que lo envíe a servicios externos debe documentar antes su privacidad y necesidad.

Firestore permite leer y actualizar `users/{userId}` solo al propio usuario autenticado según `firestore.rules`.
