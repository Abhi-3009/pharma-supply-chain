# 🏥 PharmaChain — Secure Supply Chain & DevSecOps Platform

[![CI/CD Pipeline](https://img.shields.io/badge/Jenkins-CI%2FCD%20Pipeline-blue?logo=jenkins&logoColor=white)](https://www.jenkins.io/)
[![Node.js](https://img.shields.io/badge/Node.js-v26%20LTS-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%20%2F%2016-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage%20Build-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-HPA%20Autoscaling-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![SonarQube](https://img.shields.io/badge/SonarQube-Quality%20Gate%20Passed-4E9BCD?logo=sonarqube&logoColor=white)](https://www.sonarqube.org/)
[![Security](https://img.shields.io/badge/Security-Trivy%20%7C%20Gitleaks-critical?logo=security&logoColor=white)](https://github.com/aquasecurity/trivy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An enterprise-grade, production-ready pharmaceutical supply chain management and serialization platform built with **Node.js, Express, PostgreSQL, JWT/RBAC, Atomic Transactions, Row-Level Concurrency Control**, an immutable **SHA-256 Hash-Chain Ledger** for cryptographic data integrity, and an automated **11-Stage DevSecOps CI/CD Pipeline**.

---

## 📋 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Key Features & Business Value](#-key-features--business-value)
- [Tech Stack & Engineering Rationale](#-tech-stack--engineering-rationale)
- [Layered Backend Architecture](#-layered-backend-architecture)
- [Relational Data Model](#-relational-data-model)
- [Core Workflows & Integrity Guarantees](#-core-workflows--integrity-guarantees)
- [API Documentation](#-api-documentation)
- [Local Setup & Quick Start](#-local-setup--quick-start)
- [Docker & Containerized Deployment](#-docker--containerized-deployment)
- [DevSecOps Pipeline & Security Gates](#-devsecops-pipeline--security-gates)
- [Kubernetes Orchestration & HPA Autoscaling](#-kubernetes-orchestration--hpa-autoscaling)
- [Centralized Observability (ELK Stack)](#-centralized-observability-elk-stack)
- [Ansible Automation & Vault Security](#-ansible-automation--vault-security)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [License](#-license)

---

## 🏗️ Architecture Overview

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                DEVSECOPS CI/CD WORKFLOW                                │
└────────────────────────────────────────────────────────────────────────────────────────┘

Developer Push ──▶ GitHub (main)
                      │
                      ▼
               Jenkins Pipeline (11 Stages)
               ├─ 1. Git Clone (checkout scm)
               ├─ 2. Dependencies (`npm ci`)
               ├─ 3. Linter (`eslint`)
               ├─ 4. Unit & Integration Tests (`jest --coverage`)
               ├─ 5. SAST Code Scan (SonarQube Quality Gate)
               ├─ 6. Dependency Vulnerability Scan (`npm audit --high`)
               ├─ 7. Secrets Detection (`gitleaks detect --exit-code 1`)
               ├─ 8. Multi-Stage Docker Image Build (`node:26-alpine`)
               ├─ 9. Container CVE Vulnerability Scan (`trivy image`)
               ├─ 10. Authenticated Push to DockerHub Registry
               └─ 11. Automated Rolling Deployment to Kubernetes (via Ansible Vault)
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               KUBERNETES RUNTIME CLUSTER                               │
└────────────────────────────────────────────────────────────────────────────────────────┘
                      Ingress / NodePort Service (Port 30080)
                                      │
                      ┌───────────────┴───────────────┐
                      ▼                               ▼
               Pod 1 (pharma-app)              Pod 2 (pharma-app)  ... (Up to 5 Pods via HPA)
               [Non-root appuser]              [Non-root appuser]
               [Liveness/Readiness]            [Liveness/Readiness]
                      │                               │
                      └───────────────┬───────────────┘
                                      │
                                      ▼
                      PostgreSQL 16 Relational Database
                      (ACID Transactions, Row-Level Locking, FK Constraints)
                                      │
                                      ▼
                      Winston Structured JSON Logs Stream
                                      │
                                      ▼
                      ELK Stack (Logstash:5000 ➔ Elasticsearch:9200 ➔ Kibana:5601)
```

---

## ✨ Key Features & Business Value

1. **Role-Based Access Control (RBAC)**:
   * 5 discrete roles: `ADMIN`, `MANUFACTURER`, `DISTRIBUTOR`, `WAREHOUSE`, `PHARMACY`.
   * Enforced via JWT cryptographic validation and route middleware.
2. **Cryptographic SHA-256 Hash-Chain Ledger**:
   * Every registration, transfer, and checkpoint scan is hashed with its previous block's hash.
   * Continuous tamper detection (`GET /verify`) flags the exact block index of any unauthorized database modification.
3. **Atomic Transactions with Row-Level Locking**:
   * Shipment creation and stock deduction execute within a single PostgreSQL transaction block.
   * `SELECT ... FOR UPDATE` prevents double-allocation, overselling, and race conditions.
4. **DevSecOps Security Gates**:
   * Static Application Security Testing (SonarQube).
   * Container image vulnerability scanning (Trivy).
   * Git secret and credential leak detection (Gitleaks).
   * Pinned dependency vulnerability enforcement (`npm audit`).
5. **High Availability & Autoscaling**:
   * Kubernetes Deployment with zero-downtime RollingUpdates.
   * Horizontal Pod Autoscaler (HPA) scaling between 2 to 5 pods based on CPU and Memory load.
6. **Centralized Logging & Observability**:
   * JSON log streaming via Winston to Logstash, indexed in Elasticsearch, and searchable in Kibana.

---

## 🛠️ Tech Stack & Engineering Rationale

| Component | Technology | Purpose & Problem Solved | Failure Behavior |
|-----------|-----------|--------------------------|------------------|
| **Backend** | Node.js + Express | Modular REST API server for supply chain operations | Centralized error handler with structured error responses |
| **Database** | PostgreSQL 15/16 (`pg`) | Authoritative relational persistence, foreign keys, and ACID transactions | Connection retry / 500 status on DB outage |
| **Authentication** | bcrypt + JWT | Secure password hashing (10 salt rounds) and stateless token authorization | 401 Unauthorized for expired or invalid tokens |
| **Authorization** | RBAC Middleware | Enforces role permissions per endpoint | 403 Forbidden on unauthorized role access |
| **Concurrency** | PostgreSQL `FOR UPDATE` | Row-level locking to eliminate race conditions and stock overselling | Second transaction waits/fails gracefully with 400 |
| **Data Integrity** | SHA-256 Hash Chain | Tamper-evident cryptographic ledger for recording all supply chain events | `GET /verify` flags exact tampered block index |
| **Testing** | Jest + Supertest | 9 test suites / 51 automated unit, integration, and security tests | Fails CI pipeline build on test regression |
| **Containerization** | Docker (Multi-stage) | Lean (~66 MB), non-root production container packaging | Automatic restart via Kubernetes liveness probe |
| **Security Gates** | Trivy, Gitleaks, SonarQube | Image vulnerability, leaked secret, and static code analysis | Blocks deployment if critical CVEs or secrets found |
| **CI/CD** | Jenkins | 11-stage automated pipeline with quality and security gates | Aborts pipeline on security gate or test failure |
| **Orchestration** | Kubernetes & HPA | High availability deployment (2-5 replicas autoscaled by CPU/Memory) | Unhealthy pods evicted; traffic shifted automatically |
| **Automation** | Ansible + Vault | Deployment playbook orchestration with encrypted secrets | Playbook fails if vault decryption or rollout fails |
| **Logging** | ELK Stack (Winston) | Centralized structured JSON logging and Kibana query visualization | Logs buffer locally if Logstash is temporarily down |

---

## 🏛️ Layered Backend Architecture

```text
HTTP Request
     │
     ▼
[ Express Router ]       (routes/ — Route definition, URL params, request routing)
     │
     ▼
[ Middleware ]           (middleware/ — authMiddleware, roleMiddleware, rateLimiter, helmet)
     │
     ▼
[ Controllers ]          (controllers/ — HTTP status codes, parsing req/res, delegating)
     │
     ▼
[ Service Layer ]        (services/ — Business logic, transactions, ledger hashing, orchestration)
     │
     ▼
[ Repository Layer ]     (repositories/ — SQL queries, parameterized statements, row locking)
     │
     ▼
[ PostgreSQL Pool ]      (db/pool.js — pg.Pool connection lifecycle & withTransaction)
```

---

## 🗄️ Relational Data Model

```text
  ┌──────────────┐          ┌────────────────┐          ┌────────────────┐
  │    users     │◀─────────┤     drugs      │◀─────────┤   inventory    │
  ├──────────────┤ 1      * ├────────────────┤ 1      * ├────────────────┤
  │ id (UUID)    │          │ id (UUID)      │          │ id (UUID)      │
  │ name         │          │ name           │          │ drug_id (FK)   │
  │ email (UK)   │          │ batch_id (UK)  │          │ location       │
  │ password_hash│          │ expiry_date    │          │ quantity       │
  │ role         │          │ manufacturer_id│          └────────────────┘
  └──────────────┘          └────────────────┘
         ▲                          │ 1
         │                          │
         │                          ▼ *
  ┌──────────────┐          ┌────────────────┐
  │shipment_event│◀─────────┤   shipments    │
  ├──────────────┤ *      1 ├────────────────┤
  │ id (UUID)    │          │ id (UUID)      │
  │ shipment_id  │          │ drug_id (FK)   │
  │ status       │          │ origin         │
  │ location     │          │ destination    │
  │ updated_by   │          │ quantity       │
  └──────────────┘          └────────────────┘

  ┌────────────────────────────────────────────────────────────────────────┐
  │                            ledger_entries                              │
  ├────────────────────────────────────────────────────────────────────────┤
  │ id (PK) | block_index (UK) | event_type | entity_id | payload (JSONB)  │
  │ previous_hash (SHA-256)    | hash (SHA-256)         | created_at       │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Core Workflows & Integrity Guarantees

### 1. Atomic Shipment Creation & Inventory Deduction
```text
BEGIN TRANSACTION
  1. Lock Inventory Row at Origin: SELECT quantity FROM inventory WHERE drug_id = $1 AND location = $2 FOR UPDATE
  2. Verify: available_quantity >= requested_quantity
  3. Deduct Stock: UPDATE inventory SET quantity = quantity - $quantity
  4. Create Shipment: INSERT INTO shipments (drug_id, origin, destination, quantity, status='created')
  5. Create Audit Event: INSERT INTO shipment_events (shipment_id, status='created', location=origin)
  6. Append Ledger Block: hash = SHA-256(previous_hash + payload + timestamp) -> INSERT INTO ledger_entries
COMMIT (If any step fails, entire transaction is ROLLED BACK automatically)
```

### 2. Concurrency Race-Condition Protection
When concurrent shipment requests for the same inventory stock arrive simultaneously:
* The first transaction locks the inventory row with `FOR UPDATE`.
* The second transaction waits for the lock release.
* When released, the second transaction re-evaluates the true remaining quantity. If insufficient, it aborts cleanly without negative stock balances.

### 3. Persistent Tamper-Evident Ledger Verification
* Each event generates a cryptographic block: `hash = SHA256(previous_hash + payload + timestamp)`.
* Calling `GET /verify` recalculates every block's SHA-256 hash sequentially.
* If any unauthorized direct DB edit occurs, the recalculation flags the exact corrupted block index.

---

## 📡 API Documentation

### Authentication & RBAC

| Method | Endpoint | Allowed Roles | Description |
|--------|----------|---------------|-------------|
| `POST` | `/auth/register` | Public | Register user (`ADMIN`, `MANUFACTURER`, `DISTRIBUTOR`, `WAREHOUSE`, `PHARMACY`) |
| `POST` | `/auth/login` | Public | Authenticate user & return signed JWT token |
| `GET` | `/auth/me` | Authenticated | Retrieve authenticated user profile & active role |

### Drug & Inventory Management

| Method | Endpoint | Allowed Roles | Description |
|--------|----------|---------------|-------------|
| `POST` | `/drugs` | `ADMIN`, `MANUFACTURER` | Register new pharmaceutical drug & batch |
| `GET` | `/drugs` | Public | List all registered drugs |
| `GET` | `/drugs/:id` | Public | Get specific drug details by ID |
| `POST` | `/inventory/stock` | `ADMIN`, `MANUFACTURER`, `WAREHOUSE` | Restock drug inventory at a location |
| `GET` | `/inventory` | Public / Auth | List real-time inventory levels across all locations |

### Shipment Tracking & Ledger Integrity

| Method | Endpoint | Allowed Roles | Description |
|--------|----------|---------------|-------------|
| `POST` | `/shipments` | `ADMIN`, `MANUFACTURER`, `DISTRIBUTOR`, `WAREHOUSE` | Create shipment with atomic inventory reservation |
| `GET` | `/shipments` | Public / Auth | List all active and delivered shipments |
| `GET` | `/shipments/:id` | Public / Auth | Track shipment with complete audit trail history |
| `PUT` | `/shipments/:id/status` | `ADMIN`, `DISTRIBUTOR`, `WAREHOUSE`, `PHARMACY` | Update checkpoint status (`in-transit`, `at-checkpoint`, `delivered`, `recalled`) |
| `GET` | `/verify` | Public / Auth | Verify cryptographic continuity of the hash-chain ledger |
| `GET` | `/ledger` | Public / Auth | View raw ledger blocks and cryptographic hashes |
| `POST` | `/ledger/tamper` | Testing Only | Simulate database record modification to test tamper detection |

---

## 🚀 Local Setup & Quick Start

### 1. Prerequisites
* Node.js v20.x or v26.x
* Docker & Docker Compose
* PostgreSQL 15 or 16

### 2. Start PostgreSQL via Docker
```bash
docker run -d \
  --name pharma-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=pharma_db \
  -p 5432:5432 \
  postgres:16-alpine
```

### 3. Configure and Run Backend
```bash
# Navigate to app directory
cd app

# Create .env file
cat <<EOF > .env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
JWT_SECRET=super-secret-jwt-key-for-pharma-app-2026
JWT_EXPIRES_IN=24h
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=pharma_db
EOF

# Install dependencies
npm install

# Run automated tests
npm test

# Start the application
npm start
```
Access the dashboard at **`http://localhost:3000`**.

---

## 🐳 Docker & Containerized Deployment

### Build the Multi-Stage Image:
```bash
docker build -t codestack123/pharma-supply-chain:latest -f docker/Dockerfile .
```

### Run Container Connected to Postgres:
```bash
docker run -d \
  --name pharma-app \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PGPASSWORD=postgres \
  -e PGUSER=postgres \
  -e PGHOST=host.docker.internal \
  -e PGDATABASE=pharma_db \
  codestack123/pharma-supply-chain:latest
```

### Check Container Health Status:
```bash
curl http://localhost:3000/health
# Response: {"status":"healthy","service":"pharma-supply-chain",...}
```

---

## 🛡️ DevSecOps Pipeline & Security Gates

The pipeline defined in [`jenkins/Jenkinsfile`](jenkins/Jenkinsfile) executes 11 automated stages:

1. **Code Checkout**: Clones source from GitHub main branch.
2. **Install Dependencies**: `npm ci` installs deterministic production & dev dependencies.
3. **Linting**: ESLint enforces strict code style.
4. **Automated Testing**: Jest executes 51 unit & integration tests with coverage reporting.
5. **SAST Analysis**: SonarQube Scanner analyzes code quality and enforces Quality Gate.
6. **SCA Dependency Gate**: `npm audit --audit-level=high` blocks build on high/critical vulnerabilities.
7. **Secrets Detection**: Gitleaks scans git history with `--exit-code 1` (blocks any leaked keys/tokens).
8. **Docker Build**: Packages application into an optimized non-root Alpine container.
9. **Container CVE Scan**: Trivy scans the Docker image for OS & package CVEs (`--severity CRITICAL --exit-code 1`).
10. **DockerHub Push**: Securely pushes tagged images (`${BUILD_NUMBER}` and `latest`) to DockerHub.
11. **Kubernetes Deployment**: Ansible executes automated rollout with encrypted Ansible Vault credentials.

---

## ☸️ Kubernetes Orchestration & HPA Autoscaling

Deploy all Kubernetes resources in order:

```bash
# 1. Create pharma-app namespace
kubectl apply -f k8s/namespace.yaml

# 2. Deploy 2-replica application with health probes
kubectl apply -f k8s/deployment.yaml

# 3. Create NodePort service
kubectl apply -f k8s/service.yaml

# 4. Apply Horizontal Pod Autoscaler (scales 2 to 5 pods)
kubectl apply -f k8s/hpa.yaml
```

### Verify Kubernetes Resources:
```bash
kubectl get pods -n pharma-app
kubectl get svc -n pharma-app
kubectl get hpa -n pharma-app
```

---

## 📊 Centralized Observability (ELK Stack)

Start the ELK Stack with Docker Compose:
```bash
docker-compose -f elk/docker-compose.yml up -d
```

* **Elasticsearch**: `http://localhost:9200`
* **Logstash Port**: `5000` (Receives Winston structured JSON logs)
* **Kibana UI**: `http://localhost:5601`

---

## 🔐 Ansible Automation & Vault Security

### Deploy with Ansible Playbook:
```bash
ansible-playbook -i ansible/inventory.ini ansible/deploy.yml --ask-vault-pass
```

### Encrypted Secrets Management:
```bash
# Edit encrypted secrets file
ansible-vault edit ansible/group_vars/all/vault.yml
```

---

## 🧪 Testing & Quality Assurance

Run all test suites:
```bash
cd app
npm test
```

### Test Coverage Breakdown:
* `tests/auth.test.js`: User registration, password hashing, JWT creation, token expiry.
* `tests/rbac.test.js`: Permission authorization across all 5 user roles.
* `tests/drugs.test.js`: Batch creation, duplicate batch prevention, metadata validation.
* `tests/inventory.test.js`: Multi-location stock allocation, incrementing, inventory balance check.
* `tests/shipments.test.js`: Shipment creation, state transitions (`in-transit` ➔ `delivered`), audit trails.
* `tests/transactions.test.js`: Atomic rollback verification on failed operations.
* `tests/concurrency.test.js`: Row-level locking race-condition prevention under concurrent demand.
* `tests/ledger.test.js`: Cryptographic hash-chain calculation and tamper detection.
* `tests/verify.test.js`: Full-chain verification endpoints and security alerts.

<!-- ---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

© 2026 **Abhijeet Rai**. All Rights Reserved. -->
