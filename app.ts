import fetch from 'node-fetch';
import { writeFileSync } from 'fs';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { join } from 'path';

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

async function writePropertyDetails(url :string, filename :string) {
    const dirName = "properties";

    try {
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`HTTP error! status: ${resp.status}`);
        }
        const bodyText = await resp.text();
        writeFileSync(join(dirName, `${filename}.html`), bodyText);
    } catch (error) {
        console.error(`Failed to write property details for ${url}:`, error);
        throw error;
    }
}

async function writeAllResults(propertyType: string) {
    const outFilename = `results-sspc-${propertyType}.json`;

    console.log(`Starting ${propertyType}.`);

    try {
        const host = 'https://www.sspc.co.uk';
        const resp = await fetch(`${host}/search.asp?searchtype=simple&q=&property_type=${propertyType}&page=1&view=all`);
        
        if (!resp.ok) {
            throw new Error(`HTTP error! status: ${resp.status}`);
        }

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
                    bedrooms: parseInt($(el).find('.pb > span').text())
                };
                results[i] = { ...prop, id: hashCode(prop.url) };
            } catch (error) {
                console.error(`Failed to parse property at index ${i}:`, error);
                // Continue with other properties instead of failing completely
            }
        });

        // Process properties with error handling for each one
        const successfulResults = [];
        for (let res of results) {
            if (res && res.url) {
                try {
                    await writePropertyDetails(res.url, res.id!);
                    successfulResults.push(res);
                } catch (error) {
                    console.error(`Failed to fetch property details for ${res.url}:`, error);
                    // Add property to results even if detail fetching failed
                    successfulResults.push(res);
                }
            }
        }

        writeFileSync(outFilename, JSON.stringify(successfulResults, null, 4));
        console.log(`Wrote ${successfulResults.length} results to ${outFilename} for SSPC.`);
    } catch (error) {
        console.error(`Failed to process ${propertyType} properties:`, error);
        throw error;
    }
}

async function main() {
    try {
        await Promise.all(['House', 'Flat', 'Bungalow'].map(writeAllResults));
        console.log('Successfully completed scraping all property types.');
    } catch (error) {
        console.error('Fatal error during scraping:', error);
        process.exit(1);
    }
}

main();
