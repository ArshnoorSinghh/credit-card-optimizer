import { hello } from "@fils/engine";

export default function HomePage() {
  return (
    <main>
      <h1>Fils</h1>
      <p>{hello()}</p>
    </main>
  );
}
