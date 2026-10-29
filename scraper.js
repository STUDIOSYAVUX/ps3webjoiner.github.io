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
    // PS3 ekran genişliği
    await page.setViewport({ width: 1024, height: 768 }); 

    try {
        // Sayfanın tamamen yüklenmesi için networkidle0 kullandık (Tüm scriptler ve görseller bitsin diye)
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        
        // PS3 uyumluluğu için biraz bekleyelim sayfa tam otursun
        await page.waitForTimeout(2000);

        const html = await page.content();
        const $ = cheerio.load(html);

        // Video Ayıklama
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

        // Link Koordinatları
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

        // Kırık görseli engellemek için PNG formatında net screenshot alıyoruz
        await page.screenshot({ path: 'page_screenshot.png', type: 'png' });

        // config.json güncelleme
        config.status = "ready";
        config.current_url = targetUrl;
        config.videos = foundVideos;
        config.links = linkCoordinates;
        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));

        console.log("Sistem basariyla ekran goruntusunu (PNG) kaydetti.");

    } catch (error) {
        console.error("Hata olustu:", error.message);
    } finally {
        await browser.close();
    }
}

run();
