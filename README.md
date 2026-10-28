# Store Support Assistant

A support-agent tool that finds the store policy most relevant to a customer's question and drafts a response grounded in that policy. An agent can approve, edit, or reject a draft. Questions without a sufficiently relevant policy receive a human-review fallback.

## How it works

```text
Agent signs in
      |
      v
Enters a customer question
      |
      v
Next.js API creates an OpenAI embedding
      |
      v
The API compares it with policy embeddings in Supabase
      |
      +---- No sufficiently relevant policy ---> Show human-review fallback
      |
      v
OpenAI drafts a response using the matching policy
      |
      v
Agent approves, edits, or rejects the draft
      |
      v
Supabase stores the review for that signed-in user
```

The browser never receives the OpenAI API key. Policy retrieval and answer generation happen in Next.js API routes. Review history is loaded for the authenticated user.

## Tech stack

- Next.js App Router and React
- TypeScript
- Supabase Auth, Postgres, and `pgvector`
- OpenAI embeddings (`text-embedding-3-small`) and chat completions (`gpt-4o-mini`)
- TanStack Query for answer requests and review history
- Tailwind CSS

## Requirements

- Node.js compatible with the installed Next.js version
- npm
- A Supabase project
- An OpenAI API key

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root. Add the following variables and provide values from your own Supabase and OpenAI projects:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   OPENAI_API_KEY=
   NEXT_SUPABASE_SERVICE_ROLE_KEY=
   ```

   `NEXT_SUPABASE_SERVICE_ROLE_KEY` is only needed by the one-time embedding backfill script. Keep it secret: never prefix it with `NEXT_PUBLIC_`, commit it, or expose it to the browser. The OpenAI key is also server-only. The `.env.local` file should remain untracked.

3. In Supabase, configure email/password authentication and create an agent account. The app provides sign-in but does not include a user sign-up page.

4. Prepare the database:

   - Enable the `vector` extension in Supabase.
   - Create `policy_passages` with the fields used by the app: `id`, `title`, `passages`, `suggested_reply`, and `embedding` (`vector(1536)`). Add your policy rows before generating embeddings.
   - Create `answer_reviews` with the fields used by the app: `id`, `user_id`, `question`, `draft_answer`, `final_answer`, `decision`, `source_policy_id`, and `created_at`.
   - Enable row-level security. Policies should allow authenticated users to read and write only their own `answer_reviews` rows, using `auth.uid() = user_id`. Configure policy access to `policy_passages` for signed-in agents.

   Database setup is currently managed in Supabase; this repository does not contain migration files. Match the column types to your existing Supabase schema (for example, `source_policy_id` must match the type of `policy_passages.id`).

5. Generate embeddings for policy rows whose `embedding` is null by running `lib/supabase/scripts/policies.ts` with a TypeScript runner such as `tsx`. For example, if needed, install the runner and invoke the script:

   ```bash
   npm install --save-dev tsx
   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config lib/supabase/scripts/policies.ts
   ```

   The script needs a Supabase service-role key to update rows when row-level security prevents updates with the publishable key. Use the service-role key only for this one-time server-side task.

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) and sign in with the agent account.

## Main routes and files

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Customer-question form, suggested answer, agent review controls, and recent review history |
| `app/(auth)/login/page.tsx` | Agent email/password sign-in |
| `app/api/policies/search/route.ts` | Authenticated semantic policy search and answer generation |
| `app/api/policies/reviews/route.ts` | Create and list the current user's answer reviews |
| `app/api/policies/route.ts` | Read policy rows |
| `lib/ai.ts` | OpenAI client, embedding creation/parsing, cosine similarity, and answer generation |
| `lib/supabase/` | Browser/server Supabase clients and session handling |
| `lib/supabase/scripts/policies.ts` | Backfill embeddings for policy rows |
| `proxy.ts` | Refreshes Supabase auth and redirects unauthenticated page requests to sign-in |

## Useful commands

```bash
npm run dev    # Start the local development server
npm run lint   # Run ESLint
npm run build  # Build the production app
npm start      # Serve a production build
```

## Notes

- The similarity threshold is configured in `app/api/policies/search/route.ts`. Tune it against both covered and unsupported questions; a similarity score ranks candidates but does not guarantee that a policy answers the question.
- The assistant prompt instructs the model to use the selected policy as its only source for store-policy facts. The human-review fallback is used when the best policy match is below the threshold.
- Never commit `.env.local`, API keys, Supabase service-role keys, or customer information.
