# Menu Diario

Webapp mobile first para apuntar el menú diario, planificar comidas y cenas por semana, guardar histórico, compartir tableros con otras personas y recibir avisos cuando alguien cambie un plato.

## Funcionalidades

- Autenticación con Google o sesión invitada mediante Firebase Auth.
- Menús semanales en Firestore con comida, cena y notas por día.
- Histórico y próximos menús mediante semanas independientes.
- Colaboración en tiempo real con listeners de Firestore.
- Invitación por código para compartir un menú con más personas.
- Notificaciones del navegador cuando otra persona modifica el menú abierto.
- UI responsive, accesible, preparada para modo claro/oscuro e i18n `es/en`.

## Requisitos

Usa Node 22. El repositorio incluye `.nvmrc`.

```sh
nvm use
npm ci
```

## Configuración de Firebase

Copia `.env.example` a `.env` y rellena las variables públicas de la app web de Firebase:

```env
PUBLIC_FIREBASE_API_KEY=
PUBLIC_FIREBASE_AUTH_DOMAIN=
PUBLIC_FIREBASE_PROJECT_ID=
PUBLIC_FIREBASE_STORAGE_BUCKET=
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
PUBLIC_FIREBASE_APP_ID=
PUBLIC_FIREBASE_MEASUREMENT_ID=
```

Estas claves públicas identifican la app web, pero no sustituyen a unas reglas correctas de Firestore. No subas `.env` al repositorio.

Activa en Firebase:

1. Authentication con Google y Anonymous.
2. Firestore Database.
3. Reglas de seguridad adaptadas a `docs/firebase.md`.
4. El dominio de despliegue en Authorized domains de Authentication.

## Comandos

| Comando | Acción |
| --- | --- |
| `npm run dev` | Arranca el servidor local de Astro |
| `npm run build` | Genera la web estática en `dist/` |
| `npm run preview` | Previsualiza el build localmente |
| `npm test` | Ejecuta tests smoke básicos |
| `npm run format` | Formatea CSS, JS, JSON, Markdown, TS y YAML |
| `npm run format:check` | Comprueba formato |
| `npm run clean` | Borra `dist` y `.astro` |

## Estructura principal

```text
src/components/MenuApp.astro       UI de la webapp
src/scripts/menu-app.ts            Lógica cliente, Auth, Firestore y notificaciones
src/i18n/translations/*.json       Textos traducibles
src/styles/global.css              Tokens visuales y estilos mobile first
docs/firebase.md                   Modelo de datos y reglas recomendadas
```

## GitHub Pages

El proyecto conserva compatibilidad con despliegue en dominio raíz y subruta. En GitHub Actions, `astro.config.mjs` calcula automáticamente `site` y `base`. Para dominio propio usa:

```env
ASTRO_SITE=https://example.com
ASTRO_BASE=/
```

## Documentación para agentes IA

Antes de modificar el proyecto, una IA debe leer:

- `agents.md`: reglas principales del repositorio.
- `docs/ai-checklist.md`: checklist rápida antes de cerrar tareas.
- `docs/template-usage.md`: cómo usar y modificar la plantilla.
- `docs/i18n-guide.md`: cómo añadir textos, traducciones e idiomas.
- `docs/github-pages.md`: cómo evitar romper GitHub Pages y `base`.
- `docs/testing-guide.md`: cómo mantener tests smoke.
- `docs/design-system.md`: reglas visuales, SEO, accesibilidad y responsive.

## Notas técnicas

La integración de Firebase se carga de forma dinámica en el navegador desde los módulos oficiales de Firebase Web SDK para no añadir dependencias nuevas al lockfile de npm. Esto mantiene el proyecto ligero y evita romper `npm ci` en CI.
