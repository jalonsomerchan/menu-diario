# Menu Diario

Menu Diario es una webapp mobile first para apuntar qué vas a comer cada día, planificar comidas y cenas por semanas, guardar histórico, ver próximos menús y compartir la planificación con otras personas para decidir y editar el menú juntos.

La aplicación está construida sobre Astro y usa Firebase Authentication y Firestore desde el navegador. Está pensada para funcionar bien en móvil, conservar compatibilidad con GitHub Pages y mantener una base ligera, traducible y modular.

## Características principales

- **Planificación semanal**: cada semana tiene un tablero con los siete días.
- **Comida, cena y notas**: cada día permite apuntar comida, cena y observaciones.
- **Guardado automático**: al editar un campo se actualiza Firestore sin botones extra.
- **Histórico de menús**: las semanas anteriores quedan guardadas y accesibles.
- **Próximos menús**: las semanas actuales o futuras aparecen separadas del histórico.
- **Colaboración en tiempo real**: Firestore sincroniza los cambios entre usuarios conectados.
- **Compartir por código**: cada menú genera un código de invitación para que otras personas puedan unirse.
- **Autenticación flexible**: acceso con Google o como invitado anónimo mediante Firebase Auth.
- **Notificaciones de cambios**: si el usuario activa avisos, el navegador muestra una notificación cuando otra persona modifica el menú abierto.
- **Mobile first**: interfaz optimizada para editar rápido desde el móvil.
- **Modo claro y oscuro**: los estilos se adaptan a la preferencia del sistema.
- **i18n**: textos preparados en español e inglés (`es/en`).
- **SEO y despliegue estático**: conserva layout, metadatos, manifest, robots y compatibilidad con subrutas.
- **Sin secretos en el repositorio**: la configuración real se carga con variables de entorno públicas `PUBLIC_FIREBASE_*`.

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

5. Abre la URL local que indique Astro.

## Configuración de Firebase paso a paso

### 1. Crear proyecto

1. Entra en Firebase Console.
2. Crea un proyecto nuevo o usa uno existente.
3. Añade una aplicación web desde **Project settings > Your apps > Web app**.
4. Copia los datos de configuración de la app web.

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` y rellena estas variables:

```env
PUBLIC_FIREBASE_API_KEY=
PUBLIC_FIREBASE_AUTH_DOMAIN=
PUBLIC_FIREBASE_PROJECT_ID=
PUBLIC_FIREBASE_STORAGE_BUCKET=
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
PUBLIC_FIREBASE_APP_ID=
PUBLIC_FIREBASE_MEASUREMENT_ID=
```

Ejemplo de correspondencia con el objeto de configuración de Firebase:

```js
const firebaseConfig = {
  apiKey: 'PUBLIC_FIREBASE_API_KEY',
  authDomain: 'PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'PUBLIC_FIREBASE_APP_ID',
  measurementId: 'PUBLIC_FIREBASE_MEASUREMENT_ID',
};
```

Estas claves son públicas en una app web, pero **no sustituyen a unas reglas de Firestore correctas**. No subas nunca el fichero `.env` real.

### 3. Activar Authentication

En Firebase Console:

1. Ve a **Build > Authentication**.
2. Activa **Google** como proveedor.
3. Activa **Anonymous** para permitir sesiones invitadas.
4. En **Settings > Authorized domains**, añade:
   - `localhost` para desarrollo.
   - El dominio final de producción.
   - Si usas GitHub Pages, el dominio `usuario.github.io` o tu dominio personalizado.

### 4. Activar Firestore

1. Ve a **Build > Firestore Database**.
2. Crea una base de datos.
3. Elige la región más adecuada.
4. Empieza con reglas seguras, no en modo abierto para producción.

### 5. Crear índices necesarios

La app consulta menús por miembro y ordena por semana:

```txt
weeklyMenus
  members array-contains
  weekStart desc
```

Firestore puede mostrar un error con un enlace para crear el índice compuesto automáticamente. Ábrelo y confirma la creación del índice.

## Modelo de datos en Firestore

### `users/{uid}`

Perfil mínimo del usuario autenticado.

```json
{
  "displayName": "Jorge",
  "updatedAt": "timestamp"
}
```

### `weeklyMenus/{menuId}`

Documento principal de una semana de menú.

```json
{
  "title": "11 may - 17 may",
  "ownerId": "uid-del-creador",
  "members": ["uid-del-creador", "uid-otra-persona"],
  "inviteCode": "ABC123",
  "weekStart": "2026-05-11",
  "days": {
    "2026-05-11": {
      "lunch": "Lentejas",
      "dinner": "Tortilla francesa",
      "notes": "Comprar pan"
    }
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "updatedBy": "uid-ultimo-editor"
}
```

## Reglas iniciales de Firestore

Estas reglas sirven como base para el prototipo. Permiten que los miembros lean y editen sus menús y que alguien pueda unirse a un menú si conoce su código. Para una versión más estricta en producción, conviene mover la unión por código a una Cloud Function.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isMember() {
      return signedIn() && request.auth.uid in resource.data.members;
    }

    function willBeMember() {
      return signedIn() && request.auth.uid in request.resource.data.members;
    }

    match /users/{userId} {
      allow read, write: if signedIn() && request.auth.uid == userId;
    }

    match /weeklyMenus/{menuId} {
      allow create: if signedIn()
        && request.resource.data.ownerId == request.auth.uid
        && request.auth.uid in request.resource.data.members;

      allow get: if signedIn();
      allow list: if signedIn();

      allow update: if isMember() || willBeMember();
      allow delete: if signedIn() && resource.data.ownerId == request.auth.uid;
    }
  }
}
```

### Nota de seguridad sobre invitaciones

La app usa `inviteCode` para compartir menús. En esta primera versión, el cliente consulta por código para unirse. Es suficiente para una fase inicial, pero en producción es preferible:

- Generar códigos más largos.
- Caducar invitaciones.
- Mover la lógica de unión a Cloud Functions.
- Evitar `allow list` general si no es necesario.
- Validar de forma más estricta qué campos puede modificar cada usuario.

## Notificaciones

La app usa la API nativa de notificaciones del navegador:

1. El usuario pulsa **Activar avisos**.
2. El navegador solicita permiso.
3. Si otra persona modifica el menú abierto, Firestore emite el cambio en tiempo real.
4. La app muestra una notificación local con la Web Notifications API.

Limitación actual: las notificaciones funcionan mientras la app está abierta o activa en el navegador. Para push real con la app cerrada habría que añadir Firebase Cloud Messaging, claves VAPID y un service worker específico.

## Compartir un menú

1. Entra con Google o como invitado.
2. Crea o abre una semana.
3. Pulsa **Compartir código**.
4. Envía ese código a otra persona.
5. La otra persona inicia sesión, pega el código en el campo de invitación y pulsa **Unirse**.

A partir de ese momento, ambos usuarios editan el mismo menú y ven los cambios en tiempo real.

## Estructura principal

```text
src/components/MenuApp.astro       UI de la webapp
src/scripts/menu-app.ts            Lógica cliente, Auth, Firestore y notificaciones
src/lib/firebase/config.ts         Lectura de variables públicas de Firebase
src/lib/firebase/client.ts         Carga dinámica de Firebase Web SDK
src/lib/menu/dates.ts              Helpers de semanas y fechas
src/lib/menu/repository.ts         Operaciones de Firestore
src/lib/menu/types.ts              Tipos del dominio de menús
src/lib/notifications/browser.ts   Helper de notificaciones del navegador
src/i18n/translations/*.json       Textos traducibles
src/styles/global.css              Tokens visuales y estilos mobile first
docs/firebase.md                   Modelo de datos y reglas recomendadas
```

## Variables de despliegue

Para despliegues en dominio raíz:

```env
ASTRO_SITE=https://example.com
ASTRO_BASE=/
```

Para GitHub Pages en subruta, el workflow calcula `base` automáticamente usando el nombre del repositorio. Si quieres forzarlo:

```env
ASTRO_SITE=https://usuario.github.io
ASTRO_BASE=/menu-diario/
```

## GitHub Pages

El proyecto conserva compatibilidad con despliegue en dominio raíz y subruta. En GitHub Actions, `astro.config.mjs` calcula automáticamente `site` y `base`.

Antes de desplegar en GitHub Pages, configura las variables `PUBLIC_FIREBASE_*` como variables de entorno del repositorio o del workflow, según el método de despliegue usado.

## Tests y validación

Antes de abrir o fusionar cambios:

```sh
npm ci
npm test
npm run build
```

Los tests smoke comprueban que:

- La estructura mínima de Astro existe.
- Los componentes principales están presentes.
- Las traducciones `es/en` mantienen las mismas claves.
- La home carga la webapp.
- La configuración de Firebase está documentada.
- Los workflows de CI y Pages siguen disponibles.

## i18n

Los idiomas configurados están en `src/config/site.ts`.

Las traducciones viven en:

```text
src/i18n/translations/es.json
src/i18n/translations/en.json
```

Toda clave nueva de UI debe añadirse a todos los JSON configurados.

## Documentación para agentes IA

Antes de modificar el proyecto, una IA debe leer:

- `agents.md`: reglas principales del repositorio.
- `docs/ai-checklist.md`: checklist rápida antes de cerrar tareas.
- `docs/template-usage.md`: cómo usar y modificar la plantilla.
- `docs/i18n-guide.md`: cómo añadir textos, traducciones e idiomas.
- `docs/github-pages.md`: cómo evitar romper GitHub Pages y `base`.
- `docs/testing-guide.md`: cómo mantener tests smoke.
- `docs/design-system.md`: reglas visuales, SEO, accesibilidad y responsive.
- `docs/firebase.md`: reglas, modelo de datos e índices de Firebase.

## Notas técnicas

La integración de Firebase se carga de forma dinámica en el navegador desde los módulos oficiales versionados de Firebase Web SDK. Así se evita añadir dependencias nuevas al lockfile de npm y se mantiene el proyecto ligero.

No se incluye ningún secreto en el repositorio. El fichero `.env` está ignorado por Git y solo debe existir en local o en el entorno de despliegue.
