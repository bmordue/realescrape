import { mkdirSync, readFileSync, writeFileSync } from 'fs';

interface ChangeMetric {
    averagePropertyPriceChange: number | null;
    averagePropertyPriceChangePct: number | null;
}

interface HeatmapArea {
    postcodeArea: string;
    propertyCount: number;
    averagePropertyPrice: number;
    averagePricePerBedroom: number | null;
    changes: {
        '6m': ChangeMetric;
        '1y': ChangeMetric;
        '5y': ChangeMetric;
        '10y': ChangeMetric;
    };
}

interface HeatmapFile {
    generatedAt: string;
    areas: HeatmapArea[];
}

interface PlottableArea extends HeatmapArea {
    lat: number;
    lng: number;
}

const AREA_CENTROIDS: Record<string, [number, number]> = {
    AB: [57.15, -2.09],
    DD: [56.46, -2.97],
    DG: [55.07, -3.61],
    EH: [55.95, -3.19],
    FK: [56.12, -3.94],
    G: [55.86, -4.25],
    IV: [57.48, -4.23],
    KA: [55.61, -4.50],
    KY: [56.12, -3.16],
    ML: [55.78, -3.99],
    PA: [55.85, -4.42],
    PH: [56.39, -3.44],
    TD: [55.62, -2.81]
};

function numberRange(values: number[]): { min: number; max: number } {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return {
        min: Number.isFinite(min) ? min : 0,
        max: Number.isFinite(max) ? max : 0
    };
}

function colorForValue(value: number, min: number, max: number): string {
    if (max <= min) {
        return '#3182bd';
    }

    const normalised = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const red = Math.round(20 + (235 * normalised));
    const green = Math.round(120 - (80 * normalised));
    const blue = Math.round(210 - (140 * normalised));

    return `rgb(${red}, ${green}, ${blue})`;
}

function colorForDivergingValue(value: number, min: number, max: number): string {
    // Diverging scale: red (negative) → white (zero) → green (positive)
    const absMax = Math.max(Math.abs(min), Math.abs(max));
    if (absMax === 0) {
        return '#f5f5f5';
    }

    const clamped = Math.max(-absMax, Math.min(absMax, value));
    const normalised = clamped / absMax; // -1 to +1

    if (normalised < 0) {
        // Red side: white → red as normalised goes 0 → -1
        const t = -normalised;
        const red = Math.round(255);
        const green = Math.round(255 - (200 * t));
        const blue = Math.round(255 - (200 * t));
        return `rgb(${red}, ${green}, ${blue})`;
    } else {
        // Green side: white → green as normalised goes 0 → +1
        const t = normalised;
        const red = Math.round(255 - (200 * t));
        const green = Math.round(200 + (30 * t));
        const blue = Math.round(255 - (220 * t));
        return `rgb(${red}, ${green}, ${blue})`;
    }
}

function formatPrice(value: number): string {
    if (value >= 1000000) {
        return `£${(value / 1000000).toFixed(1)}m`;
    }
    if (value >= 1000) {
        return `£${Math.round(value / 1000)}k`;
    }
    return `£${value}`;
}

function buildColorLegend(
    min: number,
    max: number,
    colorFn: (value: number, min: number, max: number) => string,
    formatFn: (value: number) => string,
    isDiverging = false
): string {
    const legendWidth = 200;
    const legendHeight = 14;
    const steps = 20;
    const swatchWidth = legendWidth / steps;
    const swatches: string[] = [];

    for (let i = 0; i < steps; i++) {
        const value = isDiverging
            ? min + ((max - min) * (i / (steps - 1)))
            : min + ((max - min) * (i / (steps - 1)));
        const x = i * swatchWidth;
        swatches.push(
            `<rect x="${x.toFixed(1)}" y="0" width="${(swatchWidth + 0.5).toFixed(1)}" height="${legendHeight}" fill="${colorFn(value, min, max)}" />`
        );
    }

    const minLabel = formatFn(min);
    const maxLabel = formatFn(max);
    const midLabel = isDiverging ? formatFn(0) : formatFn((min + max) / 2);
    const midX = legendWidth / 2;

    return `
    <g transform="translate(470, 520)">
      ${swatches.join('')}
      <rect x="0" y="0" width="${legendWidth}" height="${legendHeight}" fill="none" stroke="#9ca3af" stroke-width="0.5"/>
      <text x="0" y="${legendHeight + 11}" text-anchor="start" font-size="10" fill="#374151">${escapeForHtml(minLabel)}</text>
      <text x="${midX.toFixed(1)}" y="${legendHeight + 11}" text-anchor="middle" font-size="10" fill="#374151">${escapeForHtml(midLabel)}</text>
      <text x="${legendWidth}" y="${legendHeight + 11}" text-anchor="end" font-size="10" fill="#374151">${escapeForHtml(maxLabel)}</text>
    </g>`;
}

function escapeForHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function projectToSvg(lat: number, lng: number, width: number, height: number): { x: number; y: number } {
    const minLng = -8.0;
    const maxLng = -1.0;
    const minLat = 54.4;
    const maxLat = 58.8;

    const x = ((lng - minLng) / (maxLng - minLng)) * width;
    const y = height - (((lat - minLat) / (maxLat - minLat)) * height);

    return {
        x: Math.max(0, Math.min(width, x)),
        y: Math.max(0, Math.min(height, y))
    };
}

function buildMapSvg(
    areas: PlottableArea[],
    title: string,
    fillForArea: (area: PlottableArea) => string,
    radiusForArea: (area: PlottableArea) => number,
    subtitleForArea: (area: PlottableArea) => string,
    legend = ''
): string {
    const width = 680;
    const height = 560;

    const circles = areas.map((area) => {
        const point = projectToSvg(area.lat, area.lng, width, height);
        const radius = radiusForArea(area);
        const summary = subtitleForArea(area);

        return `
      <g>
        <title>${escapeForHtml(`${area.postcodeArea}: ${summary}`)}</title>
        <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${fillForArea(area)}" fill-opacity="0.85" stroke="#1f2937" stroke-width="1" />
        <text x="${point.x.toFixed(1)}" y="${(point.y + 4).toFixed(1)}" text-anchor="middle" fill="#111827" font-size="11" font-weight="700">${escapeForHtml(area.postcodeArea)}</text>
      </g>`;
    }).join('');

    return `
    <section class="panel">
      <h2>${escapeForHtml(title)}</h2>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeForHtml(title)}">
        <rect x="0" y="0" width="${width}" height="${height}" fill="#f8fafc" />
        ${circles}
        ${legend}
      </svg>
    </section>`;
}

function buildHtml(data: HeatmapFile): string {
    const areas: PlottableArea[] = data.areas
        .filter((area) => AREA_CENTROIDS[area.postcodeArea])
        .map((area) => {
            const [lat, lng] = AREA_CENTROIDS[area.postcodeArea];
            return { ...area, lat, lng };
        });

    const prices = areas.map((area) => area.averagePropertyPrice);
    const counts = areas.map((area) => area.propertyCount);
    const pricesPerBedroom = areas
        .map((area) => area.averagePricePerBedroom)
        .filter((value): value is number => value !== null);
    const deltas1y = areas
        .map((area) => area.changes['1y'].averagePropertyPriceChangePct)
        .filter((value): value is number => value !== null);

    const priceRange = numberRange(prices);
    const countRange = numberRange(counts);
    const pricePerBedroomRange = numberRange(pricesPerBedroom);
    const deltaRange = numberRange(deltas1y);

    const priceLegend = buildColorLegend(priceRange.min, priceRange.max, colorForValue, formatPrice);
    const pricePerBedroomLegend = pricesPerBedroom.length > 0
        ? buildColorLegend(pricePerBedroomRange.min, pricePerBedroomRange.max, colorForValue, formatPrice)
        : '';
    const changeLegend = deltas1y.length > 0
        ? buildColorLegend(deltaRange.min, deltaRange.max, colorForDivergingValue, (v) => `${v.toFixed(1)}%`, true)
        : '';

    const priceSvg = buildMapSvg(
        areas,
        'Average Property Price (colour) + Listing Count (radius)',
        (area) => colorForValue(area.averagePropertyPrice, priceRange.min, priceRange.max),
        (area) => 10 + (countRange.max > countRange.min
            ? ((area.propertyCount - countRange.min) / (countRange.max - countRange.min)) * 22
            : 12),
        (area) => `Avg price ${formatPrice(area.averagePropertyPrice)} | Listings ${area.propertyCount}`,
        priceLegend
    );

    const pricePerBedroomSvg = buildMapSvg(
        areas.filter((area) => area.averagePricePerBedroom !== null),
        'Average Price Per Bedroom',
        (area) => area.averagePricePerBedroom !== null
            ? colorForValue(area.averagePricePerBedroom, pricePerBedroomRange.min, pricePerBedroomRange.max)
            : '#9ca3af',
        () => 14,
        (area) => area.averagePricePerBedroom !== null
            ? `${formatPrice(area.averagePricePerBedroom)} / bedroom`
            : 'n/a',
        pricePerBedroomLegend
    );

    const changeSvg = buildMapSvg(
        areas,
        'Average Property Price Change (1 year %)',
        (area) => {
            const delta = area.changes['1y'].averagePropertyPriceChangePct;
            if (delta === null) {
                return '#9ca3af';
            }
            return colorForDivergingValue(delta, deltaRange.min, deltaRange.max);
        },
        () => 14,
        (area) => {
            const delta = area.changes['1y'].averagePropertyPriceChangePct;
            const abs = area.changes['1y'].averagePropertyPriceChange;
            if (delta === null) {
                return '1y change n/a';
            }
            const absStr = abs !== null ? ` (${abs >= 0 ? '+' : ''}${formatPrice(abs)})` : '';
            return `1y change ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%${absStr}`;
        },
        changeLegend
    );

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scotland Postcode Area Heatmaps</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #fafafa; color: #1f2937; }
    h1 { margin: 0; padding: 12px 16px 4px; font-size: 20px; }
    p  { margin: 0; padding: 0 16px 10px; color: #4b5563; font-size: 14px; }
    .maps { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 0 12px 12px; }
    .panel { background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .panel h2 { margin: 0; font-size: 14px; padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e5e7eb; }
    svg { display: block; width: 100%; height: auto; }
    @media (max-width: 1100px) { .maps { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>Scotland Postcode Area Heatmaps</h1>
  <p>Generated ${escapeForHtml(data.generatedAt)} from current SSPC data and git baselines.</p>
  <div class="maps">${priceSvg}${pricePerBedroomSvg}${changeSvg}</div>
</body>
</html>`;
}

function main() {
    const data = JSON.parse(readFileSync('heatmap/data/postcode-areas-scotland.json', 'utf-8')) as HeatmapFile;
    mkdirSync('heatmap/output', { recursive: true });
    const html = buildHtml(data);
    writeFileSync('heatmap/output/scotland-postcode-heatmap.html', html);
    console.log('Wrote heatmap/output/scotland-postcode-heatmap.html.');
}

main();
