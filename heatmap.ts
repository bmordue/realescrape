import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

interface PropertyResult {
    address: string;
    bedrooms?: number;
    priceDescription: string;
}

interface AreaAggregate {
    postcodeArea: string;
    propertyCount: number;
    averagePropertyPrice: number;
    averagePricePerBedroom: number | null;
}

interface ChangeMetric {
    baselineDate: string;
    baselineAveragePropertyPrice: number | null;
    baselineAveragePricePerBedroom: number | null;
    averagePropertyPriceChange: number | null;
    averagePropertyPriceChangePct: number | null;
    averagePricePerBedroomChange: number | null;
    averagePricePerBedroomChangePct: number | null;
}

interface HeatmapArea extends AreaAggregate {
    changes: Record<string, ChangeMetric>;
}

interface MutableAreaState {
    priceSum: number;
    listingCount: number;
    pricePerBedroomSum: number;
    bedroomsCount: number;
}

const RESULT_FILES = [
    'results-sspc-House.json',
    'results-sspc-Flat.json',
    'results-sspc-Bungalow.json'
];

const CHANGE_WINDOWS = [
    { key: '6m', months: 6 },
    { key: '1y', months: 12 },
    { key: '5y', months: 60 },
    { key: '10y', months: 120 }
];

function parsePrice(priceDescription: string): number | null {
    const digits = priceDescription.replace(/[^\d]/g, '');
    if (!digits) {
        return null;
    }

    const price = Number.parseInt(digits, 10);
    return Number.isFinite(price) ? price : null;
}

function extractPostcode(address: string): string | null {
    // Matches UK postcodes such as "AB12 3CD" and "G1 2AB" at end of address strings.
    const match = address.toUpperCase().match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/);
    if (!match) {
        return null;
    }

    return match[1].replace(/\s+/, ' ');
}

function postcodeAreaFromAddress(address: string): string | null {
    const postcode = extractPostcode(address);
    if (!postcode) {
        return null;
    }

    const areaMatch = postcode.match(/^[A-Z]{1,2}/);
    return areaMatch ? areaMatch[0] : null;
}

function calculateAreaAverages(properties: PropertyResult[]): Map<string, AreaAggregate> {
    const areaStats = new Map<string, MutableAreaState>();

    for (const property of properties) {
        const area = postcodeAreaFromAddress(property.address);
        const price = parsePrice(property.priceDescription);

        if (!area || price === null) {
            continue;
        }

        const stats = areaStats.get(area) ?? {
            priceSum: 0,
            listingCount: 0,
            pricePerBedroomSum: 0,
            bedroomsCount: 0
        };

        stats.priceSum += price;
        stats.listingCount += 1;

        if (property.bedrooms && property.bedrooms > 0) {
            stats.pricePerBedroomSum += price / property.bedrooms;
            stats.bedroomsCount += 1;
        }

        areaStats.set(area, stats);
    }

    const averages = new Map<string, AreaAggregate>();
    for (const [area, stats] of areaStats.entries()) {
        averages.set(area, {
            postcodeArea: area,
            propertyCount: stats.listingCount,
            averagePropertyPrice: roundToNearestPound(stats.priceSum / stats.listingCount),
            averagePricePerBedroom: stats.bedroomsCount > 0
                ? roundToNearestPound(stats.pricePerBedroomSum / stats.bedroomsCount)
                : null
        });
    }

    return averages;
}

function roundToNearestPound(value: number): number {
    return Math.round(value);
}

function subtractMonths(date: Date, months: number): Date {
    const target = new Date(date);
    target.setMonth(target.getMonth() - months);
    return target;
}

function readCurrentResults(): PropertyResult[] {
    return RESULT_FILES.flatMap((fileName) => {
        const raw = readFileSync(fileName, { encoding: 'utf-8' });
        return JSON.parse(raw) as PropertyResult[];
    });
}

function gitOutput(command: string): string {
    return execSync(command, { cwd: process.cwd(), encoding: 'utf-8' }).trim();
}

function getCommitForDate(targetDate: Date): string | null {
    const before = targetDate.toISOString();
    const files = RESULT_FILES.join(' ');

    try {
        const commit = gitOutput(`git rev-list -1 --before="${before}" HEAD -- ${files}`);
        return commit || null;
    } catch {
        return null;
    }
}

function readResultsFromCommit(commitSha: string): PropertyResult[] {
    return RESULT_FILES.flatMap((fileName) => {
        try {
            const fileContent = gitOutput(`git show ${commitSha}:${fileName}`);
            return JSON.parse(fileContent) as PropertyResult[];
        } catch {
            return [];
        }
    });
}

function calculateChange(current: number | null, baseline: number | null): { absolute: number | null; pct: number | null } {
    if (current === null || baseline === null || baseline === 0) {
        return { absolute: null, pct: null };
    }

    const absolute = roundToNearestPound(current - baseline);
    const pct = Number((((current - baseline) / baseline) * 100).toFixed(2));

    return { absolute, pct };
}

function buildHeatmapData(): { generatedAt: string; areas: HeatmapArea[] } {
    const now = new Date();
    const currentAverages = calculateAreaAverages(readCurrentResults());
    const allAreas = new Set(currentAverages.keys());

    const historicalByWindow = new Map<string, { baselineDate: string; averages: Map<string, AreaAggregate> }>();

    for (const window of CHANGE_WINDOWS) {
        const baselineDate = subtractMonths(now, window.months);
        const commitSha = getCommitForDate(baselineDate);

        if (!commitSha) {
            historicalByWindow.set(window.key, {
                baselineDate: baselineDate.toISOString().slice(0, 10),
                averages: new Map<string, AreaAggregate>()
            });
            continue;
        }

        const historicalResults = readResultsFromCommit(commitSha);
        const averages = calculateAreaAverages(historicalResults);
        for (const area of averages.keys()) {
            allAreas.add(area);
        }

        historicalByWindow.set(window.key, {
            baselineDate: baselineDate.toISOString().slice(0, 10),
            averages
        });
    }

    const areas: HeatmapArea[] = Array.from(allAreas)
        .sort((a, b) => a.localeCompare(b))
        .map((area) => {
            const current = currentAverages.get(area);
            const changes = Object.fromEntries(CHANGE_WINDOWS.map((window) => {
                const history = historicalByWindow.get(window.key);
                const baseline = history?.averages.get(area);

                const priceChange = calculateChange(
                    current?.averagePropertyPrice ?? null,
                    baseline?.averagePropertyPrice ?? null
                );
                const pricePerBedroomChange = calculateChange(
                    current?.averagePricePerBedroom ?? null,
                    baseline?.averagePricePerBedroom ?? null
                );

                const metric: ChangeMetric = {
                    baselineDate: history?.baselineDate ?? subtractMonths(now, window.months).toISOString().slice(0, 10),
                    baselineAveragePropertyPrice: baseline?.averagePropertyPrice ?? null,
                    baselineAveragePricePerBedroom: baseline?.averagePricePerBedroom ?? null,
                    averagePropertyPriceChange: priceChange.absolute,
                    averagePropertyPriceChangePct: priceChange.pct,
                    averagePricePerBedroomChange: pricePerBedroomChange.absolute,
                    averagePricePerBedroomChangePct: pricePerBedroomChange.pct
                };

                return [window.key, metric];
            }));

            return {
                postcodeArea: area,
                propertyCount: current?.propertyCount ?? 0,
                averagePropertyPrice: current?.averagePropertyPrice ?? 0,
                averagePricePerBedroom: current?.averagePricePerBedroom ?? null,
                changes
            };
        });

    return {
        generatedAt: now.toISOString(),
        areas
    };
}

function main() {
    const heatmapData = buildHeatmapData();
    const outputFile = 'heatmap-postcode-areas-scotland.json';
    writeFileSync(outputFile, JSON.stringify(heatmapData, null, 2));
    console.log(`Wrote ${heatmapData.areas.length} postcode areas to ${outputFile}.`);
}

main();
