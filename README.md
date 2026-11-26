# 🛡️ AntCrowd — Crowdsourced Penetration Testing & Security Collaboration Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker Compose](https://img.shields.io/badge/Docker%20Compose-v2+-blue?logo=docker)](docker-compose.yml)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](services/auth-service)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)](services/vdp-service)
[![Python](https://img.shields.io/badge/Python-3.11+-yellow?logo=python)](services/GRC-service)
[![React](https://img.shields.io/badge/Frontend-React%20%7C%20Vite-61DAFB?logo=react)](frontend)

> **AntCrowd** is an enterprise-grade, multi-tenant crowdsourced cybersecurity platform designed to bridge organizations, professional security researchers, and automated AI red-teaming pipelines. Built as a scalable microservices architecture powered by Go, Node.js, Python, PostgreSQL, and MinIO.

---

## 🏛️ System Architecture

```
                                  ┌───────────────────────────────┐
                                  │   Unified Web Portals (Vite)  │
                                  │   Organization | Researcher   │
                                  │   Admin Portal (Port 8089)    │
                                  │   Main Portal  (Port 3000)    │
                                  └───────────────┬───────────────┘
                                                  │
                                      HTTP / Reverse Proxy
                                                  │
 ┌────────────────────────────────────────────────┼────────────────────────────────────────────────┐
 │                                                │                                                │
 ▼                                                ▼                                                ▼
┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│       Auth Service      │      │       VDP Service       │      │       Pen Service       │
│  Node.js • Port 8080    │      │     Go/Gin • Port 8001  │      │     Go/Gin • Port 8002  │
│  JWT • 2FA • Brevo/Mail │      │  Report Lifecycle • S3  │      │  Engagements • Findings │
└────────────┬────────────┘      └────────────┬────────────┘      └────────────┬────────────┘
             │                                │                                │
 ┌───────────┼────────────────────────────────┼────────────────────────────────┼───────────┐
 │           ▼                                ▼                                ▼           │
 │  ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐  │
 │  │ Challenge Svc   │              │ AI Red Team Svc │              │ Bug Bounty Svc  │  │
 │  │ Port 8003 (Go)  │              │ Port 8004 (Py)  │              │ Port 8005 (Node)│  │
 │  └─────────────────┘              └─────────────────┘              └─────────────────┘  │
 │           │                                │                                │           │
 │           ▼                                ▼                                ▼           │
 │  ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐  │
 │  │ Code Audit Svc  │              │ Training Svc    │              │ GRC & Trust Svc │  │
 │  │ Port 8080 (Go)  │              │ Port 8000 (Py)  │              │ Port 8010 (Py)  │  │
 │  └─────────────────┘              └─────────────────┘              └─────────────────┘  │
 └────────────────────────────────────────────┬────────────────────────────────────────────┘
                                              │
                                  Shared Storage & Data
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
            ┌─────────────────────────┐               ┌─────────────────────────┐
            │   PostgreSQL 16 Multi   │               │    MinIO Object Storage │
            │   Database Container    │               │  Attachments & Evidence │
            │   Port 5545 (Internal)  │               │   Port 9000 / 9001 S3   │
            └─────────────────────────┘               └─────────────────────────┘
```

---

## 📦 Core Services & Modules

| Module / Service | Language / Framework | Description |
|---|---|---|
| **Auth Service** | Node.js, Express, PostgreSQL | Authentication, session introspection, RBAC, 2FA, Brevo/Mailpit email verification |
| **VDP Service** | Go (Gin), MinIO S3 | Vulnerability Disclosure Program ingestion, triage workflows, file attachments |
| **Pen-Testing Service** | Go (Gin), PostgreSQL | Scoped penetration test management, finding review boards, engagement tracking |
| **Bug Bounty Service** | Node.js, Express | Program definitions, bounty rewards, submission validation and scoring |
| **AI Red Team Service** | Python (FastAPI) | Automated threat modeling, prompt injection tests, and red-teaming simulations |
| **Challenge Service** | Go / Node.js | CTF-style challenges, verification flags, and security researcher gamification |
| **Code Review Service** | Go, PostgreSQL | Automated source code analysis, static vulnerability detection, and triage |
| **Training Service** | Python (FastAPI), React | Hands-on defensive and offensive interactive training modules for organizations |
| **GRC & Trust Center** | Python (FastAPI) | Compliance tracking, governance documentation, vendor risk management |
| **Admin Frontend** | React, Vite, Tailwind CSS | Multi-service administrative operations dashboard (Port `8089`) |
| **Main Frontend** | React, Vite, Tailwind CSS | Unified researcher and organization client experience (Port `3000`) |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) v18+ (for local frontend dev)
- [Go](https://golang.org/) 1.21+ (for local backend dev)
- [Python](https://www.python.org/) 3.11+ (for AI/GRC services)

### 1. Clone the Repository
```bash
git clone https://github.com/bini576/antcrowd101.git
cd antcrowd101
```

### 2. Configure Environment Variables
Copy each service's `.env.example` to `.env`:
```bash
# Main Frontend & Infrastructure
cp frontend/.env.example frontend/.env
cp infra/.env.example infra/.env

# Backends
cp services/auth-service/.env.example services/auth-service/.env
cp services/ai-redteam-service/.env.example services/ai-redteam-service/.env
cp services/bug-bounty-service/.env.example services/bug-bounty-service/.env
cp services/challenge-service/.env.example services/challenge-service/.env
cp services/code-service/.env.example services/code-service/.env
cp services/GRC-service/.env.example services/GRC-service/.env
cp services/securityTrust/.env.example services/securityTrust/.env
cp services/training-service/backend/.env.example services/training-service/backend/.env
```

> ⚠️ **Security Warning**: In production, replace all dev JWT secrets, database passwords, and API keys with cryptographically random tokens (`openssl rand -hex 32`).

### 3. Launch with Docker Compose
```bash
docker compose up --build -d
```

### 4. Verify Services
Check running containers and health checks:
```bash
docker compose ps
```

Access the user interfaces:
- **Main Client Portal**: [http://localhost:3000](http://localhost:3000)
- **Admin Management Console**: [http://localhost:8089](http://localhost:8089)
- **MinIO Console**: [http://localhost:9001](http://localhost:9001) (`minio` / `minio123`)

---

## 🔒 Security Best Practices

1. **Secret Isolation**: Real `.env` files are strictly excluded from version control via `.gitignore`.
2. **Session Security**: Inter-service communication is secured via internal service introspection tokens (`AUTH_INTERNAL_SERVICE_TOKEN`).
3. **Storage Security**: MinIO attachments are stored with multi-tenant prefix isolation.
4. **Email Security**: Production uses TLS-encrypted Brevo SMTP relays; local development falls back to isolated Mailpit instances.

---

## 👥 Contributors & Development Team

This project was engineered as the Capstone Graduation Project at **Bahir Dar University**, Faculty of Computing, Department of Cyber Security:

- **Biniyam Ademasu Afework** ([@bini576](https://github.com/bini576)) — Security Architecture, Intrusion Modeling, Core Engineering
- **Zulkifl Seid** ([@zulkifl-seid](https://github.com/zulkifl-seid)) — Services & Platform Architecture
- **Abela8767** ([@Abela8767](https://github.com/Abela8767)) — Security Research & Testing

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
