const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3005;

// === ПУТИ ДО ДАННЫХ ===
const DATA_ROOT = path.join(__dirname, 'books', 'book-data');
const USER_VOCAB_PATH = path.join(__dirname, 'users', 'userVocab.json');
const FREEDICT_FILE = path.join(__dirname, 'vocab', 'freedict.json');

// === ЗАГРУЗКА FREEDICT ===
let freedictMap = new Map();

function loadFreeDict() {
  if (fs.existsSync(FREEDICT_FILE)) {
    const entries = JSON.parse(fs.readFileSync(FREEDICT_FILE, 'utf-8'));
    for (const entry of entries) {
      const key = entry.word.toLowerCase();
      freedictMap.set(key, entry);
    }
    console.log(`📘 Загружено ${freedictMap.size} слов из FreeDict`);
  } else {
    console.warn('⚠️ freedict.json не найден!');
  }
}

loadFreeDict();

// === МИДДЛВАРЫ ===
app.use(cors());
app.use(express.json());

// === СТАТИКА: картинки книги ===
app.use('/books/:book/images', (req, res, next) => {
  const book = req.params.book;
  const imageDir = path.join(DATA_ROOT, book, 'images');
  express.static(imageDir)(req, res, next);
});

// === 📘 СПИСОК КНИГ ===
app.get('/api/books', (req, res) => {
  try {
    const indexFile = path.join(DATA_ROOT, 'index.json');
    if (!fs.existsSync(indexFile)) return res.json([]);
    const books = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка чтения списка книг' });
  }
});

// === 📄 МЕТАДАННЫЕ КНИГИ ===
app.get('/api/:book/metadata', (req, res) => {
  try {
    const filePath = path.join(DATA_ROOT, req.params.book, 'metadata.json');
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Metadata not found' });
    }
  } catch {
    res.status(500).json({ error: 'Ошибка получения метаданных' });
  }
});

// === 📄 СТРАНИЦА КНИГИ ===
app.get('/api/:book/pages/:index', (req, res) => {
  try {
    const index = String(req.params.index).padStart(3, '0');
    const pagePath = path.join(DATA_ROOT, req.params.book, 'pages', `page_${index}.json`);
    if (fs.existsSync(pagePath)) {
      res.sendFile(pagePath);
    } else {
      res.status(404).json({ error: 'Page not found' });
    }
  } catch {
    res.status(500).json({ error: 'Ошибка загрузки страницы' });
  }
});

// === 📕 ПОЛУЧИТЬ СЛОВАРЬ ПОЛЬЗОВАТЕЛЯ ===
app.get('/api/user/vocab', (req, res) => {
  try {
    if (!fs.existsSync(USER_VOCAB_PATH)) return res.json([]);
    const vocab = JSON.parse(fs.readFileSync(USER_VOCAB_PATH, 'utf-8'));
    res.json(vocab);
  } catch {
    res.status(500).json({ error: 'Ошибка загрузки словаря' });
  }
});

// === ➕/➖ ДОБАВИТЬ ИЛИ УДАЛИТЬ СЛОВО ===
app.post('/api/user/vocab', (req, res) => {
  try {
    const { word } = req.body;
    if (!word || typeof word !== 'string') {
      return res.status(400).json({ error: 'Invalid word' });
    }

    let vocab = [];
    if (fs.existsSync(USER_VOCAB_PATH)) {
      vocab = JSON.parse(fs.readFileSync(USER_VOCAB_PATH, 'utf-8'));
    }

    const index = vocab.indexOf(word);
    if (index === -1) {
      vocab.push(word);
      res.json({ status: 'added', word });
    } else {
      vocab.splice(index, 1);
      res.json({ status: 'removed', word });
    }

    fs.writeFileSync(USER_VOCAB_PATH, JSON.stringify(vocab, null, 2));
  } catch {
    res.status(500).json({ error: 'Ошибка обновления словаря' });
  }
});

// === 🔍 ПЕРЕВОД ОДНОГО СЛОВА ===
app.get('/api/translate/:word', (req, res) => {
  const word = req.params.word.toLowerCase();
  const entry = freedictMap.get(word);

  if (entry) {
    res.json(entry);
  } else {
    res.json({
      word,
      phonetics: [],
      pos: null,
      translations: ['Слово не найдено']
    });
  }
});

// === 🔤 ПАКЕТНЫЙ ПЕРЕВОД ===
app.post('/api/translate/batch', (req, res) => {
  const words = req.body.words;
  if (!Array.isArray(words)) {
    return res.status(400).json({ error: 'words должен быть массивом' });
  }

  const result = {};
  for (const word of words) {
    const lower = word.toLowerCase();
    const entry = freedictMap.get(lower);
    result[word] = entry || {
      word,
      phonetics: [],
      pos: null,
      translations: ['Слово не найдено']
    };
  }

  res.json(result);
});

// === ЗАПУСК СЕРВЕРА ===
app.listen(PORT, '0.0.0.0', () => {
  console.log(`📚 Сервер работает: http://localhost:${PORT}`);
});
