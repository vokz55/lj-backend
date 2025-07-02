  // books/merge-unique-words.js
const fs = require("fs");
const path = require("path");

const BOOK_DATA_DIR = path.join(__dirname, "book-data");
const OUTPUT_FILE = path.join(__dirname, "merged-unique-words.txt");
const WORDS_TXT_PATH = path.join(__dirname, "words.txt");

// 🔽 Укажи только нужные папки:
const INCLUDED_BOOKS = [
  "littleprince"
];

const isValidWord = (word) => {
  const clean = word.replace(/'/g, "");
  return /^[a-zA-Z]+$/.test(clean);
};

const normalizeWord = (word) => word.replace(/'/g, "").toLowerCase();

const loadCommonWords = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return new Set(content.split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(Boolean));
  } catch (err) {
    console.warn("⚠️ Не удалось загрузить words.txt:", err.message);
    return new Set();
  }
};

const commonWords = loadCommonWords(WORDS_TXT_PATH);
const allWords = new Set();

INCLUDED_BOOKS.forEach((folder) => {
  const uniquePath = path.join(BOOK_DATA_DIR, folder, "uniqueWords.json");

  if (!fs.existsSync(uniquePath)) {
    console.warn(`Пропущено: ${folder} (нет uniqueWords.json)`);
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(uniquePath, "utf-8"));

    Object.keys(data).forEach((word) => {
      const normalized = normalizeWord(word);
      if (isValidWord(normalized) && !commonWords.has(normalized)) {
        allWords.add(normalized);
      }
    });
  } catch (err) {
    console.error(`Ошибка в ${uniquePath}:`, err.message);
  }
});

fs.writeFileSync(OUTPUT_FILE, Array.from(allWords).sort().join("\n"), "utf-8");
console.log(`✅ Готово. Найдено ${allWords.size} уникальных слов (после фильтрации). Сохранено в ${OUTPUT_FILE}`);
