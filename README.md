# System Atelier

A workspace for learning system design, investigating production failures, practising low-level design, and taking conversational interviews.

## What is included

- **Learning:** 10 ordered parts, 36 modules and 108 lessons with diagrams, worked examples and knowledge checks.
- **Architecture lab:** 22 incident families with variations, editable systems and customer-impact feedback.
- **LLD:** 15 worked designs, coding practice and four interactive workbenches.
- **Interviews:** mock and guided sessions, a shared canvas, saved sessions and debriefs.
- **Workspace:** browser-saved practice for guests; account-scoped notes, drafts and progress after sign-in.

Model reviews are optional. The app works for learning and saved practice without model credentials. Code reviews provide feedback; they do not execute or compile submitted code.

## Start locally

Requires Node.js **22.13+**, npm and Python 3 for the HTTP test suite.

```sh
npm ci
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Open **http://localhost:3000**.
