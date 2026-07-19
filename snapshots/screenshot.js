const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const dir = 'C:/Users/egor3/f1-hub/snapshots/before';
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text().substring(0, 200)); });

    // Home — wait for Babel to compile
    await page.goto('https://f1.lead-seek.ru', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);
    await page.screenshot({ path: `${dir}/01-home.png`, fullPage: true });
    console.log('01-home');

    // Click tabs via bottom nav
    const tabs = [
        { text: 'Онлайн', file: '02-live' },
        { text: 'Новости', file: '03-news' },
        { text: 'Чемпионат', file: '04-standings' },
        { text: 'Прогнозы', file: '05-predictions' },
        { text: 'Профиль', file: '06-profile' },
    ];

    for (const t of tabs) {
        const btn = await page.$(`text=${t.text}`);
        if (btn) {
            await btn.click();
            await page.waitForTimeout(3000);
        }
        await page.screenshot({ path: `${dir}/${t.file}.png`, fullPage: true });
        console.log(t.file);
    }

    // Go to schedule via "Все гонки"
    const homeBtn = await page.$('text=Главная');
    if (homeBtn) { await homeBtn.click(); await page.waitForTimeout(2000); }
    const allRaces = await page.$('text=Все гонки');
    if (allRaces) { await allRaces.click(); await page.waitForTimeout(3000); }
    await page.screenshot({ path: `${dir}/07-schedule.png`, fullPage: true });
    console.log('07-schedule');

    // Click first race card
    const raceCard = await page.$('.card');
    if (raceCard) { await raceCard.click(); await page.waitForTimeout(3000); }
    await page.screenshot({ path: `${dir}/08-race-detail.png`, fullPage: true });
    console.log('08-race-detail');

    console.log(`Console errors: ${errors.length}`);
    errors.forEach((e, i) => console.log(`  [${i}] ${e}`));

    await browser.close();
})();
