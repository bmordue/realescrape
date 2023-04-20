import fetch from 'node-fetch';
import { writeFileSync } from 'fs';
import * as cheerio from 'cheerio';

interface RegionInfo {
    label: string,
    name: string,
    host: string,
    getResultsFn: (page: number, pageSize: number, region: RegionInfo) => Promise<any>
};

async function espcGetResultsPage(page: number, pageSize: number, region: RegionInfo) {
    const resp = await fetch(`https://${region}/properties/search/list`, {
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:95.0) Gecko/20100101 Firefox/95.0",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.5",
            "Content-Type": "application/json;charset=utf-8",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Referrer": `https://${region}/properties?p=3&ps=5&new=7`,
        },
        "body": `{\"page\":${page},\"pageSize\":${pageSize},\"sortBy\":null,\"locations\":[{\"displayText\":\"Scotland\",\"key\":\"scotland\",\"category\":0}],\"radiuses\":[],\"school\":null,\"rental\":false,\"minBeds\":\"\",\"minPrice\":\"\",\"maxPrice\":\"\",\"new\":7,\"fixedPrice\":false,\"virtualTour\":false,\"underOffer\":false,\"featured\":false,\"exclusive\":false,\"orgId\":null,\"ptype\":[],\"freeText\":[],\"view\":\"list\",\"keywords\":[],\"epc\":[],\"sids\":[]}`,
        "method": "POST"
    });
    return resp.json();
}

async function pspcGetResultsPage(page: number, pageSize: number, region: RegionInfo) {

    // TODO: or use /new.asp??
    const resp = await fetch(`https://${region}/all-properties.asp`, {
        "headers": {
            // "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:95.0) Gecko/20100101 Firefox/95.0",
            // "Accept": "application/json, text/plain, */*",
            // "Accept-Language": "en-US,en;q=0.5",
            // "Content-Type": "application/json;charset=utf-8",
            // "Sec-Fetch-Dest": "empty",
            // "Sec-Fetch-Mode": "cors",
            // "Sec-Fetch-Site": "same-origin",
            // "Referrer": `https://${region}/`,
        },
        "body": `{\"page\":${page},\"pageSize\":${pageSize},\"sortBy\":null,\"locations\":[{\"displayText\":\"Scotland\",\"key\":\"scotland\",\"category\":0}],\"radiuses\":[],\"school\":null,\"rental\":false,\"minBeds\":\"\",\"minPrice\":\"\",\"maxPrice\":\"\",\"new\":7,\"fixedPrice\":false,\"virtualTour\":false,\"underOffer\":false,\"featured\":false,\"exclusive\":false,\"orgId\":null,\"ptype\":[],\"freeText\":[],\"view\":\"list\",\"keywords\":[],\"epc\":[],\"sids\":[]}`,
        "method": "POST"
    });
    const html = await resp.text();
    const parsedResults = parseHtmlResults(html);

    return { results: parsedResults, totalresults: parsedResults.length };
}


interface PropertyResult {
    url?: string,
    figure?: string,
    address: string,
    summary: string,
    priceDescription: string,
    agent: string,
    propertyRef: string,
};
// <a href="/2-Bed-Detached-Bungalow-For-Sale-Speybank-10-Letham-Road-Perth-PH1-2AP" class="property">
// <figure><img src="https://docs.pspc.co.uk/photos/961478.jpg?width=294&amp;r=209692-0" alt="Speybank, 10 Letham Road, Perth PH1 2AP"></figure>
// <h2>Speybank, 10 Letham Road, Perth PH1 2AP</h2>
// <p>2 bed Detached Bungalow</p>
// <h3>Offers Over £220,000</h3>
// <h4>Miller Hendry</h4>
// <h5>Property Ref: 961478</h5>
// </a>
function parseHtmlResults(html: string) {
    const $ = cheerio.load(html);

    const results: PropertyResult[] = [];
    $('a.property').each((i, el) => {
        results.push({
            url: $(el).attr('href'),
            figure: $(el).find('img').attr('href'),
            address: $(el).find('h2').text(),
            summary: $(el).find('p').first().text(),
            priceDescription: $(el).find('h3').text(),
            agent: $(el).find('h4').text(),
            propertyRef: $(el).find('h5').text()
        });
    });
    return results;
}

async function writeAllPages(region: RegionInfo) {
    {
        console.log(`Starting ${region.name}.`);
        const pageSize = 50;
        const outFilename = `results-${region.label}.json`;

        const getResultsPage = region.getResultsFn.bind(null);

        const pageOneData = await getResultsPage(1, pageSize, region);
        console.log(`Got first page with ${pageOneData.results.length} results`);

        const highestPage = 1 + Math.trunc(pageOneData.totalResults / pageSize);
        console.log(`Expecting ${pageOneData.totalResults} total results over ${highestPage} pages of ${pageSize} items`);

        let collectedResults: Array<any> = pageOneData.results;

        let currPage = 1;
        while (currPage < highestPage) {
            currPage++;
            const pageData = await getResultsPage(currPage, pageSize, region);
            console.log(`Got page ${currPage} with ${pageData.results.length} results`);
            collectedResults = collectedResults.concat(pageData.results);
        }

        writeFileSync(outFilename, JSON.stringify(collectedResults, null, 4));
        console.log(`Wrote ${collectedResults.length} results to ${outFilename} for ${region.name}.`);
    }
}

async function main() {

    const regions: RegionInfo[] = [
        { label: 'espc', name: 'Edinburgh', host: 'espc.com', getResultsFn: espcGetResultsPage },
        { label: 'pspc', name: 'Perthshire', host: 'www.pspc.co.uk', getResultsFn: pspcGetResultsPage },
        //        { label: 'hspc', name: 'Inverness',  getResultsFn: espcGetResultsPage },
        //        { label: 'tspc', name: 'Tayside', getResultsFn: espcGetResultsPage }
    ];

    await Promise.all(regions.map(writeAllPages));
}

main();
