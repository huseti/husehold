import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Ranked magnitude list (top recipes, top purchased items) as a horizontal
// bar chart: each row's bar is scaled to the top item, not to a shared
// total -- it's a ranking, not a share of a whole. Flat single color.
export default function RankedList({ items, valueLabel, color = '#3b82f6' }) {
  if (items.length === 0) return null;
  const height = Math.max(items.length * 32, 60);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={items} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tick={{ fontSize: 12, fill: '#374151' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip formatter={(value) => [valueLabel ? valueLabel(value) : value, '']} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={10} />
      </BarChart>
    </ResponsiveContainer>
  );
}
