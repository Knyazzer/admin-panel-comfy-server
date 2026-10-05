const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const http = require('http');
const https = require('https');
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
    exec(
      command,
      {
        encoding: 'buffer',
        shell: 'powershell.exe',
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        const decodeOutput = (data) => {
          if (!data) return '';

          const buffer = Buffer.isBuffer(data)
            ? data
            : Buffer.from(data);

          // NSSM отдаёт некоторые значения в UTF-16LE
          if (
            buffer.length >= 2 &&
            buffer[1] === 0x00
          ) {
            return buffer.toString('utf16le');
          }

          return buffer.toString('utf8');
        };

        const decodedStdout = decodeOutput(stdout);
        const decodedStderr = decodeOutput(stderr);

        if (error) {
          reject({
            message: error.message,
            stdout: decodedStdout,
            stderr: decodedStderr,
            command
          });
        } else {
          resolve({
            stdout: decodedStdout,
            stderr: decodedStderr
          });
        }
      }
    );
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



// Проверка локального HTTP/HTTPS сервиса.
// Важно: даже HTTP 404 означает, что сервис отвечает,
// поэтому для health-check считаем любой полученный HTTP-ответ признаком online.
function checkLocalService(url, timeout = 3000) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const request = client.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname || '/',
        method: 'GET',
        timeout,

        // Нужно для локального HTTPS, если используется
        // самоподписанный сертификат.
        rejectUnauthorized: false
      },
      (response) => {
        response.resume();

        resolve({
          online: true,
          statusCode: response.statusCode || 0
        });
      }
    );

    request.on('timeout', () => {
      request.destroy();
      resolve({
        online: false,
        error: 'Timeout'
      });
    });

    request.on('error', (error) => {
      resolve({
        online: false,
        error: error.message
      });
    });

    request.end();
  });
}

// API: health-check локальных сервисов
app.get('/api/health', async (req, res) => {
  try {
    const comfy = await checkLocalService(
      'http://127.0.0.1:8188/'
    );

const filebrowser = await checkLocalService('http://100.89.94.92:8443/');

    res.json({
      comfyui: comfy,
      filebrowser: filebrowser
    });

  } catch (error) {
    console.error('HEALTH ERROR:', error);

    res.status(500).json({
      error: error.message
    });
  }
});




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

    const normalizePath = (value) =>
      String(value || '')
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/\//g, '\\')
        .replace(/\\+$/, '')
        .toLowerCase();

    // Получаем AppDirectory из NSSM
    const dirResult = await execPromise(
      `& "${nssmPath}" get "${serviceName}" AppDirectory`
    );

    const currentPath = dirResult.stdout
  .replace(/\u0000/g, '')
  .trim();
    const normalizedCurrentPath = normalizePath(currentPath);

    // Получаем статус Windows-службы
    const statusResult = await execPromise(
      `Get-Service -Name "${serviceName}" | Select-Object -ExpandProperty Status`
    );

    const rawStatus = statusResult.stdout.trim();

    // Получаем параметры запуска
    const paramsResult = await execPromise(
      `& "${nssmPath}" get "${serviceName}" AppParameters`
    );

    const params = paramsResult.stdout.trim();

    // Определяем порт
    const portMatch = params.match(/--port\s+(\d+)/);
    const port = portMatch ? portMatch[1] : '8188';

    // Определяем текущую сборку
    const buildsDir = config.buildsPath;
    let currentBuild = 'Неизвестно';

    if (fs.existsSync(buildsDir)) {
      const entries = fs.readdirSync(buildsDir, {
        withFileTypes: true
      });

      const builds = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);

      const matchedBuild = builds.find(name => {
        const buildPath = path.join(buildsDir, name);
        return normalizePath(buildPath) === normalizedCurrentPath;
      });

      if (matchedBuild) {
        currentBuild = matchedBuild;
      }
    }

    console.log('STATUS:');
    console.log('  AppDirectory:', currentPath);
    console.log('  Current build:', currentBuild);
    console.log('  Service status:', rawStatus);
    console.log('  Port:', port);

    res.setHeader(
      'Content-Type',
      'application/json; charset=utf-8'
    );

    res.json({
      currentBuild,
      status: rawStatus,
      port,
      currentPath
    });

  } catch (error) {
    console.error('STATUS ERROR:', error);

    res.status(500).json({
      error: error.message || 'Ошибка получения статуса',
      stderr: error.stderr || '',
      stdout: error.stdout || '',
      command: error.command || ''
    });
  }
});

// API: переключить сборку


app.post('/api/switch', async (req, res) => {
  try {
    const { buildName } = req.body;

    if (!buildName) {
      return res.status(400).json({
        success: false,
        error: 'buildName обязателен'
      });
    }

    const buildPath = path.join(config.buildsPath, buildName);

    if (!fs.existsSync(buildPath)) {
      return res.status(400).json({
        success: false,
        error: `Сборка не найдена: ${buildPath}`
      });
    }

    // Ищем main.py
    const mainPyPath = findMainPy(buildPath);

    if (!mainPyPath) {
      return res.status(400).json({
        success: false,
        error: `main.py не найден в ${buildPath}`
      });
    }

    // У каждой сборки свой embedded Python
    const pythonPath = path.join(
      buildPath,
      'python_embeded',
      'python.exe'
    );

    if (!fs.existsSync(pythonPath)) {
      return res.status(400).json({
        success: false,
        error: `python.exe не найден: ${pythonPath}`
      });
    }

    const relativeMainPy = path
      .relative(buildPath, mainPyPath)
      .replace(/\\/g, '/');

    const nssmPath = config.nssmPath;
    const serviceName = config.serviceName;
    const port = config.port;

    console.log('========================================');
    console.log(`Переключение на сборку: ${buildName}`);
    console.log(`Application: ${pythonPath}`);
    console.log(`AppDirectory: ${buildPath}`);
    console.log(`main.py: ${relativeMainPy}`);

    // 1. Остановить ComfyUI
    console.log('Остановка ComfyUI...');

    await execPromise(
      `& "${nssmPath}" stop "${serviceName}"`
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. Изменить Application (Python)
    console.log('Изменение Application...');

    await execPromise(
      `& "${nssmPath}" set "${serviceName}" Application "${pythonPath}"`
    );

    // 3. Изменить AppDirectory
    console.log('Изменение AppDirectory...');

    await execPromise(
      `& "${nssmPath}" set "${serviceName}" AppDirectory "${buildPath}"`
    );

    // 4. Изменить AppParameters
    const appParams =
      `-s "${relativeMainPy}" ` +
      `--windows-standalone-build ` +
      `--max-upload-size 999 ` +
      `--enable-manager ` +
      `--enable-manager-legacy-ui ` +
      `--listen 127.0.0.1 ` +
      `--port ${port}`;

    console.log(`AppParameters: ${appParams}`);

    await execPromise(
      `& "${nssmPath}" set "${serviceName}" AppParameters '${appParams}'`
    );

    // 5. Запустить ComfyUI
    console.log('Запуск ComfyUI...');

    await execPromise(
      `& "${nssmPath}" start "${serviceName}"`
    );

    // Даём ComfyUI время запуститься
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 6. Проверяем фактический статус службы
    const statusResult = await execPromise(
      `Get-Service "${serviceName}" | Select-Object -ExpandProperty Status`
    );

    const status = statusResult.stdout.trim();

    console.log(`Статус ComfyUI после запуска: ${status}`);

    if (status !== 'Running') {
      return res.status(500).json({
        success: false,
        error: `ComfyUI не запустилась. Текущий статус: ${status}`,
        buildName,
        buildPath,
        pythonPath,
        mainPy: relativeMainPy
      });
    }

    console.log(`Сборка ${buildName} успешно запущена`);
    console.log('========================================');

    res.json({
      success: true,
      message: `Сборка ${buildName} запущена`,
      buildName,
      buildPath,
      pythonPath,
      mainPy: relativeMainPy,
      status
    });

  } catch (error) {
    console.error('========================================');
    console.error('SWITCH ERROR:', error);
    console.error('========================================');

    res.status(500).json({
      success: false,
      error: error.message || 'Ошибка выполнения команды',
      stderr: error.stderr || '',
      stdout: error.stdout || '',
      command: error.command || ''
    });
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
