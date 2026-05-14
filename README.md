# Roo-Jaeng Incident Workflow

Incident workflow system for IDS Support.

## Stack

- Frontend: Next.js
- Backend: FastAPI
- Database: PostgreSQL
- Reverse Proxy: Nginx
- Deploy: Docker
- Integration: Slack Events API / Zabbix Alert

## Current Flow

Zabbix Alert → Slack Channel → Slack Events API → Roo-Jaeng → Auto Ticket

## Paths

- Backend: app/main.py
- Frontend: frontend/
- Compose: docker-compose.yml
- Domain: https://roo-jaeng.com
