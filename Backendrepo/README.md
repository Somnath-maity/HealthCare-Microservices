# Healthcare Platform - Microservices Backend

A containerized healthcare backend with 5 interconnected microservices, designed for learning API automation testing.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway (:3000)                          │
│              /api/auth  /api/patients  /api/appointments        │
│              /api/prescriptions  /api/notifications             │
└──────┬──────────┬──────────┬──────────┬──────────┬─────────────┘
       │          │          │          │          │
  ┌────▼───┐ ┌───▼────┐ ┌───▼─────┐ ┌─▼────────┐ ┌▼────────────┐
  │  Auth  │ │Patient │ │Appoint- │ │Prescrip- │ │Notification │
  │Service │ │Service │ │  ment   │ │  tion    │ │  Service    │
  │ :3001  │ │ :3002  │ │Service  │ │ Service  │ │   :3005     │
  └───┬────┘ └───┬────┘ │ :3003   │ │  :3004   │ └─────────────┘
      │          │      └────┬────┘ └────┬─────┘
      │          │           │           │
      └──────────┴───────────┴───────────┘
                         │
                    ┌────▼────┐
                    │ MongoDB │
                    │ :27017  │
                    └─────────┘
```

### Inter-Service Communication
- **Appointment Service** → calls **Patient Service** to validate patient exists
- **Prescription Service** → calls **Patient Service** + **Appointment Service** to validate references
- **All services** → call **Notification Service** to send alerts (fire-and-forget)
- **All services** → call **Auth Service** to verify JWT tokens

## Quick Start

### Prerequisites
- Docker & Docker Compose (Rancher Desktop / Docker Desktop)

### Launch Everything
```bash
docker-compose up --build
```

### Seed Sample Data
```bash
docker-compose run --rm seed
```

### Stop
```bash
docker-compose down
```

### Reset (clear database)
```bash
docker-compose down -v
docker-compose up --build
```

## API Endpoints

### Gateway: `http://localhost:3000`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Gateway & services health |
| GET | `/api/services` | No | Service discovery |

### Auth Service (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login, get tokens |
| POST | `/api/auth/refresh-token` | No | Refresh JWT tokens |
| GET | `/api/auth/profile` | Yes | Get current user profile |
| PUT | `/api/auth/profile` | Yes | Update profile |
| POST | `/api/auth/change-password` | Yes | Change password |
| POST | `/api/auth/logout` | Yes | Logout (invalidate tokens) |
| GET | `/api/auth/users` | Admin | List all users |
| GET | `/api/auth/users/:id` | Admin | Get user by ID |
| PATCH | `/api/auth/users/:id/status` | Admin | Activate/deactivate user |

### Patient Service (`/api/patients`)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| GET | `/api/patients` | Yes | Any | List patients (paginated, searchable) |
| GET | `/api/patients/:id` | Yes | Any | Get patient details |
| POST | `/api/patients` | Yes | admin, doctor, nurse, receptionist | Register patient |
| PUT | `/api/patients/:id` | Yes | admin, doctor, nurse, receptionist | Update patient |
| DELETE | `/api/patients/:id` | Yes | admin | Soft-delete patient |
| GET | `/api/patients/:id/medical-records` | Yes | Any | List medical records |
| POST | `/api/patients/:id/medical-records` | Yes | doctor, nurse | Add medical record |
| GET | `/api/patients/:id/medical-records/:recordId` | Yes | Any | Get single record |
| PUT | `/api/patients/:id/medical-records/:recordId` | Yes | doctor, nurse | Update record |

### Appointment Service (`/api/appointments`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/appointments` | Yes | List appointments (filtered) |
| GET | `/api/appointments/stats` | Yes (admin/doctor) | Appointment statistics |
| GET | `/api/appointments/:id` | Yes | Get appointment |
| POST | `/api/appointments` | Yes | Create appointment |
| PUT | `/api/appointments/:id` | Yes | Update appointment |
| PATCH | `/api/appointments/:id/status` | Yes | Change status |
| GET | `/api/appointments/doctor/:doctorId` | Yes | Doctor's appointments |
| GET | `/api/appointments/patient/:patientId` | Yes | Patient's appointments |

### Prescription Service (`/api/prescriptions`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/prescriptions` | Yes | List prescriptions |
| GET | `/api/prescriptions/:id` | Yes | Get prescription |
| POST | `/api/prescriptions` | Yes (doctor) | Create prescription |
| PUT | `/api/prescriptions/:id` | Yes (doctor) | Update prescription |
| PATCH | `/api/prescriptions/:id/status` | Yes (doctor/admin) | Change status |
| POST | `/api/prescriptions/:id/refill` | Yes | Request refill |
| GET | `/api/prescriptions/patient/:patientId` | Yes | Patient's prescriptions |
| GET | `/api/prescriptions/doctor/:doctorId` | Yes | Doctor's prescriptions |
| GET | `/api/prescriptions/stats` | Yes (admin/doctor) | Prescription stats |

### Notification Service (`/api/notifications`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications` | Yes | List user's notifications |
| GET | `/api/notifications/unread-count` | Yes | Unread count |
| GET | `/api/notifications/stats` | Yes | Notification stats |
| GET | `/api/notifications/:id` | Yes | Get notification |
| PATCH | `/api/notifications/:id/read` | Yes | Mark as read |
| PATCH | `/api/notifications/read-all` | Yes | Mark all as read |
| DELETE | `/api/notifications/:id` | Yes | Delete notification |
| DELETE | `/api/notifications/bulk` | Yes | Bulk delete |

## Test Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@healthcare.com | Admin@123 |
| Doctor | dr.smith@healthcare.com | Doctor@123 |
| Doctor | dr.johnson@healthcare.com | Doctor@123 |
| Doctor | dr.patel@healthcare.com | Doctor@123 |
| Doctor | dr.chen@healthcare.com | Doctor@123 |
| Nurse | nurse.williams@healthcare.com | Nurse@123 |
| Nurse | nurse.davis@healthcare.com | Nurse@123 |
| Receptionist | reception@healthcare.com | Reception@123 |
| Patient | patient.doe@email.com | Patient@123 |
| Patient | patient.wilson@email.com | Patient@123 |

## Key Features for API Automation Practice

- **Authentication flows**: Register → Login → Token refresh → Protected endpoints
- **Role-based access**: Different users see/do different things
- **CRUD operations**: Full create/read/update/delete on all resources
- **Pagination & filtering**: Query params for search, sort, filter
- **Inter-service dependencies**: Creating appointments validates patients first
- **Chained requests**: Login → Create patient → Create appointment → Create prescription
- **Status workflows**: Appointment lifecycle (scheduled → confirmed → completed/cancelled)
- **Error scenarios**: 400, 401, 403, 404, 409 responses to test
- **Bulk operations**: Bulk delete notifications
- **Statistics endpoints**: Aggregated data for validation
