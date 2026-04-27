import { mkdirSync, readFileSync, writeFileSync } from 'fs';

interface ChangeMetric {
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
    subtitleForArea: (area: PlottableArea) => string
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
    const deltas1y = areas
        .map((area) => area.changes['1y'].averagePropertyPriceChangePct)
        .filter((value): value is number => value !== null);

    const priceRange = numberRange(prices);
    const countRange = numberRange(counts);
    const deltaRange = numberRange(deltas1y);

    const priceSvg = buildMapSvg(
        areas,
        'Average Property Price (colour) + Listing Count (radius)',
        (area) => colorForValue(area.averagePropertyPrice, priceRange.min, priceRange.max),
        (area) => 10 + (countRange.max > countRange.min
            ? ((area.propertyCount - countRange.min) / (countRange.max - countRange.min)) * 22
            : 12),
        (area) => `Avg price £${area.averagePropertyPrice.toLocaleString()} | Listings ${area.propertyCount}`
    );

    const changeSvg = buildMapSvg(
        areas,
        'Average Property Price Change (1 year %)',
        (area) => {
            const delta = area.changes['1y'].averagePropertyPriceChangePct;
            if (delta === null) {
                return '#9ca3af';
            }
            return colorForValue(delta, deltaRange.min, deltaRange.max);
        },
        () => 14,
        (area) => {
            const delta = area.changes['1y'].averagePropertyPriceChangePct;
            return delta === null
                ? '1y change n/a'
                : `1y change ${delta.toFixed(2)}%`;
        }
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
  <div class="maps">${priceSvg}${changeSvg}</div>
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
