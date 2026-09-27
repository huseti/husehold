// Flat, single-color bar chart for a value-over-time trend (no gradients,
// per the project's visual style). Plain divs, not SVG -- bar heights are
// percentages of the tallest bar, plain `title` attributes stand in for a
// hover tooltip (this app has no chart library and no dark mode to support).
const MAX_LABELS = 7;

export default function TrendBarChart({ points, color = '#3b82f6', formatLabel, formatValue }) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.value), 1);
  const labelEvery = Math.max(1, Math.ceil(points.length / MAX_LABELS));

  return (
    <div className="flex items-end gap-1 h-32">
      {points.map((p, i) => (
        <div key={p.bucket} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
          <div
            title={`${formatLabel(p.bucket)}: ${formatValue ? formatValue(p.value) : p.value}`}
            style={{ height: `${Math.max((p.value / max) * 100, p.value > 0 ? 4 : 0)}%`, backgroundColor: p.value > 0 ? color : 'transparent' }}
            className="w-full rounded-t"
          />
          <span className="text-[10px] text-gray-400 mt-1 truncate w-full text-center">
            {i % labelEvery === 0 ? formatLabel(p.bucket) : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
