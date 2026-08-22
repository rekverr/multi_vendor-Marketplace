export function RoleLandingPage({ area }: { area: "Seller" | "Admin" }) {
  return (
    <main className="status-page">
      <span className="eyebrow">Protected area</span>
      <h1>{area} workspace</h1>
      <p>This route is ready for its dedicated feature pages.</p>
    </main>
  );
}
