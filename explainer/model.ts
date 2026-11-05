import { AbListing } from './types';

export interface Overview {
    generatedAt: Date;
    earliestSold: Date | null;
    latestSold: Date | null;
    activeCount: number;
    soldCount12: number;
    soldCountLast6: number;
    soldCountPrev6: number;
    underOfferCount: number;
    underOfferRate: number | null;
    medianActivePrice: number | null;
    medianSoldPrice12: number | null;
    medianSoldPriceLast6: number | null;
    medianSoldPricePrev6: number | null;
    sixMonthChangePct: number | null;
    medianSoldPricePerBedroom12: number | null;
    medianSoldPricePerSqm12: number | null;
    medianFloorArea12: number | null;
}

export interface DistrictStats {
    outcode: string;
    activeCount: number;
    soldCount12: number;
    soldCountLast6: number;
    soldCountPrev6: number;
    medianActivePrice: number | null;
    medianSoldPrice12: number | null;
    medianSoldPricePerBedroom12: number | null;
    medianSoldPricePerSqm12: number | null;
    medianSoldPriceLast6: number | null;
    medianSoldPricePrev6: number | null;
    sixMonthChangePct: number | null;
    underOfferRate: number | null;
    lat: number | null;
    lng: number | null;
    topKind: string | null;
    houseShare: number | null;
}

export interface MonthlyPoint {
    month: string;
    label: string;
    start: Date;
    end: Date;
    soldCount: number;
    medianPrice: number | null;
    medianPricePerSqm: number | null;
    rollingMedianPrice: number | null;
    rollingSoldCount: number;
}

export interface TypeMixEntry {
    label: string;
    count: number;
}

export interface BedroomBox {
    label: string;
    values: number[];
    count: number;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    lowerWhisker: number;
    upperWhisker: number;
    outliers: number[];
}

export interface HistogramBin {
    label: string;
    start: number;
    end: number;
    count: number;
}

export interface PriceSizePoint {
    area: number;
    price: number;
    label: string;
    kind: string;
    outcode: string;
}

export function parseDate(value: string | null | undefined): Date | null {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function monthsAgo(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() - months);
    return result;
}

export function median(values: number[]): number | null {
    return quantile(values, 0.5);
}

export function quantile(values: number[], q: number): number | null {
    const finite = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (finite.length === 0) {
        return null;
    }
    if (finite.length === 1) {
        return finite[0];
    }

    const position = (finite.length - 1) * Math.max(0, Math.min(1, q));
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) {
        return finite[lower];
    }

    const weight = position - lower;
    return finite[lower] * (1 - weight) + finite[upper] * weight;
}

function prices(listings: AbListing[]): number[] {
    return listings
        .map((listing) => listing.price)
        .filter((value): value is number => value !== null && value > 0);
}

function pricePerBedroom(listings: AbListing[]): number[] {
    return listings
        .filter((listing) => listing.price !== null && listing.price > 0 && listing.bedrooms !== null && listing.bedrooms > 0)
        .map((listing) => (listing.price as number) / (listing.bedrooms as number));
}

function pricePerSqm(listings: AbListing[]): number[] {
    return listings
        .filter((listing) => listing.price !== null && listing.price > 0 && listing.floorArea !== null && listing.floorArea > 0)
        .map((listing) => (listing.price as number) / (listing.floorArea as number));
}

function floorAreas(listings: AbListing[]): number[] {
    return listings
        .map((listing) => listing.floorArea)
        .filter((value): value is number => value !== null && value > 0);
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

function soldListings(listings: AbListing[]): AbListing[] {
    return listings.filter((listing) => listing.sold);
}

export function computeOverview(listings: AbListing[], generatedAt: Date): Overview {
    const active = activeListings(listings);
    const sold = soldListings(listings);
    const soldDates = sold
        .map((listing) => parseDate(listing.closedDate))
        .filter((date): date is Date => date !== null)
        .sort((a, b) => a.getTime() - b.getTime());

    const last6Start = monthsAgo(generatedAt, 6);
    const prev6Start = monthsAgo(generatedAt, 12);
    const last12Start = monthsAgo(generatedAt, 12);

    const soldLast6 = soldBetween(listings, last6Start, generatedAt);
    const soldPrev6 = soldBetween(listings, prev6Start, last6Start);
    const sold12 = soldBetween(listings, last12Start, generatedAt);

    const medianSoldPrice12 = median(prices(sold12));
    const medianSoldPriceLast6 = median(prices(soldLast6));
    const medianSoldPricePrev6 = median(prices(soldPrev6));
    const sixMonthChangePct = medianSoldPriceLast6 !== null && medianSoldPricePrev6 !== null && medianSoldPricePrev6 !== 0
        ? ((medianSoldPriceLast6 - medianSoldPricePrev6) / medianSoldPricePrev6) * 100
        : null;

    return {
        generatedAt,
        earliestSold: soldDates[0] ?? null,
        latestSold: soldDates[soldDates.length - 1] ?? null,
        activeCount: active.length,
        soldCount12: sold12.length,
        soldCountLast6: soldLast6.length,
        soldCountPrev6: soldPrev6.length,
        underOfferCount: active.filter((listing) => listing.underOffer).length,
        underOfferRate: active.length > 0 ? (active.filter((listing) => listing.underOffer).length / active.length) * 100 : null,
        medianActivePrice: median(prices(active)),
        medianSoldPrice12,
        medianSoldPriceLast6,
        medianSoldPricePrev6,
        sixMonthChangePct,
        medianSoldPricePerBedroom12: median(pricePerBedroom(sold12)),
        medianSoldPricePerSqm12: median(pricePerSqm(sold12)),
        medianFloorArea12: median(floorAreas(sold12))
    };
}

export function computeDistrictStats(listings: AbListing[], generatedAt: Date): DistrictStats[] {
    const last6Start = monthsAgo(generatedAt, 6);
    const prev6Start = monthsAgo(generatedAt, 12);
    const last12Start = monthsAgo(generatedAt, 12);
    const groups = new Map<string, AbListing[]>();

    for (const listing of listings) {
        const existing = groups.get(listing.outcode);
        if (existing) {
            existing.push(listing);
        } else {
            groups.set(listing.outcode, [listing]);
        }
    }

    const stats: DistrictStats[] = [];

    for (const [outcode, group] of groups.entries()) {
        const active = activeListings(group);
        const sold12 = soldBetween(group, last12Start, generatedAt);
        const soldLast6 = soldBetween(group, last6Start, generatedAt);
        const soldPrev6 = soldBetween(group, prev6Start, last6Start);
        const medianSoldPriceLast6 = median(prices(soldLast6));
        const medianSoldPricePrev6 = median(prices(soldPrev6));
        const sixMonthChangePct = medianSoldPriceLast6 !== null && medianSoldPricePrev6 !== null && medianSoldPricePrev6 !== 0
            ? ((medianSoldPriceLast6 - medianSoldPricePrev6) / medianSoldPricePrev6) * 100
            : null;
        const coordinates = group.filter((listing) => listing.lat !== null && listing.lng !== null);
        const kinds = new Map<string, number>();
        for (const listing of sold12) {
            kinds.set(listing.propertyKind, (kinds.get(listing.propertyKind) ?? 0) + 1);
        }
        const topKind = Array.from(kinds.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        const houseCount = sold12.filter((listing) => listing.propertyType === 'House').length;
        const flatCount = sold12.filter((listing) => listing.propertyType === 'Flat').length;

        stats.push({
            outcode,
            activeCount: active.length,
            soldCount12: sold12.length,
            soldCountLast6: soldLast6.length,
            soldCountPrev6: soldPrev6.length,
            medianActivePrice: median(prices(active)),
            medianSoldPrice12: median(prices(sold12)),
            medianSoldPricePerBedroom12: median(pricePerBedroom(sold12)),
            medianSoldPricePerSqm12: median(pricePerSqm(sold12)),
            medianSoldPriceLast6,
            medianSoldPricePrev6,
            sixMonthChangePct,
            underOfferRate: active.length > 0 ? (active.filter((listing) => listing.underOffer).length / active.length) * 100 : null,
            lat: median(coordinates.map((listing) => listing.lat as number)),
            lng: median(coordinates.map((listing) => listing.lng as number)),
            topKind,
            houseShare: houseCount + flatCount > 0 ? (houseCount / (houseCount + flatCount)) * 100 : null
        });
    }

    return stats.sort((a, b) => a.outcode.localeCompare(b.outcode));
}

export function formatMonth(date: Date): string {
    return date.toLocaleString('en-GB', { month: 'short', year: 'numeric' });
}

export function computeMonthlySeries(
    listings: AbListing[],
    generatedAt: Date,
    predicate: (listing: AbListing) => boolean = () => true
): MonthlyPoint[] {
    const sold = soldListings(listings).filter(predicate);
    const dates = sold
        .map((listing) => parseDate(listing.closedDate))
        .filter((date): date is Date => date !== null)
        .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length === 0) {
        return [];
    }

    const first = new Date(dates[0].getFullYear(), dates[0].getMonth(), 1);
    const last = new Date(generatedAt.getFullYear(), generatedAt.getMonth(), 1);
    const points: MonthlyPoint[] = [];

    for (let cursor = new Date(first); cursor <= last; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
        const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        const rollingStart = new Date(cursor.getFullYear(), cursor.getMonth() - 2, 1);
        const monthSales = soldBetween(sold, start, end);
        const rollingSales = soldBetween(sold, rollingStart, end);

        points.push({
            month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
            label: formatMonth(start),
            start,
            end,
            soldCount: monthSales.length,
            medianPrice: median(prices(monthSales)),
            medianPricePerSqm: median(pricePerSqm(monthSales)),
            rollingMedianPrice: median(prices(rollingSales)),
            rollingSoldCount: rollingSales.length
        });
    }

    return points;
}

export function computeTypeMix(listings: AbListing[]): TypeMixEntry[] {
    const counts = new Map<string, number>();
    for (const listing of listings) {
        const label = listing.propertyType;
        counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);
}

export function computeKindMix(listings: AbListing[]): TypeMixEntry[] {
    const counts = new Map<string, number>();
    for (const listing of listings) {
        counts.set(listing.propertyKind, (counts.get(listing.propertyKind) ?? 0) + 1);
    }
    return Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);
}

export function computeBedroomBoxes(listings: AbListing[]): BedroomBox[] {
    const groups = new Map<number, number[]>();
    for (const listing of listings) {
        if (listing.price === null || listing.price <= 0 || listing.bedrooms === null || listing.bedrooms <= 0) {
            continue;
        }
        const bucket = Math.min(listing.bedrooms, 6);
        const existing = groups.get(bucket);
        if (existing) {
            existing.push(listing.price);
        } else {
            groups.set(bucket, [listing.price]);
        }
    }

    const boxes: BedroomBox[] = [];
    for (const [bedrooms, values] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
        const sorted = values.slice().sort((a, b) => a - b);
        const q1 = quantile(sorted, 0.25) ?? 0;
        const med = quantile(sorted, 0.5) ?? 0;
        const q3 = quantile(sorted, 0.75) ?? 0;
        const iqr = q3 - q1;
        const lowerFence = q1 - 1.5 * iqr;
        const upperFence = q3 + 1.5 * iqr;
        const inliers = sorted.filter((value) => value >= lowerFence && value <= upperFence);
        const outliers = sorted.filter((value) => value < lowerFence || value > upperFence);

        boxes.push({
            label: bedrooms >= 6 ? '6+' : String(bedrooms),
            values: sorted,
            count: sorted.length,
            min: sorted[0],
            q1,
            median: med,
            q3,
            max: sorted[sorted.length - 1],
            lowerWhisker: inliers[0] ?? sorted[0],
            upperWhisker: inliers[inliers.length - 1] ?? sorted[sorted.length - 1],
            outliers
        });
    }

    return boxes;
}

export function computeHistogram(values: number[], binCount = 12): HistogramBin[] {
    const finite = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
    if (finite.length === 0) {
        return [];
    }

    const min = finite[0];
    const max = finite[finite.length - 1];
    const span = max - min || 1;
    const rawStep = span / binCount;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalised = rawStep / magnitude;
    const niceStep = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
    const start = Math.floor(min / niceStep) * niceStep;
    const bins: HistogramBin[] = [];

    for (let index = 0; index < binCount; index++) {
        const binStart = start + index * niceStep;
        const binEnd = binStart + niceStep;
        bins.push({
            label: `£${Math.round(binStart / 1000)}k–£${Math.round(binEnd / 1000)}k`,
            start: binStart,
            end: binEnd,
            count: finite.filter((value) => value >= binStart && (index === binCount - 1 ? value <= binEnd : value < binEnd)).length
        });
    }

    return bins;
}

export function computePriceSizePoints(listings: AbListing[]): PriceSizePoint[] {
    return listings
        .filter((listing) => listing.price !== null && listing.price > 0 && listing.floorArea !== null && listing.floorArea > 0)
        .map((listing) => ({
            area: listing.floorArea as number,
            price: listing.price as number,
            label: listing.address,
            kind: listing.propertyKind,
            outcode: listing.outcode
        }));
}

export function isCityOutcode(outcode: string): boolean {
    const match = outcode.match(/^AB(\d{1,2})$/);
    if (!match) {
        return false;
    }
    const number = Number.parseInt(match[1], 10);
    return number >= 10 && number <= 25;
}
