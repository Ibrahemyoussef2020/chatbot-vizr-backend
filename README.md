
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
4. Dashboard conversations and messages.

Seeders use deterministic records and upserts. They do not wipe the database.
Override the local account passwords with `SEED_ADMIN_PASSWORD` and
`SEED_AGENT_PASSWORD` when needed.

# Knowledge Base large uploads

Large Knowledge Base files upload directly from the browser to Cloudinary in chunks. Configure either `CLOUDINARY_URL` or all of `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` on the backend only. Optional controls are `CLOUDINARY_MAX_UPLOAD_BYTES` (default 500 MB) and `CLOUDINARY_CHUNK_SIZE` (default 8 MB; never set below 6 MB).

The backend authenticates the user, checks workspace scope and file metadata, reserves a unique upload record, and returns short-lived signed parameters. The browser uses the returned upload ID as Cloudinary's `X-Unique-Upload-Id` for every chunk. A source is not recorded as uploaded until the backend independently reads the asset from Cloudinary and confirms its public ID and byte count.

Active upload progress is retained in MongoDB and the browser stores its last confirmed byte locally. Reselecting the same file can resume using the same Cloudinary upload ID while that Cloudinary session still exists. Cloudinary does not expose a general API for querying the committed byte offset of an interrupted browser upload, so recovery after losing browser storage or after Cloudinary expires its temporary session requires restarting the file.

Transient chunk errors (network errors, 408, 429, and 5xx) retry up to five times with exponential backoff and jitter. Permanent 4xx responses fail immediately. Cancelling aborts the active request, marks the database upload cancelled, and asks Cloudinary to remove a finalized asset if one exists. Incomplete Cloudinary chunks expire on Cloudinary's side. Completion is idempotent, so a browser disconnect or backend crash can safely retry the completion call.
