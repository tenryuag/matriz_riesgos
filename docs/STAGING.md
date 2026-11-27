# Staging con su propia base de datos

Staging ya no comparte la base con producción. Usa una **rama de Supabase**
llamada `staging`: una base aparte (sus propios usuarios, dirección y llaves)
con una **copia de los datos de producción**. Todos pueden probar con datos
reales y nada de lo que se haga ahí llega a producción.

| Pieza | Staging | Producción |
|---|---|---|
| Rama de git | `staging` | `main` |
| Sitio | https://staging--matrizriesgos.netlify.app | https://app.mara-perez.online |
| Base de datos | rama `staging` de Supabase | proyecto `hcmeoducjqudokfhhvyc` |
| Datos | copia de producción (del día en que se preparó) | reales |

El mismo nombre en los tres lugares es a propósito: una sola cosa llamada
«staging».

## Cómo se entra

Con el mismo correo y la misma contraseña que en producción: las cuentas
vienen en la copia. Para registrar una empresa nueva hay cinco códigos de
invitación de prueba en `supabase/local/staging-accesos.txt` (git lo ignora);
un administrador también puede generar más desde el panel.

## Dejar la rama lista

1. **Crear la rama en Supabase** (lo hace Tenryu): Dashboard → Branches →
   *Create branch*, nombre `staging`, sin «Include data». Conviene marcarla
   como persistente: una rama persistente no se pausa ni se borra sola.
2. **Copiar y preparar:**

   ```bash
   npm run db:staging:preparar
   ```

   - Baja una copia de los datos de producción (solo lectura) a
     `supabase/local/staging-data.sql` y la carga en la rama, en una sola
     transacción. Comprueba que cada tabla quedó con las mismas filas.
   - Aplica los tres SQL de empresas, igual que se hará en producción, y
     compara qué ve cada usuario antes y después.
   - Corre las pruebas de aislamiento, invitaciones y mentores
     (`scripts/check-empresas*.sql`; no dejan cambios).
   - Prueba la API de la rama con dos cuentas temporales (una empresa cliente
     y su mentora) y las borra.

   Si se interrumpe, se puede volver a correr: retoma donde se quedó y no
   vuelve a copiar una rama que ya tiene datos.
3. **Funciones de la rama.** La rama nace con una copia de las funciones de
   producción y sin sus secretos:

   ```bash
   npm run db:staging:funciones
   ```

   Despliega en la rama las funciones `ia` y `mcp` de este repositorio y
   guarda la dirección del sitio de staging. Nunca despliega a producción.

   Falta entonces solo la llave de Anthropic, que no vive en esta máquina y
   pone Tenryu (conviene una llave propia para staging, para distinguir su
   gasto):

   ```bash
   supabase secrets set ANTHROPIC_API_KEY=… --remote=<ref de la rama>
   ```

   Sin esa llave todo funciona menos el asistente de IA, que responde «no
   configurado».
4. **Conectar el sitio:**

   ```bash
   npm run db:staging:conectar
   ```

   Cambia en Netlify la dirección y la llave de Supabase **solo** para el
   despliegue de la rama `staging`; los valores de producción se comprueban
   antes y después. Surte efecto en el siguiente despliegue de staging.

`npm run db:staging:estado` dice en cualquier momento qué hay en la rama, de
cuándo es la copia, qué funciones y secretos tiene y si Netlify ya apunta a
ella.

## Qué se copia y qué no

- **Sí:** las cuentas (con su contraseña cifrada, para entrar igual que en
  producción) y todas las tablas con datos: riesgos, planes, análisis
  financieros, permisos por módulo, códigos de invitación, uso de IA.
- **No:** sesiones abiertas y tokens, factores de doble verificación ni las
  conexiones de Claude registradas contra producción.

## Qué tener presente

- **Son datos reales de clientes en un sitio público.** La rama se cuida igual
  que producción: no compartir la liga de staging fuera del equipo ni dar
  acceso de administrador a cuentas de prueba.
- **Lo que hoy solo oculta la app, ahora lo aplica la base.** Una cuenta deja
  de recibir los datos de un módulo que no tiene asignado. En la copia del
  27-nov-2026 eso alcanza a una cuenta: tiene un plan estratégico capturado
  cuando contaba con ese módulo y hoy solo tiene Gestión del Riesgo. No se
  borra nada; si se le devuelve el módulo, el plan reaparece.
- **La copia es una foto.** Lo que se capture después en producción no llega
  a staging. Mientras producción no tenga las fases de empresas, actualizar
  la copia implica borrar la rama, crearla otra vez y repetir los pasos 2 a 4.
- **Si la rama se borra y se crea otra vez, cambian su dirección y sus
  llaves.** Hay que repetir los pasos 2 a 4 y volver a desplegar staging.
- **Cuesta mientras exista:** 0.01344 USD por hora (unos 10 USD al mes). Los
  créditos de cómputo del plan y el tope de gasto no cubren ramas.
- **No usar el botón «Merge» de la rama.** Este proyecto no tiene historial de
  migraciones; a producción sigue llegando solo el SQL que Tenryu corre.
- **Los correos no salen en la rama** (la contraseña del servidor de correo no
  se copia). El registro funciona porque no pide confirmar el correo;
  «Olvidé mi contraseña» no. Ningún cliente recibe correos desde staging.
- **«Conectar Claude» no se prueba desde el sitio de staging:** su ruta `/mcp`
  apunta a la función de producción y la pantalla de consentimiento solo
  funciona en el dominio de producción.
- **Volver a como estaba** (staging contra la base de producción):

  ```bash
  netlify env:unset VITE_SUPABASE_URL --context branch:staging --site matrizriesgos
  netlify env:unset VITE_SUPABASE_ANON_KEY --context branch:staging --site matrizriesgos
  ```

  y volver a desplegar staging.
