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
	        // console.log(await resp.text());
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

async function fetchOnePage(propertyType: string, page: number): Promise<PropertyResult[]> {
        const url = 'https://www.sspc.co.uk/search.asp';
        const options = {
            method: 'POST',
            body: new URLSearchParams({
                searchtype: 'simple',
                q: '',
                property_type: propertyType,
                bedrooms: '',
                min_price: '',
                max_price: '',
                latitude: '',
                longitude: '',
                page: page.toString()
            })
        };
        const resp = await fetchWithRetries(url, options, 3, 500);
        const $ = cheerio.load(await resp.text());

        const resultsSelector = 'div#search_results > a';
//        console.log(`Got ${$(resultsSelector).length} results.`);

        const results: PropertyResult[] = [];
        $(resultsSelector).each((i, el) => {
            try {
                const prop = {
                    url: url + $(el).attr('href'),
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
        return results;
}

async function writeAllResults(propertyType: string) {
    const outFilename = `results-sspc-${propertyType}.json`;

    console.log(`Starting ${propertyType}.`);

// curl 'https://www.sspc.co.uk/search.asp' \
//   -X POST \
//   -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0' \
//   -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' \
//   -H 'Accept-Language: en-GB,en;q=0.9' \
//   -H 'Accept-Encoding: gzip, deflate, br, zstd' \
//   -H 'Content-Type: application/x-www-form-urlencoded' \
//   -H 'Origin: https://www.sspc.co.uk' \
//   -H 'Connection: keep-alive' \
//   -H 'Referer: https://www.sspc.co.uk/search.asp?searchtype=simple&q=&property_type=Bungalow&bedrooms=&min_price=&max_price=&latitude=&longitude=&page=1&view=all' \
//   -H 'Upgrade-Insecure-Requests: 1' \
//   -H 'Sec-Fetch-Dest: document' \
//   -H 'Sec-Fetch-Mode: navigate' \
//   -H 'Sec-Fetch-Site: same-origin' \
//   -H 'Sec-Fetch-User: ?1' \
//   -H 'Priority: u=0, i' \
//   --data-raw 'searchtype=simple&q=&property_type=Bungalow&bedrooms=&min_price=&max_price=&latitude=&longitude='

    try {
		let results: PropertyResult[] = [];
		let morePages = true;
		let page = 1;
		while (morePages) {
			let pageResults = await fetchOnePage(propertyType, page);
			results = results.concat(pageResults);
			if (pageResults.length === 0) {
				morePages = false;
				console.log(`No more results for ${propertyType} after page ${page}.`);
			}
			page++;
		}
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
