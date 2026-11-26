# Staging con su propia base de datos

Staging deja de compartir la base con producción. Usa una **rama de Supabase**
llamada `staging`, que es una base aparte (sus propios usuarios, dirección y
llaves) con datos de ejemplo. Lo que se pruebe ahí no puede tocar producción.

| Pieza | Staging | Producción |
|---|---|---|
| Rama de git | `staging` | `main` |
| Sitio | https://staging--matrizriesgos.netlify.app | https://app.mara-perez.online |
| Base de datos | rama `staging` de Supabase | proyecto `hcmeoducjqudokfhhvyc` |
| Datos | de ejemplo (cuentas `demo.*@example.com`) | reales |

El mismo nombre en los tres lugares es a propósito: una sola cosa llamada
«staging».

## Dejar la rama lista

1. **Crear la rama en Supabase** (lo hace Tenryu): Dashboard → Branches →
   *Create branch*, nombre `staging`, sin «Include data». Conviene marcarla
   como persistente si se va a quedar: una rama persistente no se pausa ni se
   borra sola. Por CLI:
   `supabase branches create staging --persistent --remote=hcmeoducjqudokfhhvyc`.
2. **Cargarla:**

   ```bash
   npm run db:staging:preparar
   ```

   Aplica los tres SQL de empresas (el mismo paso del estreno en producción),
   carga los datos de ejemplo, pone la contraseña de las cuentas demo, crea
   cinco códigos de invitación y comprueba por la API que cada cuenta ve lo
   que le toca. Es repetible.
3. **Funciones y secretos de la rama** (lo hace Tenryu). La rama nace con una
   copia de las funciones de producción y sin los secretos:

   ```bash
   supabase functions deploy ia  --no-verify-jwt --remote=<ref de la rama>
   supabase functions deploy mcp --no-verify-jwt --remote=<ref de la rama>
   supabase secrets set ANTHROPIC_API_KEY=… --remote=<ref de la rama>
   ```

   `npm run db:staging:preparar` imprime estos comandos con el ref ya puesto.
4. **Conectar el sitio:**

   ```bash
   npm run db:staging:conectar
   ```

   Cambia en Netlify la dirección y la llave de Supabase **solo** para el
   despliegue de la rama `staging`; los valores de producción se comprueban
   antes y después. Surte efecto en el siguiente despliegue de staging.

`npm run db:staging:estado` dice en cualquier momento qué hay en la rama, qué
funciones y secretos tiene y si Netlify ya apunta a ella.

## Cuentas de ejemplo

La contraseña (una sola para todas) y los códigos de invitación quedan en
`supabase/local/staging-accesos.txt`, que git ignora. Para elegir la
contraseña: `DEMO_PASSWORD=… npm run db:staging:preparar`.

| Cuenta | Quién es |
|---|---|
| `demo.admin@example.com` | Carlos Méndez, administrador de «Metalmecánica del Bajío» (los tres módulos, con datos) |
| `demo.ana@example.com` | Ana López, miembro con «solo ver» |
| `demo.invitacion@example.com` | miembro sin módulos asignados |
| `demo.mentora@example.com` | Marta Ruiz, mentora de esa empresa en Análisis Financiero |
| `demo.plataforma@example.com` | Paula Admin, administradora de la plataforma |

Las cuentas reales no existen en staging: se entra con las de ejemplo o
registrando una empresa nueva con uno de los códigos.

## De dónde salen los datos

`supabase-seed-staging.sql` se genera desde la base local con
`npm run db:staging:exportar`: toma las cuentas demo locales y les asigna el
ejemplo completo de «Metalmecánica del Bajío» (21 riesgos, plan estratégico,
análisis financiero de cinco periodos, informe y resumen de IA). El archivo no
lleva contraseñas ni identificadores de usuarios o empresas reales; la
exportación se cancela si detecta alguno.

## Qué tener presente

- **Cuesta mientras exista:** 0.01344 USD por hora (unos 10 USD al mes). Los
  créditos de cómputo del plan y el tope de gasto no cubren ramas.
- **Si la rama se borra y se crea otra vez, cambian su dirección y sus
  llaves.** Hay que repetir los pasos 2 a 4 y volver a desplegar staging.
- **No usar el botón «Merge» de la rama.** Este proyecto no tiene historial de
  migraciones; a producción sigue llegando solo el SQL que Tenryu corre.
- **Los correos no salen en la rama** (la contraseña del servidor de correo no
  se copia). El registro funciona porque no pide confirmar el correo;
  «Olvidé mi contraseña» no.
- **«Conectar Claude» no se prueba desde el sitio de staging:** su ruta `/mcp`
  apunta a la función de producción y la pantalla de consentimiento solo
  funciona en el dominio de producción.
- **Volver a como estaba** (staging contra la base de producción):

  ```bash
  netlify env:unset VITE_SUPABASE_URL --context branch:staging --site matrizriesgos
  netlify env:unset VITE_SUPABASE_ANON_KEY --context branch:staging --site matrizriesgos
  ```

  y volver a desplegar staging.
