# Firebase Storage + Firestore

Persistencia da app: **Firestore** (metadados) + **Firebase Storage** (blobs).

## Paths

- Treino/vídeo: `training/{profileOrDraftId}/{uuid}-{filename}`
- Compliance: `compliance/{relativePath}`

## Config

- Bucket: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (ou `FIREBASE_TRAINING_ASSETS_BUCKET`)
- Admin: `FIREBASE_SERVICE_ACCOUNT_JSON` (dev) / ADC no App Hosting

## CORS (upload direto via signed URL)

O browser faz `PUT` na signed URL do Storage. Sem CORS no bucket, o console mostra `net::ERR_FAILED`.

Arquivo canônico: `storage-cors.json`. Aplicar:

```bash
gsutil cors set storage-cors.json gs://madatodigital.firebasestorage.app
gsutil cors get gs://madatodigital.firebasestorage.app
```

Se o PUT direto falhar, o client cai no proxy `PUT /api/profile/training-assets/binary`.

## Deploy

```bash
npm run firebase:rules:deploy
npm run firebase:indexes:deploy
```

Rules client: deny all (`firestore.rules`, `storage.rules`) — acesso só via Admin no server.

## Reset

```bash
npm run db:reset:confirm
```
