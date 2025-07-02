const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3005;
const DATA_ROOT = path.join(__dirname, 'books', 'book-data');
const USER_VOCAB_PATH = path.join(__dirname, 'users', 'userVocab.json');

app.use(cors());
app.use(bodyParser.json()); // для чтения JSON из тела запроса

// Статические картинки: /books/:book/images/...
app.use('/books/:book/images', (req, res, next) => {
  const book = req.params.book;
  const imageDir = path.join(DATA_ROOT, book, 'images');
  express.static(imageDir)(req, res, next);
});

// 📘 Получить список книг
app.get('/api/books', (req, res) => {
  const indexFile = path.join(DATA_ROOT, 'index.json');
  if (fs.existsSync(indexFile)) {
    const books = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
    res.json(books);
  } else {
    res.json([]);
  }
});

// 📄 Получить метаданные книги
app.get('/api/:book/metadata', (req, res) => {
  const book = req.params.book;
  const filePath = path.join(DATA_ROOT, book, 'metadata.json');

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Metadata not found' });
  }
});

// 📄 Получить страницу книги
app.get('/api/:book/pages/:index', (req, res) => {
  const book = req.params.book;
  const index = String(req.params.index).padStart(3, '0');
  const pagePath = path.join(DATA_ROOT, book, 'pages', `page_${index}.json`);

  if (fs.existsSync(pagePath)) {
    res.sendFile(pagePath);
  } else {
    res.status(404).json({ error: 'Page not found' });
  }
});

// 📘 Получить словарь пользователя
app.get('/api/user/vocab', (req, res) => {
  if (fs.existsSync(USER_VOCAB_PATH)) {
    const vocab = JSON.parse(fs.readFileSync(USER_VOCAB_PATH, 'utf-8'));
    res.json(vocab);
  } else {
    res.json([]);
  }
});

// ➕/➖ Добавить или удалить слово из словаря
app.post('/api/user/vocab', (req, res) => {
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
});

app.listen(PORT, () => {
  console.log(`📚 Сервер работает: http://localhost:${PORT}`);
});