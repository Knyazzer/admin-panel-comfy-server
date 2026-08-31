# DONE — comfy-server

- 2026-08-27 Проект создан осью агентов (шаблон empty).
- 2026-08-31 Сеть Tailscale под проект: отдельный аккаунт `megapolis.television@gmail.com` (отдельный tailnet, план Free). GPU-машина подключена auth-key'ём без логина на ней; у ноды выключен key expiry («Expiry disabled»).
- 2026-08-31 GPU-машина = **ai-pc-msi-x870e** (RTX, MSI X870E), tailnet-IP `100.89.94.92`. ComfyUI установлен в `C:\ComfyUI` (портативная сборка, встроенный ComfyUI-Manager: флаги `--enable-manager --enable-manager-legacy-ui`).
- 2026-08-31 ComfyUI доступен по сети Tailscale: запуск с `--listen --port 8188`; заход `http://ai-pc-msi-x870e:8188` (по MagicDNS) и `http://100.89.94.92:8188`. Создан `C:\ComfyUI\run_network.bat` (оригинальные bat не тронуты).
- 2026-08-31 Доступ ограничен только tailnet: правило брандмауэра `ComfyUI 8188` (TCP 8188 inbound) сужено до `RemoteAddress 100.64.0.0/10` — локальная сеть отрезана, ComfyUI без auth защищён приватностью tailnet.
- 2026-08-31 Модель мультиюзера согласована (брейншторм с Владом): **single-user** режим — общая библиотека workflow на диске + общая очередь на 1 GPU; каждый работает в своём браузере над своим флоу, история/прогресс общие (для доверенного круга — плюс). Своя обёртка-портал НЕ делается: выбор workflow = встроенная панель Workflows, установка нод/моделей = ComfyUI-Manager, файлы = Filebrowser.
