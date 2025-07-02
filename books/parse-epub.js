const EPub = require('epub');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const tokenize = text =>
  Array.from(text.matchAll(/[\u00C0-\u024F\w’']+|[^\w\s]| +/g)).map(m => m[0]);

const safe = str => str?.replace(/[<>:"/\\|?*\n\r]+/g, '_').trim() || null;

const parseBook = (filePath, outputDir, bookName) => {
  return new Promise((resolve, reject) => {
    const epub = new EPub(filePath);

    const saveImage = (id, fileName) =>
      new Promise((res, rej) => {
        epub.getFile(id, (err, data) => {
          if (err) return rej(err);
          fs.writeFileSync(path.join(outputDir, 'images', fileName), data);
          res();
        });
      });

    epub.on('end', async () => {
      const rawDir = path.join(outputDir, 'raw_chapters');
      const imgDir = path.join(outputDir, 'images');
      const pagesDir = path.join(outputDir, 'pages');
      const chaptersInfo = [];
      const wordFrequency = {};

      [rawDir, imgDir, pagesDir].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      });

      const coverItem = Object.values(epub.manifest).find(item => item.media_type?.includes('jpg') && item.id?.toLowerCase().includes('cover'));
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
              const text = $(el).text().replace(/&nbsp;/g, '').replace(/\u00A0/g, '').trim().replace(/\n+/g, ' ');
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

          // Разделение на страницы
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

      const sortedWordFrequency = Object.entries(wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .reduce((acc, [word, freq]) => {
          acc[word] = freq;
          return acc;
        }, {});

      fs.writeFileSync(
        path.join(outputDir, 'uniqueWords.json'),
        JSON.stringify(sortedWordFrequency, null, 2),
        'utf-8'
      );

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
        path.join(outputDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2),
        'utf-8'
      );

      resolve(bookName);
    });

    epub.on('error', err => {
      console.error(`❌ EPUB error in "${bookName}":`, err.message);
      reject(err);
    });

    epub.parse();
  });
};

// === Main function ===
(async () => {
  const booksDir = path.resolve(__dirname, 'book-source');
  const outDir = path.resolve(__dirname, 'book-data');
  const indexFile = path.join(outDir, 'index.json');

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  if (!fs.existsSync(indexFile)) fs.writeFileSync(indexFile, '[]');

  const processedBooks = new Set(JSON.parse(fs.readFileSync(indexFile, 'utf-8')));
  const files = fs.readdirSync(booksDir).filter(file => file.endsWith('.epub'));

  for (const file of files) {
    const baseName = path.basename(file, '.epub');
    if (processedBooks.has(baseName)) {
      console.log(`🔁 Пропущено: ${baseName} (уже обработано)`);
      continue;
    }

    console.log(`📘 Обработка: ${baseName}`);
    const filePath = path.join(booksDir, file);
    const outputDir = path.join(outDir, baseName);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    try {
      await parseBook(filePath, outputDir, baseName);
      processedBooks.add(baseName);
      fs.writeFileSync(indexFile, JSON.stringify([...processedBooks], null, 2));
    } catch (err) {
      console.error(`❌ Ошибка при обработке ${baseName}:`, err.message);
    }
  }

  console.log('\n✅ Все книги обработаны.');
})();
