// Flat, single-track stacked bar (no gradients, per the project's visual
// style) -- one rounded-full bar split proportionally into colored segments,
// with a legend underneath showing each segment's label, value and share.
export default function StackedBarChart({ segments, total }) {
  const sum = total ?? segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
        {sum > 0 && segments.filter((seg) => seg.value > 0).map((seg, i) => (
          <div
            key={i}
            title={`${seg.label}: ${seg.value} (${Math.round((seg.value / sum) * 100)}%)`}
            style={{ width: `${(seg.value / sum) * 100}%`, backgroundColor: seg.color }}
            className="h-3 first:rounded-l-full last:rounded-r-full border-r-2 border-white last:border-r-0"
          />
        ))}
      </div>
      <ul className="mt-2 space-y-1">
        {segments.map((seg, i) => (
          <li key={i} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: seg.color }} />
              {seg.label}
            </span>
            <span className="text-gray-500">
              {seg.value} {sum > 0 && `(${Math.round((seg.value / sum) * 100)}%)`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
