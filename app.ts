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
    const resp = await fetch(`https://${region.host}/properties/search/list`, {
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:95.0) Gecko/20100101 Firefox/95.0",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.5",
            "Content-Type": "application/json;charset=utf-8",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Referrer": `https://${region.host}/properties?p=3&ps=5&new=7`,
        },
        "body": `{\"page\":${page},\"pageSize\":${pageSize},\"sortBy\":null,\"locations\":[{\"displayText\":\"Scotland\",\"key\":\"scotland\",\"category\":0}],\"radiuses\":[],\"school\":null,\"rental\":false,\"minBeds\":\"\",\"minPrice\":\"\",\"maxPrice\":\"\",\"new\":7,\"fixedPrice\":false,\"virtualTour\":false,\"underOffer\":false,\"featured\":false,\"exclusive\":false,\"orgId\":null,\"ptype\":[],\"freeText\":[],\"view\":\"list\",\"keywords\":[],\"epc\":[],\"sids\":[]}`,
        "method": "POST"
    });
    return resp.json();
}

async function pspcGetResultsPage(page: number, pageSize: number, region: RegionInfo) {

    // TODO: or use /new.asp??
    const resp = await fetch(`https://${region.host}/all-properties.asp`, {
        "headers": {
            // "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:95.0) Gecko/20100101 Firefox/95.0",
            // "Accept": "application/json, text/plain, */*",
            // "Accept-Language": "en-US,en;q=0.5",
            // "Content-Type": "application/json;charset=utf-8",
            // "Sec-Fetch-Dest": "empty",
            // "Sec-Fetch-Mode": "cors",
            // "Sec-Fetch-Site": "same-origin",
            // "Referrer": `https://${region.host}/`,
        },
        "body": `{\"page\":${page},\"pageSize\":${pageSize},\"sortBy\":null,\"locations\":[{\"displayText\":\"Scotland\",\"key\":\"scotland\",\"category\":0}],\"radiuses\":[],\"school\":null,\"rental\":false,\"minBeds\":\"\",\"minPrice\":\"\",\"maxPrice\":\"\",\"new\":7,\"fixedPrice\":false,\"virtualTour\":false,\"underOffer\":false,\"featured\":false,\"exclusive\":false,\"orgId\":null,\"ptype\":[],\"freeText\":[],\"view\":\"list\",\"keywords\":[],\"epc\":[],\"sids\":[]}`,
        "method": "POST"
    });
    const html = await resp.text();
    const parsedResults = pspcParseHtmlResults(html, `https://${region.host}`);

    return { results: parsedResults, totalresults: parsedResults.length };
}

async function hspcGetResultsPage(page: number, pageSize: number, region: RegionInfo) {
    const resp = await fetch('https://hspc.co.uk/all-properties.asp', {});
    const html = await resp.text();
    const parsedResults = hspcParseHtmlResults(html, `https://${region.host}`);

    return { results: parsedResults, totalresults: parsedResults.length };
}

// <tr>
// <td>59909</td>
// <td></td>
// <td>Raon Eorna, Polbain, Achiltibuie</td>
// <td>5 beds</td>
// <td>Detached Villa</td>
// <td>Offers Over £445,000</td>
// <td><a href="/Detached-Villa-For-Sale-Raon-Eorna-Polbain-Achiltibuie-IV26-2YW">view</a></td>
// </tr>

function hspcParseHtmlResults(html: string, baseUrl = '') {
    const $ = cheerio.load(html);

    console.log(`Number of HSPC property entries: ${$('body table > tbody > tr').length}`);
    const results: PropertyResult[] = [];
    $('body table > tbody > tr').each((i, el) => {
        results[i] = {
            id: $(el).find('td').first().text(),
            address: $(el).find('td').eq(2).text(),
            bedrooms: $(el).find('td').eq(3).text(),
            summary: $(el).find('td').eq(4).text(),
            priceDescription: $(el).find('td').eq(5).text(),
            url: baseUrl + $(el).find('td > a').attr('href')
        };
    });

    return results;
}

interface PropertyResult {
    url?: string,
    id: string,
    address: string,
    bedrooms?: string,
    postcode?: string,
    summary: string,
    priceDescription: string,
};
// <tr>
// <td><a href="/2-Bed-Semi-Detached-Bungalow-For-Sale-1-Smithfield-Crescent-Blairgowrie-PH10-6UD">961419</a></td>
// <td>1 Smithfield Crescent Blairgowrie</td>
// <td>PH10-6UD</td>
// <td>Semi-Detached Bungalow</td>
// <td class="tar">Offers Over &pound;150,000</td>
// </tr>
function pspcParseHtmlResults(html: string, baseUrl = '') {
    const $ = cheerio.load(html);

    console.log(`Number of PSPC property entries: ${$('table.data > tbody > tr').length}`);
    const results: PropertyResult[] = [];
    $('table.data > tbody > tr').each((i, el) => {
        results[i] = {
            url: baseUrl + $(el).find('td > a').attr('href'),
            id: $(el).find('td').first().text(),
            address: $(el).find('td').eq(1).text(),
            postcode: $(el).find('td').eq(2).text(),
            summary: $(el).find('td').eq(3).text(),
            priceDescription: $(el).find('td.tar').text()
        };
    });
    console.log(`results.length: ${results.length}`);
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
        { label: 'hspc', name: 'Highlands and Islands', host: 'hspc.co.uk', getResultsFn: hspcGetResultsPage },
        //        { label: 'tspc', name: 'Tayside', getResultsFn: espcGetResultsPage }
        // Dumfries & Galloway!
    ];

    await Promise.all(regions.map(writeAllPages));
}

main();
