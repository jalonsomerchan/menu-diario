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
- Se sincroniza también como agregado mínimo en `groups/{groupId}.memberFoodIntolerances`, usando el UID como clave y solo el texto de intolerancias como valor.
- La planificación con IA incluye las intolerancias agregadas de todo el grupo como restricciones alimentarias dentro del prompt, recortadas a 500 caracteres y sin añadir emails, nombres de miembros ni códigos de invitación.
- El planificador usa `getGroupFoodIntolerances(group, fallback)` para juntar el agregado del grupo y la preferencia del usuario actual como fallback mientras llega la suscripción del grupo.
- Cualquier flujo nuevo que lo envíe a servicios externos debe documentar antes su privacidad y necesidad.

Firestore permite leer y actualizar `users/{userId}` solo al propio usuario autenticado según `firestore.rules`. El agregado de grupo vive en `groups/{groupId}`, que ya se comparte con miembros del grupo para opciones comunes, invitaciones y planificación compartida.
