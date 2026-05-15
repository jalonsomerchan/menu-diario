# Firebase para Menu Diario

Esta webapp usa Firebase Auth y Firestore desde el navegador. Las variables `PUBLIC_FIREBASE_*` son públicas y deben protegerse con reglas de seguridad correctas.

## Servicios necesarios

Activa en Firebase Console:

- Authentication: Google y Anonymous.
- Firestore Database.
- Firebase AI Logic cuando se activen funciones con Gemini.
- App Check antes de exponer funciones de IA a usuarios reales.
- Authorized domains: el dominio donde se despliegue la webapp.

## Firebase AI Logic y Gemini

La base técnica de IA vive en `src/lib/ai/` y está preparada para usarse desde futuras funciones concretas sin añadir dependencias npm. Sigue el mismo patrón que Auth y Firestore: carga dinámica de módulos oficiales versionados del Firebase Web SDK desde el navegador.

Archivos principales:

```text
src/lib/ai/config.ts         Modelos, temperatura, topP, tokens, timeouts y prompts base
src/lib/ai/client.ts         Wrapper mínimo para Gemini con JSON validado y timeout
src/lib/ai/errors.ts         Errores normalizados y logs no sensibles
src/lib/ai/flags.ts          Feature flags por entorno y Remote Config
src/lib/ai/json.ts           Helpers para pedir y validar JSON estructurado
src/lib/ai/limits.ts         Límites básicos por usuario/sesión en cliente
src/lib/ai/remote-config.ts  Preparación opcional para Firebase Remote Config
src/lib/ai/ui-state.ts       Estados comunes traducibles de UI
```

### Variables de entorno

La IA queda desactivada por defecto. Para activarla en un entorno concreto:

```env
PUBLIC_AI_ENABLED=true
PUBLIC_AI_MENU_SUGGESTIONS_ENABLED=true
PUBLIC_FIREBASE_AI_MODEL=gemini-2.5-flash-lite
PUBLIC_FIREBASE_AI_TEMPERATURE=0.35
PUBLIC_FIREBASE_AI_TOP_P=0.9
PUBLIC_FIREBASE_AI_MAX_OUTPUT_TOKENS=768
PUBLIC_FIREBASE_AI_TIMEOUT_MS=15000
PUBLIC_AI_MAX_SESSION_REQUESTS=8
PUBLIC_AI_MAX_USER_DAILY_REQUESTS=20
```

Si se quiere gobernar el apagado/encendido desde Remote Config:

```env
PUBLIC_AI_REMOTE_CONFIG_ENABLED=true
```

Claves remotas preparadas:

```text
ai_enabled
ai_menu_suggestions_enabled
```

Remote Config debe considerarse una capa de operación del producto, no una frontera de seguridad. Una función crítica no debe depender solo de flags de cliente.

### App Check

Antes de activar IA para usuarios reales:

1. Activa App Check en Firebase Console.
2. Registra los dominios reales, `localhost` para desarrollo y el dominio de GitHub Pages si aplica.
3. Usa reCAPTCHA Enterprise o el proveedor recomendado para web.
4. Prueba en modo monitorización antes de forzar cumplimiento.
5. Cuando todo funcione, exige App Check en Firebase AI Logic y servicios relacionados.

App Check ayuda a reducir abuso desde clientes no autorizados, pero no sustituye reglas de seguridad, límites de backend ni monitorización.

### Límites cliente

`src/lib/ai/limits.ts` aplica límites básicos con `sessionStorage`:

- `PUBLIC_AI_MAX_SESSION_REQUESTS` para limitar una sesión del navegador.
- `PUBLIC_AI_MAX_USER_DAILY_REQUESTS` para limitar un usuario o invitado durante el día local registrado.

Estos límites solo mejoran UX y reducen abuso accidental. No son una protección real porque el usuario controla el cliente. Si más adelante la app añade Cloud Functions, deben repetirse los límites en backend por `uid`, IP, App Check y coste acumulado.

### Uso recomendado para futuras funciones

Cada función concreta debe construir un prompt pequeño y validar la forma exacta antes de usar la respuesta:

```ts
import { buildJsonPrompt, generateGeminiJson } from '../lib/ai';

const isSuggestionResponse = (value: unknown): value is { suggestions: string[] } =>
  Boolean(
    value &&
      typeof value === 'object' &&
      Array.isArray((value as { suggestions?: unknown }).suggestions) &&
      (value as { suggestions: unknown[] }).suggestions.every((item) => typeof item === 'string')
  );

const result = await generateGeminiJson({
  userId: user.uid,
  prompt: buildJsonPrompt([
    'Suggest three simple lunch ideas.',
    'Return { "suggestions": string[] }.',
  ]),
  validator: isSuggestionResponse,
});
```

No uses la respuesta de Gemini directamente en Firestore ni en la UI sin pasar antes por un validador.

## Error `Missing or insufficient permissions`

Si al iniciar sesión aparece `Missing or insufficient permissions`, normalmente la autenticación sí ha funcionado, pero Firestore ha rechazado la lectura o escritura posterior.

Para solucionarlo, publica las reglas del fichero `firestore.rules` en Firebase Console:

```txt
Firebase Console > Firestore Database > Rules
```

Después pulsa **Publish**. La app necesita permiso para:

- Crear o actualizar `users/{uid}` del usuario autenticado.
- Guardar preferencias personales como `enabledMeals`, `theme` y `groupId`.
- Crear y actualizar `groups/{groupId}`.
- Añadirse como miembro de un grupo cuando conoce el código de invitación.
- Crear un `weeklyMenus/{menuId}` propio.
- Leer menús estando autenticado, porque el histórico y los códigos usan consultas cliente.
- Editar o borrar días de menús donde el usuario sea miembro.
- Crear y actualizar platos reutilizables en `dishes` para sugerencias y estadísticas.

## Colecciones

### `users/{userId}`

Perfil mínimo y preferencias del usuario autenticado.

```json
{
  "displayName": "Jorge",
  "email": "jorge@example.com",
  "enabledMeals": ["breakfast", "lunch", "dinner"],
  "theme": "system",
  "groupId": "group-id",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

`enabledMeals` puede incluir `breakfast`, `lunch` y `dinner`. `theme` puede ser `system`, `light` o `dark`.

### `groups/{groupId}`

Grupo de convivencia o planificación. Permite ver miembros, emails pendientes y opciones compartidas.

```json
{
  "name": "Menu Diario",
  "ownerId": "uid",
  "members": ["uid"],
  "memberEmails": ["jorge@example.com"],
  "pendingEmails": ["otra-persona@example.com"],
  "inviteCode": "ABC123",
  "enabledMeals": ["lunch"],
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

La invitación por email no envía correo desde la app. Guarda el email como pendiente y muestra el código para compartirlo manualmente. La otra persona se une escribiendo ese código en **Ajustes**.

Si un usuario sale de un grupo, se elimina de `members` y se le crea o asigna un grupo propio para que no se quede sin configuración.

### `weeklyMenus/{menuId}`

Menú compartido. Cada día permite desayuno, comida y cena, y cada bloque permite varios platos. También puede marcarse el día completo como no configurable, guardando motivo y nota.

```json
{
  "title": "13 may - 19 may",
  "ownerId": "uid",
  "members": ["uid"],
  "inviteCode": "ABC123",
  "weekStart": "2026-05-11",
  "days": {
    "2026-05-11": {
      "skipped": false,
      "reason": "",
      "skipNote": "",
      "meals": {
        "breakfast": {
          "items": ["Café", "Tostada"],
          "skipped": false,
          "reason": "",
          "note": ""
        },
        "lunch": {
          "items": ["Lentejas", "Ensalada"],
          "skipped": false,
          "reason": "",
          "note": ""
        },
        "dinner": {
          "items": [],
          "skipped": true,
          "reason": "eating-out",
          "note": "Cena fuera"
        }
      },
      "notes": "Comprar pan"
    }
  },
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp",
  "updatedBy": "uid"
}
```

Cuando `days.{fecha}.skipped` es `true`, la interfaz oculta platos y notas del día y muestra `reason` y `skipNote`. Los campos `meals.*.skipped` se mantienen para compatibilidad y para posibles saltos por comida concreta.

El histórico reutiliza estos documentos buscando menús donde el usuario es miembro y mostrando los días anteriores del rango seleccionado.

### `dishes/{dishId}`

Catálogo de platos reutilizables. Se alimenta automáticamente cuando se añaden platos a un día y también permite crear platos manualmente desde **Mis platos** aunque todavía no se hayan comido.

```json
{
  "name": "Lentejas",
  "normalizedName": "lentejas",
  "createdBy": "uid",
  "members": ["uid"],
  "timesUsed": 3,
  "tags": ["legumbre"],
  "archived": false,
  "createdAt": "serverTimestamp",
  "lastUsedAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

`normalizedName` se usa para evitar duplicados por mayúsculas, acentos o espacios repetidos. Los platos creados manualmente empiezan con `timesUsed: 0` y sin `lastUsedAt`. Archivar un plato cambia `archived` a `true`; no borra ni modifica menús históricos que ya guarden ese nombre en `weeklyMenus.days.*.meals.*.items`.

`tags` queda preparado para futuras integraciones con recetas, sugerencias, lista de la compra y estadísticas avanzadas. La primera versión solo muestra etiquetas si ya existen en Firestore.

## Reglas incluidas

La fuente de verdad está en `firestore.rules`. Copia ese fichero en Firestore Rules si configuras el proyecto desde Firebase Console.

## Índices

Firestore puede pedir crear índices para estas consultas:

```txt
weeklyMenus
  members array-contains
  weekStart desc
```

La lista de platos reutilizables usa `createdBy == uid` y se ordena en el navegador por `timesUsed`, `lastUsedAt`, `createdAt` o `name`, así que no necesita índices compuestos nuevos.

La consulta por código de grupo usa `inviteCode ==`, que normalmente no necesita índice compuesto.

## Notificaciones

La app usa notificaciones del navegador cuando un documento escuchado en tiempo real cambia y el cambio lo hace otro usuario. No usa Firebase Cloud Messaging todavía, por lo que no envía push si el navegador no tiene la app abierta o cargada en segundo plano.

## Seguridad pendiente para producción

Estas reglas están pensadas para que la app funcione en una primera versión cliente-only. Para producción conviene endurecerlas:

- Mover la unión por código a una Cloud Function para reducir `allow read: if signedIn()` en `weeklyMenus` y `groups`.
- Enviar invitaciones reales por email desde backend o Cloud Functions.
- Validar longitudes máximas de `meals.*.items`, `meals.*.note`, `notes`, `skipNote`, `title`, `inviteCode`, `name`, `memberEmails` y `pendingEmails`.
- Impedir que usuarios no propietarios cambien `ownerId` o eliminen miembros arbitrariamente.
- Usar códigos de invitación más largos o con caducidad.
- Repetir en backend cualquier cuota de IA si se añaden Cloud Functions o endpoints propios.
