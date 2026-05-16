# Estadísticas de uso de platos

`timesUsed` representa cuántas veces se ha añadido un plato nuevo a una comida concreta del menú. No debe subir solo por abrir un editor, guardar sin cambios, reordenar campos o volver a guardar el mismo array de platos.

## Regla de incremento

La app compara los platos anteriores de la comida con los platos nuevos usando conteo por nombre exacto:

- añadir `Yogur` a `[Lentejas]` incrementa solo `Yogur`;
- guardar de nuevo `[Lentejas]` no incrementa nada;
- cambiar `[Lentejas]` por `[Pollo]` incrementa solo `Pollo`;
- pasar de `[Tortilla]` a `[Tortilla, Tortilla]` incrementa una vez `Tortilla`;
- quitar un plato no incrementa estadísticas.

El helper compartido vive en `src/lib/menu/dish-usage.mjs` y se usa tanto en cambios de día completo como en patches antiguos de `items`.

## `lastUsedAt`

Por ahora `lastUsedAt` se actualiza cuando se registra un uso nuevo real. La fecha procede de `serverTimestamp()` de Firestore, por lo que representa el momento de registro del uso. Si más adelante se necesita diferenciar la fecha exacta del menú frente al momento de edición, debe añadirse un campo separado y documentado.
