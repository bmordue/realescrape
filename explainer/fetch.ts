import fetch from 'node-fetch';
import { mkdirSync, writeFileSync } from 'node:fs';
import { AbListing, AbListingFile } from './types';

const API_BASE = 'https://api.aspc.co.uk';
const CLOSED_WINDOW_DAYS = 730;
const PAGE_SIZE = 1000;
const MAX_OFFSET = 9500;
const REQUEST_DELAY_MS = 650;

interface PartitionFilters {
    ResidentialType?: string;
    HouseFormat?: string;
    FlatFormat?: string;
    PriceMin?: number;
    PriceMax?: number;
}

interface AspcRawListing {
    Id: number;
    Bedrooms: number | null;
    Bathrooms: number | null;
    PublicRooms: number | null;
    Price: number | null;
    PriceType: number | null;
    UnderOffer: boolean;
    ClosedDate: string | null;
    ClosedDateVisible: boolean;
    ClosedMessage: string | null;
    IsOpen: boolean;
    FloorArea: number | null;
    ResidentialType: number | null;
    HouseFormat: number | null;
    PropertyIconKey: string | null;
    Location: {
        AddressLine1?: string;
        LineOneLocation?: string;
        LineTwoLocation?: string;
        Locality?: string;
        City?: string;
        Postcode?: string;
        Spatial?: {
            Geography?: {
                WellKnownText?: string;
            };
        };
    };
    SolicitorAccount?: {
        Name?: string;
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildParams(filters: PartitionFilters, page?: number, pageSize?: number): URLSearchParams {
    const params = new URLSearchParams();
    params.set('PrimaryPropertyType', 'Buy');
    params.set('SortBy', 'PublishedDesc');
    params.set('LastUpdated', 'AddedAnytime');
    params.set('PropertyType', 'Residential');
    params.set('ExcludeUnderOffer', 'false');
    params.set('IncludeClosedProperties', 'true');
    params.set('ClosedDatesSearch', String(CLOSED_WINDOW_DAYS));
    params.set('ByFixedPriceOnly', 'false');
    params.set('ResultMode', 'NONE');
    params.set('ResultView', 'LIST');
    params.set('Sort', 'PublishedDesc');

    if (filters.ResidentialType) {
        params.set('ResidentialType', filters.ResidentialType);
    }
    if (filters.HouseFormat) {
        params.set('HouseFormat', filters.HouseFormat);
    }
    if (filters.FlatFormat) {
        params.set('FlatFormat', filters.FlatFormat);
    }
    if (filters.PriceMin !== undefined) {
        params.set('PriceMin', String(filters.PriceMin));
    }
    if (filters.PriceMax !== undefined) {
        params.set('PriceMax', String(filters.PriceMax));
    }
    if (page !== undefined) {
        params.set('Page', String(page));
    }
    if (pageSize !== undefined) {
        params.set('PageSize', String(pageSize));
    }

    return params;
}

async function fetchJson(url: string, label: string): Promise<unknown> {
    const maxAttempts = 6;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    Accept: 'application/json',
                    Referer: 'https://www.aspc.co.uk/search/',
                    Origin: 'https://www.aspc.co.uk',
                    'User-Agent': 'realescrape-ab-explainer/1.0 (+https://github.com/bmordue/realescrape)'
                },
                timeout: 60000
            } as never);

            if (!response.ok) {
                const body = await response.text();
                const error = new Error(`HTTP ${response.status} ${response.statusText} for ${label}: ${body.slice(0, 200)}`);
                (error as Error & { status?: number }).status = response.status;
                throw error;
            }

            return await response.json();
        } catch (error) {
            if (attempt === maxAttempts) {
                throw error;
            }

            const delay = Math.round(1000 * Math.pow(2, attempt - 1) + Math.random() * 500);
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`${label}: ${message}. Retrying in ${delay}ms (attempt ${attempt}/${maxAttempts}).`);
            await sleep(delay);
        }
    }

    throw new Error(`Unreachable: exhausted retries for ${label}`);
}

async function getCount(filters: PartitionFilters): Promise<number> {
    const url = `${API_BASE}/Property/GetPropertyCount?${buildParams(filters).toString()}`;
    const data = await fetchJson(url, 'property count');
    if (typeof data === 'object' && data !== null && typeof (data as { count?: unknown }).count === 'number') {
        return (data as { count: number }).count;
    }
    return 0;
}

function splitFilters(filters: PartitionFilters): Array<{ label: string; filters: PartitionFilters }> {
    if (filters.ResidentialType === 'House' && !filters.HouseFormat) {
        return ['Detached', 'SemiDetached', 'Terraced'].map((format) => ({
            label: format,
            filters: { ...filters, HouseFormat: format }
        }));
    }

    if (filters.ResidentialType === 'Flat' && !filters.FlatFormat) {
        return ['Ground', 'UpperFloor', 'Floor', 'TopFloor', 'Basement'].map((format) => ({
            label: format,
            filters: { ...filters, FlatFormat: format }
        }));
    }

    if (filters.PriceMin === undefined && filters.PriceMax === undefined) {
        const bands = [0, 100000, 150000, 200000, 250000, 300000, 400000, 500000, 750000, 1000000, 2000000];
        return bands.map((min, index) => {
            const max = bands[index + 1];
            return {
                label: max === undefined ? `over £${min.toLocaleString('en-GB')}` : `£${min.toLocaleString('en-GB')} to £${max.toLocaleString('en-GB')}`,
                filters: {
                    ...filters,
                    ...(min > 0 ? { PriceMin: min } : {}),
                    ...(max !== undefined ? { PriceMax: max - 1 } : {})
                }
            };
        });
    }

    return [];
}

async function fetchPages(filters: PartitionFilters, count: number, label: string): Promise<AspcRawListing[]> {
    const results: AspcRawListing[] = [];
    let page = 1;

    while (results.length < count && page <= 12) {
        const url = `${API_BASE}/Property/GetProperties?${buildParams(filters, page, PAGE_SIZE).toString()}`;
        const data = await fetchJson(url, `${label} page ${page}`);

        if (!Array.isArray(data) || data.length === 0) {
            break;
        }

        results.push(...(data as AspcRawListing[]));
        console.log(`${label}: page ${page} returned ${data.length} records (${results.length}/${count}).`);

        if (data.length < PAGE_SIZE) {
            break;
        }

        page += 1;
        await sleep(REQUEST_DELAY_MS);
    }

    return results;
}

async function fetchPartition(filters: PartitionFilters, label: string): Promise<AspcRawListing[]> {
    const count = await getCount(filters);
    console.log(`${label}: ${count} records available.`);

    if (count === 0) {
        return [];
    }

    if (count > MAX_OFFSET) {
        const splits = splitFilters(filters);
        if (splits.length > 0) {
            console.log(`${label}: splitting into ${splits.length} partitions to stay below the API's 10,000-record offset limit.`);
            const results: AspcRawListing[] = [];
            for (const split of splits) {
                results.push(...await fetchPartition(split.filters, `${label} / ${split.label}`));
                await sleep(REQUEST_DELAY_MS);
            }
            return results;
        }
    }

    return fetchPages(filters, count, label);
}

function parsePoint(wkt: string | undefined): { lat: number; lng: number } | null {
    if (!wkt) {
        return null;
    }

    const match = wkt.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    if (!match) {
        return null;
    }

    const lng = Number.parseFloat(match[1]);
    const lat = Number.parseFloat(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return { lat, lng };
}

function normalisePostcode(value: string | undefined): string {
    return (value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

function outcodeFromPostcode(postcode: string): string | null {
    const match = postcode.match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/);
    if (match) {
        return match[1];
    }

    const fallback = postcode.match(/^([A-Z]{1,2}\d[A-Z\d]?)/);
    return fallback ? fallback[1] : null;
}

function priceLabelForType(priceType: number | null): string | null {
    switch (priceType) {
        case 1: return 'Price over';
        case 2: return 'Price';
        case 3: return 'Rent';
        case 4: return 'Fixed price';
        case 5: return 'Price around';
        case 6: return 'Rent negotiable';
        case 7: return 'Price guide';
        case 8: return 'Rent over';
        case 9: return 'Prices from';
        case 10: return 'Prices over';
        case 11: return 'Rent around';
        default: return null;
    }
}

function propertyKindFor(raw: AspcRawListing): { type: AbListing['propertyType']; kind: string } {
    switch (raw.PropertyIconKey) {
        case 'FLAT':
            return { type: 'Flat', kind: 'Flat' };
        case 'HOUSE_DETACHED':
            return { type: 'House', kind: 'Detached house' };
        case 'HOUSE_SEMI_DETACHED':
            return { type: 'House', kind: 'Semi-detached house' };
        case 'HOUSE_TERRACED':
            return { type: 'House', kind: 'Terraced house' };
        default:
            break;
    }

    if (raw.ResidentialType === 2) {
        return { type: 'Flat', kind: 'Flat' };
    }
    if (raw.ResidentialType === 1) {
        return { type: 'House', kind: 'House' };
    }
    return { type: 'Other', kind: 'Other' };
}

function slugify(value: string): string {
    return value
        .replace(/, /g, '-')
        .replace(/ /g, '-')
        .replace(/\./g, '')
        .replace(/[()'`]/g, '')
        .replace(/\//g, '-');
}

function buildListingUrl(raw: AspcRawListing): string {
    const address = raw.Location.AddressLine1 || raw.Location.LineOneLocation || '';
    const place = raw.Location.City || raw.Location.Locality || '';
    return `https://www.aspc.co.uk/search/property/${raw.Id}/${slugify(address)}/${slugify(place)}/`;
}

function mapListing(raw: AspcRawListing, fetchedAt: string): AbListing | null {
    const postcode = normalisePostcode(raw.Location.Postcode);
    const outcode = outcodeFromPostcode(postcode);
    if (!outcode || !outcode.startsWith('AB')) {
        return null;
    }

    const point = parsePoint(raw.Location.Spatial?.Geography?.WellKnownText);
    const address = [raw.Location.LineOneLocation, raw.Location.LineTwoLocation]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(', ') || raw.Location.AddressLine1 || '';
    const property = propertyKindFor(raw);
    const price = raw.Price !== null && raw.Price > 0 ? raw.Price : null;
    const floorArea = raw.FloorArea !== null && raw.FloorArea > 0 ? raw.FloorArea : null;
    const closedDate = raw.ClosedDateVisible && raw.ClosedDate ? raw.ClosedDate : null;

    return {
        id: raw.Id,
        address,
        postcode,
        outcode,
        area: outcode.replace(/^([A-Z]{1,2}).*$/, '$1'),
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
        price,
        priceType: raw.PriceType,
        priceLabel: priceLabelForType(raw.PriceType),
        bedrooms: raw.Bedrooms !== null && raw.Bedrooms > 0 ? raw.Bedrooms : null,
        bathrooms: raw.Bathrooms !== null && raw.Bathrooms > 0 ? raw.Bathrooms : null,
        publicRooms: raw.PublicRooms !== null && raw.PublicRooms > 0 ? raw.PublicRooms : null,
        floorArea,
        propertyType: property.type,
        propertyKind: property.kind,
        underOffer: Boolean(raw.UnderOffer),
        isOpen: Boolean(raw.IsOpen),
        sold: !raw.IsOpen && Boolean(closedDate),
        closedDate,
        city: raw.Location.City ?? '',
        locality: raw.Location.Locality ?? '',
        solicitor: raw.SolicitorAccount?.Name ?? '',
        url: buildListingUrl(raw),
        fetchedAt
    };
}

async function main(): Promise<void> {
    const startedAt = new Date();
    console.log(`Fetching ASPC listings with sold dates from the last ${CLOSED_WINDOW_DAYS} days.`);

    const rawResults: AspcRawListing[] = [];
    for (const type of ['House', 'Flat']) {
        rawResults.push(...await fetchPartition({ ResidentialType: type }, type));
        await sleep(REQUEST_DELAY_MS);
    }

    const byId = new Map<number, AspcRawListing>();
    for (const raw of rawResults) {
        byId.set(raw.Id, raw);
    }

    const fetchedAt = startedAt.toISOString();
    const listings = Array.from(byId.values())
        .map((raw) => mapListing(raw, fetchedAt))
        .filter((listing): listing is AbListing => listing !== null)
        .sort((a, b) => a.outcode.localeCompare(b.outcode) || a.price! - b.price!);

    const active = listings.filter((listing) => listing.isOpen);
    const sold = listings.filter((listing) => listing.sold);

    const file: AbListingFile = {
        generatedAt: fetchedAt,
        source: 'ASPC (Aberdeen Solicitors Property Centre)',
        closedWindowDays: CLOSED_WINDOW_DAYS,
        counts: {
            fetched: byId.size,
            ab: listings.length,
            active: active.length,
            sold: sold.length,
            underOffer: active.filter((listing) => listing.underOffer).length,
            withCoordinates: listings.filter((listing) => listing.lat !== null && listing.lng !== null).length
        },
        listings
    };

    mkdirSync('explainer/data', { recursive: true });
    writeFileSync('explainer/data/ab-listings.json', JSON.stringify(file, null, 2));

    console.log(`Wrote ${listings.length} AB listings (${active.length} active, ${sold.length} sold) to explainer/data/ab-listings.json.`);
}

main().catch((error) => {
    console.error('Failed to fetch AB listings:', error);
    process.exit(1);
});
