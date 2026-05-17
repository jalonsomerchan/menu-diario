# Páginas públicas compartibles

Esta guía define la base común para futuras páginas públicas de Menu Diario, como menús semanales compartidos, recetas compartidas o platos públicos.

## Principios

- Una página pública solo debe existir si el usuario o grupo activa explícitamente compartir.
- El enlace público debe usar un `shareId` específico, aleatorio y no adivinable. No se deben mostrar en la UI ids internos de usuario, grupo, documento de Firestore ni códigos de invitación.
- El contenido personal compartido debe ser `noindex,nofollow` por defecto. La indexación solo debe permitirse con una opción explícita del usuario.
- El enlace compartido debe poder desactivarse y regenerarse.
- Las páginas públicas deben mostrar solo una copia mínima de datos públicos, no el documento privado completo.

## Datos permitidos

En un menú público se pueden mostrar, si el usuario lo habilita:

- título público del menú;
- rango de fechas;
- días;
- comidas activas;
- nombres de platos;
- notas marcadas explícitamente como públicas.

En una receta pública se pueden mostrar, si el usuario lo habilita:

- título;
- ingredientes;
- pasos;
- raciones;
- duración aproximada;
- etiquetas públicas;
- notas marcadas explícitamente como públicas.

## Datos prohibidos

Nunca deben exponerse en páginas públicas:

- `uid`, `ownerId`, `createdBy`, `updatedBy` o ids internos de documentos;
- emails;
- miembros del grupo;
- códigos de invitación;
- preferencias alimentarias sensibles;
- alergias o restricciones privadas;
- despensa privada;
- tuppers privados;
- historial completo no seleccionado para compartir;
- notas privadas;
- límites, flags internos o detalles de App Check;
- datos de Firebase que no sean estrictamente necesarios para la vista pública.

## SEO y metadatos

Los helpers de metadatos públicos viven en `src/lib/public-sharing/metadata.mjs`.

Reglas recomendadas:

- `robots`: usar `noindex,nofollow` por defecto.
- `canonical`: generar con `withBasePath()` y `getAbsoluteUrl()` para soportar dominio raíz, subrutas y GitHub Pages.
- Open Graph: usar título y descripción públicos, nunca notas privadas.
- JSON-LD: solo añadirlo cuando la página sea indexable explícitamente y el contenido tenga estructura suficiente.

Ejemplo:

```js
import { createPublicShareMetadata } from '../lib/public-sharing/metadata.mjs';

const metadata = createPublicShareMetadata({
  title: 'Menú semanal',
  description: 'Menú compartido por la familia',
  routePath: `/menu/${shareId}`,
  type: 'menu',
  indexable: false,
});
```

## Modelo recomendado

Campos comunes sugeridos para documentos compartibles:

```json
{
  "publicShare": {
    "enabled": true,
    "shareId": "random-non-guessable-token",
    "indexable": false,
    "createdAt": "serverTimestamp",
    "updatedAt": "serverTimestamp",
    "revokedAt": null
  }
}
```

Si una vista pública necesita alto aislamiento, es preferible guardar una copia mínima en una colección pública separada, por ejemplo `publicShares/{shareId}`, con solo los campos seguros para renderizar la página.

## Reglas Firestore recomendadas

La lectura pública debe limitarse a documentos marcados como compartidos y a una forma mínima de datos públicos.

Ejemplo orientativo:

```txt
match /publicShares/{shareId} {
  allow read: if resource.data.enabled == true;
  allow write: if false;
}
```

La escritura o regeneración de enlaces públicos debe hacerse desde la zona privada y solo por miembros autorizados del grupo o propietario. En modo cliente-only, las reglas deben validar que el usuario autenticado puede activar o revocar el enlace. Si se añade backend, es preferible que la generación de `shareId` y la copia pública mínima se hagan en servidor.

## Checklist antes de crear una página pública

- Usa `shareId` y no ids internos.
- Aplica `noindex,nofollow` por defecto.
- Permite revocar o regenerar el enlace.
- No muestra emails, UIDs, miembros, invitaciones, despensa, tuppers o preferencias privadas.
- Usa helpers de canonical/OG compatibles con base path.
- Incluye tests que busquen datos privados prohibidos en la UI pública.
- Documenta campos nuevos en `docs/firebase.md` cuando se añadan al modelo real.
