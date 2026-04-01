# Declavo

Plataforma de visibilidad de stock para empresas tecnológicas. Acceso cerrado por invitación.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Base de datos**: Supabase (PostgreSQL + Auth + Storage)
- **Estilos**: Tailwind CSS
- **Deploy**: Netlify

## Setup local

```bash
# 1. Clonar e instalar
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 3. Correr en desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Variables de entorno

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key pública de Supabase |
| `NEXT_PUBLIC_SITE_URL` | URL pública del sitio (para links de invitación) |

## Deploy en Netlify

1. Subir este repo a GitHub
2. En Netlify: **Add new site → Import from Git**
3. Build command: `npm run build`
4. Publish directory: `.next`
5. Agregar las variables de entorno en **Site settings → Environment variables**
6. El archivo `netlify.toml` ya tiene todo configurado

## Crear el primer super_admin

Después del primer deploy, ejecutar en Supabase SQL Editor:

```sql
-- 1. Registrar el usuario en Supabase Auth (desde la UI de Supabase o via invitación)
-- 2. Una vez que el usuario existe en auth.users, actualizar su rol:
UPDATE public.profiles
SET role = 'super_admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'tu@email.com');
```

## Estructura del proyecto

```
src/
├── app/
│   ├── login/          # Página de login
│   ├── invite/[token]/ # Aceptar invitación
│   ├── catalogo/       # Catálogo público (autenticado)
│   ├── mis-productos/  # Panel de la empresa
│   └── admin/          # Super admin
├── components/
│   └── layout/
│       └── Navbar.tsx
├── hooks/
│   └── useProfile.ts   # Auth state + profile + org
├── lib/supabase/
│   ├── client.ts       # Browser client
│   ├── server.ts       # Server client
│   └── middleware.ts   # Auth middleware
└── types/
    └── database.ts     # Tipos TypeScript
```

## Flujo de invitación

1. Super admin crea invitación en `/admin` → se genera token único
2. El link `https://declavo.com.ar/invite/TOKEN` se copia y envía manualmente (o por email)
3. El invitado hace clic, completa nombre y contraseña
4. El trigger `handle_new_user` lo asigna automáticamente a la empresa y rol correctos

## API REST (para integraciones ERP)

Los clientes pueden sincronizar productos via la API de Supabase directamente usando su `api_key`. 
Ejemplo de upsert:

```bash
curl -X POST https://fnwrsbuebpbyafokrboi.supabase.co/rest/v1/products \
  -H "apikey: TU_ANON_KEY" \
  -H "Authorization: Bearer TU_JWT" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  -d '{"sku":"SKU-001","description":"Producto","brand":"HP","stock_quantity":10,"organization_id":"ORG_ID"}'
```
