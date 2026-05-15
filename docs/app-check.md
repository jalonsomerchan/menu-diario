# Firebase App Check

Menu Diario inicializa App Check desde `src/lib/firebase/app-check.ts` antes de crear Auth y Firestore. La carga sigue siendo dinámica y usa los módulos oficiales versionados del Firebase Web SDK, igual que el resto de Firebase.

## Variables públicas

Añade estas variables al entorno donde despliegues la app:

```env
PUBLIC_FIREBASE_APPCHECK_ENABLED=false
PUBLIC_FIREBASE_APPCHECK_SITE_KEY=
PUBLIC_FIREBASE_APPCHECK_AUTO_REFRESH=true
PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI=false
PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=
```

`PUBLIC_FIREBASE_APPCHECK_SITE_KEY` es la clave pública del proveedor web de App Check. No añadas secretos ni credenciales privadas al cliente. `PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` solo debe usarse en entornos locales controlados y nunca debe rellenarse en `.env.example` ni en documentación compartida con un valor real.

## Configuración recomendada

### Localhost

1. Registra `localhost` en la app web de Firebase y en el proveedor de App Check.
2. Mantén `PUBLIC_FIREBASE_APPCHECK_ENABLED=false` al empezar para no bloquear el desarrollo.
3. Actívalo con `PUBLIC_FIREBASE_APPCHECK_ENABLED=true` cuando hayas registrado el dominio local o tengas un token de depuración local.
4. Deja `PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI=false` hasta confirmar que el token se emite correctamente.

### GitHub Pages

1. Registra `jalonsomerchan.github.io` como dominio permitido.
2. Añade también la URL final con subruta cuando revises enlaces y canonical, aunque App Check valida el host.
3. Configura las variables `PUBLIC_FIREBASE_APPCHECK_*` en `Settings > Secrets and variables > Actions > Variables`.
4. Prueba primero con App Check en modo monitorización antes de forzar cumplimiento.

### Dominio propio

1. Registra el dominio propio en Firebase Auth y App Check.
2. Comprueba que el `site`/`base` de Astro no cambia el host real desde el que se sirve la app.
3. Activa cumplimiento de App Check servicio a servicio: primero Firestore y después Firebase AI Logic cuando no haya errores legítimos.

## Activación gradual

1. **Fase 0:** App Check desactivado en cliente y sin enforcement en Firebase.
2. **Fase 1:** `PUBLIC_FIREBASE_APPCHECK_ENABLED=true`, enforcement desactivado en Firebase. Revisa métricas y consola.
3. **Fase 2:** enforcement para Firestore si Auth, invitaciones y menús funcionan correctamente.
4. **Fase 3:** `PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI=true` y enforcement para Firebase AI Logic antes de exponer funciones costosas.
5. **Fase 4:** mantener límites de cliente, añadir límites de backend si se incorporan Cloud Functions o endpoints propios.

## Firebase AI Logic / Gemini

`generateGeminiJson` llama a `assertFirebaseAppCheckReadyForAi()` antes de invocar Gemini cuando `PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI=true`. Si App Check no está listo, devuelve el error normalizado `app-check-unavailable`, que se mapea a la clave traducible `ai.appCheckUnavailable`.

Los límites actuales de IA viven en `src/lib/ai/limits.ts` y usan `sessionStorage`:

- `PUBLIC_AI_MAX_SESSION_REQUESTS`: máximo por sesión de navegador.
- `PUBLIC_AI_MAX_USER_DAILY_REQUESTS`: máximo por usuario o invitado durante el día registrado.

Estos límites son útiles para UX y abuso accidental, pero no son una frontera de seguridad. Cualquier límite real de coste debe repetirse en backend con Auth, App Check, IP y métricas de uso.

## Cómo comprobar que funciona

1. Arranca la app con Firebase configurado y `PUBLIC_FIREBASE_APPCHECK_ENABLED=true`.
2. Abre DevTools y verifica que no aparecen avisos `[firebase] app-check`.
3. En Firebase Console, revisa App Check y confirma que llegan peticiones verificadas.
4. Si activas `PUBLIC_FIREBASE_APPCHECK_REQUIRED_FOR_AI=true`, una llamada de IA debe funcionar solo cuando App Check esté en estado `ready`.
5. Cuando Firebase muestre tráfico válido, activa enforcement primero en modo controlado y revisa errores de Firestore y AI Logic.

## Depuración

- Si ves `ai.appCheckUnavailable`, falta la clave pública, el dominio no está registrado, el proveedor no puede cargar o el token no se emite.
- Si Firestore devuelve permisos aunque Auth esté correcto, revisa App Check enforcement y las reglas de `firestore.rules`.
- Si solo falla en GitHub Pages, confirma el host real, las variables de Actions y que `ASTRO_BASE` no se confundió con un dominio.
- Si usas token de depuración local, no lo subas nunca al repositorio ni lo configures en entornos públicos.
