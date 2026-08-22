export function Rating({ average, count }: { average: string; count: number }) {
  return (
    <span
      className="rating"
      aria-label={`${average} out of 5 from ${count} reviews`}
    >
      <span aria-hidden="true">★</span> {average} <small>({count})</small>
    </span>
  );
}
