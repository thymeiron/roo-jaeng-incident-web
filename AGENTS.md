# Roo-Jaeng Production Rules

This is a production Docker application.

## Safety rules

- Do not run docker compose down.
- Do not stop or restart containers unless explicitly requested.
- Do not build Docker images unless explicitly requested.
- Do not run docker system prune or docker volume prune.
- Do not delete or modify the postgres directory.
- Do not modify production database records without explicit permission.
- Do not expose passwords, tokens, cookies, API keys, or environment variables.
- Do not modify the token_20260506 file.
- Inspect files and explain the plan before making changes.
- Preserve all existing uncommitted changes.
- Never use git restore, git reset, git clean, or force checkout.
- Show git diff after editing.
- Prefer targeted container builds instead of rebuilding all services.
