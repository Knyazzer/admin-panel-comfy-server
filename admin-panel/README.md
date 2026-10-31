# ComfyControl Panel

Веб-админка для управления сборками ComfyUI на Windows-сервере.

## Возможности

- **Список сборок**: автоматически сканирует `D:\comfy-builds\`, находит папки с `main.py`.
- **Текущий статус**: показывает активную сборку, статус службы (Running/Stopped), порт.
- **Переключение сборки**: выбираешь новую → служба останавливается → меняется путь → запускается.
- **Перезагрузка сервера**: кнопка `shutdown /r /t 10` с подтверждением.
- **Автообновление**: статус обновляется каждые 10 секунд.
- **Быстрые ссылки**: ComfyUI, Filebrowser, Tailscale Admin.

## Установка

### 1. Подготовка папки сборок

Создай папку для сборок (если её нет):
```powershell
New-Item -ItemType Directory -Path "D:\comfy-builds" -Force
```

Перемести текущую сборку ComfyUI в эту папку (например, `D:\comfy-builds\comfy-main\`).

### 2. Установка зависимостей

В папке `admin-panel`:
```powershell
cd "D:\Pet projects\scripts\comfy-server\admin-panel"
npm install
```

### 3. Настройка `config.json`

Открой `config.json` и проверь/измени пути:

```json
{
  "buildsPath": "D:\\comfy-builds",           // папка со сборками
  "nssmPath": "C:\\nssm\\nssm-2.24\\win64\\nssm.exe",  // путь к nssm.exe
  "serviceName": "ComfyUI",                   // имя службы (не меняй)
  "port": 8188,                               // порт ComfyUI
  "adminPort": 9999                           // порт админки
}
```

**Важно:** путь к `nssm.exe` должен быть правильным — проверь командой:
```powershell
Test-Path "C:\nssm\nssm-2.24\win64\nssm.exe"
```
Если вернёт `False` — найди правильный путь и впиши в `config.json`.

### 4. Тест-запуск (от администратора)

Открой PowerShell **от администратора**, запусти админку:
```powershell
cd "D:\Pet projects\scripts\comfy-server\admin-panel"
npm start
```

Должно появиться:
```
ComfyControl Panel запущена на http://localhost:9999
Папка сборок: D:\comfy-builds
Служба: ComfyUI
```

Открой в браузере `http://localhost:9999` — должен показаться список сборок и текущий статус. **Если всё работает** — переходи к шагу 5.

### 5. Установка как Windows-службы (автозапуск)

Останови тест-запуск (Ctrl+C), затем в PowerShell **от администратора**:

```powershell
$nssm = "C:\nssm\nssm-2.24\win64\nssm.exe"
$adminPath = "D:\Pet projects\scripts\comfy-server\admin-panel"

# Установить службу
& $nssm install ComfyControlPanel "C:\Program Files\nodejs\node.exe"
& $nssm set ComfyControlPanel AppParameters "src\server.js"
& $nssm set ComfyControlPanel AppDirectory "$adminPath"
& $nssm set ComfyControlPanel AppStdout "$adminPath\logs\service.log"
& $nssm set ComfyControlPanel AppStderr "$adminPath\logs\service.log"
& $nssm set ComfyControlPanel Start SERVICE_AUTO_START

# Создать папку логов
New-Item -ItemType Directory -Path "$adminPath\logs" -Force

# Запустить службу
& $nssm start ComfyControlPanel
Start-Sleep -Seconds 5
Get-Service ComfyControlPanel | Select-Object Name, Status, StartType
```

Ждём `Status: Running`. Проверь в браузере `http://localhost:9999` — должна открыться админка.

### 6. Настройка Tailscale Serve

Открой порт 9999 через Tailscale (в обычном PowerShell):
```powershell
tailscale serve --https=9999 --bg localhost:9999
```

Должно вернуть:
```
https://comfy-server.impala-justice.ts.net:9999/
|-- proxy http://localhost:9999
```

Проверь статус:
```powershell
tailscale serve status
```

Теперь админка доступна в tailnet по адресу:
```
https://comfy-server.impala-justice.ts.net:9999
```

## Использование

1. Заходишь в Filebrowser (`https://comfy-server.impala-justice.ts.net:8443`).
2. Скачиваешь архив новой сборки ComfyUI → распаковываешь в `D:\comfy-builds\<имя>\`.
3. Заходишь в админку (`https://comfy-server.impala-justice.ts.net:9999`).
4. Жмёшь **«Обновить список»** → новая сборка появляется в списке.
5. Кликаешь на карточку новой сборки → жмёшь **«Применить»** → подтверждаешь.
6. Служба ComfyUI перезапускается на новой сборке (3-5 секунд).
7. ComfyUI доступен по старому адресу `https://comfy-server.impala-justice.ts.net/` — уже на новой сборке.

**Перезагрузка сервера**: кнопка **«Перезагрузить сервер»** → подтверждение → сервер перезагружается через 10 секунд. Все службы (ComfyUI, Filebrowser, AdminPanel) стартуют автоматически при загрузке Windows.

## Структура проекта

```
admin-panel/
├── config.json          # конфигурация (пути, порты)
├── package.json         # зависимости
├── src/
│   └── server.js        # backend (Express API)
├── public/
│   └── index.html       # frontend (HTML/CSS/JS)
└── logs/
    └── service.log      # логи службы
```

## API

- `GET /api/builds` — список сборок (сканирует `D:\comfy-builds\`).
- `GET /api/status` — текущая сборка + статус службы.
- `POST /api/switch` — переключить сборку (`{ buildName: "..." }`).
- `POST /api/reboot` — перезагрузить сервер (`shutdown /r /t 10`).

## Troubleshooting

**Служба не запускается:**
- Проверь путь к `node.exe` — должен быть `C:\Program Files\nodejs\node.exe` (или где у тебя Node.js).
- Проверь лог: `Get-Content "D:\Pet projects\scripts\comfy-server\admin-panel\logs\service.log" -Tail 20`.

**Сборки не отображаются:**
- Проверь `config.json` → `buildsPath` должен быть `D:\\comfy-builds`.
- Убедись, что в папках сборок есть файл `main.py`.

**Ошибка переключения:**
- Проверь `config.json` → `nssmPath` должен указывать на реальный `nssm.exe`.
- Запускай админку **от администратора** (служба требует админ-прав).

**Порт 9999 занят:**
- Измени `adminPort` в `config.json` на другой (например, `9998`).
- Перезапусти службу: `nssm restart ComfyControlPanel`.
- Перенастрой Tailscale Serve на новый порт.
