import fetch from 'node-fetch';
import { writeFileSync } from 'fs';
import * as cheerio from 'cheerio';

interface PropertyResult {
    url?: string,
    address: string,
    bedrooms?: number,
    summary: string,
    priceDescription: string,
};

async function writeAllResults(propertyType: string) {
    const outFilename = `results-sspc-${propertyType}.json`;

    console.log(`Starting ${propertyType}.`);

    const host = 'https://www.sspc.co.uk';
    const resp = await fetch(`${host}/search.asp?searchtype=simple&q=&property_type=${propertyType}&page=1&view=all`);

    const $ = cheerio.load(await resp.text());

    const resultsSelector = 'div#search_results > a';
    console.log(`Got ${$(resultsSelector).length} results.`);

    const results: PropertyResult[] = [];
    $(resultsSelector).each((i, el) => {
        results[i] = {
            url: host + $(el).attr('href'),
            address: $(el).find('h4').text(),
            priceDescription: $(el).find('.pp').text(),
            summary: $(el).find('.pt').text().trim(),
            bedrooms: parseInt($(el).find('.pb > span').text())
        };
    });

    writeFileSync(outFilename, JSON.stringify(results, null, 4));
    console.log(`Wrote ${results.length} results to ${outFilename} for SSPC.`);
}

async function main() {
    await Promise.all(['House', 'Flat', 'Bungalow'].map(writeAllResults));
}

main();
