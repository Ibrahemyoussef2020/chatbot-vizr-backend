
# MERN Stack AI Chatbot

This is an AI Chatbot application, inspired by ChatGPT, by using MERN Stack and OpenAI

It's a customized chatbot where each message of the user is stored in DB and can be retrieved and deleted.

It's a completely secure application using JWT Tokens, HTTP-Only Cookies, Signed Cookies, Password Encryption, and Middleware Chains.

Contributions are welcome

## Development seed data

Run the organized, idempotent development seeders with:

```bash
npm run seed
```

The runner executes seeders from `src/seeders` in dependency order:

1. Admin user required to own the demo workspace.
2. Demo workspace.
3. Workspace assignment and agent user.
4. Brand Ecommerce and Vizr knowledge sessions with persisted plans, reports, and independently addressable output schemas.
5. Dashboard conversations and messages, analytics telemetry, tags, and logs.

Seeders use deterministic records and upserts. They do not wipe the database.

## Knowledge AI generation

Plans and reports use the Vercel AI SDK through Vercel AI Gateway. The backend validates every provider result against the shared Zod output schema before writing it to MongoDB, and the frontend receives the same serialized output shape for every provider.

Copy the knowledge settings from `.env.example` into the backend environment. `AI_GATEWAY_API_KEY` is required locally. On Vercel, add the same variables in Project Settings and select stable model IDs available in the project's AI Gateway account. `KNOWLEDGE_AI_MODEL` is the primary model; `KNOWLEDGE_AI_FALLBACK_MODELS` is a comma-separated fallback chain.

Generation retries transient model calls twice, applies a total request timeout, bounds source context, prevents duplicate generation for the same session and output kind, and limits concurrent work per running backend instance. Production deployments with sustained generation traffic should replace the in-process concurrency gate with a durable Redis-backed queue.

## Customer-service AI

The main web, WhatsApp, Telegram, and Gmail AI reply strategy also uses Vercel AI Gateway when `DEFAULT_AI_PROVIDER=vercel`. It loads the workspace's saved AI configuration, applies company identity, tone, pricing, language, contact, and action rules, and adds bounded excerpts from ready Knowledge Base sources. Source content is treated as untrusted data rather than instructions.

Configure `CHAT_AI_MODEL` and `CHAT_AI_FALLBACK_MODELS` independently from plan/report generation. Chat requests use two SDK retries, a bounded timeout, output-token and history limits, per-instance concurrency protection, Gateway usage attribution by workspace, and safe errors when the provider chain is unavailable.

## Redis/BullMQ channel workers

WhatsApp, Telegram, and Instagram webhook requests validate the platform event, persist inbound messages idempotently in MongoDB, enqueue a deterministic BullMQ job, and acknowledge only after Redis accepts the job. AI generation and platform delivery never run inside those webhook request lifecycles. Queue outages return a retryable response instead of silently losing an inbound event.

Set `REDIS_URL` for both the API process and worker process, then run them independently:

```bash
npm run dev
npm run worker:dev
```

Production uses `npm start` for the API and `npm run worker` for a continuously running worker service. Do not deploy the worker as a request-based serverless function. BullMQ retries failed jobs with exponential backoff. MongoDB `WebhookEvent` records provide durable processing status, attempt counts, failure details, and webhook idempotency. Failed jobs remain in Redis and can be inspected with `GET /api/admin/channel-jobs/failed?system_slug=<slug>` and retried using `POST /api/admin/channel-jobs/<event-id>/retry` with `system_slug` in the body.

Meta POST webhooks require `X-Hub-Signature-256`. WhatsApp uses its stored app secret with `WHATSAPP_APP_SECRET`/`META_APP_SECRET` fallback. Instagram requires a `MetaChannelConfig` record containing the workspace, Instagram account ID, Facebook Page ID, Page access token, app secret, and verify token; secrets are excluded from normal queries. The Instagram callback is `/api/instagram/webhook`. Telegram continues to require its per-bot `X-Telegram-Bot-Api-Secret-Token`.
Override the local account passwords with `SEED_ADMIN_PASSWORD` and
`SEED_AGENT_PASSWORD` when needed.

The knowledge-output seeder creates two sessions in `brand-ecommerce` and two in
`vizr`. Each session receives a six-schema Plan and a nine-schema Report. Running
the seed command again updates those deterministic records without duplicating
them and does not delete user-created sessions or outputs. To seed a production
deployment, run `npm run seed` with that deployment's database environment
configured and reviewed; the repository does not automatically mutate the
production database during build or deployment.

# Knowledge Base large uploads

Large Knowledge Base files upload directly from the browser to Cloudinary in chunks. Configure either `CLOUDINARY_URL` or all of `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` on the backend only. `CLOUDINARY_KEY_NAME` may remain as the descriptive key label but is not used as the Cloudinary API cloud name. Optional controls are `CLOUDINARY_MAX_UPLOAD_BYTES` (default 500 MB) and `CLOUDINARY_CHUNK_SIZE` (default 8 MB; never set below 6 MB).

The backend authenticates the user, checks workspace scope and file metadata, reserves a unique upload record, and returns short-lived signed parameters. The browser uses the returned upload ID as Cloudinary's `X-Unique-Upload-Id` for every chunk. A source is not recorded as uploaded until the backend independently reads the asset from Cloudinary and confirms its public ID and byte count.

Set `SERVER_URL` to the public backend origin, or set `CLOUDINARY_NOTIFICATION_URL` explicitly to `https://<backend>/api/webhooks/cloudinary`. Cloudinary signs the raw webhook body with `X-Cld-Signature` and `X-Cld-Timestamp`; the backend rejects invalid or stale notifications. The webhook is the normal completion path. The authenticated completion endpoint remains an idempotent reconciliation fallback if no webhook arrives within the frontend polling window.

Active upload progress is retained in MongoDB and the browser stores its last confirmed byte locally. Reselecting the same file can resume using the same Cloudinary upload ID while that Cloudinary session still exists. Cloudinary does not expose a general API for querying the committed byte offset of an interrupted browser upload, so recovery after losing browser storage or after Cloudinary expires its temporary session requires restarting the file.

Transient chunk errors (network errors, 408, 429, and 5xx) retry up to five times with exponential backoff and jitter. Permanent 4xx responses fail immediately. Cancelling aborts the active request, marks the database upload cancelled, and asks Cloudinary to remove a finalized asset if one exists. Incomplete Cloudinary chunks expire on Cloudinary's side. Completion is idempotent, so a browser disconnect or backend crash can safely retry the completion call.
