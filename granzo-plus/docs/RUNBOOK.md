# Runbook — Granzo Plus

## Subir (NUC)
1. `mkdir -p data secrets && chmod 700 data secrets`
2. `head -c 48 /dev/urandom | base64 > secrets/granzo_db_key && chmod 600 secrets/granzo_db_key` (guarde cópia da chave **fora** do NUC e separada do backup)
3. `cp .env.example .env && chmod 600 .env` e preencha.
4. `docker compose up -d --build` e `./scripts/check_security.sh`.

## Rotacionar segredos
- **Pluggy Client Secret:** dashboard.pluggy.ai → regenerar → atualizar `.env` → `docker compose up -d`.
- **Token do Discord:** Developer Portal → Bot → Reset Token → `.env` → reiniciar.
- **Chave do SQLCipher:** `PRAGMA rekey` com a chave antiga; fazer backup antes.

## Revogar acesso bancário (S5)
App do banco → Open Finance → compartilhamentos → revogar; e remover a conexão em meu.pluggy.ai.

## Consentimento expirado
Aviso em `#granzo2-status` → reconectar o banco no MeuPluggy (manual).

## Backup (a implementar)
Diário, `age`, retenção 14 dias, destino fora do NUC (decisão pendente do Lucas).
