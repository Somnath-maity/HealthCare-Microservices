# Healthcare API Automation

A REST Assured and JUnit 5 test project for a containerized healthcare API. The repository contains the backend services and the Java API automation suite in separate folders.

## Repository layout

```text
.
├── Backendrepo/   Node.js healthcare services, API gateway, MongoDB, and seed data
└── RestAPI/       Java 21, Maven, REST Assured, and JUnit 5 API tests
```

The backend is composed of an API gateway and five services: authentication, patients, appointments, prescriptions, and notifications. MongoDB stores service data. The gateway is available at `http://localhost:3000` and routes requests under `/api/*` to the corresponding service.

## Prerequisites

- Docker Desktop or another Docker Compose installation
- Java 21
- Maven 3.6.3 or later

## Start the backend

Run Compose commands from `Backendrepo/`:

```sh
cd Backendrepo
docker compose up --build -d
```

Compose reads configuration from `Backendrepo/.env`. Keep this local file private; if it is missing, create it using the variable names referenced in `docker-compose.yml` (MongoDB credentials, JWT secrets and expirations, published service ports, and internal service URLs). Use strong, unique secrets for any non-local deployment.

Wait for the gateway health check and inspect service status:

```sh
docker compose ps
curl http://localhost:3000/health
```

The gateway health response reports the status of its downstream services. Service ports and URLs are configurable through the Compose environment. The default gateway port is `3000`.

### Load sample data

The seed container is in the `seed` Compose profile and waits for the gateway to become healthy:

```sh
docker compose --profile seed run --rm seed
```

To stop the services:

```sh
docker compose down
```

To also delete the persisted MongoDB volume and all local data:

```sh
docker compose down -v
```

The seed command creates demo accounts and records. Their credentials are documented in [`Backendrepo/README.md`](Backendrepo/README.md); use them only with a local seeded environment.

## Run the API tests

Start the backend and load its sample data first. Then run the Maven suite:

```sh
cd RestAPI
mvn test
```

The test base URL is currently set to `http://localhost:3000` in `src/test/java/com/healthcare/api/base/BaseTest.java`. The existing tests cover successful admin login and rejection of an incorrect password. The login test expects the seeded admin account.

## Current test coverage

- `com.healthcare.api.tests.auth.LoginTests`
  - Valid admin login returns access and refresh tokens and expected user details.
  - Wrong password returns HTTP 401.

Add new JUnit 5 test classes under `RestAPI/src/test/java` and reuse `BaseTest` for the shared REST Assured base URI.

## API and backend documentation

- [`Backendrepo/README.md`](Backendrepo/README.md): service architecture, endpoint inventory, demo credentials, and API automation scenarios.
- [`Backendrepo/dockerGuide.md`](Backendrepo/dockerGuide.md): Docker health checks and seed troubleshooting.

Useful gateway routes include `GET /health` for service health and `GET /api/services` for service discovery. Authentication endpoints are under `/api/auth`; patient, appointment, prescription, and notification routes are under `/api/patients`, `/api/appointments`, `/api/prescriptions`, and `/api/notifications` respectively. Most resource routes require a bearer access token.

## Notes

- The Java suite targets Java 21 and uses Maven dependencies declared in `RestAPI/pom.xml`.
- The backend consists of independent Node.js services and a Docker Compose deployment; the Java tests call the gateway rather than individual services.
- `Backendrepo/.env` contains local runtime configuration and is excluded from version control. Do not commit credentials or production secrets.
