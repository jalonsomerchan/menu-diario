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
- La planificación con IA carga las intolerancias de los usuarios miembros del grupo actual, las deduplica y las incluye como restricción alimentaria dentro del prompt.
- El prompt recorta el bloque combinado a 500 caracteres y no añade emails, UID, nombres de miembros ni códigos de invitación.
- Cualquier flujo nuevo que lo envíe a servicios externos debe documentar antes su privacidad y necesidad.

Firestore permite leer y actualizar `users/{userId}` solo al propio usuario autenticado. También permite leer perfiles de usuarios del mismo grupo para que el planificador de IA pueda respetar las intolerancias alimentarias compartidas por todos los miembros. Las escrituras siguen limitadas al propio usuario según `firestore.rules`.
