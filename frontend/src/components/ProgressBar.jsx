// Flat single-color progress bar (no gradients, per the project's visual style).
export default function ProgressBar({ done, total, colorHex }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: colorHex || '#3b82f6' }} />
    </div>
  );
}
