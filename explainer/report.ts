import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { AbListing, AbListingFile } from './types';
import {
    BedroomBox,
    computeBedroomBoxes,
    computeDistrictStats,
    computeHistogram,
    computeKindMix,
    computeMonthlySeries,
    computeOverview,
    computePriceSizePoints,
    computeTypeMix,
    DistrictStats,
    formatMonth,
    isCityOutcode,
    median,
    monthsAgo,
    Overview,
    parseDate,
    TypeMixEntry
} from './model';
import {
    boxPlotChart,
    donutChart,
    escapeHtml,
    FLAT_COLOR,
    formatMoney,
    formatNumber,
    formatPct,
    formatPrice,
    formatSignedPct,
    histogramChart,
    horizontalBarChart,
    HOUSE_COLOR,
    lineChart,
    mapChart,
    MapLabel,
    MapPoint,
    OTHER_COLOR,
    scatterChart,
    sequentialColor,
    typeColor,
    verticalBarChart
} from './charts';

const INPUT_FILE = 'explainer/data/ab-listings.json';
const OUTPUT_FILE = 'explainer/output/ab-postcode-explainer.html';

function loadData(): AbListingFile {
    return JSON.parse(readFileSync(INPUT_FILE, 'utf-8')) as AbListingFile;
}

function soldBetween(listings: AbListing[], start: Date, end: Date): AbListing[] {
    return listings.filter((listing) => {
        if (!listing.sold) {
            return false;
        }
        const date = parseDate(listing.closedDate);
        return date !== null && date >= start && date < end;
    });
}

function activeListings(listings: AbListing[]): AbListing[] {
    return listings.filter((listing) => listing.isOpen);
}

function sample<T>(items: T[], maxItems: number): T[] {
    if (items.length <= maxItems) {
        return items;
    }
    const step = Math.ceil(items.length / maxItems);
    return items.filter((_, index) => index % step === 0);
}

function safeMedianPrice(listings: AbListing[]): number | null {
    return median(listings.map((listing) => listing.price).filter((value): value is number => value !== null && value > 0));
}

function statWithMin(stats: DistrictStats[], minSales: number): DistrictStats[] {
    return stats.filter((stat) => stat.soldCount12 >= minSales && stat.medianSoldPrice12 !== null);
}

function renderKpi(label: string, value: string, note: string): string {
    return `<div class="kpi"><span class="kpi-label">${escapeHtml(label)}</span><span class="kpi-value">${escapeHtml(value)}</span><span class="kpi-note">${escapeHtml(note)}</span></div>`;
}

function renderNarrative(overview: Overview, stats: DistrictStats[], active: AbListing[], sold12: AbListing[]): string {
    const ranked = statWithMin(stats, 20).slice().sort((a, b) => (b.medianSoldPrice12 as number) - (a.medianSoldPrice12 as number));
    const expensive = ranked[0];
    const affordable = ranked[ranked.length - 1];
    const busiest = stats.slice().sort((a, b) => b.soldCount12 - a.soldCount12)[0];
    const underOfferRanked = stats
        .filter((stat) => stat.activeCount >= 20 && stat.underOfferRate !== null)
        .sort((a, b) => (b.underOfferRate as number) - (a.underOfferRate as number));
    const highestUnderOffer = underOfferRanked[0];
    const movers = stats
        .filter((stat) => stat.soldCountLast6 >= 10 && stat.soldCountPrev6 >= 10 && stat.sixMonthChangePct !== null)
        .sort((a, b) => (b.sixMonthChangePct as number) - (a.sixMonthChangePct as number));
    const biggestRise = movers[0];
    const biggestFall = movers[movers.length - 1];
    const houseCount = sold12.filter((listing) => listing.propertyType === 'House').length;
    const flatCount = sold12.filter((listing) => listing.propertyType === 'Flat').length;
    const detached = sold12.filter((listing) => listing.propertyKind === 'Detached house');
    const flats = sold12.filter((listing) => listing.propertyType === 'Flat');
    const sentences: string[] = [];

    sentences.push(
        `This report looks at ${formatNumber(active.length)} homes currently advertised across AB postcodes and ${formatNumber(sold12.length)} ASPC listings marked sold in the last 12 months. The median sold price over that period was ${formatMoney(overview.medianSoldPrice12)}, while the median asking price of homes on the market now is ${formatMoney(overview.medianActivePrice)}.`
    );

    if (overview.underOfferRate !== null) {
        sentences.push(
            `${formatPct(overview.underOfferRate)} of active listings are under offer, and the median sold home had ${formatNumber(overview.medianFloorArea12)} m² of floor area at ${formatMoney(overview.medianSoldPricePerSqm12)} per m².`
        );
    }

    if (expensive && affordable) {
        sentences.push(
            `Among districts with at least 20 sales, the highest median sold price was in ${expensive.outcode} (${formatMoney(expensive.medianSoldPrice12)} from ${formatNumber(expensive.soldCount12)} sales), and the lowest was in ${affordable.outcode} (${formatMoney(affordable.medianSoldPrice12)} from ${formatNumber(affordable.soldCount12)} sales).`
        );
    }

    if (busiest) {
        sentences.push(
            `${busiest.outcode} was the busiest district by sales volume, with ${formatNumber(busiest.soldCount12)} sold listings in the last 12 months.`
        );
    }

    if (highestUnderOffer) {
        sentences.push(
            `The highest under-offer rate among districts with at least 20 active listings was in ${highestUnderOffer.outcode} at ${formatPct(highestUnderOffer.underOfferRate)}.`
        );
    }

    if (overview.sixMonthChangePct !== null) {
        const direction = overview.sixMonthChangePct >= 0 ? 'rose' : 'fell';
        sentences.push(
            `The median sold price ${direction} ${formatPct(Math.abs(overview.sixMonthChangePct))} in the last six months compared with the previous six months.`
        );
    }

    if (biggestRise && biggestFall && biggestRise.outcode !== biggestFall.outcode) {
        sentences.push(
            `District-level momentum was mixed: ${biggestRise.outcode} recorded the strongest six-month change (${formatSignedPct(biggestRise.sixMonthChangePct)}), while ${biggestFall.outcode} recorded the weakest (${formatSignedPct(biggestFall.sixMonthChangePct)}).`
        );
    }

    if (houseCount + flatCount > 0) {
        const houseShare = (houseCount / (houseCount + flatCount)) * 100;
        const detachedMedian = safeMedianPrice(detached);
        const flatMedian = safeMedianPrice(flats);
        sentences.push(
            `Houses made up ${formatPct(houseShare)} of recorded sales. ${detachedMedian !== null ? `Detached houses had a median sold price of ${formatMoney(detachedMedian)}` : 'Detached house data was limited'}${flatMedian !== null ? `, compared with ${formatMoney(flatMedian)} for flats` : ''}.`
        );
    }

    return sentences.map((sentence) => `<p>${escapeHtml(sentence)}</p>`).join('');
}

function renderDistrictTable(stats: DistrictStats[]): string {
    const rows = stats
        .filter((stat) => stat.soldCount12 > 0 || stat.activeCount > 0)
        .slice()
        .sort((a, b) => (b.medianSoldPrice12 ?? 0) - (a.medianSoldPrice12 ?? 0))
        .map((stat) => {
            const lowSample = stat.soldCount12 < 10;
            const changeClass = stat.sixMonthChangePct === null ? '' : stat.sixMonthChangePct >= 0 ? 'positive' : 'negative';
            return `<tr class="${lowSample ? 'low-sample' : ''}">
                <td><strong>${escapeHtml(stat.outcode)}</strong></td>
                <td class="num">${formatNumber(stat.activeCount)}</td>
                <td class="num">${formatNumber(stat.soldCount12)}</td>
                <td class="num">${formatMoney(stat.medianSoldPrice12)}</td>
                <td class="num">${formatMoney(stat.medianSoldPricePerSqm12)}</td>
                <td class="num">${formatMoney(stat.medianSoldPricePerBedroom12)}</td>
                <td class="num">${formatPct(stat.underOfferRate)}</td>
                <td class="num ${changeClass}">${formatSignedPct(stat.sixMonthChangePct)}</td>
            </tr>`;
        })
        .join('');

    return `<div class="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>District</th>
                    <th class="num">Active</th>
                    <th class="num">Sold 12m</th>
                    <th class="num">Median sold</th>
                    <th class="num">£/m²</th>
                    <th class="num">£/bedroom</th>
                    <th class="num">Under offer</th>
                    <th class="num">6m change</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>
    <p class="small">Rows in grey have fewer than 10 sales in the last 12 months and should be treated as indicative. “n/a” means there was not enough data for that metric.</p>`;
}

function renderMapLegendNote(): string {
    return `<p class="small">The maps are schematic: each dot is a listing or district centroid plotted from latitude and longitude. There is no basemap, so the shape reflects where listings are, not administrative boundaries.</p>`;
}

function renderMethodNote(file: AbListingFile, overview: Overview): string {
    const first = overview.earliestSold ? formatMonth(overview.earliestSold) : 'n/a';
    const last = overview.latestSold ? formatMonth(overview.latestSold) : 'n/a';
    return `<section class="panel method">
        <h2>Method and caveats</h2>
        <ul>
            <li><strong>Source:</strong> ${escapeHtml(file.source)} search API, captured ${escapeHtml(file.generatedAt)}. The script fetches active listings and listings marked sold within the last ${formatNumber(file.closedWindowDays)} days.</li>
            <li><strong>Coverage:</strong> ${formatNumber(file.counts.ab)} AB-postcode listings were retained from ${formatNumber(file.counts.fetched)} records fetched. Sold dates run from ${escapeHtml(first)} to ${escapeHtml(last)}.</li>
            <li><strong>“Sold” price:</strong> the advertised price at the time the listing closed, not necessarily the final achieved price. Asking-price labels such as “offers over” and “fixed price” are not adjusted.</li>
            <li><strong>Scope:</strong> ASPC-listed properties only. Private sales and some new-build or non-ASPC sales are not included.</li>
            <li><strong>Small samples:</strong> district rankings use a minimum of 20 sales; six-month changes require at least 10 sales in each period. Small-sample districts are shown for context but are noisy.</li>
            <li><strong>Floor area:</strong> price per square metre uses the floor area recorded by ASPC and is only available for a subset of listings.</li>
            <li><strong>Refresh:</strong> run <code>npm run explainer</code> to fetch fresh data and rebuild this report.</li>
        </ul>
    </section>`;
}

function buildPriceBars(stats: DistrictStats[]): Array<{ label: string; value: number; detail: string; color: string; muted: boolean }> {
    const eligible = statWithMin(stats, 10).sort((a, b) => (b.medianSoldPrice12 as number) - (a.medianSoldPrice12 as number));
    const values = eligible.map((stat) => stat.medianSoldPrice12 as number);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return eligible.map((stat) => ({
        label: stat.outcode,
        value: stat.medianSoldPrice12 as number,
        detail: `${formatNumber(stat.soldCount12)} sales`,
        color: sequentialColor(stat.medianSoldPrice12, min, max),
        muted: stat.soldCount12 < 20
    }));
}

function buildPricePerSqmBars(stats: DistrictStats[]): Array<{ label: string; value: number; detail: string; color: string; muted: boolean }> {
    const eligible = stats
        .filter((stat) => stat.soldCount12 >= 10 && stat.medianSoldPricePerSqm12 !== null)
        .sort((a, b) => (b.medianSoldPricePerSqm12 as number) - (a.medianSoldPricePerSqm12 as number));
    const values = eligible.map((stat) => stat.medianSoldPricePerSqm12 as number);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return eligible.map((stat) => ({
        label: stat.outcode,
        value: stat.medianSoldPricePerSqm12 as number,
        detail: `${formatNumber(stat.soldCount12)} sales`,
        color: sequentialColor(stat.medianSoldPricePerSqm12, min, max),
        muted: stat.soldCount12 < 20
    }));
}

function buildUnderOfferBars(stats: DistrictStats[]): Array<{ label: string; value: number; detail: string; color: string; muted: boolean }> {
    const eligible = stats
        .filter((stat) => stat.activeCount >= 20 && stat.underOfferRate !== null)
        .sort((a, b) => (b.underOfferRate as number) - (a.underOfferRate as number));
    const values = eligible.map((stat) => stat.underOfferRate as number);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return eligible.map((stat) => ({
        label: stat.outcode,
        value: stat.underOfferRate as number,
        detail: `${formatNumber(stat.activeCount)} active listings`,
        color: sequentialColor(stat.underOfferRate, min, max),
        muted: stat.activeCount < 30
    }));
}

function buildMonthlyChartData(listings: AbListing[], now: Date): {
    labels: string[];
    monthly: ReturnType<typeof computeMonthlySeries>;
    city: ReturnType<typeof computeMonthlySeries>;
    shire: ReturnType<typeof computeMonthlySeries>;
} {
    const monthly = computeMonthlySeries(listings, now);
    const city = computeMonthlySeries(listings.filter((listing) => isCityOutcode(listing.outcode)), now);
    const shire = computeMonthlySeries(listings.filter((listing) => !isCityOutcode(listing.outcode)), now);
    return { labels: monthly.map((point) => point.label), monthly, city, shire };
}

function monthLookup(points: ReturnType<typeof computeMonthlySeries>): Map<string, number | null> {
    return new Map(points.map((point) => [point.month, point.rollingMedianPrice]));
}

function main(): void {
    const file = loadData();
    const now = parseDate(file.generatedAt) ?? new Date();
    const listings = file.listings;
    const active = activeListings(listings);
    const sold = listings.filter((listing) => listing.sold);
    const sold12 = soldBetween(listings, monthsAgo(now, 12), now);
    const overview = computeOverview(listings, now);
    const stats = computeDistrictStats(listings, now);
    const monthlyData = buildMonthlyChartData(listings, now);
    const cityLookup = monthLookup(monthlyData.city);
    const shireLookup = monthLookup(monthlyData.shire);
    const typeMix = computeTypeMix(sold12);
    const kindMix = computeKindMix(sold12);
    const bedroomBoxes = computeBedroomBoxes(sold12).filter((box) => box.count >= 10);
    const priceHistogram = computeHistogram(sold12.map((listing) => listing.price).filter((value): value is number => value !== null && value > 0), 12);
    const priceSizePoints = sample(computePriceSizePoints(sold12), 1400);

    const activeMapPoints: MapPoint[] = active
        .filter((listing) => listing.lat !== null && listing.lng !== null && listing.price !== null)
        .map((listing) => ({
            lat: listing.lat as number,
            lng: listing.lng as number,
            colorValue: listing.price,
            sizeValue: listing.floorArea,
            label: listing.address,
            detail: `${listing.address} (${listing.outcode}) — ${formatMoney(listing.price)}; ${formatNumber(listing.bedrooms)} bed ${listing.propertyKind.toLowerCase()}${listing.floorArea ? `; ${formatNumber(listing.floorArea)} m²` : ''}${listing.underOffer ? '; under offer' : ''}`
        }));

    const districtMapPoints: MapPoint[] = stats
        .filter((stat) => stat.lat !== null && stat.lng !== null && stat.medianSoldPrice12 !== null)
        .map((stat) => ({
            lat: stat.lat as number,
            lng: stat.lng as number,
            colorValue: stat.medianSoldPrice12,
            sizeValue: stat.soldCount12,
            label: stat.outcode,
            detail: `${stat.outcode} — median sold ${formatMoney(stat.medianSoldPrice12)}; ${formatNumber(stat.soldCount12)} sales; ${formatNumber(stat.activeCount)} active; ${formatPct(stat.underOfferRate)} under offer`
        }));

    const districtLabels: MapLabel[] = stats
        .filter((stat) => stat.lat !== null && stat.lng !== null && stat.soldCount12 > 0)
        .map((stat) => ({
            label: stat.outcode,
            lat: stat.lat as number,
            lng: stat.lng as number,
            detail: `${stat.outcode}: ${formatNumber(stat.soldCount12)} sales`
        }));

    const priceBars = buildPriceBars(stats);
    const pricePerSqmBars = buildPricePerSqmBars(stats);
    const underOfferBars = buildUnderOfferBars(stats);
    const medianPrices = monthlyData.monthly.map((point) => point.medianPrice);
    const rollingPrices = monthlyData.monthly.map((point) => point.rollingMedianPrice);
    const priceYMin = Math.min(...[...medianPrices, ...rollingPrices].filter((value): value is number => value !== null)) * 0.95;
    const priceYMax = Math.max(...[...medianPrices, ...rollingPrices].filter((value): value is number => value !== null)) * 1.05;

    const cityPoints = monthlyData.labels.map((label, index) => {
        const point = monthlyData.city.find((candidate) => candidate.label === label);
        return {
            x: index,
            y: point?.rollingMedianPrice ?? null,
            label,
            detail: point ? `${formatNumber(point.rollingSoldCount)} sales in trailing 3 months` : undefined
        };
    });
    const shirePoints = monthlyData.labels.map((label, index) => {
        const point = monthlyData.shire.find((candidate) => candidate.label === label);
        return {
            x: index,
            y: point?.rollingMedianPrice ?? null,
            label,
            detail: point ? `${formatNumber(point.rollingSoldCount)} sales in trailing 3 months` : undefined
        };
    });

    const overviewHtml = renderNarrative(overview, stats, active, sold12);
    const tableHtml = renderDistrictTable(stats);

    const activeMapSvg = mapChart({
        title: 'Active AB listings by price and floor area',
        points: activeMapPoints,
        width: 960,
        height: 560,
        colorLabel: 'Asking price',
        colorFormat: formatPrice,
        sizeLabel: 'Floor area (m²)',
        pointRadius: 4
    });

    const districtMapSvg = mapChart({
        title: 'Median sold price by AB postcode district',
        points: districtMapPoints,
        labels: districtLabels,
        width: 960,
        height: 560,
        colorLabel: 'Median sold price',
        colorFormat: formatPrice,
        sizeLabel: 'Sales (12m)'
    });

    const priceSvg = horizontalBarChart({
        title: 'Median sold price by district',
        data: priceBars,
        width: 960,
        valueFormat: formatPrice,
        xLabel: 'Median sold price (last 12 months)',
        maxValue: Math.max(...priceBars.map((bar) => bar.value)) * 1.05
    });

    const pricePerSqmSvg = horizontalBarChart({
        title: 'Median sold price per square metre by district',
        data: pricePerSqmBars,
        width: 960,
        valueFormat: formatPrice,
        xLabel: 'Median £ per m² (last 12 months)',
        maxValue: Math.max(...pricePerSqmBars.map((bar) => bar.value)) * 1.05
    });

    const underOfferSvg = horizontalBarChart({
        title: 'Under-offer rate by district',
        data: underOfferBars,
        width: 960,
        valueFormat: (value) => formatPct(value),
        xLabel: 'Share of active listings under offer',
        maxValue: 100
    });

    const trendSvg = lineChart({
        title: 'Median sold price over time',
        series: [
            {
                name: 'Monthly median',
                color: '#94a3b8',
                dashed: true,
                points: monthlyData.monthly.map((point, index) => ({
                    x: index,
                    y: point.medianPrice,
                    label: point.label,
                    detail: `${formatNumber(point.soldCount)} sales`
                }))
            },
            {
                name: '3-month rolling median',
                color: '#1d4ed8',
                points: monthlyData.monthly.map((point, index) => ({
                    x: index,
                    y: point.rollingMedianPrice,
                    label: point.label,
                    detail: `${formatNumber(point.rollingSoldCount)} sales in trailing 3 months`
                }))
            }
        ],
        width: 960,
        height: 340,
        xLabels: monthlyData.labels,
        yFormat: formatPrice,
        yMin: priceYMin,
        yMax: priceYMax,
        yLabel: 'Median sold price'
    });

    const volumeSvg = verticalBarChart({
        title: 'Monthly sold listings',
        data: monthlyData.monthly.map((point) => ({
            label: point.label,
            value: point.soldCount,
            detail: `median ${formatMoney(point.medianPrice)}`
        })),
        width: 960,
        height: 300,
        valueFormat: formatNumber,
        yLabel: 'Sales',
        color: '#93c5fd'
    });

    const cityShireSvg = lineChart({
        title: 'City vs shire: rolling median sold price',
        series: [
            {
                name: 'Aberdeen City (AB10–AB25)',
                color: HOUSE_COLOR,
                points: cityPoints
            },
            {
                name: 'Aberdeenshire / rural (AB30+)',
                color: '#0f766e',
                points: shirePoints
            }
        ],
        width: 960,
        height: 340,
        xLabels: monthlyData.labels,
        yFormat: formatPrice,
        yLabel: '3-month rolling median sold price'
    });

    const typeDonutSvg = donutChart({
        title: 'Sold listings by property type',
        segments: typeMix.map((entry) => ({
            label: entry.label,
            value: entry.count,
            color: typeColor(entry.label)
        })),
        width: 560,
        height: 300,
        centerLabel: 'sales'
    });

    const kindDonutSvg = donutChart({
        title: 'Sold listings by property kind',
        segments: kindMix.map((entry) => ({
            label: entry.label,
            value: entry.count,
            color: kindColor(entry.label)
        })),
        width: 560,
        height: 300,
        centerLabel: 'sales'
    });

    const boxSvg = boxPlotChart({
        title: 'Sold price distribution by number of bedrooms',
        boxes: bedroomBoxes,
        width: 960,
        height: 340,
        valueFormat: formatPrice
    });

    const histogramSvg = histogramChart({
        title: 'Distribution of sold prices',
        bins: priceHistogram,
        width: 960,
        height: 300,
        color: '#2563eb'
    });

    const scatterSvg = scatterChart({
        title: 'Sold price vs floor area',
        points: priceSizePoints,
        width: 960,
        height: 360,
        xLabel: 'Floor area (m²)',
        yLabel: 'Sold price'
    });

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AB postcode property market explainer</title>
<style>
    :root {
        color-scheme: light;
        --ink: #111827;
        --muted: #6b7280;
        --line: #e5e7eb;
        --panel: #ffffff;
        --bg: #f6f7f9;
        --blue: #1d4ed8;
        --green: #15803d;
        --red: #b91c1c;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 28px 18px 64px; }
    .hero { background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 62%, #0f766e 100%); color: #fff; border-radius: 18px; padding: 34px 34px 28px; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18); }
    .hero h1 { margin: 4px 0 10px; font-size: clamp(28px, 4vw, 46px); line-height: 1.08; letter-spacing: -0.03em; }
    .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: 0.14em; font-size: 11px; font-weight: 700; color: #bfdbfe; }
    .lede { margin: 0; max-width: 820px; font-size: 17px; color: #dbeafe; }
    .meta { margin: 16px 0 0; font-size: 12px; color: #bfdbfe; }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0 8px; }
    .kpi { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
    .kpi-label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
    .kpi-value { display: block; margin: 5px 0 2px; font-size: 25px; font-weight: 800; letter-spacing: -0.02em; }
    .kpi-note { display: block; font-size: 11px; color: var(--muted); }
    section { margin-top: 22px; }
    .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 20px 22px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); overflow: hidden; }
    .panel h2 { margin: 0 0 6px; font-size: 20px; letter-spacing: -0.01em; }
    .panel h3 { margin: 18px 0 4px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
    .panel p { margin: 8px 0; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
    .chart svg { display: block; width: 100%; height: auto; }
    .chart-title { margin: 0 0 8px; font-size: 14px; font-weight: 700; }
    .chart-note { margin: 4px 0 0; font-size: 11px; color: var(--muted); }
    .small { font-size: 11px; color: var(--muted); }
    .table-wrap { overflow-x: auto; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 760px; }
    th, td { padding: 7px 8px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); background: #f8fafc; position: sticky; top: 0; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    tr.low-sample { color: #9ca3af; }
    .positive { color: var(--green); font-weight: 600; }
    .negative { color: var(--red); font-weight: 600; }
    .method ul { margin: 8px 0 0; padding-left: 20px; }
    .method li { margin: 7px 0; font-size: 13px; }
    code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 0.92em; }
    footer { margin-top: 26px; font-size: 11px; color: var(--muted); text-align: center; }
    @media (max-width: 900px) {
        .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid-2, .grid-3 { grid-template-columns: 1fr; }
        .hero { padding: 26px 22px; }
    }
    @media print {
        body { background: #fff; }
        .hero { box-shadow: none; }
        .panel, .kpi { box-shadow: none; break-inside: avoid; }
    }
</style>
</head>
<body>
<div class="wrap">
    <header class="hero">
        <p class="eyebrow">ASPC data · AB postcodes</p>
        <h1>Aberdeen property market explainer</h1>
        <p class="lede">What ${escapeHtml(formatNumber(active.length))} homes currently for sale and ${escapeHtml(formatNumber(sold12.length))} recent sales say about prices, stock and demand across Aberdeen City and Aberdeenshire.</p>
        <p class="meta">Generated ${escapeHtml(file.generatedAt)} · Source: ${escapeHtml(file.source)} · Sold window: last ${escapeHtml(formatNumber(file.closedWindowDays))} days</p>
    </header>

    <section class="kpis">
        ${renderKpi('Active listings', formatNumber(overview.activeCount), 'homes currently advertised')}
        ${renderKpi('Median asking price', formatMoney(overview.medianActivePrice), 'active listings')}
        ${renderKpi('Median sold price', formatMoney(overview.medianSoldPrice12), 'last 12 months')}
        ${renderKpi('6-month change', formatSignedPct(overview.sixMonthChangePct), 'median sold price')}
        ${renderKpi('Under offer', formatPct(overview.underOfferRate), `${formatNumber(overview.underOfferCount)} active listings`)}
        ${renderKpi('Median £/m²', formatMoney(overview.medianSoldPricePerSqm12), 'sold, last 12 months')}
        ${renderKpi('Median £/bedroom', formatMoney(overview.medianSoldPricePerBedroom12), 'sold, last 12 months')}
        ${renderKpi('Sales recorded', formatNumber(overview.soldCount12), 'last 12 months')}
    </section>

    <section class="panel">
        <h2>What the data says</h2>
        ${overviewHtml}
    </section>

    <section class="panel">
        <h2>Where the market is</h2>
        <p>The first map shows every active AB listing with a price and coordinates, coloured by asking price and sized by floor area. The second rolls listings up to postcode districts and colours each district by its median sold price over the last 12 months.</p>
        <div class="chart">
            <h3>Active listings</h3>
            ${activeMapSvg}
            ${renderMapLegendNote()}
        </div>
        <div class="chart">
            <h3>District medians</h3>
            ${districtMapSvg}
            ${renderMapLegendNote()}
        </div>
    </section>

    <section class="panel">
        <h2>Prices across AB districts</h2>
        <p>Median sold prices vary widely between districts. Bars in grey are based on fewer than 20 sales and should be treated as indicative.</p>
        <div class="chart">
            <h3>Median sold price</h3>
            ${priceSvg}
        </div>
        <div class="chart">
            <h3>Median price per square metre</h3>
            ${pricePerSqmSvg}
            <p class="chart-note">Floor area is only recorded for a subset of listings, so this chart covers fewer sales than the price chart.</p>
        </div>
    </section>

    <section class="panel">
        <h2>Price trends over time</h2>
        <p>The monthly median is noisy because it reflects the mix of homes sold in each month. The three-month rolling median smooths that noise and is the better guide to direction.</p>
        <div class="chart">
            <h3>Overall median sold price</h3>
            ${trendSvg}
        </div>
        <div class="chart">
            <h3>Monthly sales volume</h3>
            ${volumeSvg}
        </div>
        <div class="chart">
            <h3>City vs shire</h3>
            ${cityShireSvg}
            <p class="chart-note">Aberdeen City is defined here as AB10–AB25. The shire series covers AB30 and higher, including Aberdeenshire towns and rural areas.</p>
        </div>
    </section>

    <section class="panel">
        <h2>What is selling</h2>
        <div class="grid-2">
            <div class="chart">
                <h3>Property type</h3>
                ${typeDonutSvg}
            </div>
            <div class="chart">
                <h3>Property kind</h3>
                ${kindDonutSvg}
            </div>
        </div>
        <div class="chart">
            <h3>Under-offer rate by district</h3>
            ${underOfferSvg}
            <p class="chart-note">Only districts with at least 20 active listings are shown.</p>
        </div>
    </section>

    <section class="panel">
        <h2>Price, bedrooms and floor area</h2>
        <div class="chart">
            <h3>Sold price by number of bedrooms</h3>
            ${boxSvg}
            <p class="chart-note">Boxes show the interquartile range; the line is the median. Whiskers extend to the most extreme non-outlier values; dots are outliers.</p>
        </div>
        <div class="chart">
            <h3>Distribution of sold prices</h3>
            ${histogramSvg}
        </div>
        <div class="chart">
            <h3>Price vs floor area</h3>
            ${scatterSvg}
            <p class="chart-note">The dashed line is a simple linear fit. A sample of up to 1,400 sold listings is plotted for legibility.</p>
        </div>
    </section>

    <section class="panel">
        <h2>District detail</h2>
        ${tableHtml}
    </section>

    ${renderMethodNote(file, overview)}

    <footer>Generated from ASPC data by the realescrape AB explainer. Prices are advertised prices, not guaranteed achieved prices.</footer>
</div>
</body>
</html>`;

    mkdirSync('explainer/output', { recursive: true });
    writeFileSync(OUTPUT_FILE, html);
    console.log(`Wrote ${OUTPUT_FILE}.`);
}

function kindColor(label: string): string {
    switch (label) {
        case 'Detached house': return '#1d4ed8';
        case 'Semi-detached house': return '#3b82f6';
        case 'Terraced house': return '#93c5fd';
        case 'Flat': return FLAT_COLOR;
        default: return OTHER_COLOR;
    }
}

main();
