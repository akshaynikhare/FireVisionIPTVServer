# Local Development Setup

## Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for running outside Docker)
- Git

## Quick Start

```bash
cd FireVisionIPTVServer
cp .env.example .env
# Edit .env — see Configuration below
npm run dev              # or: make up
```

## Configuration

Edit `.env` with at minimum:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://mongodb:27017/firevision-iptv

# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_ACCESS_SECRET=<random-string>
JWT_REFRESH_SECRET=<random-string>

SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_PASSWORD=YourDevPassword123!
SUPER_ADMIN_EMAIL=admin@dev.local
```

Full env var reference: see [SELF_HOSTING_GUIDE.md → Configuration Reference](./SELF_HOSTING_GUIDE.md#configuration-reference).

## Super Admin

- Created automatically on first startup from `SUPER_ADMIN_*` env vars
- Password hashed with bcrypt (10 rounds)
- Gets a unique 6-character playlist code
- Won't be recreated if already exists
- To reset password: set `FORCE_UPDATE_ADMIN_PASSWORD=true`, restart, then remove it

Verify creation:

```bash
docker-compose logs api | grep "Super Admin"
```

## Running

### Docker Compose (recommended)

```bash
make up                   # Start all services
docker-compose ps         # Check status
docker-compose logs -f api  # View API logs
make down                 # Stop
```

Services started: API (:8009), Frontend (:3001), MongoDB, Redis, MailHog (:8025), Scheduler.

### Node.js directly

```bash
# Start MongoDB separately
docker run -d -p 27017:27017 --name mongodb mongo:7.0

# Set MONGODB_URI=mongodb://localhost:27017/firevision-iptv in .env
npm install
npm run dev
```

## First Login

- Dashboard: `http://localhost:8009/admin` (legacy) or `http://localhost:3001` (Next.js)
- Credentials: your `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD`

## User Management

### Via Dashboard

Users section → Add User → set username, email, password, role (Admin/User).

### Via API

```bash
# Login — get session ID
curl -X POST http://localhost:8009/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YourDevPassword123!"}'

# Create user
curl -X POST http://localhost:8009/api/v1/users \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: <session-id>" \
  -d '{"username":"newuser","email":"user@dev.local","password":"Password123!","role":"User"}'
```

### Session info

- Sessions expire after 24 hours, stored in MongoDB
- View sessions: `GET /api/v1/auth/sessions`
- Revoke: `DELETE /api/v1/auth/sessions/:sessionId`

### Playlist access

Each user gets a 6-character code. Playlist URL: `http://localhost:8009/api/v1/tv/playlist/<CODE>`

## Troubleshooting

| Problem                  | Fix                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Super admin not created  | `docker-compose logs api \| grep -i admin` then check `SUPER_ADMIN_*` env vars                         |
| "Invalid credentials"    | Verify `.env` values, check `FORCE_UPDATE_ADMIN_PASSWORD=true` if changed after first run              |
| MongoDB connection error | Ensure `MONGODB_URI` uses `mongodb://mongodb:27017/` (Docker) or `mongodb://localhost:27017/` (native) |
| Port 8009 in use         | Change port mapping in `docker-compose.yml` or kill conflicting process: `lsof -i :8009`               |
| Check user in DB         | `docker-compose exec mongodb mongosh firevision-iptv --eval "db.users.find({role:'Admin'}).pretty()"`  |

## Related Docs

- [API Documentation](./API_DOCUMENTATION.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Architecture](./ARCHITECTURE.md)
- [TV Pairing System](./TV_PAIRING_SYSTEM.md)
