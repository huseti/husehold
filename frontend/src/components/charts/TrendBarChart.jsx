import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Single-series value-over-time bar chart (meals/week, purchases/week,
// redeemed voucher value/week). Flat single color, no gradients.
export default function TrendBarChart({ points, color = '#3b82f6', formatLabel, formatValue }) {
  if (points.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="bucket"
          tickFormatter={formatLabel}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis hide />
        <Tooltip
          labelFormatter={formatLabel}
          formatter={(value) => [formatValue ? formatValue(value) : value, '']}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
