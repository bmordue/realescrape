export interface AbListing {
    id: number;
    address: string;
    postcode: string;
    outcode: string;
    area: string;
    lat: number | null;
    lng: number | null;
    price: number | null;
    priceType: number | null;
    priceLabel: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    publicRooms: number | null;
    floorArea: number | null;
    propertyType: 'House' | 'Flat' | 'Other';
    propertyKind: string;
    underOffer: boolean;
    isOpen: boolean;
    sold: boolean;
    closedDate: string | null;
    city: string;
    locality: string;
    solicitor: string;
    url: string;
    fetchedAt: string;
}

export interface AbListingFile {
    generatedAt: string;
    source: string;
    closedWindowDays: number;
    counts: {
        fetched: number;
        ab: number;
        active: number;
        sold: number;
        underOffer: number;
        withCoordinates: number;
    };
    listings: AbListing[];
}
