import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">Overflow<span>Partner</span></div>
        <Link className="button secondary" href="/login">Workspace</Link>
      </header>
      <section className="hero">
        <p className="eyebrow">Engineering overflow capacity</p>
        <h1>Extra engineering capacity. Without losing control.</h1>
        <p className="lede">
          Overflow Partner helps engineering and manufacturing teams absorb CAD, CAM and technical documentation demand through a controlled delivery workflow.
        </p>
        <Link className="button" href="/login">Open Workspace</Link>
      </section>
    </main>
  );
}
