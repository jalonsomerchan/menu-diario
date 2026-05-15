# Menu Diario

Menu Diario es una webapp mobile first para apuntar qué vas a comer cada día, planificar desayunos, comidas y cenas, guardar histórico, ver próximos menús y reutilizar platos ya escritos.

La aplicación está construida sobre Astro y usa Firebase Authentication, Firestore, App Check y una base preparada para Firebase AI Logic/Gemini desde el navegador. Está pensada para funcionar bien en móvil, instalarse como PWA, conservar compatibilidad con GitHub Pages y mantener una base ligera, traducible y modular.

## Flujo principal

- `/`: landing informativa y acceso con Google o sesión invitada.
- `/dashboard`: pantalla rápida para usuarios autenticados.
- `/configurar`: pantalla separada para ajustes y configuración de menús.

En móvil, el dashboard muestra una tarjeta principal tipo resumen y una lista de los próximos 7 días empezando siempre mañana. Cada tarjeta permite editar el día en `/configurar` cuando hay conexión.

## Características principales

- **Dashboard rápido**: resumen de hoy y próximos 7 días.
- **Configurador separado**: ajustes y edición viven en `/configurar`.
- **Preferencias por usuario**: desayuno, comida y/o cena.
- **Tema por usuario**: sistema, claro u oscuro.
- **Varios platos por comida** y reutilización de platos guardados.
- **Días sin comida** con motivo y nota.
- **Autenticación flexible** con Google o invitado anónimo.
- **Firestore en tiempo real** para menús compartidos.
- **PWA móvil** con manifest instalable, service worker ligero y consulta offline del último menú cargado.
- **Firebase App Check** preparado para proteger Firestore y Firebase AI Logic.
- **Firebase AI Logic/Gemini** preparado con flags, timeouts, validación JSON, errores traducidos y límites básicos de cliente.
- **i18n** en español e inglés (`es/en`).
- **GitHub Pages** compatible con dominio raíz y subruta.

## Stack técnico

- Astro 6.
- Tailwind CSS 4.
- TypeScript.
- Firebase Authentication.
- Cloud Firestore.
- Firebase App Check.
- Firebase AI Logic preparado para Gemini.
- Web Notifications API.
- Service Worker y Web App Manifest con APIs nativas.
- Tests smoke con `node:test`.
- GitHub Actions para CI y GitHub Pages.

## Requisitos

Usa Node 22. El repositorio incluye `.nvmrc`.

```sh
nvm use
npm ci
```

## Comandos disponibles

| Comando | Acción |
| --- | --- |
| `npm run dev` | Arranca el servidor local de Astro |
| `npm run build` | Genera la web estática en `dist/` |
| `npm run preview` | Previsualiza el build localmente |
| `npm test` | Ejecuta tests smoke básicos |
| `npm run format` | Formatea CSS, JS, JSON, Markdown, TS y YAML |
| `npm run format:check` | Comprueba formato |
| `npm run clean` | Borra `dist` y `.astro` |

## Puesta en marcha local

1. Instala dependencias:

```sh
npm ci
```

2. Crea el fichero `.env` a partir de `.env.example`:

```sh
cp .env.example .env
```

3. Rellena las variables `PUBLIC_FIREBASE_*` con la configuración pública de tu app web de Firebase.

4. Deja App Check desactivado al principio o actívalo solo cuando tengas `localhost` registrado o un token de depuración local controlado:

```env
PUBLIC_FIREBASE_APPCHECK_ENABLED=false
PUBLIC_FIREBASE_APPCHECK_SITE_KEY=
PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI=false
```

5. Deja la IA desactivada por defecto o activa `PUBLIC_AI_ENABLED=true` cuando Firebase AI Logic y App Check estén listos.

6. Arranca el entorno local:

```sh
npm run dev
```

## Variables de entorno para GitHub Pages

Para GitHub Pages, configura estos nombres en:

```text
Settings > Secrets and variables > Actions > Variables
```

Variables recomendadas:

```text
PUBLIC_FIREBASE_API_KEY
PUBLIC_FIREBASE_AUTH_DOMAIN
PUBLIC_FIREBASE_PROJECT_ID
PUBLIC_FIREBASE_STORAGE_BUCKET
PUBLIC_FIREBASE_MESSAGING_SENDER_ID
PUBLIC_FIREBASE_APP_ID
PUBLIC_FIREBASE_MEASUREMENT_ID
PUBLIC_FIREBASE_APPCHECK_ENABLED
PUBLIC_FIREBASE_APPCHECK_SITE_KEY
PUBLIC_FIREBASE_APPCHECK_AUTO_REFRESH
PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI
PUBLIC_AI_ENABLED
PUBLIC_AI_MENU_SUGGESTIONS_ENABLED
PUBLIC_AI_REMOTE_CONFIG_ENABLED
PUBLIC_FIREBASE_AI_MODEL
PUBLIC_FIREBASE_AI_TEMPERATURE
PUBLIC_FIREBASE_AI_TOP_P
PUBLIC_FIREBASE_AI_MAX_OUTPUT_TOKENS
PUBLIC_FIREBASE_AI_TIMEOUT_MS
PUBLIC_AI_MAX_SESSION_REQUESTS
PUBLIC_AI_MAX_USER_DAILY_REQUESTS
PUBLIC_REPOSITORY_URL
```

`PUBLIC_REPOSITORY_URL` es opcional. `ASTRO_SITE` y `ASTRO_BASE` también son opcionales porque el workflow y `astro.config.mjs` calculan `site` y `base` automáticamente. Si quieres forzarlas:

```text
ASTRO_SITE=https://jalonsomerchan.github.io
ASTRO_BASE=/menu-diario
```

Las claves públicas de Firebase identifican la app web, pero **no sustituyen a reglas correctas de Firestore, App Check, límites de backend ni monitorización**. No subas nunca un `.env` real ni un token de depuración de App Check.

## Configuración de Firebase

Activa en Firebase Console:

1. Authentication con Google.
2. Authentication Anonymous si quieres permitir invitados.
3. Firestore Database.
4. Firebase App Check con proveedor web, preferiblemente reCAPTCHA Enterprise.
5. Firebase AI Logic si vas a activar funciones de IA.
6. Authorized domains:
   - `localhost`.
   - `jalonsomerchan.github.io`.
   - tu dominio personalizado, si lo usas.

Publica las reglas de `firestore.rules` en:

```text
Firebase Console > Firestore Database > Rules
```

La documentación del modelo de datos, reglas, índices, App Check y preparación de Firebase AI vive en:

- `docs/firebase.md`.
- `docs/app-check.md`.

## PWA y modo offline

La PWA se apoya en APIs nativas y ficheros pequeños:

- `src/pages/manifest.webmanifest.ts`: manifest instalable y respetuoso con `BASE_URL`.
- `src/pages/sw.js.ts`: service worker con precache de rutas principales y caché ligera de assets del mismo origen.
- `src/scripts/pwa-register.ts`: registro del service worker con `scope` basado en `import.meta.env.BASE_URL`.
- `src/lib/pwa/`: estado online/offline, caché local versionada y estado de sincronización.

El dashboard guarda el último menú cargado correctamente en `localStorage` con versión. Si se abre sin conexión, muestra ese menú en modo solo lectura con un aviso accesible y traducido. En esta fase **no se permite editar offline**: no hay cola local de cambios para evitar conflictos silenciosos si Firestore cambió mientras el dispositivo estaba sin conexión.

La guía completa está en `docs/pwa-offline.md`.

## App Check y activación gradual

La app inicializa App Check en `src/lib/firebase/app-check.ts` antes de exponer Auth y Firestore desde `src/lib/firebase/client.ts`.

Estrategia recomendada:

1. Desarrollo local: `PUBLIC_FIREBASE_APPCHECK_ENABLED=false`.
2. Monitorización: `PUBLIC_FIREBASE_APPCHECK_ENABLED=true`, enforcement desactivado en Firebase.
3. Firestore: activar enforcement cuando las métricas muestren tráfico válido.
4. IA: activar `PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI=true` y enforcement de Firebase AI Logic antes de exponer funciones costosas.
5. Producción: añadir límites reales en backend si se incorporan Cloud Functions o endpoints propios.

## Firebase AI Logic / Gemini

La base de IA vive en `src/lib/ai/` y está desactivada por defecto. Incluye:

- Wrapper `generateGeminiJson` con timeout, validación JSON y logs no sensibles.
- Feature flags por entorno y preparación para Remote Config.
- Errores normalizados y estados de UI traducibles.
- Límite por sesión y por usuario/día en cliente.
- Comprobación de App Check antes de Gemini cuando `PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI=true`.

Los límites de cliente (`PUBLIC_AI_MAX_SESSION_REQUESTS` y `PUBLIC_AI_MAX_USER_DAILY_REQUESTS`) solo reducen abuso accidental y mejoran UX. No son una protección real porque el usuario controla el navegador.

## Modelo de datos principal

### `users/{uid}`

```json
{
  "displayName": "Jorge",
  "enabledMeals": ["lunch"],
  "theme": "system",
  "updatedAt": "timestamp"
}
```

### `weeklyMenus/{menuId}`

```json
{
  "ownerId": "uid",
  "members": ["uid"],
  "weekStart": "2026-05-15",
  "days": {
    "2026-05-16": {
      "meals": {
        "lunch": {
          "items": ["Pasta"],
          "skipped": false,
          "reason": "",
          "note": ""
        }
      },
      "notes": ""
    }
  }
}
```

### `dishes/{dishId}`

```json
{
  "name": "Pasta",
  "normalizedName": "pasta",
  "createdBy": "uid",
  "members": ["uid"],
  "timesUsed": 3,
  "lastUsedAt": "timestamp"
}
```

## Estructura principal

```text
src/components/DashboardApp.astro      Dashboard rápido
src/components/ConfiguratorApp.astro   Ajustes y configurador
src/scripts/dashboard-app.ts           Lógica del dashboard
src/scripts/configurator-app.ts        Lógica de ajustes/configuración
src/scripts/pwa-register.ts            Registro del service worker
src/pages/sw.js.ts                     Service worker dinámico y base-aware
src/lib/firebase/                      Inicialización de Firebase y App Check
src/lib/menu/repository.ts             Operaciones de Firestore
src/lib/menu/types.ts                  Tipos del dominio
src/lib/pwa/                           Helpers de conexión, caché offline y sync state
src/lib/ai/                            Base Firebase AI Logic/Gemini
src/i18n/translations/*.json           Textos traducibles
src/styles/global.css                  Tokens visuales, light/dark y UI mobile first
src/styles/pwa.css                     Estados offline y PWA
docs/firebase.md                       Modelo de datos, reglas e índices
docs/app-check.md                      Configuración y depuración de App Check
docs/pwa-offline.md                    Instalación, caché, offline y límites
```

## Tests y validación

Antes de abrir o fusionar cambios:

```sh
npm ci
npm test
npm run build
```

Los tests smoke comprueban que:

- La estructura mínima de Astro existe.
- Las rutas `/dashboard` y `/configurar` existen también en idiomas secundarios.
- Las traducciones `es/en` mantienen las mismas claves.
- El dashboard y el configurador están conectados a sus scripts.
- La base de Firebase AI conserva flags, configuración, validación JSON y estados de error.
- App Check mantiene variables, inicialización, documentación y errores traducidos.
- La PWA mantiene manifest instalable, service worker con `base`, estado offline traducido y caché local versionada.
- Las rutas siguen siendo compatibles con GitHub Pages.

## Documentación para agentes IA

Antes de modificar el proyecto, una IA debe leer:

- `agents.md`.
- `docs/ai-checklist.md`.
- `docs/template-usage.md`.
- `docs/i18n-guide.md`.
- `docs/github-pages.md`.
- `docs/testing-guide.md`.
- `docs/design-system.md`.
- `docs/firebase.md`.
- `docs/app-check.md`.
- `docs/pwa-offline.md`.

## Notas técnicas

La integración de Firebase se carga dinámicamente en el navegador desde los módulos oficiales versionados de Firebase Web SDK. Así se evita añadir dependencias nuevas al lockfile de npm y se mantiene el proyecto ligero.

No se incluye ningún secreto en el repositorio. El fichero `.env` está ignorado por Git y solo debe existir en local o en el entorno de despliegue.
