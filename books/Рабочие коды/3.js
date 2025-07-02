const EPub = require('epub');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const epubPath = path.resolve(__dirname, 'littleprince.epub');
const epub = new EPub(epubPath);

const tokenize = text =>
  Array.from(text.matchAll(/[\u00C0-\u024F\w’']+|[^\w\s]| +/g)).map(m => m[0]);

const safe = str => str?.replace(/[<>:"/\\|?*\n\r]+/g, '_').trim() || null;

const saveImage = (id, fileName) =>
  new Promise((resolve, reject) => {
    epub.getFile(id, (err, data) => {
      if (err) return reject(err);
      fs.writeFileSync(path.join(__dirname, 'images', fileName), data);
      resolve();
    });
  });

epub.on('end', async () => {
  const rawDir = path.join(__dirname, 'raw_chapters');
  const imgDir = path.join(__dirname, 'images');
  const pagesDir = path.join(__dirname, 'pages');
  const chaptersInfo = [];
  const wordFrequency = {};

  [rawDir, imgDir, pagesDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  });

  // Найдём первую подходящую обложку
  const coverItem = Object.values(epub.manifest).find(item => item.media_type?.includes('jpeg') && item.id?.toLowerCase().includes('cover'));
  const coverHref = coverItem ? `images/${path.basename(coverItem.href)}` : null;
  if (coverItem) {
    try {
      await saveImage(coverItem.id, path.basename(coverItem.href));
    } catch (e) {
      console.warn(`⚠️ Не удалось сохранить обложку: ${e.message}`);
    }
  }

  let pageIndex = 0;

  for (let i = 0; i < epub.flow.length; i++) {
    const chapter = epub.flow[i];
    const chapterTitle = chapter.title || `Chapter ${i + 1}`;
    const baseName = safe(path.basename(chapter.href).replace(/\.[^/.]+$/, '')) || `chapter_${i + 1}`;
    const chapterItems = [];

    try {
      const raw = await new Promise((res, rej) =>
        epub.getChapterRaw(chapter.id, (err, rawHtml) => err ? rej(err) : res(rawHtml))
      );

      fs.writeFileSync(path.join(rawDir, `${baseName}.xhtml`), raw, 'utf-8');

      const $ = cheerio.load(raw, { xmlMode: true });

      $('h1,h2,h3,h4,h5,h6,p,img').each((_, el) => {
        const tag = el.tagName.toLowerCase();

        if (tag === 'img') {
          const src = $(el).attr('src');
          if (src) {
            const cleanSrc = src.replace(/^(\.\.\/)+/, '');
            const imageId = Object.keys(epub.manifest).find(key => epub.manifest[key].href.endsWith(cleanSrc));
            const imageFileName = path.basename(cleanSrc);

            if (imageId) {
              saveImage(imageId, imageFileName)
                .then(() => console.log(`🖼️ Сохранено изображение: ${imageFileName}`))
                .catch(err => console.warn(`⚠️ Не удалось сохранить ${imageFileName}: ${err.message}`));
            }

            chapterItems.push({ type: 'image', src: cleanSrc });
          }
        } else {
          const text = $(el).text()
            .replace(/&nbsp;/g, '')
            .replace(/\u00A0/g, '')
            .trim()
            .replace(/\n+/g, ' ');

          const words = tokenize(text);
          if (words.length) {
            for (const w of words) {
              const word = w.toLowerCase();
              wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            }

            chapterItems.push({
              type: /^h[1-6]$/.test(tag) ? 'heading' : 'paragraph',
              words
            });
          }
        }
      });

      // Разделение на страницы с минимумом 250 слов
      const MIN_WORDS_PER_PAGE = 250;
      let buffer = [];
      let wordCount = 0;
      const startPage = pageIndex;

      for (const item of chapterItems) {
        const itemWordCount = item.words?.length || 0;

        buffer.push(item);
        wordCount += itemWordCount;

        if (wordCount >= MIN_WORDS_PER_PAGE) {
          fs.writeFileSync(
            path.join(pagesDir, `page_${String(pageIndex).padStart(3, '0')}.json`),
            JSON.stringify({ pageIndex, content: buffer }, null, 2)
          );
          pageIndex++;
          buffer = [];
          wordCount = 0;
        }
      }

      if (buffer.length) {
        fs.writeFileSync(
          path.join(pagesDir, `page_${String(pageIndex).padStart(3, '0')}.json`),
          JSON.stringify({ pageIndex, content: buffer }, null, 2)
        );
        pageIndex++;
      }

      const endPage = pageIndex - 1;
      chaptersInfo.push({ title: chapterTitle, startPage, endPage });

      console.log(`✅ Глава "${chapterTitle}" обработана. Страницы: ${startPage}–${endPage}`);
    } catch (err) {
      console.error(`❌ Ошибка в главе ${i + 1}:`, err.message);
    }
  }

  // Сортируем словарь по убыванию частотности
  const sortedWordFrequency = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [word, freq]) => {
      acc[word] = freq;
      return acc;
    }, {});

  fs.writeFileSync(
    path.join(__dirname, 'uniqueWords.json'),
    JSON.stringify(sortedWordFrequency, null, 2),
    'utf-8'
  );

  // Сохраняем метаданные
  const metadata = {
    title: epub.metadata.title || "Unknown Title",
    author: epub.metadata.creator || "Unknown Author",
    cover: coverHref,
    totalPages: pageIndex,
    totalChapters: chaptersInfo.length,
    uniqueWords: Object.keys(wordFrequency).length,
    chapters: chaptersInfo
  };

  fs.writeFileSync(
    path.join(__dirname, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );

  console.log('📘 Все данные успешно собраны: metadata.json, uniqueWords.json, страницы и изображения.');
});

epub.on('error', err => console.error('❌ EPUB error:', err));
epub.parse();
