---
description: Generate a new SQLite migration via the db-architect subagent.
argument-hint: <short-description-of-change>
---

Invoke the `db-architect` subagent. Forward this request to it verbatim:

> Generate a new migration for: $ARGUMENTS
>
> Steps to follow:
> 1. Read existing migrations in `db/migrations/` and the current schema. If the directory does not exist yet, propose its creation as part of this migration.
> 2. Determine the next migration version number (zero-padded four digits, e.g. `0001_init.sql`).
> 3. Produce: the migration SQL (forward-only), any updated TypeScript types, and the data-access functions affected.
> 4. Show the full proposed change — SQL, types, data-access diffs — and wait for approval before writing files.
> 5. After approval and write, print the verification command to apply the migration on next app boot.

Do not write SQL or schema code yourself in this command. The data layer is owned by `db-architect` and that ownership is enforced by always routing through it.
