import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// One thin horizontal bar split into per-member segments (task completion),
// plus a legend with the absolute value and share underneath. Flat colors
// per segment (each member's existing color_hex), no gradients.
export default function StackedBarChart({ segments, total }) {
  const sum = total ?? segments.reduce((s, seg) => s + seg.value, 0);
  const data = [Object.fromEntries(segments.map((seg) => [seg.label, seg.value]))];

  return (
    <div>
      <ResponsiveContainer width="100%" height={56}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <XAxis type="number" hide domain={[0, sum || 1]} />
          <YAxis type="category" hide />
          <Tooltip
            formatter={(value, name) => [`${value} (${sum ? Math.round((value / sum) * 100) : 0}%)`, name]}
            labelFormatter={() => ''}
          />
          {segments.map((seg) => (
            <Bar key={seg.label} dataKey={seg.label} stackId="a" fill={seg.color} radius={[4, 4, 4, 4]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
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
