# EPUB Book Server

Простой API-сервер на Node.js + Express для отдачи страниц книги, метаданных и обложки.

## Структура

- `/api/metadata` — JSON с общей информацией о книге
- `/api/pages/:index` — страница книги по номеру
- `/images/:filename` — любые изображения, включая обложку

## Как запустить

1. Убедитесь, что у вас есть директория `book-data/` со следующей структурой:

book-data/
├── metadata.json
├── pages/
│ ├── page_000.json
│ ├── ...
└── images/
└── cover.jpg

go
Копировать
Редактировать

2. Установите зависимости:
```bash
npm install
Запустите сервер:

bash
Копировать
Редактировать
npm start
Откройте браузер:

http://localhost:3000/api/metadata

http://localhost:3000/api/pages/0

http://localhost:3000/images/cover.jpg

yaml
Копировать
Редактировать

---

Готово ✅  
Если хочешь развернуть это на Vercel, Railway, Render или в Docker — тоже могу помочь.