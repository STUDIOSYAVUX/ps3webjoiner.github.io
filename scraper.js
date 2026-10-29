const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

async function run() {
    // Config dosyasının tam ana dizin yolunu buluyoruz
    const configPath = path.join(__dirname, 'config.json');
    const screenshotPath = path.join(__dirname, 'page_screenshot.png');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const targetUrl = config.target_url;

    console.log(`Hedef siteye gidiliyor: ${targetUrl}`);

    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 }); 

    try {
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        
        // Sayfanın render süresi için kısa bir mola
        await page.waitForTimeout(3000);

        const html = await page.content();
        const $ = cheerio.load(html);

        // Link Koordinatları Ayıklama
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

        // Görseli tam olarak projenin ana dizinine (root) PNG formatında mühürlüyoruz
        await page.screenshot({ path: screenshotPath, type: 'png' });

        // Verileri config dosyasına geri işleme
        config.status = "ready";
        config.current_url = targetUrl;
        config.links = linkCoordinates;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        console.log("Ekran goruntusu ana dizine basariyla png olarak kaydedildi.");

    } catch (error) {
        console.error("Hata meydana geldi:", error.message);
    } finally {
        await browser.close();
    }
}

run();
