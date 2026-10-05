const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Утилита: выполнить команду и вернуть промис
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, { encoding: 'utf8', shell: 'powershell.exe', windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error.message, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Рекурсивный поиск main.py в папке (макс 2 уровня вглубь)
function findMainPy(dir, maxDepth = 2) {
  function search(currentDir, depth) {
    if (depth > maxDepth) return null;
    const mainPy = path.join(currentDir, 'main.py');
    if (fs.existsSync(mainPy)) return mainPy;

    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const found = search(path.join(currentDir, entry.name), depth + 1);
          if (found) return found;
        }
      }
    } catch (e) {}
    return null;
  }
  return search(dir, 0);
}

// API: получить список сборок (папки в C:\comfy-builds с main.py)
app.get('/api/builds', async (req, res) => {
  try {
    const buildsDir = config.buildsPath;
    if (!fs.existsSync(buildsDir)) {
      return res.json({ builds: [], error: `Папка ${buildsDir} не найдена` });
    }

    const entries = fs.readdirSync(buildsDir, { withFileTypes: true });
    const builds = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .map(name => {
        const buildPath = path.join(buildsDir, name);
        const mainPyPath = findMainPy(buildPath);
        return mainPyPath ? { name, path: buildPath, mainPy: mainPyPath } : null;
      })
      .filter(Boolean);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({ builds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: получить текущий статус службы ComfyUI
app.get('/api/status', async (req, res) => {
  try {
    const nssmPath = config.nssmPath;
    const serviceName = config.serviceName;

    // Получить текущий AppDirectory из службы
    const dirCmd = `& "${nssmPath}" get ${serviceName} AppDirectory`;
    const dirResult = await execPromise(dirCmd);
    const currentPath = dirResult.stdout.trim();

    // Получить статус службы
    const statusCmd = `Get-Service ${serviceName} | Select-Object Status | ConvertTo-Json`;
    const statusResult = await execPromise(statusCmd);
    const status = JSON.parse(statusResult.stdout).Status;

    // Получить порт
    const portCmd = `& "${nssmPath}" get ${serviceName} AppParameters`;
    const portResult = await execPromise(portCmd);
    const params = portResult.stdout.trim();
    const portMatch = params.match(/--port\s+(\d+)/);
    const port = portMatch ? portMatch[1] : '8188';

    // Найти имя сборки по пути
    const buildsDir = config.buildsPath;
    let currentBuild = 'Неизвестно';
    if (fs.existsSync(buildsDir)) {
      const builds = fs.readdirSync(buildsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      currentBuild = builds.find(name => {
        const buildPath = path.join(buildsDir, name);
        return currentPath.includes(buildPath) || buildPath.includes(currentPath);
      }) || 'Неизвестно';
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      currentBuild,
      status,
      port,
      currentPath
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: переключить сборку
app.post('/api/switch', async (req, res) => {
  try {
    const { buildName } = req.body;
    if (!buildName) {
      return res.status(400).json({ error: 'buildName обязателен' });
    }

    const buildPath = path.join(config.buildsPath, buildName);
    const mainPyPath = findMainPy(buildPath);
    if (!mainPyPath) {
      return res.status(400).json({ error: `main.py не найден в ${buildPath}` });
    }

    // Вычислить относительный путь от buildPath до main.py
    const relativeMainPy = path.relative(buildPath, mainPyPath).replace(/\\/g, '/');

    const nssmPath = config.nssmPath;
    const serviceName = config.serviceName;
    const port = config.port;

    // Остановить службу
    await execPromise(`& "${nssmPath}" stop ${serviceName}`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Сменить путь и параметры
    await execPromise(`& "${nssmPath}" set ${serviceName} AppDirectory "${buildPath}"`);
    const appParams = `-s ${relativeMainPy} --windows-standalone-build --max-upload-size 999 --enable-manager --enable-manager-legacy-ui --listen 127.0.0.1 --port ${port}`;
    await execPromise(`& "${nssmPath}" set ${serviceName} AppParameters "${appParams}"`);

    // Запустить службу
    await execPromise(`& "${nssmPath}" start ${serviceName}`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    res.json({ success: true, message: `Сборка ${buildName} запущена` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: перезагрузить сервер
app.post('/api/reboot', async (req, res) => {
  try {
    res.json({ success: true, message: 'Сервер перезагружается через 10 секунд' });
    setTimeout(() => {
      exec('shutdown /r /t 10', { shell: 'powershell.exe' });
    }, 500);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Запуск сервера
const PORT = config.adminPort;
app.listen(PORT, () => {
  console.log(`ComfyControl Panel запущена на http://localhost:${PORT}`);
  console.log(`Папка сборок: ${config.buildsPath}`);
  console.log(`Служба: ${config.serviceName}`);
});
