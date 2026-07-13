#!/usr/bin/env bash
# ============================================================
# DISTOK — backup do MySQL (P1 #6 do BACKLOG.md)
# Uso:   bash scripts/backup-db.sh
#
# Pensado pra rodar via Cron Job do hPanel (Hostinger), na raiz do repo,
# uma vez por dia. Lê as credenciais do mesmo .env usado pela API.
#
# O que faz:
#  1. mysqldump consistente (--single-transaction, sem lock de tabela)
#  2. comprime em .sql.gz com timestamp
#  3. apaga backups locais com mais de BACKUP_RETENTION_DAYS dias
#  4. se BACKUP_OFFSITE_CMD estiver definida, roda esse comando passando
#     o caminho do arquivo como $1 (ex.: copiar pra outro storage) —
#     NÃO fica de graça: configure isso você mesmo pro seu provedor
#     (rclone, rsync, s3 cp, etc.), este script só chama o comando.
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a; source .env; set +a
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_NAME="${DB_NAME:-distok}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/distok-backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/distok-$DB_NAME-$STAMP.sql.gz"

echo "==> Gerando dump de '$DB_NAME' em $OUT_FILE"
mysqldump \
  --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASS" \
  --single-transaction --routines --no-tablespaces --quick \
  "$DB_NAME" | gzip > "$OUT_FILE"

echo "==> Dump concluído ($(du -h "$OUT_FILE" | cut -f1))"

echo "==> Removendo backups locais com mais de $BACKUP_RETENTION_DAYS dias"
find "$BACKUP_DIR" -name 'distok-*.sql.gz' -mtime "+$BACKUP_RETENTION_DAYS" -delete

if [ -n "${BACKUP_OFFSITE_CMD:-}" ]; then
  echo "==> Enviando para destino off-site"
  eval "$BACKUP_OFFSITE_CMD \"$OUT_FILE\""
else
  echo "==> BACKUP_OFFSITE_CMD não configurada — backup ficou só local em $BACKUP_DIR."
  echo "    Isso NÃO cumpre o objetivo de backup off-site sozinho; configure essa variável."
fi

echo "==> Backup finalizado."
