# Mobile Mammography Camp Request

A responsive bilingual camp-request application built with React, Vite, Fastify, and MongoDB. The production stack runs with Docker Compose.

## Architecture

- `frontend/`: React 19 + Vite interface, served by Nginx in production
- `backend/`: Node.js 22 + Fastify API using the MongoDB driver
- `mongodb`: MongoDB 7 with a persistent Docker volume
- Nginx proxies `/api/*` requests to Fastify, so the browser uses one origin

## Run with Docker

Create the local environment file and update the MongoDB password:

```bash
cp .env.example .env
```

Start the complete stack:

```bash
docker compose up -d --build
```

Open [http://localhost:1005](http://localhost:1005).

The services are available on these ports:

- Frontend: `1005`
- Backend API: `2005`
- MongoDB: `3005`

Check service status and logs:

```bash
docker compose ps
docker compose logs -f api
```

Stop the services while retaining MongoDB data:

```bash
docker compose down
```

To also delete the local database volume, run `docker compose down -v` only when the stored requests are no longer needed.

## API

### Health check

```text
GET /api/health
```

### Submit a camp request

```text
POST /api/camp-requests
Content-Type: application/json
```

Successful submissions return HTTP `201` with a reference such as `MMC-20260924-A31C62`. The API validates the request again before saving it to the `camp_requests` MongoDB collection.

No public endpoint lists submitted requests because the records contain personal information.

## Admin portal

Open [http://localhost:1005/admin](http://localhost:1005/admin) to sign in and view registrations. The admin dashboard provides summary totals, search, status filtering, pagination, and a complete details view for each request.

Admin credentials and the JWT signing secret come from `.env`:

```text
ADMIN_EMAIL=admin@hospital.local
ADMIN_PASSWORD=choose-a-strong-password
JWT_SECRET=choose-a-long-random-secret
```

Change all three values before exposing the application outside a local development machine. Admin list and detail endpoints require an eight-hour bearer token, and repeated login attempts are rate limited.

## Local development

Start MongoDB with Docker, then run the API and frontend in separate terminals:

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Vite runs at `http://localhost:1005` and proxies `/api` to `http://localhost:2005`.

## Verification

```bash
cd backend && npm test
cd frontend && npm run build
docker compose config --quiet
```

Tamil and English text are stored as Unicode in MongoDB. Phone numbers, dates, ages, and numeric counts retain their format validation in both languages.
# camp_form
