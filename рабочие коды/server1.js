const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3005;
const DATA_ROOT = path.join(__dirname, 'books', 'book-data');

app.use(cors());

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

app.listen(PORT, () => {
  console.log(`📚 Сервер работает: http://localhost:${PORT}`);
});
