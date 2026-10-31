# comfy-server

Приватный доступ к Windows-машине для AI-генерации: ComfyUI, Filebrowser и серверные загрузки через Tailscale. Веб-панель ComfyControl Panel управляет сборками ComfyUI и службой NSSM.

## Структура

- `admin-panel/` — приложение на Node.js + Express: API, веб-интерфейс и конфигурация.
- `docs/SPEC.md` — описание инфраструктуры.
- `docs/SETUP-WINDOWS.md` — инструкция по установке на Windows.
- `TODO.md`, `BACKLOG.md`, `DONE.md` — задачи и выполненные работы.

Это единый Git-репозиторий. Папка `admin-panel/` — обычная папка с кодом, отдельный clone или настройка подмодулей не нужны. История прежних репозиториев сохранена.

## Получение и обновление

```powershell
git clone https://github.com/Knyazzer/admin-panel-comfy-server.git comfy-server
cd comfy-server
```

Для обновления существующей копии из корня проекта:

```powershell
git pull --ff-only
```

Основная ветка — `master`.

## Запуск панели

На Windows с установленным Node.js:

```powershell
cd admin-panel
npm ci
npm start
```

Перед запуском проверь пути и порты в `admin-panel/config.json`. Для управления службой NSSM нужны права администратора. Подробная настройка службы и Tailscale — в [инструкции панели](admin-panel/README.md).
