# Base de datos local de pruebas

Staging y producción comparten la misma base en Supabase. Para probar cambios
de estructura o de reglas de seguridad sin tocarla, se trabaja contra una copia
local que corre en Docker.

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
- El sitio de staging en Netlify sigue apuntando a la base de producción. Lo
  que se pruebe en local solo se ve en esta máquina.
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
