#!/usr/bin/env bash
# Provisiona topics/subscriptions Pub/Sub para async jobs (piloto).
# Uso: ./scripts/provision-async-jobs-gcp.sh [APP_BASE_URL]
# Nao cria Cloud Run separado no MVP — push aponta para App Hosting /api/workers/*.
set -euo pipefail

PROJECT="${GCP_PROJECT:-madatodigital}"
REGION="${GCP_REGION:-us-central1}"
BASE_URL="${1:-${APP_BASE_URL:-https://mandatodigital-stg--madatodigital.us-central1.hosted.app}}"
WORKER_SECRET_NAME="${WORKER_SECRET_NAME:-jobs-worker-shared-secret}"

echo "Project=$PROJECT BaseURL=$BASE_URL"

gcloud config set project "$PROJECT"

for TOPIC in md-jobs-seal md-jobs-voice md-jobs-publish md-jobs-dlq; do
  gcloud pubsub topics create "$TOPIC" --project="$PROJECT" 2>/dev/null || echo "topic $TOPIC already exists"
done

# Push subscriptions (requer JOBS_WORKER_SHARED_SECRET no App Hosting + OIDC opcional depois)
create_push() {
  local name="$1"
  local topic="$2"
  local path="$3"
  gcloud pubsub subscriptions create "$name" \
    --topic="$topic" \
    --push-endpoint="${BASE_URL}${path}" \
    --ack-deadline=300 \
    --min-retry-delay=10s \
    --max-retry-delay=600s \
    --dead-letter-topic=md-jobs-dlq \
    --max-delivery-attempts=5 \
    --project="$PROJECT" 2>/dev/null || echo "subscription $name already exists"
}

create_push "md-jobs-seal-push" "md-jobs-seal" "/api/workers/seal"
create_push "md-jobs-voice-push" "md-jobs-voice" "/api/workers/voice"
create_push "md-jobs-publish-push" "md-jobs-publish" "/api/workers/publish"

# Cloud Scheduler do Distribuidor. O Instagram Graph nao agenda do lado da Meta:
# sem o sweep de agendados o pacote fica preso em "scheduled" para sempre.
# O refresh de token evita que publicar quebre 60 dias apos conectar.
if [ -n "${JOBS_WORKER_SHARED_SECRET:-}" ]; then
  gcloud services enable cloudscheduler.googleapis.com --project="$PROJECT" 2>/dev/null \
    || echo "cloudscheduler.googleapis.com ja habilitado (ou sem permissao)"

  create_scheduler() {
    local name="$1"
    local schedule="$2"
    local path="$3"
    local body="$4"
    gcloud scheduler jobs create http "$name" \
      --location="$REGION" \
      --schedule="$schedule" \
      --time-zone="America/Sao_Paulo" \
      --uri="${BASE_URL}${path}" \
      --http-method=POST \
      --headers="Content-Type=application/json,Authorization=Bearer ${JOBS_WORKER_SHARED_SECRET}" \
      --message-body="$body" \
      --attempt-deadline=320s \
      --project="$PROJECT" 2>/dev/null || echo "scheduler $name already exists"
  }

  create_scheduler "md-distribution-scheduled" "*/5 * * * *" \
    "/api/workers/distribution-scheduled" '{"limit":25}'
  create_scheduler "md-instagram-token-refresh" "0 4 * * *" \
    "/api/workers/instagram-token-refresh" '{"windowDays":15,"limit":50}'
else
  echo "JOBS_WORKER_SHARED_SECRET nao exportado — pulei os Cloud Scheduler do Distribuidor."
fi

echo ""
echo "Proximos passos manuais:"
echo "1. Gerar secret JOBS_WORKER_SHARED_SECRET e cadastrar no App Hosting"
echo "2. Em apphosting.yaml: PUBSUB_JOBS_ENABLED=true, ASYNC_SEAL_ENABLED=true, NEXT_PUBLIC_ASYNC_SEAL_ENABLED=true"
echo "3. Deploy indexes Firestore: npm run firebase:indexes:deploy"

echo "4. Configurar push auth (OIDC) ou header x-jobs-worker-secret via transform (Cloud Run/ESPv2) — no MVP o worker aceita Bearer do secret se o push incluir (configure pushAttributes ou migre para OIDC)."
echo "Done."
