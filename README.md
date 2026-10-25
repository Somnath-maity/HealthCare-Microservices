# Healthcare API Automation

REST Assured + JUnit 5 automation suite for a containerized healthcare platform with microservices architecture.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Java 21 |
| Build | Maven |
| HTTP Client | REST Assured 5.4.0 |
| Test Framework | JUnit 5 (Jupiter 5.10.2) |
| Backend Under Test | Node.js microservices + MongoDB (Docker Compose) |

## Repository Layout

```
.
├── Backendrepo/          # Healthcare microservices (Docker Compose)
│   ├── api-gateway/      # Routes all /api/* requests (:3000)
│   ├── auth-service/     # JWT auth, user management (:3001)
│   ├── patient-service/  # Patient CRUD, medical records (:3002)
│   ├── appointment-service/  # Appointment lifecycle (:3003)
│   ├── prescription-service/ # Prescriptions, refills (:3004)
│   ├── notification-service/ # Alerts, bulk operations (:3005)
│   └── docker-compose.yml
│
└── RestAPI/              # API automation suite
    ├── pom.xml
    └── src/test/java/com/healthcare/api/
        ├── base/
        │   └── BaseTest.java          # Shared REST Assured config
        └── tests/
            └── auth/
                └── LoginTests.java    # Authentication test cases
```

## Architecture Under Test

```
         ┌──────────────────────────────────────────────────┐
         │              API Gateway (:3000)                  │
         │   /api/auth  /api/patients  /api/appointments     │
         │   /api/prescriptions  /api/notifications          │
         └──────┬─────────┬─────────┬─────────┬─────────┬───┘
                │         │         │         │         │
           Auth      Patient   Appointment Prescription Notification
          :3001      :3002       :3003       :3004       :3005
                │         │         │         │
                └─────────┴─────────┴─────────┘
                              │
                          MongoDB
                          :27017
```

All tests hit the API gateway at `localhost:3000` — individual services are not called directly.

## Getting Started

### Prerequisites

- Docker Desktop (or Rancher Desktop)
- Java 21
- Maven 3.6.3+

### 1. Start the Backend

```bash
cd Backendrepo
docker compose up --build -d
```

### 2. Seed Sample Data

```bash
docker compose --profile seed run --rm seed
```

This creates demo users across all roles (admin, doctor, nurse, receptionist, patient) with pre-populated patients, appointments, and prescriptions.

### 3. Verify Backend Health

```bash
curl http://localhost:3000/health
```

### 4. Run the Tests

```bash
cd RestAPI
mvn test
```

## Test Coverage

### Authentication (`LoginTests`)

| Test | Endpoint | Validates |
|------|----------|-----------|
| `adminCanLoginSuccessfully` | `POST /api/auth/login` | 200 response, access/refresh tokens present, user email/role/id in response body |
| `loginFailsWithWrongPassword` | `POST /api/auth/login` | 401 rejection for invalid credentials |

## API Endpoints Available for Automation

The healthcare platform exposes 40+ endpoints across five services. Key areas to automate:

### Auth Service (`/api/auth`)
- User registration, login, token refresh
- Profile management (get/update)
- Password changes, logout
- Admin user management (list, get by ID, activate/deactivate)

### Patient Service (`/api/patients`)
- Patient CRUD with role-based access
- Medical records (add, update, retrieve)
- Pagination, search, and filtering

### Appointment Service (`/api/appointments`)
- Appointment CRUD with status workflow (scheduled → confirmed → completed/cancelled)
- Filter by doctor or patient
- Statistics endpoint

### Prescription Service (`/api/prescriptions`)
- Prescription CRUD (doctor-only create/update)
- Refill requests
- Filter by doctor or patient
- Statistics endpoint

### Notification Service (`/api/notifications`)
- List, read, bulk delete
- Unread count and stats

## Test Credentials (Seeded Data)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@healthcare.com | Admin@123 |
| Doctor | dr.smith@healthcare.com | Doctor@123 |
| Nurse | nurse.williams@healthcare.com | Nurse@123 |
| Receptionist | reception@healthcare.com | Reception@123 |
| Patient | patient.doe@email.com | Patient@123 |

## Project Patterns

### Base Test Setup

All test classes extend `BaseTest`, which configures the REST Assured base URI:

```java
public class BaseTest {
    @BeforeAll
    static void setup() {
        RestAssured.baseURI = "http://localhost:3000";
    }
}
```

### Writing a New Test

1. Create a class under `src/test/java/com/healthcare/api/tests/`
2. Extend `BaseTest`
3. Use REST Assured's BDD style (`given()` / `when()` / `then()`)

```java
public class PatientTests extends BaseTest {
    @Test
    void shouldListPatients() {
        given()
            .header("Authorization", "Bearer " + accessToken)
        .when()
            .get("/api/patients")
        .then()
            .statusCode(200);
    }
}
```

## What to Automate Next

- **Token lifecycle** — register, login, refresh, access protected endpoints, logout
- **Role-based access** — verify doctors can create prescriptions but patients cannot
- **CRUD flows** — create → read → update → delete for patients, appointments, prescriptions
- **Chained requests** — login → create patient → create appointment → create prescription
- **Negative scenarios** — 400 (bad request), 403 (forbidden), 404 (not found), 409 (conflict)
- **Pagination & filtering** — query params for search, sort, page size
- **Status workflows** — appointment and prescription state transitions
- **Inter-service validation** — creating an appointment validates the patient exists first

## Tear Down

```bash
cd Backendrepo
docker compose down       # stop services
docker compose down -v    # stop and delete all data
```

## Additional Documentation

- [Backendrepo/README.md](Backendrepo/README.md) — full endpoint inventory, all test credentials, service architecture
- [Backendrepo/dockerGuide.md](Backendrepo/dockerGuide.md) — Docker health checks and seed troubleshooting
