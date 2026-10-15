import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const LABEL_WIDTH = 120;
const MAX_CHARS = 17; // what fits into LABEL_WIDTH at 12px

const shorten = (text) => (text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1).trimEnd()}…` : text);

// Axis label cut to one line; the full text shows on hover (SVG <title>) and in
// the bar's tooltip (tap on phones).
function TruncatedTick({ x, y, payload }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{payload.value}</title>
      <text x={-4} y={0} dy={4} textAnchor="end" fontSize={12} fill="currentColor" className="text-gray-700 dark:text-gray-200">
        {shorten(payload.value)}
      </text>
    </g>
  );
}

// Ranked magnitude list (top recipes, labels, purchased items) as a horizontal
// bar chart: each row's bar is scaled to the top item, not to a shared total --
// it's a ranking, not a share of a whole. Flat single color unless an item
// brings its own (labels).
export default function RankedList({ items, valueLabel, color = '#059669' }) {
  if (items.length === 0) return null;
  const height = Math.max(items.length * 32, 60);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={items} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={LABEL_WIDTH}
          tick={<TruncatedTick />}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <Tooltip cursor={{ fill: 'rgba(156, 163, 175, 0.15)' }} formatter={(value) => [valueLabel ? valueLabel(value) : value, '']} separator="" />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={10}>
          {items.map((item) => <Cell key={item.label} fill={item.color || color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
