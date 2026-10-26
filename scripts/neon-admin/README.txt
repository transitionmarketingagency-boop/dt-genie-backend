NeonVision Knowledge Desk
========================

This is a local-only knowledge management dashboard. It binds exclusively to
127.0.0.1 and is not served by the Render chatbot. There is no cloud database
or dashboard service, so documents remain on this PC and survive Render
restarts and redeploys.

Start
-----

1. Open PowerShell or Git Bash in the repository folder.
2. Run: npm run neon:admin
3. Open: http://127.0.0.1:4177
4. On first use, create a unique admin password of at least 14 characters.

By default, dashboard data is stored in:
  %LOCALAPPDATA%\NeonVision\admin-dashboard

Set NEON_ADMIN_DATA_DIR to choose a different local folder. Do not place that
folder inside the repository or a synced/public folder. Back it up securely.

Features and safeguards
-----------------------

* First-run password setup, scrypt password hashing, lockout after repeated
  failed logins, expiring in-memory sessions, same-origin and CSRF checks.
* Local loopback binding, browser security headers, no external fonts/scripts.
* Upload PDF, DOCX, Markdown, and text files up to 8 MB. Documents are
  extracted, common sensitive identifiers are redacted, split into chunks,
  and embedded through the configured OpenRouter embedding service. Text is
  sent to OpenRouter for embeddings; do not upload material that must never
  leave this PC.
* Public uploads begin as drafts. Review full extracted text and explicitly
  approve before activation. Candidate preparation includes only the public
  baseline and approved public documents, rejects internal chunks, and writes
  an ignored candidate file. It does not deploy or change the chatbot.
* Internal corpus import requires internal-only labels and valid 2560-number
  embeddings. Internal search is local keyword matching; no question or
  internal excerpt is sent to a model for answer generation.
* Local audit history and document status controls.

The admin dashboard is a local knowledge workbench, not a production cloud
control plane. Public candidate files still require the project's separate
retrieval/safety validation and intentional release process. The internal
corpus is excluded from Git by .gitignore and must never be committed.
