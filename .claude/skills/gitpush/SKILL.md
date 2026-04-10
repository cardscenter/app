---
name: gitpush
description: Commit alle wijzigingen en push naar GitHub
user_invocable: true
---

Maak een nieuwe commit van alle huidige wijzigingen en push naar GitHub.

Stappen:
1. Bekijk alle gewijzigde en untracked bestanden met `git status` en `git diff`
2. Bekijk recente commits voor de commit message stijl met `git log --oneline -5`
3. Stage alle relevante bestanden (NIET: .env bestanden, credentials, of andere gevoelige bestanden)
4. Maak een commit met een duidelijke beschrijving van de wijzigingen
5. Push naar origin main met `git push`
6. Bevestig dat de push gelukt is
