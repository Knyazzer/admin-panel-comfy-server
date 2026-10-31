# comfy-server

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Что это

Удалённый приватный доступ к локальной Windows-машине с мощной GPU для AI-генерации: ComfyUI + файловый браузер (Filebrowser) + серверные загрузки по URL (aria2) за Tailscale, автозапуск службами (NSSM); для Влада и Даниила

Проект создан осью агентов (шаблон `empty`). Задачи ведутся в [BACKLOG.md](BACKLOG.md) / [TODO.md](TODO.md) / [DONE.md](DONE.md). Инфраструктурная документация и код панели в `admin-panel/` хранятся в одном Git-репозитории, связанном с `https://github.com/Knyazzer/admin-panel-comfy-server.git` (ветка `master`). Вложенного репозитория и подмодулей нет.

## Документация проекта

- [docs/SPEC.md](docs/SPEC.md) — ТЗ: суть (удалённый AI-воркстейшн за Tailscale), 4 сервиса (ComfyUI + Filebrowser + aria2/AriaNg + Tailscale), доступ/безопасность (только tailnet, ComfyUI без auth защищён приватностью), границы (файлы смотрим/качаем по URL, но не грузим тяжёлое через систему), доступ по адресам, открытые вопросы.
- [docs/SETUP-WINDOWS.md](docs/SETUP-WINDOWS.md) — пошаговый runbook установки под Windows: Tailscale+MagicDNS → ComfyUI `--listen` → Filebrowser → aria2/AriaNg → автозапуск службами NSSM → (опц.) Caddy/стартовая страница → финальная проверка.

## Команды

Панель: Node.js + Express, backend — `admin-panel/src/server.js`, frontend — `admin-panel/public/index.html`. Из папки `admin-panel`: `npm ci` — установка зависимостей, `npm start` — запуск. Тест-раннер не настроен. Установка и управление службой описаны в [admin-panel/README.md](admin-panel/README.md).

## Порты и окружение

- Панель по умолчанию слушает порт 9999, ComfyUI — 8188. Настройки путей и портов — `admin-panel/config.json`.
- Секреты — только в `.env` (gitignored), значений в документах не держать.

## Ключевые инварианты (не сломать)

- Контракт наблюдаемости: `GET /health` → `{ ok, requests }`, `GET /routes` — список страниц (совместимость с KomusWatchdog и осью). (актуально после появления сервера)
- Правила коллекции — `_knowledge/RULES.md` (связность md, маршрутизация знаний).
