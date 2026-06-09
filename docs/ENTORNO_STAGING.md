# 🧪 Entorno de Pruebas (Staging)

## Qué es

Una rama paralela a producción donde se prueban features nuevas con el equipo antes de lanzarlas a producción. La rama se llama `staging` y se despliega automáticamente en una URL aparte usando Netlify.

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
4. Netlify detecta el push y publica el cambio en la URL de staging.
5. **Compartir la URL con el equipo** para que lo revisen.
6. Cuando el equipo aprueba, **subir a producción**:
   ```bash
   git checkout main
   git pull
   git merge staging
   git push origin main
   ```

---

## Configurar Netlify (una sola vez)

### 1. Activar branch deploys

1. Entra a [app.netlify.com](https://app.netlify.com) → tu sitio `matriz-riesgos`.
2. Ve a **Site configuration → Build & deploy → Continuous deployment → Branches and deploy contexts**.
3. En **Branch deploys**, selecciona una de estas opciones:
   - **"Let me add individual branches"** y agrega `staging` (más controlado).
   - **"All"** si quieres que cualquier rama se despliegue automáticamente.
4. Guarda.

A partir de ese momento, cada push a `staging` activa un deploy en una URL tipo:

```
https://staging--matriz-riesgos.netlify.app
```

(Reemplaza `matriz-riesgos` con el nombre real de tu sitio en Netlify.)

### 2. Marcar a staging como entorno de pruebas (opcional pero recomendado)

Para que el badge amarillo "Entorno de Pruebas" aparezca con detección robusta:

1. Ve a **Site configuration → Environment variables**.
2. Pulsa **Add a variable → Add a single variable**.
3. Llena:
   - **Key:** `VITE_ENVIRONMENT`
   - **Values:** `staging`
   - En **Deploy contexts**, marca **solo "Branch deploys"** (NO "Production"). Así main no ve esa variable.
4. Guarda.

> Aunque no configures esta variable, el badge igual aparece porque el código también detecta la URL de Netlify (`staging--…`). La variable es solo para máxima robustez.

### 3. URL de staging

La URL que sale automáticamente:
```
https://staging--<nombre-del-sitio>.netlify.app
```

Si quieres una URL más bonita (ej. `staging.tudominio.com`):

1. Ve a **Domain management → Custom domains**.
2. Pulsa **Add domain alias**.
3. Agrega `staging.tudominio.com` y apunta el DNS según las instrucciones.
4. En **Branch deploys**, vincula ese subdominio a la rama `staging`.

---

## El badge "Entorno de Pruebas"

Cuando alguien entra al deploy de staging, ve una píldora ámbar fija arriba a la derecha:

```
   ⚠ ENTORNO DE PRUEBAS
```

Al hacer click se expande y explica que los datos creados ahí se reflejan en la base de datos real. En producción el badge **no aparece** (detección automática vía URL o variable de entorno).

---

## Cómo recibir feedback del equipo

Sugerencias:

- **WhatsApp / correo:** comparte la URL de staging con un mensaje corto explicando qué probar.
- **Issues de GitHub:** crea un issue por feature para que el equipo deje comentarios estructurados.
- **Sesión en vivo:** abre la URL en una pantalla compartida y recorre la feature con ellos.

---

## (Opcional) Aislar datos: Supabase separado

Si en el futuro quieres que staging tenga su propia base de datos sin afectar producción:

1. En [supabase.com](https://supabase.com) crea un proyecto nuevo (free tier).
2. Ejecuta los SQL de la raíz del repo en ese proyecto, en este orden:
   - `supabase-invitation-codes.sql`
   - `supabase-admin-rls-policies.sql`
   - `supabase-control-fields.sql`
   - `supabase-suspend-user.sql`
   - `supabase-fix-invitation-codes.sql`
3. Toma la **URL** y la **anon key** del proyecto nuevo (Settings → API).
4. En Netlify → **Site configuration → Environment variables**, agrega:
   - `VITE_SUPABASE_URL` con scope **Branch deploys** → URL del Supabase de staging
   - `VITE_SUPABASE_ANON_KEY` con scope **Branch deploys** → anon key de staging
5. Asegúrate de que las mismas variables para **Production** apunten al Supabase actual.
6. Provoca un redeploy de staging (push o "Trigger deploy" en Netlify).

A partir de ahí staging usa una base separada y los datos quedan completamente aislados.

---

## Notas

- El archivo `vercel.json` del repo no se usa con Netlify, pero no estorba. Netlify usa `public/_redirects` para el routing SPA (ya configurado).
- Si en algún momento quieres mover staging a Vercel u otro host, el badge sigue funcionando (detecta también el patrón `*-git-staging-*` de Vercel).
