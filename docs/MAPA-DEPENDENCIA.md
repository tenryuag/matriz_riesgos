# Mapa de dependencia (módulo `dependency`)

VIA Mapa de Dependencia · Modo Director · Semana 1. El empresario registra
cinco días laborables de actividades y de decisiones que le llegan; la app
calcula la línea base y el asistente de IA clasifica las actividades y redacta
el diagnóstico. Sustituye al flujo «llena el Excel y adjúntalo a ChatGPT con
el prompt».

Fuentes del método (en `docs/`, sin versionar): `Prompt Cliente.docx`
(versión 2.1), `VIA Mapa de dependencia.xlsx` (plantilla) y
`Ejemplo VIA Mapa de dependencia.xlsx` (trae datos reales: no subirlo).

## Del Excel a la app

| Hoja del Excel | En la app |
|---|---|
| Instrucciones | Inicio del módulo (`DependencyHome`) y las ayudas de cada pantalla |
| Bitácora | `DependencyLog`: captura por día, desde computadora o celular |
| Decisiones que tomas | `DependencyDecisions`, con las mismas dos listas |
| Clasificación IA | La asigna el asistente; se ve en la bitácora después del análisis |
| Línea base | La calcula la app (`src/config/dependencyCalc.js`) con las fórmulas del Excel |
| Mapa de dependencia | Seis apartados que redacta el asistente (`DependencyMap`) |

Una empresa puede tener varias **mediciones** (una semana de una persona
cada una): el método compara la línea base al inicio y al cierre del programa.

## Datos

`supabase-mapa-dependencia.sql` (requiere las tres fases de empresas):

| Tabla | Contenido |
|---|---|
| `dep_measurements` | La medición: semana (`title`), nombre, puesto, aclaraciones y si hubo actividades simultáneas |
| `dep_activities` | Bitácora: fecha, actividad (`description`), propósito, minutos |
| `dep_decisions` | Decisiones: fecha, quién solicita, situación (`description`), tipo de intervención, motivo, minutos |
| `dep_diagnoses` | El diagnóstico vigente de la medición. Solo lectura para la app: lo escribe la función `ia` |

- Los datos son de la empresa. El acceso pasa por
  `accessible_companies('dependency', …)`, como en los demás módulos: permiso
  ver / editar por persona y modo mentor con `x-company-id`.
- Todo miembro con el módulo ve todas las mediciones de su empresa. El
  administrador de la empresa decide a quién le da el módulo.
- Los cambios quedan en el historial de la empresa (`change_log`).
- Un tiempo vacío no es cero: la fila queda fuera de los porcentajes y se avisa.
- Las filas en blanco no se guardan. El autoguardado manda solo lo que cambió.

## Línea base

`src/config/dependencyCalc.js` es un módulo puro que usan la app y la función
`ia` (copia en `supabase/functions/_shared/app`, `npm run mcp:sync`):

- % del tiempo por clasificación = minutos de la clasificación ÷ minutos
  totales de la bitácora (formato `0.0%`).
- Decisiones por tipo de intervención: cantidad, tiempo en «h y min» (nunca
  horas decimales) y % sobre el total de minutos de decisiones.
- Los minutos de las decisiones no se suman a los de la bitácora.

`node scripts/check-dependencyCalc.mjs` compara los cálculos con las cifras de
la hoja «Línea base» del ejemplo del método.

## Análisis (acción `mapa_dependencia` de la función `ia`)

Body: `{ measurement_id, respuestas?: string[], reiniciar?: boolean }`. Cada
petición hace como mucho **una** llamada a Claude y deja el avance en
`dep_diagnoses.status`; la app repite la llamada mientras la respuesta sea
`clasificado`.

1. **Clasificar.** Clasifica cada actividad (Dirección, Gestión, Supervisión,
   Operación) y propone de cero a tres preguntas de validación.
   → `preguntas` si hay preguntas; si no, `clasificado`.
2. **Preguntas.** El empresario las ve juntas, una sola vez; contesta o deja en
   blanco. Lo que no conteste queda como dato a validar. (El método las hace
   una por turno en conversación; la app no tiene chat.)
3. **Redactar.** Con la clasificación, la línea base ya calculada y las
   respuestas, escribe las cuatro interpretaciones y los seis apartados.
   → `listo`.

Dos vueltas extra posibles, siempre con una llamada cada una:

- Si las respuestas cambian la clasificación de alguna actividad, se aplica el
  cambio y se redacta en la siguiente vuelta con la línea base recalculada.
  Así ningún porcentaje del texto sale de memoria.
- Si el texto rompe una regla comprobable del método, se pide **una**
  corrección: cifras o proporciones («la mitad», «la mayoría») en las
  interpretaciones; cantidades o porcentajes en «Decisiones e intervenciones»;
  porcentajes que no son de la línea base (ni suma de sus categorías). Si
  persiste, se entrega y queda anotado en `result.avisos`.

El diagnóstico guarda una foto: `input_hash` (huella de los registros),
`classification`, `questions` y `result` (`linea_base`, `interpretaciones`,
`mapa`, `avisos`), además de `prompt_version`, modelo y costo acumulado. Si los
registros cambian después, la app lo detecta comparando huellas y ofrece
volver a analizar. Con los mismos registros, repetir la petición devuelve lo
guardado sin gastar.

Requisitos: módulo `dependency`, permiso de edición y al menos cinco
actividades con tiempo. Topes de gasto: los generales del asistente
(`docs/IA.md`); cada paso cuenta como una llamada.

### Adaptación del prompt 2.1

El prompt vive en `supabase/functions/ia/actions/mapa.ts` (`PROMPT_VERSION`,
hoy `2.1-app.1`; súbelo al cambiar el texto).

- **Se conserva:** definiciones y reglas de distinción de las cuatro
  categorías, lectura de las decisiones, las cinco dimensiones, causas y
  lectura equilibrada, criterios de las preguntas, reglas de la línea base,
  estándar de profundidad, los seis apartados y el alcance de la Semana 1.
- **No aplica:** todo lo relativo a recibir, llenar, verificar y conservar el
  formato del Excel.
- **Cambia:** las cifras las calcula la app; las preguntas van en un solo
  paso; el nombre de la persona no se envía a la IA (sí puesto y semana).
- **Por validar con quien cuida el método:** el texto le habla de «tú» al
  empresario, como pide el prompt («Habla directamente con el empresario»);
  el ejemplo en Excel está en tercera persona.

## Comandos

```bash
npm run db:local:mapa        # aplica el SQL en la base LOCAL y corre sus pruebas
npm run db:local:mapa:demo   # semana de ejemplo (datos inventados) en la cuenta demo local
npm run db:staging:mapa      # lo mismo que db:local:mapa, en la rama de staging
node scripts/check-dependencyCalc.mjs
npm run ia:check             # tipos y esquemas de la función ia
```

`supabase-seed-mapa-demo.sql` acepta otra cuenta: `-v email=correo@…`.

## Estreno en producción

Después de estrenar empresas (`docs/BD-LOCAL.md`), o junto con ello:

1. Desplegar la función `ia` (1.2.0 o posterior). Sirve antes y después.
2. Correr `supabase-mapa-dependencia.sql` (después de los tres SQL de empresas).
3. Publicar el código de la app.
4. Asignar el módulo a las empresas que lo usarán (Administración → Empresas).

El rollback de empresas no toca estas tablas: siguen protegidas por empresa.

## Pendiente

- Probar con la llave real de Anthropic y ajustar el prompt con casos reales.
- Descargar el Excel con el formato del método e importar Excels ya llenados.
- Comparación entre dos mediciones (inicio y cierre del programa).
- Herramientas del conector MCP para este módulo.
- Las pantallas del módulo están solo en español (el menú sí tiene inglés).
