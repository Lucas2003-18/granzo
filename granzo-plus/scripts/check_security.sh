#!/usr/bin/env bash
# Checklist SPEC-01 automatizável. Roda no NUC depois do `docker compose up`.
set -u
fail=0; ok(){ echo "OK   $*"; }; bad(){ echo "FAIL $*"; fail=1; }
C=granzo-plus
[ -z "$(docker port $C 2>/dev/null)" ] && ok "sem portas publicadas" || bad "portas publicadas"
[ "$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' $C)" = true ] && ok read_only || bad read_only
[ "$(docker inspect -f '{{.Config.User}}' $C)" != "" ] && [ "$(docker inspect -f '{{.Config.User}}' $C)" != root ] && ok "não-root" || bad "root"
docker inspect -f '{{json .HostConfig.CapDrop}}' $C | grep -q ALL && ok "cap_drop ALL" || bad cap_drop
docker inspect -f '{{json .HostConfig.SecurityOpt}}' $C | grep -q no-new-privileges && ok no-new-privileges || bad no-new-privileges
docker inspect -f '{{range .Mounts}}{{.Source}} {{end}}' $C | grep -q docker.sock && bad "docker.sock montado" || ok "sem docker.sock"
docker inspect -f '{{json .NetworkSettings.Networks}}' $C | grep -q collab-hub && bad "na collab-hub-network" || ok "fora da collab-hub-network"
[ "$(stat -c %a .env 2>/dev/null)" = 600 ] && ok ".env 600" || bad ".env sem permissão 600"
if git -C "$(dirname "$0")/.." grep -nEi 'clientsecret *= *[A-Za-z0-9]{10,}|discord_token *= *[A-Za-z0-9._-]{20,}' -- . ':!*.example' ':!tests' >/dev/null 2>&1; then bad "possível segredo no repo"; else ok "sem segredos no repo"; fi
exit $fail
