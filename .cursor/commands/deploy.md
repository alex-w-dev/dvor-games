Задеплой мини-игру на lightborn.ru через ферму.

Из корня `lightborn-games` запусти:

```powershell
pnpm run deploy <name>
```

`<name>` — папка в `games/` (например `hello`). Нужен корневой `.env` с `LIGHTBORN_API_KEY`.

Не деплой платформу (`l-fight-mobile`, VM, `deploy.ps1`). Не коммить и не пушь без явной просьбы.

Если упало — покажи ошибку API/zip, не выдумывай обход.
В конце кратко: успех/фейл, slug и URL `https://lightborn.ru/play/<slug>` (или draft, если ещё на модерации).
