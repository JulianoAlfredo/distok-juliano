#!/usr/bin/env bash
# ============================================================
# DISTOK — script de deploy (rodar via SSH na Hostinger, na raiz do repo)
# Uso:   bash scripts/deploy.sh
#
# Pré-requisitos:
#  - .env preenchido na raiz (ver .env.production.example)
#  - Node LTS disponível (o "Setup Node.js App" da Hostinger fornece o node/npm)
#  - Banco MySQL já criado e credenciais no .env
# ============================================================
set -euo pipefail

echo "==> 1/5  Instalando dependências (npm ci)"
npm ci

echo "==> 2/5  Aplicando migrations no banco (cria/atualiza o schema)"
npm run migrate

# Rode o seed APENAS no primeiríssimo deploy (cria super admin + dados demo).
# Comente/remova após o primeiro uso para não recriar dados.
if [ "${RUN_SEED:-no}" = "yes" ]; then
  echo "==> (opcional) Rodando seed inicial"
  npm run seed
fi

echo "==> 3/5  Build do frontend (gera apps/web/dist)"
npm run build

echo "==> 4/5  Publicando o frontend"
# Ajuste PUBLISH_DIR para a pasta pública do seu domínio/subdomínio do front.
PUBLISH_DIR="${PUBLISH_DIR:-$HOME/public_html}"
if [ -d "apps/web/dist" ]; then
  echo "    copiando apps/web/dist -> $PUBLISH_DIR"
  cp -r apps/web/dist/. "$PUBLISH_DIR"/
else
  echo "    [aviso] apps/web/dist não encontrado — verifique o build."
fi

echo "==> 5/5  Pronto. Agora reinicie o Node app no hPanel (botão Restart)."
echo "    Depois teste:  curl https://api.SEU-DOMINIO/health"
