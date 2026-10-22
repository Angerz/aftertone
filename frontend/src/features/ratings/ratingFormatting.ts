export const formatPercentage = (ratio: number | null): string => ratio === null ? "—" : `${(ratio * 100).toFixed(2)} %`;
