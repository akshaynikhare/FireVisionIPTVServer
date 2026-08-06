

# FireVision IPTV Server

[![Build & Deploy](https://github.com/akshaynikhare/FireVisionIPTVServer/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/akshaynikhare/FireVisionIPTVServer/actions/workflows/docker-publish.yml)
[![CI](https://github.com/akshaynikhare/FireVisionIPTVServer/actions/workflows/ci.yml/badge.svg)](https://github.com/akshaynikhare/FireVisionIPTVServer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/akshaynikhare/FireVisionIPTVServer)](https://github.com/akshaynikhare/FireVisionIPTVServer/releases/latest)
[![License](https://img.shields.io/github/license/akshaynikhare/FireVisionIPTVServer)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-ghcr.io-blue?logo=docker)](https://github.com/akshaynikhare/FireVisionIPTVServer/pkgs/container/firevisioniptvserver)

**Plataforma autogestionada para la gestión de canales IPTV.** Administra canales, usuarios, guías EPG y dispositivos vinculados desde un único panel de administración, y luego transmite directamente a tu Fire TV con la [app complementaria para Android](https://github.com/akshaynikhare/FireVisionIPTV).

> Tu servidor. Tus canales. Sin suscripciones.

---

## Capturas de pantalla

| Panel de Administración                                      | Gestión de Canales                                     | Guía EPG                                |
| ---------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| ![Admin Dashboard](preview/screenshot-dashboard.jpg) | ![Channel Management](preview/screenshot-channels.jpg) | ![EPG Guide](preview/screenshot-epg.jpg) |

| Gestión de Usuarios                                  | Vinculación de Dispositivos                                    | Estadísticas                                  |
| ------------------------------------------------ | ------------------------------------------------- | ------------------------------------------- |
| ![User Management](preview/screenshot-users.jpg) | ![Device Pairing](preview/screenshot-pairing.jpg) | ![Statistics](preview/screenshot-stats.jpg) |

---

## Características

### Gestión de Canales

- Importa listas de reproducción M3U y fuentes externas (Pluto TV, Samsung TV Plus)
- Agrupación inteligente de flujos con conmutación automática a flujos alternativos
- Escaneo en vivo del estado — estado en línea/desconectado por canal
- Operaciones masivas: habilitar, deshabilitar, reordenar, eliminar
- Pruebas de flujo por canal con métricas de latencia y manifiesto
- Endpoint global de lista de reproducción M3U compatible con cualquier reproductor IPTV

### Guía EPG y de Programas

- Integración EPG XMLTV con actualización automática programada
- Horario de programas por canal sincronizado con televisores vinculados

### Vinculación de Dispositivos

- Vinculación basada en PIN con soporte para código QR
- La app de TV recibe la lista de canales sincronizada, favoritos y datos de estado en tiempo real
- Vinculación heredada basada en código para clientes antiguos

### Panel de Administración

- Gestión completa de usuarios — crear, desactivar, asignar roles, restablecer contraseñas
- Control de acceso basado en roles: roles de Administrador y Usuario
- Tablero de estadísticas — canales, usuarios, sesiones, línea de tiempo de actividad, gráficos
- Control del programador — verificaciones de estado, actualización EPG, calentamiento de caché
- Gestión de versiones de app OTA — impulsar actualizaciones APK a todos los dispositivos TV vinculados

### Autenticación y Seguridad

- Autenticación basada en sesiones (principal) + JWT (clientes API)
- Inicio de sesión con OAuth2 mediante Google y GitHub
- Rotación de tokens de actualización, revocación por sesión, cierre de sesión forzoso en todos los dispositivos
- Limitación de tasa, CORS, encabezados de seguridad

### Infraestructura

- Configuración de Docker Compose con un solo comando (desarrollo + producción)
- Caché de Redis con respaldo elegante si no está disponible
- Monitoreo de errores con Sentry
- Correo transaccional vía Brevo SMTP (MailHog en desarrollo)
- Proxy de flujos y proxy de imágenes

---

## Inicio Rápido

**Requisitos:** Docker y Docker Compose, mínimo 2 GB de RAM

```bash
# 1. Clonar y configurar
git clone https://github.com/akshaynikhare/FireVisionIPTVServer.git
cd FireVisionIPTVServer
cp .env.example .env
```

Edita `.env` — al menos configura tus credenciales de administrador y secretos JWT:

```env
SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_PASSWORD=YourSecurePassword123!
SUPER_ADMIN_EMAIL=you@example.com

# Generar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_ACCESS_SECRET=<random-32-char-string>
JWT_REFRESH_SECRET=<different-random-32-char-string>
```

```bash
# 2. Iniciar la pila completa (API + frontend + programador + MongoDB + Redis)
docker compose up -d

# Panel de administración → http://localhost:3001
# API         → http://localhost:3000
```

Para implementación en producción, consulta la [Guía de Autoalojamiento](docs/workflow/SELF_HOSTING_GUIDE.md).

---

x

## Arquitectura

```
┌──────────────┐     ┌──────────────┐
│  Android App │     │  Next.js     │
│  (Fire TV)   │     │  Frontend    │
└──────┬───────┘     └──────┬───────┘
       │                    │
       └────────┬───────────┘
                ▼
       ┌─────────────────┐
       │   Express API   │
       │  (TypeScript)   │
       └───┬─────────┬───┘
           │         │
           ▼         ▼
    ┌──────────┐ ┌────────┐
    │ MongoDB  │ │ Redis  │
    └──────────┘ └────────┘
```

## Stack Tecnológico

|              |                                              |
| ------------ | -------------------------------------------- |
| **Backend**  | Express.js, TypeScript, Mongoose             |
| **Frontend** | Next.js 14, Tailwind CSS, shadcn/ui          |
| **Estado**   | TanStack Query + Zustand                     |
| **Base de Datos** | MongoDB 7                               |
| **Caché**    | Redis 7 (opcional — respaldo elegante)       |
| **Autenticación** | Basada en sesión + JWT, OAuth2 (Google, GitHub) |
| **Pruebas**  | Jest, Supertest, Playwright (E2E)            |
| **CI/CD**    | GitHub Actions → Docker (GHCR) → Portainer   |

---

## Cliente Android

Vincúlalo con la app [FireVision IPTV](https://github.com/akshaynikhare/FireVisionIPTV), un reproductor IPTV de código abierto para Amazon Fire TV y Android TV.

Características: transmisión en vivo HLS vía ExoPlayer, navegación con D-pad, favoritos sincronizados con el servidor, escaneo de estado en segundo plano, actualizaciones OTA.

---

## Documentación

| Documento                                                       | Descripción                                  |
| --------------------------------------------------------- | -------------------------------------------- |
| [Guía de Autoalojamiento](docs/workflow/SELF_HOSTING_GUIDE.md) | Configuración de Docker para producción paso a paso |
| [Documentación de la API](docs/API_DOCUMENTATION.md)            | Todos los endpoints con ejemplos de solicitud/respuesta |
| [Arquitectura](docs/ARCHITECTURE.md)                      | Diseño del sistema y flujo de datos          |
| [Guía de Configuración](docs/workflow/SETUP_GUIDE.md)               | Entorno de desarrollo local                  |
| [Sistema de Vinculación de TV](docs/workflow/TV_PAIRING_SYSTEM.md)   | Cómo funciona la vinculación de dispositivos   |
| [Guía de Implementación](docs/workflow/DEPLOYMENT_GUIDE.md)     | Auto-implementación basada en etiquetas vía GitHub Actions |
| [Configuración de OAuth](docs/workflow/OAUTH_SETUP.md)               | Configuración de OAuth de Google y GitHub    |
| [Lista de Características](docs/FEATURE_LIST.md)                      | Inventario completo de características       |

---

## Contribuciones

Consulta [CONTRIBUTING.md](CONTRIBUTING.md). Se agradecen issues y PRs.

## Licencia

[MIT](LICENSE)
