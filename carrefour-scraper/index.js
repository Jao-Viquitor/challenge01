// index.js
const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeCarrefourDrinks() {
    try {
        const browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox'],
            timeout: 60000
        });

        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        const baseUrl = 'https://mercado.carrefour.com.br/';
        console.log('Navegando para:', baseUrl);

        await page.goto(baseUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        const cepButtonSelector = '#__next > div:nth-child(5) > div.bg-white.min-h-\\[39px\\].border-b.border-gray-light > div > div > div > button';
        console.log('Tentando clicar no botão "Insira seu CEP"...');
        await page.waitForSelector(cepButtonSelector, { timeout: 60000 });
        await page.click(cepButtonSelector);
        await delay(2000);
        console.log('Botão "Insira seu CEP" clicado.');

        console.log('Aguardando popup e clicando em "Retire na Loja"...');
        await page.waitForSelector('div.tooltip_tooltip-container__0_z6A', { timeout: 60000 });
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button[role="tab"]'));
            const pickupButton = buttons.find(button =>
                button.textContent.includes('Retire na Loja')
            );
            if (pickupButton) {
                pickupButton.click();
            } else {
                throw new Error('Botão "Retire na Loja" não encontrado');
            }
        });
        await delay(2000);
        console.log('Botão "Retire na Loja" clicado.');

        const selectCitySelector = '#selectCity';
        console.log('Selecionando "Piracicaba - SP" no dropdown...');
        await page.waitForSelector(selectCitySelector, { timeout: 60000 });
        await page.select(selectCitySelector, 'Piracicaba');
        await delay(3000);
        console.log('Cidade "Piracicaba - SP" selecionada.');

        const targetSelector = '#headlessui-tabs-panel-\\:r1g\\: > div > article > div.grid.grid-flow-col > h3';
        console.log('Tentando clicar no elemento após selecionar a cidade...');

        await page.waitForSelector(targetSelector, { timeout: 60000, visible: true });

        const element = await page.$(targetSelector);
        if (!element) {
            throw new Error('Elemento não encontrado com o seletor: ' + targetSelector);
        }

        await page.evaluate((selector) => {
            const el = document.querySelector(selector);
            if (el) {
                el.click();
            }
        }, targetSelector);

        await delay(2000);

        console.log('Elemento clicado com sucesso.');

        console.log('Página inicial carregada. Tentando encontrar o menu de bebidas...');

        const drinksMenuSelector = "#__next > div:nth-child(5) > nav > div > ul > li:nth-child(3) > a";

        try {
            await page.waitForSelector(drinksMenuSelector, { timeout: 60000 });
            console.log('Menu de bebidas encontrado! Tentando clique via evaluate...');
            await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                if (element) {
                    element.click();
                } else {
                    throw new Error('Elemento não encontrado no evaluate');
                }
            }, drinksMenuSelector);
            await delay(2000);
            console.log('URL atual após clique:', await page.url());
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
        } catch (error) {
            console.log('Erro na navegação com seletor original:', error.message);
            console.log('Tentando abordagem alternativa...');
            await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('nav a'));
                const drinksLink = links.find(link => link.textContent.toLowerCase().includes('bebidas'));
                if (drinksLink) {
                    console.log('Link alternativo encontrado:', drinksLink.href);
                    drinksLink.click();
                } else {
                    console.log('Nenhum link de bebidas encontrado na alternativa');
                }
            });
            await delay(2000);
            console.log('URL atual após tentativa alternativa:', await page.url());
        }

        console.log('Iniciando extração na URL:', await page.url());

        const products = [];

        const extractProducts = async () => {
            return await page.evaluate(() => {
                const productElements = document.querySelectorAll('ul.grid.grid-cols-2.xl\\:grid-cols-5.md\\:grid-cols-4 > li');
                console.log('Número de produtos encontrados:', productElements.length);

                const productsData = [];
                productElements.forEach(product => {
                    const nameElement = product.querySelector('h3 > span > a');
                    const priceElement = product.querySelector('div.flex.flex-col > div.flex.flex-col.xs\\:flex-row.xs\\:justify-between.xs\\:items-center > span.text-base.text-blue-royal');
                    const imageElement = product.querySelector('div[data-product-card-image] > img');

                    const name = nameElement?.textContent || 'N/A';
                    const price = priceElement?.textContent || 'N/A';
                    const image = imageElement?.src || 'N/A';

                    productsData.push({
                        name: name.trim(),
                        price: price.trim(),
                        image: image.trim(),
                        timestamp: new Date().toISOString()
                    });
                });

                return productsData;
            });
        };

        await page.waitForSelector('ul.grid.grid-cols-2.xl\\:grid-cols-5.md\\:grid-cols-4 > li', { timeout: 60000 });
        const scrapedProducts = await extractProducts();
        products.push(...scrapedProducts);

        let hasNextPage = true;
        while (hasNextPage) {
            try {
                await page.waitForSelector('ul.grid.grid-cols-2.xl\\:grid-cols-5.md\\:grid-cols-4 > li', { timeout: 60000 });
                const scrapedProducts = await extractProducts();
                products.push(...scrapedProducts);

                const nextPageButton = await page.$('link[rel="next"]');
                if (nextPageButton) {
                    console.log('Botão de próxima página encontrado, clicando...');
                    await Promise.all([
                        nextPageButton.click(),
                        page.waitForNavigation({ waitUntil: 'networkidle2' })
                    ]);
                } else {
                    console.log('Nenhum botão de próxima página encontrado.');
                    hasNextPage = false;
                }
            } catch (error) {
                console.log('Erro durante a navegação para a próxima página:', error.message);
                hasNextPage = false;
            }
        }

        await fs.writeFile(
            'output.json',
            JSON.stringify(products, null, 2),
            'utf8'
        );

        console.log(`Scraping concluído! ${products.length} produtos salvos em output.json`);
        await browser.close();

    } catch (error) {
        console.error('Erro durante o scraping:', error);
    }
}

scrapeCarrefourDrinks();
