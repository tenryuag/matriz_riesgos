# 🧪 Entorno de Pruebas (Staging)

## Qué es

Una rama paralela a producción donde se prueban features nuevas con el equipo antes de lanzarlas a producción. La rama se llama `staging` y se despliega automáticamente en una URL aparte.

> ⚠️ **Importante:** Staging comparte la misma base de datos que producción. Cualquier riesgo, departamento o usuario que el equipo cree en staging **se ve también en producción**. Si quieres pruebas con datos aislados, hay que crear un proyecto Supabase separado (ver al final).

---

## Flujo de trabajo

```
   feature/nueva-cosa  ─►  staging  ─►  main
       (desarrollo)      (revisión)    (producción)
```

1. **Crear rama feature** desde `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feature/nombre-descriptivo
   ```
2. **Trabajar y commitear** en la rama feature.
3. **Subir a staging** para que el equipo lo vea:
   ```bash
   git checkout staging
   git pull
   git merge feature/nombre-descriptivo
   git push origin staging
   ```
4. Vercel detecta el push y publica el cambio en la URL de staging.
5. **Compartir la URL con el equipo** para que lo revisen.
6. Cuando el equipo aprueba, **subir a producción**:
   ```bash
   git checkout main
   git pull
   git merge staging
   git push origin main
   ```

---

## Configurar Vercel (una sola vez)

### 1. Asegurar que staging se despliegue automáticamente

Vercel ya despliega automáticamente cualquier rama. Para staging:

1. Entra a [vercel.com](https://vercel.com) → proyecto `matriz-riesgos`.
2. Ve a **Settings → Git**.
3. Verifica que:
   - **Production Branch** = `main`
   - **Preview Deployments** está activado para "All branches" (o agrega `staging` explícitamente).

### 2. Marcar a staging como entorno de pruebas

Para que aparezca el badge amarillo "Entorno de Pruebas" en la UI:

1. Ve a **Settings → Environment Variables**.
2. Agrega una nueva variable:
   - **Name:** `VITE_ENVIRONMENT`
   - **Value:** `staging`
   - **Environment:** marca solo **Preview** (no Production).
3. Guarda. El próximo deploy de staging tendrá la variable y mostrará el badge.

> El código también detecta staging por la URL (cuando contiene `-git-staging-`), así que el badge debería aparecer aunque no configures la variable. La variable es solo para tener la detección más robusta.

### 3. URL de staging

Por defecto Vercel genera una URL tipo:
```
matriz-riesgos-git-staging-tenryuag.vercel.app
```

Si quieres una URL más bonita (ej. `staging.tudominio.com`):

1. Ve a **Settings → Domains**.
2. Agrega un dominio nuevo, por ejemplo `staging.maraperez.com`.
3. En el campo **Git Branch**, especifica `staging`.
4. Apunta el DNS según las instrucciones que da Vercel.

---

## El badge "Entorno de Pruebas"

Cuando alguien entra al deploy de staging, ve una píldora amarilla fija en la esquina superior derecha:

```
   ⚠ ENTORNO DE PRUEBAS
```

Al hacer click se expande y explica que los datos creados ahí se reflejan en producción. En producción el badge **no aparece** (detección automática).

---

## Cómo recibir feedback del equipo

Sugerencias:

- **WhatsApp/Slack:** comparte la URL de staging con un mensaje corto explicando qué probar.
- **Issues de GitHub:** crea un issue por feature para que el equipo deje comentarios estructurados.
- **Sesión en vivo:** abre la URL en una pantalla compartida y recorre la feature con ellos.

---

## (Opcional) Aislar datos: Supabase separado

Si en el futuro quieres que staging tenga su propia base de datos sin afectar producción:

1. En [supabase.com](https://supabase.com) crea un proyecto nuevo (free tier).
2. Ejecuta los SQL de la raíz del repo en ese proyecto:
   - `supabase-invitation-codes.sql`
   - `supabase-admin-rls-policies.sql`
   - `supabase-control-fields.sql`
   - `supabase-suspend-user.sql`
   - `supabase-fix-invitation-codes.sql`
3. Toma la URL y la anon key del proyecto nuevo.
4. En Vercel → Settings → Environment Variables, agrega para el entorno **Preview**:
   - `VITE_SUPABASE_URL` = URL del Supabase de staging
   - `VITE_SUPABASE_ANON_KEY` = anon key de staging
5. Asegúrate de que las mismas variables para **Production** apunten al Supabase actual (de producción).
6. Redespliega staging.

Ya con eso staging usa una base separada y los datos quedan aislados.
