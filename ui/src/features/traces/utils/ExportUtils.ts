export const convertToCSV = (data: any[], headers: string[]): string => {
  const csvRows = [];

  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
};

export const downloadCSV = (csvContent: string, filename: string): void => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const flattenMetricsForCSV = (metrics: any) => {
  const flattened: any[] = [];

  if (metrics.totals) {
    flattened.push({
      type: 'totals',
      metric: 'request_count',
      value: metrics.totals.request_count,
      ...metrics.totals,
    });
  }

  if (metrics.series?.by_time) {
    metrics.series.by_time.forEach((point: any) => {
      flattened.push({
        type: 'time_series',
        ...point,
      });
    });
  }

  if (metrics.series?.by_model) {
    metrics.series.by_model.forEach((point: any) => {
      flattened.push({
        type: 'model_series',
        ...point,
      });
    });
  }

  if (metrics.series?.by_backend) {
    metrics.series.by_backend.forEach((point: any) => {
      flattened.push({
        type: 'backend_series',
        ...point,
      });
    });
  }

  return flattened;
};
