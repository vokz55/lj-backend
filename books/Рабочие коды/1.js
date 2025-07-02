const EPub = require('epub');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const epubPath = path.resolve(__dirname, 'littleprince.epub');
const epub = new EPub(epubPath);

const tokenize = text =>
  Array.from(text.matchAll(/[\u00C0-\u024F\w’']+|[^\w\s]| +/g)).map(m => m[0]);

epub.on('end', async () => {
  const result = {
    title: epub.metadata.title || 'Unknown Title',
    author: epub.metadata.creator || 'Unknown Author',
    language: epub.metadata.language || 'en',
    content: [],
  };

  const rawDir = path.join(__dirname, 'raw_chapters');
  if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir);

  for (let i = 0; i < epub.flow.length; i++) {
    const chapter = epub.flow[i];

    try {
      const raw = await new Promise((res, rej) =>
        epub.getChapterRaw(chapter.id, (err, rawHtml) => err ? rej(err) : res(rawHtml))
      );

      const safeTitle = chapter.title?.replace(/[<>:"/\\|?*]+/g, '_') || `chapter_${i + 1}`;
      const fileName = `chapter_${String(i + 1).padStart(2, '0')}_${safeTitle}.xhtml`;
      fs.writeFileSync(path.join(rawDir, fileName), raw, 'utf-8');

      const $ = cheerio.load(raw, { xmlMode: true });

      $('h1,h2,h3,h4,h5,h6,p,img').each((_, el) => {
        const tag = el.tagName.toLowerCase();

        if (tag === 'img') {
          const src = $(el).attr('src');
          if (src) {
            result.content.push({ type: 'image', src });
          }
        } else {
          const text = $(el).text().trim().replace(/\n+/g, ' ');
          const words = tokenize(text);
          if (words.length) {
            result.content.push({
              type: /^h[1-6]$/.test(tag) ? 'heading' : 'paragraph',
              words,
            });
          }
        }
      });

    } catch (err) {
      console.error(`⚠️ Глава "${chapter.title}" — ошибка:`, err.message);
    }
  }

  fs.writeFileSync('structured_output.json', JSON.stringify(result, null, 2), 'utf-8');
  console.log('✅ Готово: structured_output.json и raw_chapters/*.xhtml');
});

epub.on('error', err => console.error('❌ EPUB error:', err));
epub.parse();