// Ranked magnitude list (top recipes, top purchased items): each row's bar
// is scaled to the top item, not to a shared total -- it's a ranking, not a
// share of a whole. Flat single color, per the project's visual style.
export default function RankedList({ items, valueLabel, color = '#3b82f6' }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i}>
          <div className="flex justify-between text-sm text-gray-700 mb-0.5">
            <span className="truncate pr-2">{item.label}</span>
            <span className="text-gray-500 flex-shrink-0">{valueLabel ? valueLabel(item.value) : item.value}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-1.5 rounded-full" style={{ width: `${(item.value / max) * 100}%`, backgroundColor: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
