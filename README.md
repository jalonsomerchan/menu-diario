# Menu Diario

Menu Diario es una webapp mobile first para apuntar qué vas a comer cada día, planificar desayunos, comidas y cenas, guardar histórico, ver próximos menús y reutilizar platos ya escritos.

La aplicación está construida sobre Astro y usa Firebase Authentication y Firestore desde el navegador. Está pensada para funcionar bien en móvil, conservar compatibilidad con GitHub Pages y mantener una base ligera, traducible y modular.

## Flujo principal

- `/`: landing informativa y acceso con Google o sesión invitada.
- `/dashboard`: pantalla rápida para usuarios autenticados.
- `/configurar`: pantalla separada para ajustes y configuración de menús.

En móvil, el dashboard muestra una tarjeta principal tipo resumen:

```text
Hola Jorge
Hoy para comer:
- Pasta
```

Debajo aparecen accesos a **Ajustes** y **Configurar**, y después una lista de los próximos 7 días. Esa lista empieza siempre **mañana**, no el lunes. Cada tarjeta de día incluye un botón para editar ese día en `/configurar`.

## Características principales

- **Dashboard rápido**: resumen de hoy y próximos 7 días.
- **Configurador separado**: ajustes y edición viven en `/configurar`.
- **Próximos 7 días desde mañana**: el dashboard y el configurador no dependen de que la semana empiece en lunes.
- **Preferencias por usuario**: cada usuario elige si quiere configurar desayuno, comida y/o cena.
- **Tema por usuario**: sistema, claro u oscuro. Por defecto usa la preferencia del navegador.
- **Varios platos por comida**: cada plato es un input independiente.
- **Reutilización de platos**: los inputs usan `datalist` con platos ya escritos para mantener nombres consistentes.
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

4. Arranca el entorno local:

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
```

`PUBLIC_REPOSITORY_URL` es opcional. `ASTRO_SITE` y `ASTRO_BASE` también son opcionales porque el workflow y `astro.config.mjs` calculan `site` y `base` automáticamente. Si quieres forzarlas:

```text
ASTRO_SITE=https://jalonsomerchan.github.io
ASTRO_BASE=/menu-diario
```

Las claves públicas de Firebase identifican la app web, pero **no sustituyen a unas reglas correctas de Firestore**. No subas nunca un `.env` real.

## Configuración de Firebase

Activa en Firebase Console:

1. Authentication con Google.
2. Authentication Anonymous si quieres permitir invitados.
3. Firestore Database.
4. Authorized domains:
   - `localhost`
   - `jalonsomerchan.github.io`
   - tu dominio personalizado, si lo usas.

Publica las reglas de `firestore.rules` en:

```text
Firebase Console > Firestore Database > Rules
```

La documentación del modelo de datos, índices y reglas vive en `docs/firebase.md`.

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

Aunque la colección mantiene el nombre `weeklyMenus`, el documento activo se usa como bloque de planificación móvil y permite guardar los días próximos aunque no empiecen en lunes.

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
src/lib/menu/repository.ts             Operaciones de Firestore
src/lib/menu/types.ts                  Tipos del dominio
src/i18n/translations/*.json           Textos traducibles
src/styles/global.css                  Tokens visuales, light/dark y UI mobile first
docs/firebase.md                       Modelo de datos, reglas e índices
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

## Notas técnicas

La integración de Firebase se carga dinámicamente en el navegador desde los módulos oficiales versionados de Firebase Web SDK. Así se evita añadir dependencias nuevas al lockfile de npm y se mantiene el proyecto ligero.

No se incluye ningún secreto en el repositorio. El fichero `.env` está ignorado por Git y solo debe existir en local o en el entorno de despliegue.
