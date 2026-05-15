# Menu Diario

Menu Diario es una webapp mobile first para apuntar qué vas a comer cada día, planificar desayunos, comidas y cenas, guardar histórico, ver próximos menús y reutilizar platos ya escritos.

La aplicación está construida sobre Astro y usa Firebase Authentication y Firestore desde el navegador. Está pensada para funcionar bien en móvil, conservar compatibilidad con GitHub Pages y mantener una base ligera, traducible y modular.

## Flujo principal

- `/`: landing informativa y acceso con Google o sesión invitada.
- `/dashboard`: pantalla rápida para usuarios autenticados.
- `/configurar`: pantalla separada para edición de menús.
- `/platos`: catálogo de platos generales y platos propios.
- `/ajustes`: grupo, preferencias y opciones compartidas.

En móvil, el dashboard muestra una tarjeta principal tipo resumen:

```text
Hola Jorge
Hoy para comer:
- Pasta
```

Debajo aparecen accesos a **Ajustes**, **Configurar** y **Mis platos**, y después una lista de los próximos 7 días. Esa lista empieza siempre **mañana**, no el lunes.

## Características principales

- **Dashboard rápido**: resumen de hoy y próximos 7 días.
- **Configurador separado**: edición de días en `/configurar` y edición rápida desde dashboard e histórico.
- **Próximos 7 días desde mañana**: el dashboard y el configurador no dependen de que la semana empiece en lunes.
- **Preferencias por usuario**: cada usuario elige si quiere configurar desayuno, comida y/o cena.
- **Tema por usuario**: sistema, claro u oscuro. Por defecto usa la preferencia del navegador.
- **Varios platos por comida**: cada plato es un input independiente con búsqueda y texto libre.
- **Catálogo dual de platos**: platos generales gestionados por administración y platos propios del grupo editables por miembros.
- **Duplicado controlado**: un plato general puede duplicarse como propio para personalizarlo sin tocar el catálogo común.
- **Deduplicación normalizada**: se comparan nombres sin mayúsculas, acentos ni espacios repetidos.
- **Días sin comida**: al marcar que una comida no se apunta, se muestran motivo y nota.
- **Autenticación flexible**: acceso con Google o como invitado anónimo mediante Firebase Auth.
- **Firestore en tiempo real**: los cambios se sincronizan con el documento de menú activo.
- **i18n**: textos preparados en español e inglés (`es/en`).
- **GitHub Pages**: rutas y assets preparados para dominio raíz y subruta.

## Stack técnico

- Astro 6.
- Tailwind CSS 4.
- TypeScript.
- Firebase Authentication.
- Cloud Firestore.
- Firebase AI Logic preparado para Gemini.
- Web Notifications API.
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

3. Rellena las variables `PUBLIC_FIREBASE_*` con la configuración de tu app web de Firebase.

4. Deja la IA desactivada por defecto o activa `PUBLIC_AI_ENABLED=true` cuando Firebase AI Logic y App Check estén listos.

5. Arranca el entorno local:

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
PUBLIC_REPOSITORY_URL
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
```

`PUBLIC_REPOSITORY_URL` es opcional. `ASTRO_SITE` y `ASTRO_BASE` también son opcionales porque el workflow y `astro.config.mjs` calculan `site` y `base` automáticamente. Si quieres forzarlas:

```text
ASTRO_SITE=https://jalonsomerchan.github.io
ASTRO_BASE=/menu-diario
```

Las claves públicas de Firebase identifican la app web, pero **no sustituyen a unas reglas correctas de Firestore, App Check y límites de backend**. No subas nunca un `.env` real.

## Configuración de Firebase

Activa en Firebase Console:

1. Authentication con Google.
2. Authentication Anonymous si quieres permitir invitados.
3. Firestore Database.
4. Firebase AI Logic si vas a activar funciones de IA.
5. App Check para proteger llamadas desde cliente.
6. Authorized domains:
   - `localhost`
   - `jalonsomerchan.github.io`
   - tu dominio personalizado, si lo usas.

Publica las reglas de `firestore.rules` en:

```text
Firebase Console > Firestore Database > Rules
```

La documentación del modelo de datos, índices, reglas, siembra de platos generales y preparación de Firebase AI vive en `docs/firebase.md`.

## Modelo de datos principal

### `users/{uid}`

```json
{
  "displayName": "Jorge",
  "enabledMeals": ["lunch"],
  "theme": "system",
  "groupId": "group-id",
  "updatedAt": "timestamp"
}
```

### `groups/{groupId}`

```json
{
  "ownerId": "uid",
  "members": ["uid"],
  "memberEmails": ["jorge@example.com"],
  "pendingEmails": [],
  "inviteCode": "ABC123",
  "enabledMeals": ["lunch"]
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

Aunque la colección mantiene el nombre `weeklyMenus`, el documento activo se usa como bloque de planificación móvil y permite guardar los días próximos aunque no empiecen en lunes.

### `dishes/{dishId}`

El catálogo usa una sola colección para evitar duplicar lógica de búsqueda, sugerencias, normalización y deduplicación. El campo `scope` separa el origen:

```json
{
  "name": "Lentejas con verduras",
  "normalizedName": "lentejas con verduras",
  "scope": "global",
  "source": "admin",
  "isGlobal": true,
  "editable": false,
  "createdBy": "admin-uid",
  "timesUsed": 0,
  "archived": false,
  "quickTags": ["cheap", "healthy"]
}
```

```json
{
  "name": "Lentejas de la abuela",
  "normalizedName": "lentejas de la abuela",
  "scope": "group",
  "groupId": "group-id",
  "source": "duplicated-global",
  "isGlobal": false,
  "editable": true,
  "createdBy": "uid",
  "members": ["uid"],
  "duplicatedFrom": "global_lentejas",
  "timesUsed": 0,
  "archived": false
}
```

- `scope: global`: lectura para usuarios autenticados y escritura solo para administradores con custom claim `admin`.
- `scope: group`: lectura y edición para miembros autorizados del grupo.
- `scope: user`: fallback compatible para sesiones sin `groupId` o datos antiguos.
- `archivedAt` marca archivado sin eliminar referencias históricas de menús.

## Sembrar platos generales

El fichero `data/global-dishes.seed.json` contiene datos iniciales sin credenciales. Puedes importarlo con la consola de Firebase, un script local controlado o Admin SDK fuera del repo. Al importar añade `createdBy`, `createdAt`, `updatedAt`, `timesUsed: 0`, `archived: false` y conserva `scope: "global"`, `source: "admin"`, `isGlobal: true`, `editable: false`.

## Estructura principal

```text
src/components/DashboardApp.astro      Dashboard rápido
src/components/ConfiguratorApp.astro   Configurador de menús
src/components/DishesApp.astro         Catálogo de platos
src/scripts/dashboard-app.ts           Lógica del dashboard
src/scripts/configurator-app.ts        Lógica de configuración
src/scripts/dishes-app.ts              Lógica de platos generales y propios
src/lib/dishes/                        Repositorio, normalización y deduplicación de platos
src/lib/menu/repository.ts             Operaciones de Firestore
src/lib/menu/types.ts                  Tipos del dominio
src/lib/ai/                            Base Firebase AI Logic/Gemini
src/i18n/translations/*.json           Textos traducibles
src/styles/global.css                  Tokens visuales, light/dark y UI mobile first
docs/firebase.md                       Modelo de datos, reglas e índices
firestore.rules                        Reglas de seguridad
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
- Las rutas privadas existen también en idiomas secundarios.
- Las traducciones `es/en` mantienen las mismas claves.
- El dashboard, configurador, histórico y catálogo están conectados a sus scripts.
- El catálogo distingue platos generales y propios, permisos de edición, normalización y deduplicación.
- Las reglas de Firestore contienen controles para admin, grupo y platos globales.
- La base de Firebase AI conserva flags, configuración, validación JSON y estados de error.
- Las rutas siguen siendo compatibles con GitHub Pages.
