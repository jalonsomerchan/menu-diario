# API autenticada de IA

Menu Diario usa un endpoint propio para las generaciones de IA desde el cliente:

```text
https://alon.one/api-ia/auth.php
```

La URL puede cambiarse con `PUBLIC_AI_API_ENDPOINT`, manteniendo el valor por defecto anterior para producción.

## Autenticación

El cliente obtiene el ID token del usuario autenticado con Firebase Auth y lo envía en cada petición:

```http
Authorization: Bearer <Firebase ID token>
Content-Type: application/x-www-form-urlencoded;charset=UTF-8
Accept: application/json
```

El endpoint valida ese token antes de llamar al modelo. La app no guarda ni expone claves privadas de modelos de IA.

## Payload

La petición se envía como formulario `application/x-www-form-urlencoded` con estos campos:

```text
system_prompt=...
user_prompt=...
```

`system_prompt` contiene las reglas base comunes de seguridad, idioma y salida JSON. `user_prompt` contiene el prompt concreto del flujo: planificador, recomendador o lista de la compra.

## Respuesta

La capa `src/lib/ai/client.ts` espera JSON, valida la forma exacta con el validador del flujo y solo después entrega la respuesta a la UI.

Los errores HTTP se normalizan como `AiClientError`:

- `401` y `403`: token ausente, inválido o rechazado por el endpoint.
- `429`: cuota agotada.
- `5xx`: fallo temporal del endpoint.

## Relación con App Check y límites

App Check puede seguir usándose como guardia previa en el cliente cuando `PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI=true`, pero la frontera real de generación pasa a ser el endpoint autenticado.

Los límites de cliente con `sessionStorage` siguen existiendo para reducir abuso accidental, pero no son una protección real. Los límites importantes deben aplicarse en el backend del endpoint por usuario, token, IP, App Check si se usa y coste acumulado.