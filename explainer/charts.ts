import { BedroomBox, HistogramBin, PriceSizePoint } from './model';

const INK = '#1f2937';
const MUTED = '#6b7280';
const GRID = '#e5e7eb';
const AXIS = '#9ca3af';
const PANEL = '#f8fafc';

export const HOUSE_COLOR = '#2563eb';
export const FLAT_COLOR = '#f59e0b';
export const OTHER_COLOR = '#6b7280';

export function escapeHtml(value: unknown): string {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function formatPrice(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return 'n/a';
    }
    if (Math.abs(value) >= 1_000_000) {
        return `£${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
    }
    if (Math.abs(value) >= 1_000) {
        return `£${Math.round(value / 1_000)}k`;
    }
    return `£${Math.round(value)}`;
}

export function formatMoney(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return 'n/a';
    }
    return `£${Math.round(value).toLocaleString('en-GB')}`;
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return 'n/a';
    }
    return value.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatPct(value: number | null | undefined, digits = 1): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return 'n/a';
    }
    return `${value.toFixed(digits)}%`;
}

export function formatSignedPct(value: number | null | undefined, digits = 1): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return 'n/a';
    }
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(digits)}%`;
}

export function niceTicks(min: number, max: number, count = 5): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return [];
    }
    if (min === max) {
        return [min];
    }

    const span = max - min;
    const rawStep = span / Math.max(1, count);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalised = rawStep / magnitude;
    const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
    const start = Math.ceil(min / step) * step;
    const ticks: number[] = [];

    for (let value = start; value <= max + step * 0.001; value += step) {
        ticks.push(Number(value.toFixed(10)));
    }

    return ticks;
}

function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '');
    const value = Number.parseInt(clean.length === 3 ? clean.split('').map((part) => part + part).join('') : clean, 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex(rgb: [number, number, number]): string {
    return `#${rgb.map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, '0')).join('')}`;
}

function interpolateStops(stops: string[], t: number): string {
    const clamped = Math.max(0, Math.min(1, t));
    if (stops.length === 0) {
        return '#2563eb';
    }
    if (stops.length === 1) {
        return stops[0];
    }

    const scaled = clamped * (stops.length - 1);
    const lower = Math.floor(scaled);
    const upper = Math.min(stops.length - 1, lower + 1);
    const weight = scaled - lower;
    const a = hexToRgb(stops[lower]);
    const b = hexToRgb(stops[upper]);

    return rgbToHex([
        a[0] + (b[0] - a[0]) * weight,
        a[1] + (b[1] - a[1]) * weight,
        a[2] + (b[2] - a[2]) * weight
    ]);
}

export function sequentialColor(value: number | null, min: number, max: number): string {
    if (value === null || !Number.isFinite(value)) {
        return '#d1d5db';
    }
    if (max <= min) {
        return '#3b82f6';
    }
    return interpolateStops(['#eff6ff', '#93c5fd', '#3b82f6', '#1e3a8a'], (value - min) / (max - min));
}

export function divergingColor(value: number | null, min: number, max: number): string {
    if (value === null || !Number.isFinite(value)) {
        return '#d1d5db';
    }
    const absMax = Math.max(Math.abs(min), Math.abs(max));
    if (absMax === 0) {
        return '#f8fafc';
    }
    const t = Math.max(-1, Math.min(1, value / absMax));
    if (t < 0) {
        return interpolateStops(['#f8fafc', '#fca5a5', '#b91c1c'], -t);
    }
    return interpolateStops(['#f8fafc', '#86efac', '#15803d'], t);
}

export function typeColor(label: string): string {
    if (label === 'House' || label.includes('house')) {
        return HOUSE_COLOR;
    }
    if (label === 'Flat' || label.includes('Flat')) {
        return FLAT_COLOR;
    }
    return OTHER_COLOR;
}

function svgOpen(width: number, height: number, title: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}" preserveAspectRatio="xMidYMid meet">`;
}

function titleElement(title: string): string {
    return `<title>${escapeHtml(title)}</title>`;
}

export interface HorizontalBarDatum {
    label: string;
    value: number;
    detail?: string;
    color?: string;
    muted?: boolean;
}

export interface HorizontalBarOptions {
    title: string;
    data: HorizontalBarDatum[];
    width?: number;
    rowHeight?: number;
    valueFormat?: (value: number) => string;
    colorFor?: (datum: HorizontalBarDatum, index: number) => string;
    xLabel?: string;
    minValue?: number;
    maxValue?: number;
    showValues?: boolean;
}

export function horizontalBarChart(options: HorizontalBarOptions): string {
    const width = options.width ?? 920;
    const rowHeight = options.rowHeight ?? 26;
    const margin = { top: 18, right: 96, bottom: 42, left: 84 };
    const height = margin.top + options.data.length * rowHeight + margin.bottom;
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = options.data.length * rowHeight;
    const values = options.data.map((datum) => datum.value).filter((value) => Number.isFinite(value));
    const minValue = options.minValue ?? Math.min(0, ...values);
    const maxValue = options.maxValue ?? Math.max(...values, 1);
    const paddedMax = maxValue === minValue ? minValue + 1 : maxValue;
    const xScale = (value: number): number => margin.left + ((value - minValue) / (paddedMax - minValue)) * plotWidth;
    const ticks = niceTicks(minValue, paddedMax, 5);
    const valueFormat = options.valueFormat ?? formatPrice;
    const colorFor = options.colorFor ?? ((datum: HorizontalBarDatum) => datum.color ?? '#3b82f6');
    const parts: string[] = [];

    parts.push(svgOpen(width, height, options.title), titleElement(options.title));
    parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

    for (const tick of ticks) {
        const x = xScale(tick);
        parts.push(`<line x1="${x.toFixed(1)}" y1="${margin.top}" x2="${x.toFixed(1)}" y2="${(margin.top + plotHeight).toFixed(1)}" stroke="${GRID}" stroke-width="1"/>`);
        parts.push(`<text x="${x.toFixed(1)}" y="${(height - 18).toFixed(1)}" text-anchor="middle" font-size="10" fill="${MUTED}">${escapeHtml(valueFormat(tick))}</text>`);
    }

    options.data.forEach((datum, index) => {
        const y = margin.top + index * rowHeight;
        const barHeight = Math.max(8, rowHeight - 9);
        const zeroX = xScale(Math.max(minValue, 0));
        const valueX = xScale(datum.value);
        const barX = Math.min(zeroX, valueX);
        const barWidth = Math.max(1, Math.abs(valueX - zeroX));
        const fill = datum.muted ? '#cbd5e1' : colorFor(datum, index);
        const tooltip = `${datum.label}: ${valueFormat(datum.value)}${datum.detail ? ` — ${datum.detail}` : ''}`;

        parts.push(`<g><title>${escapeHtml(tooltip)}</title>`);
        parts.push(`<rect x="${barX.toFixed(1)}" y="${(y + 3).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight}" rx="2" fill="${fill}" fill-opacity="${datum.muted ? 0.7 : 0.9}"/>`);
        parts.push(`<text x="${(margin.left - 10).toFixed(1)}" y="${(y + rowHeight / 2 + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="${datum.muted ? MUTED : INK}" font-weight="${datum.muted ? 400 : 600}">${escapeHtml(datum.label)}</text>`);
        if (options.showValues !== false) {
            parts.push(`<text x="${(valueX + 7).toFixed(1)}" y="${(y + rowHeight / 2 + 4).toFixed(1)}" text-anchor="start" font-size="10" fill="${MUTED}">${escapeHtml(valueFormat(datum.value))}</text>`);
        }
        parts.push('</g>');
    });

    if (options.xLabel) {
        parts.push(`<text x="${(margin.left + plotWidth / 2).toFixed(1)}" y="${(height - 3).toFixed(1)}" text-anchor="middle" font-size="10" fill="${MUTED}">${escapeHtml(options.xLabel)}</text>`);
    }

    parts.push('</svg>');
    return parts.join('');
}

export interface VerticalBarDatum {
    label: string;
    value: number;
    detail?: string;
    color?: string;
}

export interface VerticalBarOptions {
    title: string;
    data: VerticalBarDatum[];
    width?: number;
    height?: number;
    valueFormat?: (value: number) => string;
    yLabel?: string;
    color?: string;
    showValues?: boolean;
    labelEvery?: number;
}

export function verticalBarChart(options: VerticalBarOptions): string {
    const width = options.width ?? 920;
    const height = options.height ?? 300;
    const margin = { top: 22, right: 20, bottom: 64, left: 64 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const values = options.data.map((datum) => datum.value).filter((value) => Number.isFinite(value));
    const maxValue = Math.max(...values, 1);
    const ticks = niceTicks(0, maxValue, 5);
    const yMax = ticks[ticks.length - 1] ?? maxValue;
    const yScale = (value: number): number => margin.top + plotHeight - (value / yMax) * plotHeight;
    const barGap = 4;
    const barWidth = Math.max(2, plotWidth / Math.max(1, options.data.length) - barGap);
    const valueFormat = options.valueFormat ?? formatNumber;
    const labelEvery = options.labelEvery ?? Math.max(1, Math.ceil(options.data.length / 14));
    const parts: string[] = [];

    parts.push(svgOpen(width, height, options.title), titleElement(options.title));
    parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

    for (const tick of ticks) {
        const y = yScale(tick);
        parts.push(`<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${GRID}" stroke-width="1"/>`);
        parts.push(`<text x="${(margin.left - 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="${MUTED}">${escapeHtml(valueFormat(tick))}</text>`);
    }

    options.data.forEach((datum, index) => {
        const x = margin.left + index * (barWidth + barGap) + barGap / 2;
        const y = yScale(datum.value);
        const barHeight = margin.top + plotHeight - y;
        const fill = datum.color ?? options.color ?? '#3b82f6';
        const tooltip = `${datum.label}: ${valueFormat(datum.value)}${datum.detail ? ` — ${datum.detail}` : ''}`;
        parts.push(`<g><title>${escapeHtml(tooltip)}</title>`);
        parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(1, barHeight).toFixed(1)}" rx="2" fill="${fill}" fill-opacity="0.85"/>`);
        if (options.showValues) {
            parts.push(`<text x="${(x + barWidth / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="${MUTED}">${escapeHtml(valueFormat(datum.value))}</text>`);
        }
        if (index % labelEvery === 0 || index === options.data.length - 1) {
            parts.push(`<text x="${(x + barWidth / 2).toFixed(1)}" y="${(margin.top + plotHeight + 16).toFixed(1)}" text-anchor="end" font-size="9" fill="${MUTED}" transform="rotate(-35 ${(x + barWidth / 2).toFixed(1)} ${(margin.top + plotHeight + 16).toFixed(1)})">${escapeHtml(datum.label)}</text>`);
        }
        parts.push('</g>');
    });

    parts.push(`<line x1="${margin.left}" y1="${(margin.top + plotHeight).toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${(margin.top + plotHeight).toFixed(1)}" stroke="${AXIS}" stroke-width="1"/>`);
    if (options.yLabel) {
        parts.push(`<text x="14" y="${(margin.top + plotHeight / 2).toFixed(1)}" text-anchor="middle" font-size="10" fill="${MUTED}" transform="rotate(-90 14 ${(margin.top + plotHeight / 2).toFixed(1)})">${escapeHtml(options.yLabel)}</text>`);
    }
    parts.push('</svg>');
    return parts.join('');
}

export interface LinePoint {
    x: number;
    y: number | null;
    label?: string;
    detail?: string;
}

export interface LineSeries {
    name: string;
    color: string;
    points: LinePoint[];
    dashed?: boolean;
}

export interface LineChartOptions {
    title: string;
    series: LineSeries[];
    width?: number;
    height?: number;
    yFormat?: (value: number) => string;
    yMin?: number;
    yMax?: number;
    xLabels?: string[];
    labelEvery?: number;
    showLegend?: boolean;
    yLabel?: string;
}

export function lineChart(options: LineChartOptions): string {
    const width = options.width ?? 920;
    const height = options.height ?? 320;
    const margin = { top: 34, right: 26, bottom: 54, left: 74 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const allValues = options.series.flatMap((series) => series.points.map((point) => point.y)).filter((value): value is number => value !== null && Number.isFinite(value));
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    const padding = (dataMax - dataMin) * 0.08 || dataMax * 0.08 || 1;
    const yMin = options.yMin ?? dataMin - padding;
    const yMax = options.yMax ?? dataMax + padding;
    const ticks = niceTicks(yMin, yMax, 5);
    const yScale = (value: number): number => margin.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;
    const pointCount = Math.max(...options.series.map((series) => series.points.length), 1);
    const xScale = (index: number): number => margin.left + (pointCount === 1 ? plotWidth / 2 : (index / (pointCount - 1)) * plotWidth);
    const valueFormat = options.yFormat ?? formatPrice;
    const labelEvery = options.labelEvery ?? Math.max(1, Math.ceil(pointCount / 12));
    const parts: string[] = [];

    parts.push(svgOpen(width, height, options.title), titleElement(options.title));
    parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

    for (const tick of ticks) {
        const y = yScale(tick);
        parts.push(`<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${GRID}" stroke-width="1"/>`);
        parts.push(`<text x="${(margin.left - 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="${MUTED}">${escapeHtml(valueFormat(tick))}</text>`);
    }

    options.series.forEach((series) => {
        let path = '';
        let started = false;
        series.points.forEach((point, index) => {
            if (point.y === null || !Number.isFinite(point.y)) {
                started = false;
                return;
            }
            const x = xScale(index);
            const y = yScale(point.y);
            path += `${started ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `;
            started = true;
        });
        parts.push(`<path d="${path.trim()}" fill="none" stroke="${series.color}" stroke-width="${series.dashed ? 1.5 : 2.5}" stroke-dasharray="${series.dashed ? '5 4' : ''}" stroke-linejoin="round" stroke-linecap="round"/>`);

        series.points.forEach((point, index) => {
            if (point.y === null || !Number.isFinite(point.y)) {
                return;
            }
            const x = xScale(index);
            const y = yScale(point.y);
            const tooltip = `${series.name} — ${point.label ?? ''}: ${valueFormat(point.y)}${point.detail ? ` (${point.detail})` : ''}`;
            parts.push(`<g><title>${escapeHtml(tooltip)}</title><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.7" fill="#ffffff" stroke="${series.color}" stroke-width="1.8"/></g>`);
        });
    });

    if (options.xLabels) {
        options.xLabels.forEach((label, index) => {
            if (index % labelEvery !== 0 && index !== options.xLabels!.length - 1) {
                return;
            }
            const x = xScale(index);
            parts.push(`<text x="${x.toFixed(1)}" y="${(margin.top + plotHeight + 18).toFixed(1)}" text-anchor="end" font-size="9" fill="${MUTED}" transform="rotate(-35 ${x.toFixed(1)} ${(margin.top + plotHeight + 18).toFixed(1)})">${escapeHtml(label)}</text>`);
        });
    }

    if (options.showLegend !== false) {
        let legendX = margin.left;
        options.series.forEach((series) => {
            parts.push(`<line x1="${legendX}" y1="14" x2="${legendX + 18}" y2="14" stroke="${series.color}" stroke-width="${series.dashed ? 2 : 3}" stroke-dasharray="${series.dashed ? '4 3' : ''}"/>`);
            parts.push(`<text x="${legendX + 24}" y="18" font-size="10" fill="${MUTED}">${escapeHtml(series.name)}</text>`);
            legendX += 24 + series.name.length * 6 + 20;
        });
    }

    if (options.yLabel) {
        parts.push(`<text x="14" y="${(margin.top + plotHeight / 2).toFixed(1)}" text-anchor="middle" font-size="10" fill="${MUTED}" transform="rotate(-90 14 ${(margin.top + plotHeight / 2).toFixed(1)})">${escapeHtml(options.yLabel)}</text>`);
    }

    parts.push('</svg>');
    return parts.join('');
}

export interface DonutSegment {
    label: string;
    value: number;
    color: string;
}

export interface DonutOptions {
    title: string;
    segments: DonutSegment[];
    width?: number;
    height?: number;
    centerLabel?: string;
}

export function donutChart(options: DonutOptions): string {
    const width = options.width ?? 560;
    const height = options.height ?? 300;
    const cx = 150;
    const cy = height / 2;
    const radius = 88;
    const strokeWidth = 34;
    const circumference = 2 * Math.PI * radius;
    const total = options.segments.reduce((sum, segment) => sum + segment.value, 0);
    const parts: string[] = [];

    parts.push(svgOpen(width, height, options.title), titleElement(options.title));
    parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

    if (total <= 0) {
        parts.push(`<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="12" fill="${MUTED}">No data</text>`);
        parts.push('</svg>');
        return parts.join('');
    }

    let offset = 0;
    for (const segment of options.segments) {
        const length = (segment.value / total) * circumference;
        parts.push(`<g><title>${escapeHtml(`${segment.label}: ${formatNumber(segment.value)} (${formatPct((segment.value / total) * 100)})`)}</title>`);
        parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${segment.color}" stroke-width="${strokeWidth}" stroke-dasharray="${length.toFixed(2)} ${(circumference - length).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`);
        parts.push('</g>');
        offset += length;
    }

    parts.push(`<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="24" font-weight="700" fill="${INK}">${escapeHtml(formatNumber(total))}</text>`);
    parts.push(`<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="11" fill="${MUTED}">${escapeHtml(options.centerLabel ?? 'sales')}</text>`);

    let legendY = cy - (options.segments.length * 24) / 2 + 8;
    for (const segment of options.segments) {
        parts.push(`<rect x="280" y="${(legendY - 9).toFixed(1)}" width="12" height="12" rx="2" fill="${segment.color}"/>`);
        parts.push(`<text x="300" y="${legendY.toFixed(1)}" font-size="11" fill="${INK}" font-weight="600">${escapeHtml(segment.label)}</text>`);
        parts.push(`<text x="300" y="${(legendY + 14).toFixed(1)}" font-size="10" fill="${MUTED}">${escapeHtml(formatNumber(segment.value))} (${escapeHtml(formatPct((segment.value / total) * 100))})</text>`);
        legendY += 40;
    }

    parts.push('</svg>');
    return parts.join('');
}

export interface HistogramOptions {
    title: string;
    bins: HistogramBin[];
    width?: number;
    height?: number;
    color?: string;
    valueFormat?: (value: number) => string;
}

export function histogramChart(options: HistogramOptions): string {
    const width = options.width ?? 920;
    const height = options.height ?? 300;
    const margin = { top: 22, right: 20, bottom: 74, left: 64 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const maxCount = Math.max(...options.bins.map((bin) => bin.count), 1);
    const ticks = niceTicks(0, maxCount, 5);
    const yMax = ticks[ticks.length - 1] ?? maxCount;
    const yScale = (value: number): number => margin.top + plotHeight - (value / yMax) * plotHeight;
    const barWidth = Math.max(2, plotWidth / Math.max(1, options.bins.length) - 3);
    const valueFormat = options.valueFormat ?? formatNumber;
    const parts: string[] = [];

    parts.push(svgOpen(width, height, options.title), titleElement(options.title));
    parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

    for (const tick of ticks) {
        const y = yScale(tick);
        parts.push(`<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${GRID}" stroke-width="1"/>`);
        parts.push(`<text x="${(margin.left - 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="${MUTED}">${escapeHtml(valueFormat(tick))}</text>`);
    }

    options.bins.forEach((bin, index) => {
        const x = margin.left + index * (barWidth + 3) + 1.5;
        const y = yScale(bin.count);
        const barHeight = margin.top + plotHeight - y;
        parts.push(`<g><title>${escapeHtml(`${bin.label}: ${formatNumber(bin.count)} sales`)}</title>`);
        parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(1, barHeight).toFixed(1)}" rx="2" fill="${options.color ?? '#3b82f6'}" fill-opacity="0.82"/>`);
        parts.push(`<text x="${(x + barWidth / 2).toFixed(1)}" y="${(margin.top + plotHeight + 14).toFixed(1)}" text-anchor="end" font-size="8" fill="${MUTED}" transform="rotate(-45 ${(x + barWidth / 2).toFixed(1)} ${(margin.top + plotHeight + 14).toFixed(1)})">${escapeHtml(bin.label)}</text>`);
        parts.push('</g>');
    });

    parts.push(`<line x1="${margin.left}" y1="${(margin.top + plotHeight).toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${(margin.top + plotHeight).toFixed(1)}" stroke="${AXIS}" stroke-width="1"/>`);
    parts.push('</svg>');
    return parts.join('');
}

export interface BoxPlotOptions {
    title: string;
    boxes: BedroomBox[];
    width?: number;
    height?: number;
    valueFormat?: (value: number) => string;
    color?: string;
}

export function boxPlotChart(options: BoxPlotOptions): string {
    const width = options.width ?? 920;
    const height = options.height ?? 330;
    const margin = { top: 24, right: 24, bottom: 54, left: 76 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const allValues = options.boxes.flatMap((box) => [box.lowerWhisker, box.upperWhisker, ...box.outliers]);
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    const padding = (dataMax - dataMin) * 0.05 || 1;
    const yMin = Math.max(0, dataMin - padding);
    const yMax = dataMax + padding;
    const ticks = niceTicks(yMin, yMax, 5);
    const yScale = (value: number): number => margin.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;
    const slot = plotWidth / Math.max(1, options.boxes.length);
    const boxWidth = Math.min(56, slot * 0.48);
    const valueFormat = options.valueFormat ?? formatPrice;
    const parts: string[] = [];

    parts.push(svgOpen(width, height, options.title), titleElement(options.title));
    parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

    for (const tick of ticks) {
        const y = yScale(tick);
        parts.push(`<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${GRID}" stroke-width="1"/>`);
        parts.push(`<text x="${(margin.left - 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="${MUTED}">${escapeHtml(valueFormat(tick))}</text>`);
    }

    options.boxes.forEach((box, index) => {
        const cx = margin.left + slot * index + slot / 2;
        const color = options.color ?? '#3b82f6';
        const yQ1 = yScale(box.q1);
        const yQ3 = yScale(box.q3);
        const yMed = yScale(box.median);
        const yLow = yScale(box.lowerWhisker);
        const yHigh = yScale(box.upperWhisker);
        const tooltip = `${box.label} bedroom${box.label === '1' ? '' : 's'}: ${box.count} sales; median ${formatMoney(box.median)}; IQR ${formatMoney(box.q1)}–${formatMoney(box.q3)}`;

        parts.push(`<g><title>${escapeHtml(tooltip)}</title>`);
        parts.push(`<line x1="${cx.toFixed(1)}" y1="${yLow.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${yHigh.toFixed(1)}" stroke="${color}" stroke-width="1.5"/>`);
        parts.push(`<line x1="${(cx - boxWidth / 3).toFixed(1)}" y1="${yLow.toFixed(1)}" x2="${(cx + boxWidth / 3).toFixed(1)}" y2="${yLow.toFixed(1)}" stroke="${color}" stroke-width="1.5"/>`);
        parts.push(`<line x1="${(cx - boxWidth / 3).toFixed(1)}" y1="${yHigh.toFixed(1)}" x2="${(cx + boxWidth / 3).toFixed(1)}" y2="${yHigh.toFixed(1)}" stroke="${color}" stroke-width="1.5"/>`);
        parts.push(`<rect x="${(cx - boxWidth / 2).toFixed(1)}" y="${Math.min(yQ1, yQ3).toFixed(1)}" width="${boxWidth.toFixed(1)}" height="${Math.max(1, Math.abs(yQ1 - yQ3)).toFixed(1)}" rx="2" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.3"/>`);
        parts.push(`<line x1="${(cx - boxWidth / 2).toFixed(1)}" y1="${yMed.toFixed(1)}" x2="${(cx + boxWidth / 2).toFixed(1)}" y2="${yMed.toFixed(1)}" stroke="${color}" stroke-width="2.5"/>`);
        for (const outlier of box.outliers) {
            if (outlier < yMin || outlier > yMax) {
                continue;
            }
            parts.push(`<circle cx="${(cx + ((index % 5) - 2) * 2).toFixed(1)}" cy="${yScale(outlier).toFixed(1)}" r="2" fill="${color}" fill-opacity="0.5"/>`);
        }
        parts.push(`<text x="${cx.toFixed(1)}" y="${(margin.top + plotHeight + 18).toFixed(1)}" text-anchor="middle" font-size="10" fill="${MUTED}">${escapeHtml(box.label)} bed${box.label === '1' ? '' : 's'}</text>`);
        parts.push(`<text x="${cx.toFixed(1)}" y="${(margin.top + plotHeight + 32).toFixed(1)}" text-anchor="middle" font-size="9" fill="${MUTED}">n=${box.count}</text>`);
        parts.push('</g>');
    });

    parts.push(`<line x1="${margin.left}" y1="${(margin.top + plotHeight).toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${(margin.top + plotHeight).toFixed(1)}" stroke="${AXIS}" stroke-width="1"/>`);
    parts.push('</svg>');
    return parts.join('');
}

export interface ScatterOptions {
    title: string;
    points: PriceSizePoint[];
    width?: number;
    height?: number;
    xLabel?: string;
    yLabel?: string;
}

export function scatterChart(options: ScatterOptions): string {
    const width = options.width ?? 920;
    const height = options.height ?? 340;
    const margin = { top: 26, right: 24, bottom: 56, left: 76 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const xValues = options.points.map((point) => point.area);
    const yValues = options.points.map((point) => point.price);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.max(0, Math.min(...yValues) * 0.9);
    const yMax = Math.max(...yValues) * 1.08;
    const xTicks = niceTicks(xMin, xMax, 5);
    const yTicks = niceTicks(yMin, yMax, 5);
    const xScale = (value: number): number => margin.left + ((value - xMin) / (xMax - xMin || 1)) * plotWidth;
    const yScale = (value: number): number => margin.top + plotHeight - ((value - yMin) / (yMax - yMin || 1)) * plotHeight;
    const parts: string[] = [];

    parts.push(svgOpen(width, height, options.title), titleElement(options.title));
    parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

    for (const tick of xTicks) {
        const x = xScale(tick);
        parts.push(`<line x1="${x.toFixed(1)}" y1="${margin.top}" x2="${x.toFixed(1)}" y2="${(margin.top + plotHeight).toFixed(1)}" stroke="${GRID}" stroke-width="1"/>`);
        parts.push(`<text x="${x.toFixed(1)}" y="${(margin.top + plotHeight + 16).toFixed(1)}" text-anchor="middle" font-size="10" fill="${MUTED}">${escapeHtml(formatNumber(tick))}</text>`);
    }
    for (const tick of yTicks) {
        const y = yScale(tick);
        parts.push(`<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${GRID}" stroke-width="1"/>`);
        parts.push(`<text x="${(margin.left - 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="${MUTED}">${escapeHtml(formatPrice(tick))}</text>`);
    }

    const n = options.points.length;
    if (n > 2) {
        const meanX = xValues.reduce((sum, value) => sum + value, 0) / n;
        const meanY = yValues.reduce((sum, value) => sum + value, 0) / n;
        const covariance = options.points.reduce((sum, point) => sum + (point.area - meanX) * (point.price - meanY), 0);
        const variance = options.points.reduce((sum, point) => sum + Math.pow(point.area - meanX, 2), 0);
        const slope = variance > 0 ? covariance / variance : 0;
        const intercept = meanY - slope * meanX;
        const startX = xMin;
        const endX = xMax;
        parts.push(`<line x1="${xScale(startX).toFixed(1)}" y1="${yScale(intercept + slope * startX).toFixed(1)}" x2="${xScale(endX).toFixed(1)}" y2="${yScale(intercept + slope * endX).toFixed(1)}" stroke="#111827" stroke-width="1.4" stroke-dasharray="5 4" stroke-opacity="0.55"/>`);
    }

    for (const point of options.points) {
        const color = typeColor(point.kind);
        parts.push(`<g><title>${escapeHtml(`${point.label} (${point.outcode}): ${formatMoney(point.price)} for ${formatNumber(point.area)} m² — ${point.kind}`)}</title><circle cx="${xScale(point.area).toFixed(1)}" cy="${yScale(point.price).toFixed(1)}" r="3.4" fill="${color}" fill-opacity="0.55" stroke="#ffffff" stroke-width="0.6"/></g>`);
    }

    parts.push(`<line x1="${margin.left}" y1="${(margin.top + plotHeight).toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${(margin.top + plotHeight).toFixed(1)}" stroke="${AXIS}" stroke-width="1"/>`);
    if (options.xLabel) {
        parts.push(`<text x="${(margin.left + plotWidth / 2).toFixed(1)}" y="${(height - 8).toFixed(1)}" text-anchor="middle" font-size="10" fill="${MUTED}">${escapeHtml(options.xLabel)}</text>`);
    }
    if (options.yLabel) {
        parts.push(`<text x="14" y="${(margin.top + plotHeight / 2).toFixed(1)}" text-anchor="middle" font-size="10" fill="${MUTED}" transform="rotate(-90 14 ${(margin.top + plotHeight / 2).toFixed(1)})">${escapeHtml(options.yLabel)}</text>`);
    }
    parts.push('</svg>');
    return parts.join('');
}

export interface MapPoint {
    lat: number;
    lng: number;
    colorValue: number | null;
    sizeValue: number | null;
    label: string;
    detail: string;
}

export interface MapLabel {
    label: string;
    lat: number;
    lng: number;
    detail?: string;
}

export interface MapChartOptions {
    title: string;
    points: MapPoint[];
    labels?: MapLabel[];
    width?: number;
    height?: number;
    colorMin?: number;
    colorMax?: number;
    colorFormat?: (value: number) => string;
    colorLabel?: string;
    sizeMin?: number;
    sizeMax?: number;
    sizeLabel?: string;
    pointRadius?: number;
}

function buildColorLegend(
    x: number,
    y: number,
    width: number,
    min: number,
    max: number,
    format: (value: number) => string,
    label: string
): string {
    const height = 10;
    const steps = 24;
    const swatchWidth = width / steps;
    const parts: string[] = [];

    for (let index = 0; index < steps; index++) {
        const value = min + ((max - min) * index) / (steps - 1 || 1);
        parts.push(`<rect x="${(x + index * swatchWidth).toFixed(1)}" y="${y}" width="${(swatchWidth + 0.4).toFixed(1)}" height="${height}" fill="${sequentialColor(value, min, max)}"/>`);
    }
    parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${AXIS}" stroke-width="0.6"/>`);
    parts.push(`<text x="${x}" y="${y - 4}" font-size="9" fill="${MUTED}">${escapeHtml(label)}</text>`);
    parts.push(`<text x="${x}" y="${y + height + 11}" text-anchor="start" font-size="9" fill="${MUTED}">${escapeHtml(format(min))}</text>`);
    parts.push(`<text x="${(x + width).toFixed(1)}" y="${y + height + 11}" text-anchor="end" font-size="9" fill="${MUTED}">${escapeHtml(format(max))}</text>`);

    return parts.join('');
}

export function mapChart(options: MapChartOptions): string {
    const width = options.width ?? 920;
    const height = options.height ?? 520;
    const margin = { top: 24, right: 24, bottom: 52, left: 24 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const points = options.points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / Math.max(1, points.length);
    const cosLat = Math.cos((meanLat * Math.PI) / 180);
    const projected = points.map((point) => ({
        ...point,
        px: point.lng * cosLat,
        py: point.lat
    }));
    const xMin = Math.min(...projected.map((point) => point.px));
    const xMax = Math.max(...projected.map((point) => point.px));
    const yMin = Math.min(...projected.map((point) => point.py));
    const yMax = Math.max(...projected.map((point) => point.py));
    const padX = (xMax - xMin) * 0.06 || 0.01;
    const padY = (yMax - yMin) * 0.06 || 0.01;
    const dataWidth = xMax - xMin + padX * 2;
    const dataHeight = yMax - yMin + padY * 2;
    const scale = Math.min(plotWidth / dataWidth, plotHeight / dataHeight);
    const offsetX = margin.left + (plotWidth - dataWidth * scale) / 2;
    const offsetY = margin.top + (plotHeight - dataHeight * scale) / 2;
    const project = (lat: number, lng: number): { x: number; y: number } => ({
        x: offsetX + (lng * cosLat - (xMin - padX)) * scale,
        y: offsetY + ((yMax + padY) - lat) * scale
    });
    const colorValues = points.map((point) => point.colorValue).filter((value): value is number => value !== null && Number.isFinite(value));
    const colorMin = options.colorMin ?? Math.min(...colorValues);
    const colorMax = options.colorMax ?? Math.max(...colorValues);
    const sizeValues = points.map((point) => point.sizeValue).filter((value): value is number => value !== null && Number.isFinite(value));
    const sizeMin = options.sizeMin ?? Math.min(...sizeValues);
    const sizeMax = options.sizeMax ?? Math.max(...sizeValues);
    const colorFormat = options.colorFormat ?? formatPrice;
    const parts: string[] = [];

    parts.push(svgOpen(width, height, options.title), titleElement(options.title));
    parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);
    parts.push(`<rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" fill="${PANEL}" stroke="${GRID}" stroke-width="1"/>`);

    for (let index = 1; index < 6; index++) {
        const x = margin.left + (plotWidth * index) / 6;
        const y = margin.top + (plotHeight * index) / 6;
        parts.push(`<line x1="${x.toFixed(1)}" y1="${margin.top}" x2="${x.toFixed(1)}" y2="${(margin.top + plotHeight).toFixed(1)}" stroke="#e2e8f0" stroke-width="0.7"/>`);
        parts.push(`<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="0.7"/>`);
    }

    for (const point of projected) {
        const position = project(point.lat, point.lng);
        const radius = point.sizeValue !== null && Number.isFinite(point.sizeValue) && sizeMax > sizeMin
            ? 3 + ((point.sizeValue - sizeMin) / (sizeMax - sizeMin)) * 7
            : options.pointRadius ?? 4;
        const fill = sequentialColor(point.colorValue, colorMin, colorMax);
        parts.push(`<g><title>${escapeHtml(point.detail)}</title><circle cx="${position.x.toFixed(1)}" cy="${position.y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${fill}" fill-opacity="0.78" stroke="#ffffff" stroke-width="0.7"/></g>`);
    }

    if (options.labels) {
        for (const label of options.labels) {
            const position = project(label.lat, label.lng);
            parts.push(`<g><title>${escapeHtml(label.detail ?? label.label)}</title><text x="${position.x.toFixed(1)}" y="${position.y.toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="${INK}" style="paint-order: stroke; stroke: #ffffff; stroke-width: 3px; stroke-linejoin: round;">${escapeHtml(label.label)}</text></g>`);
        }
    }

    const kmPerPixel = 111 / scale;
    const barKm = kmPerPixel * 90 > 40 ? 50 : kmPerPixel * 90 > 15 ? 20 : 10;
    const barPixels = barKm / kmPerPixel;
    const barX = margin.left + 16;
    const barY = margin.top + plotHeight - 22;
    parts.push(`<line x1="${barX}" y1="${barY}" x2="${(barX + barPixels).toFixed(1)}" y2="${barY}" stroke="${INK}" stroke-width="2"/>`);
    parts.push(`<line x1="${barX}" y1="${barY - 4}" x2="${barX}" y2="${barY + 4}" stroke="${INK}" stroke-width="1.5"/>`);
    parts.push(`<line x1="${(barX + barPixels).toFixed(1)}" y1="${barY - 4}" x2="${(barX + barPixels).toFixed(1)}" y2="${barY + 4}" stroke="${INK}" stroke-width="1.5"/>`);
    parts.push(`<text x="${(barX + barPixels / 2).toFixed(1)}" y="${barY - 7}" text-anchor="middle" font-size="9" fill="${MUTED}">${barKm} km</text>`);
    parts.push(`<text x="${(margin.left + plotWidth - 16).toFixed(1)}" y="${(margin.top + 20).toFixed(1)}" text-anchor="end" font-size="11" font-weight="700" fill="${INK}">N ↑</text>`);

    const legendX = margin.left + plotWidth - 196;
    const legendY = margin.top + plotHeight - 38;
    parts.push(buildColorLegend(legendX, legendY, 180, colorMin, colorMax, colorFormat, options.colorLabel ?? 'Colour'));

    if (sizeMin !== undefined && sizeMax !== undefined && Number.isFinite(sizeMin) && Number.isFinite(sizeMax)) {
        const sizeLegendX = margin.left + 16;
        const sizeLegendY = margin.top + plotHeight - 70;
        parts.push(`<text x="${sizeLegendX}" y="${sizeLegendY - 6}" font-size="9" fill="${MUTED}">${escapeHtml(options.sizeLabel ?? 'Size')}</text>`);
        [sizeMin, (sizeMin + sizeMax) / 2, sizeMax].forEach((value, index) => {
            const radius = sizeMax > sizeMin ? 3 + ((value - sizeMin) / (sizeMax - sizeMin)) * 7 : 4;
            parts.push(`<circle cx="${sizeLegendX + 6 + index * 38}" cy="${sizeLegendY + 8}" r="${radius.toFixed(1)}" fill="#64748b" fill-opacity="0.5" stroke="#ffffff" stroke-width="0.6"/>`);
            parts.push(`<text x="${sizeLegendX + 6 + index * 38}" y="${sizeLegendY + 24}" text-anchor="middle" font-size="8" fill="${MUTED}">${escapeHtml(formatNumber(value))}</text>`);
        });
    }

    parts.push('</svg>');
    return parts.join('');
}
