# comfy-server

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Что это

Удалённый приватный доступ к локальной Windows-машине с мощной GPU для AI-генерации: ComfyUI + файловый браузер (Filebrowser) + серверные загрузки по URL (aria2) за Tailscale, автозапуск службами (NSSM); для Влада и Даниила

Проект создан осью агентов (шаблон `empty`). Задачи ведутся в [BACKLOG.md](BACKLOG.md) / [TODO.md](TODO.md) / [DONE.md](DONE.md). Инфра/сетап-проект (не кодовый продукт), пока **вне workspace**.

## Документация проекта

- [docs/SPEC.md](docs/SPEC.md) — ТЗ: суть (удалённый AI-воркстейшн за Tailscale), 4 сервиса (ComfyUI + Filebrowser + aria2/AriaNg + Tailscale), доступ/безопасность (только tailnet, ComfyUI без auth защищён приватностью), границы (файлы смотрим/качаем по URL, но не грузим тяжёлое через систему), доступ по адресам, открытые вопросы.
- [docs/SETUP-WINDOWS.md](docs/SETUP-WINDOWS.md) — пошаговый runbook установки под Windows: Tailscale+MagicDNS → ComfyUI `--listen` → Filebrowser → aria2/AriaNg → автозапуск службами NSSM → (опц.) Caddy/стартовая страница → финальная проверка.

## Команды

Кода пока нет. Тест-раннер не настроен.

## Порты и окружение

- Портов нет.
- Секреты — только в `.env` (gitignored), значений в документах не держать.

## Ключевые инварианты (не сломать)

- Контракт наблюдаемости: `GET /health` → `{ ok, requests }`, `GET /routes` — список страниц (совместимость с KomusWatchdog и осью). (актуально после появления сервера)
- Правила коллекции — `_knowledge/RULES.md` (связность md, маршрутизация знаний).
