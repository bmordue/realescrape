import fetch from 'node-fetch';
import { writeFileSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';


export interface PropertyResult {
    id: string,
    url?: string,
    address: string,
    bedrooms?: number,
    summary: string,
    priceDescription: string,
    addedData?: object
};

function hashCode(str: string) {
    const hash = createHash('md5');
    hash.update(str);
    return hash.digest('hex');
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetries(url: string, options: any = {}, retries = 3, backoff = 500) {
    options.headers = {
        ...options.headers,
        'User-Agent': 'realescrape/0.0.1 (+https://github.com/)'
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const resp = await fetch(url, options);
            if (!resp.ok) {
                const err = new Error(`HTTP error! status: ${resp.status} on attempt ${attempt + 1} for ${url}`);
                (err as any).status = resp.status;
                if (resp.status >= 500 && attempt < retries) {
                    const jitter = Math.random() * 200;
                    const delay = backoff * Math.pow(2, attempt) + jitter;
                    console.log(`Backing off for ${delay} ms after HTTP status ${resp.status} (attempt ${attempt})`);
                    await sleep(delay);
                    continue;
                }
	        // console.log(await resp.text());
                throw err;
            }
            return resp;
        } catch (error) {
            if (attempt === retries) throw error;
            const jitter = Math.random() * 200;
            const delay = backoff * Math.pow(2, attempt) + jitter;
            console.log(`Backing off for ${delay} ms after error thrown (attempt ${attempt})`);
            await sleep(delay);
        }
    }
    throw new Error(`Unreachable: fetchWithRetries exhausted for ${url}`);
}

async function writeAllResults(propertyType: string) {
    const outFilename = `results-sspc-${propertyType}.json`;

    console.log(`Starting ${propertyType}.`);

    try {
        const host = 'https://www.sspc.co.uk';
        const resp = await fetchWithRetries(`${host}/search.asp?searchtype=simple&q=&property_type=${propertyType}&page=1&view=all`, undefined, 3, 500);
        const $ = cheerio.load(await resp.text());

        const resultsSelector = 'div#search_results > a';
        console.log(`Got ${$(resultsSelector).length} results.`);

        const results: PropertyResult[] = [];
        $(resultsSelector).each((i, el) => {
            try {
                const prop = {
                    url: host + $(el).attr('href'),
                    address: $(el).find('h4').text(),
                    priceDescription: $(el).find('.pp').text(),
                    summary: $(el).find('.pt').text().trim(),
                    bedrooms: Number.parseInt($(el).find('.pb > span').text())
                };
                results[i] = { ...prop, id: hashCode(prop.url) };
            } catch (error) {
                console.error(`Failed to parse property at index ${i}:`, error);
                // Continue with other properties instead of failing completely
            }
        });

        const successfulResults = results.filter((r): r is PropertyResult => !!(r?.url));

        writeFileSync(outFilename, JSON.stringify(successfulResults, null, 4));
        console.log(`Wrote ${successfulResults.length} results to ${outFilename} for SSPC.`);
    } catch (error) {
        console.error(`Failed to process ${propertyType} properties:`, error);
        throw error;
    }
}

async function main() {
    const propertyTypes = ['House', 'Flat', 'Bungalow'];
    const results = await Promise.allSettled(propertyTypes.map(writeAllResults));
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length > 0) {
        failures.forEach(f => console.error('Scraping failure:', f.reason));
    }
    console.log(`Completed: ${results.length - failures.length}/${results.length} property types scraped successfully.`);
}

main();
