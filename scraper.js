const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

async function run() {
    const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    const targetUrl = config.target_url;

    console.log(`Siteye gidiliyor: ${targetUrl}`);

    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 }); // PS3 Çözünürlüğü

    try {
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });

        const html = await page.content();
        const $ = cheerio.load(html);

        // Gelişmiş Video Ayıklama
        const foundVideos = [];
        $('video').each((i, el) => {
            const src = $(el).find('source').attr('src') || $(el).attr('src');
            if (src) foundVideos.push(src);
        });
        $('iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src && (src.includes('video') || src.includes('embed') || src.includes('player') || src.includes('stream'))) {
                foundVideos.push(src);
            }
        });

        // Link Koordinatlarını Ayıklama
        const linkCoordinates = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(link => {
                const rect = link.getBoundingClientRect();
                return {
                    href: link.href,
                    left: Math.round(rect.left),
                    top: Math.round(rect.top),
                    right: Math.round(rect.right),
                    bottom: Math.round(rect.bottom)
                };
            }).filter(l => (l.right - l.left) > 0 && (l.bottom - l.top) > 0);
        });

        // PS3 RAM'i için optimize sıkıştırılmış ekran görüntüsü al
        await page.screenshot({ path: 'page_screenshot.jpg', type: 'jpeg', quality: 60 });

        // config.json'ı güncelle
        config.status = "ready";
        config.current_url = targetUrl;
        config.videos = foundVideos;
        config.links = linkCoordinates;
        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));

        console.log("Sistem başarıyla sonuçları kaydetti.");

    } catch (error) {
        console.error("Hata oluştu:", error.message);
    } finally {
        await browser.close();
    }
}

run();
