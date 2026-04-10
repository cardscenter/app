---
name: testserver
description: Start of herstart de dev server met verse cache
user_invocable: true
---

Start een verse dev server, of herstart deze als er al een draait.

Stappen:
1. Kill alle processen op port 3000 (als er al een server draait)
2. Verwijder de `.next` cache map
3. Start de dev server met `npm run dev`
