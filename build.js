#!/usr/bin/env node
// Собирает dist/blockout.html из частей.
// Единый файл нужен, чтобы страницу можно было открыть где угодно —
// включая артефакты Claude, где нет сервера и внешних файлов.

const fs = require('fs');
const path = require('path');

const R = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

const head = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Блокаут — поставьте сцену словами</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>`;

const solver = R('src/solver.js').replace(
  /\n\/\/ экспорт для тестов в node[\s\S]*$/, '\n');

const out = [
  head,
  '\n<style>\n' + R('src/style.css') + '\n</style>\n',
  R('src/markup.html'),
  '\n<script>\n' + solver + '\n' + R('src/app.js') + '\n</script>\n'
].join('\n');

fs.mkdirSync(path.join(__dirname, 'dist'), {recursive: true});
const dest = path.join(__dirname, 'dist', 'blockout.html');
fs.writeFileSync(dest, out, 'utf8');

// проверка, что собранный скрипт вообще разбирается
const body = out.split('<script>').pop().split('</scr' + 'ipt>')[0];
new Function('THREE','document','window','addEventListener','fetch','performance',
             'requestAnimationFrame','URL','MediaRecorder','Blob','devicePixelRatio',
             'matchMedia','Map', body);

console.log('собрано:', dest, '·', out.length, 'символов');
