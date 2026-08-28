
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

