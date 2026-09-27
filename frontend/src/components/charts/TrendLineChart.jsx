import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// A rate (0-1) over time as a line -- unlike TrendBarChart's counts, this
// tracks a percentage, so the y-axis is fixed to [0, 1] rather than scaled
// to the tallest point. Flat single color, no gradients.
export default function TrendLineChart({ points, color = '#3b82f6', formatLabel, formatValue }) {
  if (points.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="bucket"
          tickFormatter={formatLabel}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis hide domain={[0, 1]} />
        <Tooltip
          labelFormatter={formatLabel}
          formatter={(value) => [formatValue ? formatValue(value) : value, '']}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
