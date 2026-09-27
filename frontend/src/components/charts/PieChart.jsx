import { PieChart as RPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Share-of-whole view of the same per-member counts StackedBarChart shows
// as an absolute bar -- flat colors per segment (each member's color_hex).
export default function PieChart({ segments, valueLabel }) {
  const data = segments.filter((seg) => seg.value > 0);
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RPieChart>
        <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80}>
          {data.map((seg, i) => <Cell key={i} fill={seg.color} />)}
        </Pie>
        <Tooltip formatter={(value, name) => [valueLabel ? valueLabel(value) : value, name]} />
        <Legend />
      </RPieChart>
    </ResponsiveContainer>
  );
}
