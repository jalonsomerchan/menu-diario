# Firebase para Menu Diario

Esta webapp usa Firebase Auth, Firestore, App Check y una base preparada para Firebase AI Logic/Gemini desde el navegador. Las variables `PUBLIC_FIREBASE_*` son públicas y deben protegerse con reglas de seguridad, App Check, límites operativos y monitorización.

## Servicios necesarios

Activa en Firebase Console:

- Authentication: Google y Anonymous.
- Firestore Database.
- App Check para la app web.
- Firebase AI Logic cuando se activen funciones con Gemini.
- Authorized domains: `localhost`, `jalonsomerchan.github.io` y el dominio personalizado si existe.

La guía detallada de App Check vive en `docs/app-check.md`.

## Inicialización cliente

`src/lib/firebase/client.ts` carga dinámicamente los módulos oficiales del Firebase Web SDK y llama a `initializeFirebaseAppCheck(app)` antes de exponer Auth y Firestore. Esto permite activar App Check por entorno sin añadir dependencias npm ni romper despliegues en GitHub Pages.

Archivos principales:

```text
src/lib/firebase/config.ts     Configuración pública de Firebase y App Check
src/lib/firebase/app-check.ts  Inicialización, estado y helpers de App Check
src/lib/firebase/client.ts     App, Auth y Firestore con carga dinámica
```

## Variables de entorno

Configura `.env` desde `.env.example` y no subas nunca valores reales privados. Las claves públicas identifican la app web, pero no son una frontera de seguridad.

```env
PUBLIC_FIREBASE_API_KEY=
PUBLIC_FIREBASE_AUTH_DOMAIN=
PUBLIC_FIREBASE_PROJECT_ID=
PUBLIC_FIREBASE_STORAGE_BUCKET=
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
PUBLIC_FIREBASE_APP_ID=
PUBLIC_FIREBASE_MEASUREMENT_ID=
PUBLIC_FIREBASE_APPCHECK_ENABLED=false
PUBLIC_FIREBASE_APPCHECK_SITE_KEY=
PUBLIC_FIREBASE_APPCHECK_AUTO_REFRESH=true
PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI=false
PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=
```

`PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` solo debe usarse en desarrollo local controlado. No lo rellenes en `.env.example`, README ni documentación compartida.

## App Check

La integración usa `ReCaptchaEnterpriseProvider` e inicializa App Check con `isTokenAutoRefreshEnabled` según `PUBLIC_FIREBASE_APPCHECK_AUTO_REFRESH`. El SDK de Firebase recomienda inicializar App Check antes de acceder a otros servicios de Firebase y activar explícitamente el auto-refresh cuando se quiera renovar tokens automáticamente.

Configuración recomendada:

- **Localhost:** empieza con `PUBLIC_FIREBASE_APPCHECK_ENABLED=false`. Actívalo cuando `localhost` esté registrado o cuando uses un token local de depuración.
- **GitHub Pages:** registra `jalonsomerchan.github.io`, configura las variables públicas en Actions Variables y prueba primero sin enforcement.
- **Dominio propio:** registra el host real en Auth y App Check; `ASTRO_BASE` solo afecta a rutas, no al dominio validado por App Check.

Activación gradual:

1. App Check desactivado en cliente y enforcement desactivado en Firebase.
2. `PUBLIC_FIREBASE_APPCHECK_ENABLED=true` con enforcement desactivado para observar métricas.
3. Enforcement de Firestore cuando Auth, grupos, platos y menús funcionen con tráfico verificado.
4. `PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI=true` y enforcement de Firebase AI Logic antes de exponer funciones costosas.
5. Añadir límites de backend si se incorporan Cloud Functions o endpoints propios.

Para comprobarlo, revisa DevTools, busca errores `[firebase] app-check`, confirma tráfico verificado en Firebase Console y prueba Firestore/AI con enforcement apagado antes de encenderlo.

## Firebase AI Logic y Gemini

La base técnica de IA vive en `src/lib/ai/` y está preparada para usarse desde futuras funciones concretas sin añadir dependencias npm.

Archivos principales:

```text
src/lib/ai/config.ts         Modelos, temperatura, topP, tokens, timeouts y prompts base
src/lib/ai/client.ts         Wrapper mínimo para Gemini con JSON validado, timeout y App Check opcional obligatorio
src/lib/ai/errors.ts         Errores normalizados y logs no sensibles
src/lib/ai/flags.ts          Feature flags por entorno y Remote Config
src/lib/ai/json.ts           Helpers para pedir y validar JSON estructurado
src/lib/ai/limits.ts         Límites básicos por usuario/sesión en cliente
src/lib/ai/remote-config.ts  Preparación opcional para Firebase Remote Config
src/lib/ai/ui-state.ts       Estados comunes traducibles de UI
```

La IA queda desactivada por defecto. Las sugerencias inteligentes deben usar el catálogo visible completo: platos generales (`scope: global`) y platos propios (`scope: group` o `scope: user`) ya cargados por `watchDishes`.

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

### Protección de IA con App Check

`generateGeminiJson` llama a `assertFirebaseAppCheckReadyForAi()` antes de invocar Gemini cuando `PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI=true`. Si App Check no está listo, se devuelve el error normalizado `app-check-unavailable`, que la UI puede mostrar con la clave traducible `ai.appCheckUnavailable`.

### Límites cliente

`src/lib/ai/limits.ts` aplica límites básicos con `sessionStorage`:

- `PUBLIC_AI_MAX_SESSION_REQUESTS` limita una sesión del navegador.
- `PUBLIC_AI_MAX_USER_DAILY_REQUESTS` limita un usuario o invitado durante el día local registrado.

Estos límites solo mejoran UX y reducen abuso accidental. no son una protección real porque el usuario controla el cliente. Si más adelante la app añade Cloud Functions, deben repetirse los límites en backend por `uid`, IP, App Check y coste acumulado.

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
- Leer platos generales y platos propios visibles para su grupo.
- Crear y actualizar platos propios, pero no platos generales desde la UI normal.

Si el error aparece solo tras activar enforcement, revisa también `docs/app-check.md`, dominios registrados y métricas de App Check.

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
        "breakfast": { "items": ["Café", "Tostada"], "skipped": false, "reason": "", "note": "" },
        "lunch": { "items": ["Lentejas", "Ensalada"], "skipped": false, "reason": "", "note": "" },
        "dinner": { "items": [], "skipped": true, "reason": "eating-out", "note": "Cena fuera" }
      },
      "notes": "Comprar pan"
    }
  },
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp",
  "updatedBy": "uid"
}
```

### `dishes/{dishId}`

El catálogo de platos usa **una sola colección** `dishes`. Se eligió este modelo para no duplicar consultas, normalización, deduplicación, UI, sugerencias y futuras funciones de IA. La separación se hace con campos explícitos de ámbito y permisos.

#### Plato general

Creado o gestionado por administración. Visible para usuarios autenticados y no editable desde la UI normal.

```json
{
  "name": "Lentejas con verduras",
  "normalizedName": "lentejas con verduras",
  "scope": "global",
  "groupId": null,
  "createdBy": "admin-uid",
  "isGlobal": true,
  "editable": false,
  "source": "admin",
  "timesUsed": 0,
  "favorite": false,
  "blocked": false,
  "tags": ["legumbre"],
  "quickTags": ["cheap", "healthy"],
  "archived": false,
  "archivedAt": null,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

#### Plato propio del grupo

Creado desde menús, manualmente en **Mis platos** o duplicando un plato general. Visible y editable por miembros autorizados del grupo.

```json
{
  "name": "Lentejas de casa",
  "normalizedName": "lentejas de casa",
  "scope": "group",
  "groupId": "group-id",
  "createdBy": "uid",
  "members": ["uid"],
  "isGlobal": false,
  "editable": true,
  "source": "duplicated-global",
  "duplicatedFrom": "global_lentejas con verduras",
  "timesUsed": 0,
  "favorite": false,
  "blocked": false,
  "tags": ["legumbre"],
  "quickTags": ["cheap", "healthy"],
  "archived": false,
  "archivedAt": null,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

#### Fallback `scope: user`

Si una sesión todavía no tiene `groupId` o existen datos antiguos, la app mantiene compatibilidad con platos personales por `createdBy`. En cuanto hay grupo, las nuevas escrituras pasan a `scope: group`.

#### Campos clave

- `scope`: `global`, `group` o `user`.
- `groupId`: obligatorio para `scope: group`.
- `createdBy`: UID que creó el documento o UID administrativo.
- `isGlobal`: redundante pero explícito para UI/reglas.
- `editable`: `false` en globales, `true` en propios.
- `source`: `admin`, `manual`, `menu`, `group`, `legacy` o `duplicated-global`.
- `archived` y `archivedAt`: archivado lógico sin borrar históricos.
- `duplicatedFrom`: id del plato general original cuando aplica.

`normalizedName` se usa para evitar duplicados por mayúsculas, acentos o espacios repetidos. La UI avisa si se intenta crear un plato propio con el mismo nombre que un general o que otro propio visible.

`favorite` prioriza el plato en listados y sugerencias. `blocked` evita que el plato propio aparezca como sugerencia automática, aunque el usuario puede escribirlo manualmente en un menú. Los platos generales no se pueden bloquear, archivar ni marcar favoritos desde la UI normal; para personalizarlos se duplican primero.

## Sembrar platos generales

El repositorio incluye `data/global-dishes.seed.json` como ejemplo controlado y sin credenciales. No contiene claves privadas ni configuración de Firebase.

Opciones seguras:

1. Importación manual desde Firebase Console, creando documentos en `dishes` con `scope: global`, `isGlobal: true`, `editable: false` y `source: admin`.
2. Script local fuera del repo con Firebase Admin SDK y credenciales en una ruta no versionada.
3. Tarea de backend protegida si más adelante se añaden Cloud Functions.

Al sembrar, añade estos campos si no vienen en el JSON:

```json
{
  "createdBy": "admin-uid",
  "timesUsed": 0,
  "favorite": false,
  "blocked": false,
  "archived": false,
  "archivedAt": null,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Equivalente en objetos JavaScript para scripts locales: `timesUsed: 0`.

El id recomendado es `global_` + `encodeURIComponent(normalizedName)` saneado igual que `getDishId`, o cualquier id estable documentado.

## Reglas incluidas

La fuente de verdad está en `firestore.rules`. Copia ese fichero en Firestore Rules si configuras el proyecto desde Firebase Console.

Las reglas actuales permiten:

- Leer `dishes` a usuarios autenticados.
- Crear o modificar platos globales solo a usuarios con custom claim `admin == true`.
- Crear o modificar platos `scope: group` solo si el usuario pertenece a `groups/{groupId}.members`.
- Crear o modificar platos `scope: user` propios como compatibilidad con datos antiguos o ausencia temporal de grupo.
- Bloquear borrados físicos de platos. El borrado funcional se hace con `archived` y `archivedAt`.

Para convertir a un usuario en administrador hay que asignar custom claims desde un entorno seguro, por ejemplo con Admin SDK en local o backend:

```js
await getAuth().setCustomUserClaims(uid, { admin: true });
```

No ejecutes ese código en cliente ni guardes credenciales de servicio en el repo.
App Check debe aplicarse desde Firebase Console con enforcement por servicio; no se expresa dentro de `firestore.rules`.

## Índices

Firestore puede pedir crear índices para estas consultas:

```txt
weeklyMenus
  members array-contains
  weekStart desc

dishes
  scope asc
  normalizedName asc

dishes
  scope asc
  groupId asc
  normalizedName asc

dishes
  scope asc
  groupId asc
```

La lista de platos reutilizables se ordena en el navegador por favoritos, bloqueados, etiquetas, `timesUsed`, `lastUsedAt`, `createdAt` o `name`, así que no necesita índices compuestos para ordenación.

## Notificaciones

La app usa notificaciones del navegador cuando un documento escuchado en tiempo real cambia y el cambio lo hace otro usuario. No usa Firebase Cloud Messaging todavía, por lo que no envía push si el navegador no tiene la app abierta o cargada en segundo plano.

## Seguridad pendiente para producción

Estas reglas están pensadas para que la app funcione en una primera versión cliente-only. Para producción conviene endurecerlas:

- Mover la unión por código a una Cloud Function para reducir `allow read: if signedIn()` en `weeklyMenus` y `groups`.
- Enviar invitaciones reales por email desde backend o Cloud Functions.
- Validar longitudes máximas de `meals.*.items`, `meals.*.note`, `notes`, `skipNote`, `title`, `inviteCode`, `name`, `memberEmails`, `pendingEmails`, `quickTags` y `tags`.
- Impedir que usuarios no propietarios cambien `ownerId` o eliminen miembros arbitrariamente.
- Añadir validaciones estrictas por campos permitidos en `dishes` si la app pasa a producción con más roles.
- Usar códigos de invitación más largos o con caducidad.
- Repetir en backend cualquier cuota de IA si se añaden Cloud Functions o endpoints propios.
- Mantener App Check enforcement para Firestore y Firebase AI Logic cuando el tráfico legítimo esté verificado.
