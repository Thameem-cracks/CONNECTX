# ConnectX Deployment Guide

This guide covers deploying the ConnectX full-stack real-time web chat application.

---

## 1. Database Deployment (Supabase PostgreSQL)

1. Sign in to [Supabase](https://supabase.com) and create a new project.
2. Under **SQL Editor**, run the database migrations in order:
   - `database/migrations/001_initial_schema.sql`
   - `database/migrations/002_rls_policies.sql`
   - `database/migrations/003_triggers.sql`
3. Optional: execute `database/seed.sql` to create starter rooms.
4. Retrieve your database connection string and authentication parameters:
   - **Database URL**: `Settings` -> `Database` -> `Connection string` (URI)
   - **Project URL & Anon Key**: `Settings` -> `API`
   - **JWKS Endpoint**: `https://<PROJECT-REF>.supabase.co/auth/v1/.well-known/jwks.json`

---

## 2. Backend Deployment (Render with Docker)

The C++ backend is containerized using a multi-stage Dockerfile that builds with CMake and Ninja on Ubuntu, producing a secure, lightweight runtime container.

1. Sign in to [Render](https://render.com).
2. Create a new **Web Service** and connect your GitHub repository.
3. Configure the service:
   - **Environment**: Docker
   - **Dockerfile Path**: `backend/Dockerfile`
   - **Docker Build Context**: `backend`
4. Set Environment Variables in Render:
   - `PORT`: `8080`
   - `DATABASE_URL`: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
   - `SUPABASE_URL`: `https://[PROJECT-REF].supabase.co`
   - `SUPABASE_JWKS_URL`: `https://[PROJECT-REF].supabase.co/auth/v1/.well-known/jwks.json`
   - `LOG_LEVEL`: `info`
5. Deploy. Render will terminate TLS and route secure WebSocket traffic (`wss://`) directly to the container.

---

## 3. Frontend Deployment (Vercel)

The frontend is a lightweight SPA built with Vite.

1. Sign in to [Vercel](https://vercel.com) and import the Git repository.
2. Set **Root Directory** to `frontend`.
3. Set Build & Output Settings:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Configure Environment Variables in Vercel:
   - `VITE_API_URL`: `https://<your-render-service>.onrender.com`
   - `VITE_WS_URL`: `wss://<your-render-service>.onrender.com/ws`
   - `VITE_SUPABASE_URL`: `https://<your-project-ref>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: `<your-supabase-anon-key>`
5. Deploy.

---

## 4. Local Development

### Running the Backend with Docker:
```bash
cp .env.example .env
# Edit .env with your PostgreSQL credentials
docker-compose up --build
```

### Running the Frontend locally:
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
