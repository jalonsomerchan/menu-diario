# Opciones personalizadas por día

Las opciones personalizadas permiten marcar condiciones del día sin mezclarlas con comidas, platos ni notas. Ejemplos: `llego tarde`, `comida fuera`, `día de niños`, `entreno` o `no cocinar`.

## Uso

- Se gestionan desde **Ajustes > Condiciones personalizadas**.
- Cada opción tiene nombre, descripción opcional, estado activo/inactivo, color, icono y orden.
- Las opciones activas aparecen como checkboxes en el modal de edición de cada día.
- Al guardar un día, solo se guardan los ids marcados en `days[isoDate].optionIds`.
- Dashboard, planificación e histórico muestran badges con las opciones marcadas.

## Modelo

Las definiciones viven en `dailyOptions/{optionId}` y los días solo guardan referencias por id. Esto mantiene separado el contexto del día respecto a platos y comidas.

```json
{
  "name": "No cocinar",
  "description": "Usar platos fríos o ya preparados",
  "active": true,
  "color": "slate",
  "icon": "no-cook",
  "order": 20,
  "scope": "group",
  "ownerId": "group-id",
  "groupId": "group-id",
  "createdBy": "uid",
  "members": ["uid"]
}
```

## IA

El planificador inteligente recibe las opciones marcadas como condiciones. Debe tratarlas como restricciones blandas de planificación: llegada tarde prioriza platos rápidos, entreno prioriza comidas nutritivas, no cocinar prioriza opciones sin cocción o de bajo esfuerzo.

## Módulos

- `src/lib/menu/daily-options.ts`: normalización y helpers de selección/resumen.
- `src/lib/menu/daily-options-repository.ts`: lectura y escritura en Firestore.
- `src/lib/menu/day-editor.ts`: checkboxes accesibles en el editor de día.
- `src/lib/menu/day-card-data.ts`: badges de resumen.
