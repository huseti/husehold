// Read-only when onChange is omitted (e.g. an average on a recipe card);
// interactive otherwise. Single amber color, filled vs. grey.
export default function StarRating({ value, onChange, className = 'text-xl' }) {
  const filled = Math.round(value || 0);

  return (
    <span className={`inline-flex ${className}`} aria-label={value ? `${value}/5` : undefined}>
      {[1, 2, 3, 4, 5].map((star) => {
        const color = star <= filled ? 'text-amber-500' : 'text-gray-300';
        if (!onChange) {
          return <span key={star} className={color}>★</span>;
        }
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`${color} hover:text-amber-400 leading-none px-0.5`}
          >
            ★
          </button>
        );
      })}
    </span>
  );
}
