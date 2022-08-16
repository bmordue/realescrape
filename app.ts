import fetch from 'node-fetch';
import { writeFileSync } from 'fs'; 

async function getResultsPage(page: number, pageSize: number) {
    const resp = await fetch("https://espc.com/properties/search/list", {
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:95.0) Gecko/20100101 Firefox/95.0",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.5",
            "Content-Type": "application/json;charset=utf-8",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Referrer": "https://espc.com/properties?p=3&ps=5&new=7",
        },
        "body": `{\"page\":${page},\"pageSize\":${pageSize},\"sortBy\":null,\"locations\":[{\"displayText\":\"Scotland\",\"key\":\"scotland\",\"category\":0}],\"radiuses\":[],\"school\":null,\"rental\":false,\"minBeds\":\"\",\"minPrice\":\"\",\"maxPrice\":\"\",\"new\":7,\"fixedPrice\":false,\"virtualTour\":false,\"underOffer\":false,\"featured\":false,\"exclusive\":false,\"orgId\":null,\"ptype\":[],\"freeText\":[],\"view\":\"list\",\"keywords\":[],\"epc\":[],\"sids\":[]}`,
        "method": "POST"
    });
    return resp.json();
}

async function main() {
    const pageSize = 50;
    const outFile = 'results.txt';

    const pageOneData = await getResultsPage(1, pageSize);
    console.log(`Got first page with ${pageOneData.results.length} results`);

    const highestPage = 1 + Math.trunc( pageOneData.totalResults / pageSize );
    console.log(`Expecting ${pageOneData.totalResults} total results over ${highestPage} pages of ${pageSize} items`);

    let collectedResults: Array<any> = pageOneData.results;

    let currPage = 1;
    while (currPage < highestPage) {
        currPage++;
        const pageData = await getResultsPage(currPage, pageSize);
        console.log(`Got page ${currPage} with ${pageData.results.length} results`);
        collectedResults = collectedResults.concat(pageData.results);
    }

    writeFileSync(outFile, JSON.stringify(collectedResults, null, 4));
    console.log(`Wrote ${collectedResults.length} results to ${outFile}`);
}

main();
