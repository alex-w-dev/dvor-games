Задеплой мини-игру на dvor.ru через ферму.

Из корня `dvor-games` запусти:

```powershell
pnpm run deploy <name>
```

`<name>` — папка в `games/` (например `hello`). Нужен корневой `.env` с `DVOR_API_KEY`.

Не коммить и не пушь. Не трогай платформенный репо и VM.

В конце кратко: успех/фейл, slug и URL `https://dvor-play.ru/play/<slug>` (или draft, если ещё на модерации).
