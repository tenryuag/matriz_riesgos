# Base de datos local de pruebas

Para probar cambios de estructura o de reglas de seguridad sin tocar la base
de producción, se trabaja contra una copia local que corre en Docker. (Staging
tiene además su propia base en línea: [STAGING.md](STAGING.md).)

## Requisitos

- Docker Desktop abierto.
- Supabase CLI con sesión iniciada (`supabase login`).

## Uso diario

```bash
npm run dev:local        # la app en http://localhost:5173 contra la base LOCAL
npm run dev              # la app contra la base de PRODUCCIÓN (como siempre)
```

Se entra con el mismo correo y contraseña que en producción: los usuarios
vienen en la copia. Los correos que la app "envía" en local no salen a nadie;
se ven en http://127.0.0.1:54344.

| Qué | Dónde |
|---|---|
| API local | http://127.0.0.1:54341 |
| Panel de la base (Studio) | http://127.0.0.1:54343 |
| Postgres | puerto 54342 |

## Comandos

```bash
npm run db:local:copiar  # baja esquema y datos de producción (solo lectura)
npm run db:local:cargar  # borra la base LOCAL y le carga la última copia
npm run db:local:empresas   # aplica los tres SQL de empresas
npm run db:local:mapa       # aplica el módulo Mapa de dependencia y corre sus pruebas
npm run db:local:mapa:demo  # semana de ejemplo (inventada) para la cuenta demo
supabase stop            # apaga los contenedores (los datos se conservan)
supabase start -x logflare,vector,imgproxy,supavisor   # los vuelve a encender
```

`db:local:cargar` devuelve la base local al estado de la última copia. Sirve
para ensayar una migración las veces que haga falta: cargar, aplicar el SQL,
revisar, y volver a cargar.

## Aplicar un SQL en local

Desde Studio (SQL Editor), o por terminal:

```bash
docker exec -i -e PGPASSWORD=postgres supabase_db_hcmeoducjqudokfhhvyc \
  psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < archivo.sql
```

## Qué tener presente

- La copia contiene **datos reales de clientes**. Vive en `supabase/local/`,
  que git ignora. No se comparte ni se sube a ningún lado.
- No se copian sesiones ni tokens de acceso de producción.
- Las funciones `ia` y `mcp` no se levantan solas. Para probarlas:
  `supabase functions serve` (la de IA necesita `ANTHROPIC_API_KEY` en
  `supabase/.env.local`).
- Lo que se pruebe en local solo se ve en esta máquina. El sitio de staging
  usa otra base: la rama `staging` de Supabase.
- No correr `supabase config push`: sobreescribiría la configuración de Auth
  de producción con la de este archivo.

## Ensayo de la migración de empresas

```bash
npm run db:local:cargar && scripts/check-empresas.sh
```

Carga la copia de producción, toma una huella de lo que ve cada usuario,
aplica `supabase-empresas.sql`, comprueba que todos ven exactamente lo mismo y
prueba el aislamiento entre empresas. Para deshacer las reglas:
`supabase-empresas-rollback.sql`.

## Empresas (multiempresa) en local

Las migraciones de empresas todavía no están en producción, así que una copia
recién cargada no las trae. Después de `npm run db:local:cargar`:

```bash
npm run db:local:empresas   # aplica las tres migraciones de empresas (estructura, usuarios, mentores)
```

Pruebas de la segunda fase (invitaciones y permisos por módulo):

```bash
docker exec -i supabase_db_hcmeoducjqudokfhhvyc psql -U postgres -d postgres -q < scripts/check-empresas-usuarios.sql
docker exec -i supabase_db_hcmeoducjqudokfhhvyc psql -U postgres -d postgres -q < scripts/check-empresas-mentores.sql
```

Ensayo de «deshacer» con las tres fases aplicadas:

```bash
npm run db:local:ensayar-rollback
```

Aplica `supabase-empresas-rollback.sql`, comprueba que todo vuelve a la regla
«solo el dueño» (mismas reglas de seguridad que producción, la app anterior
puede guardar, cada usuario ve solo lo suyo) y vuelve a aplicar las tres fases
encima. Corre dentro de una transacción que se revierte al final: la base
local queda como estaba.

## Staging con su propia base

Para probar en línea sin tocar producción hay una rama de Supabase con una
copia de los datos de producción, conectada al sitio de staging. Cómo se crea,
se carga y se conecta: [STAGING.md](STAGING.md).

## Orden para estrenar empresas en producción

1. Desplegar las funciones `ia` y `mcp`. Entienden la base de antes y la de
   después, así que pueden ir primero sin afectar a nadie.
2. Correr, en este orden: `supabase-empresas.sql`,
   `supabase-empresas-usuarios.sql` y `supabase-empresas-mentores.sql`.
3. Publicar el código de la app.

El módulo Mapa de dependencia va después de las tres fases: su orden está en
[MAPA-DEPENDENCIA.md](MAPA-DEPENDENCIA.md).

La función `ia` va antes que el SQL porque la fase 3 cambia cómo se guardan
los resultados del asistente (uno por usuario, empresa y tipo) y la versión
anterior de la función no puede guardar con esa regla.

Para deshacer: `supabase-empresas-rollback.sql`. La versión anterior de la app
vuelve a funcionar y no se borra nada; las tres fases se pueden volver a
aplicar encima.
