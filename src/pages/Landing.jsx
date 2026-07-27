import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-perceive-bg text-perceive-text dark:bg-perceive-darkbg dark:text-perceive-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-serif text-xl font-semibold">Perceive</span>
        <Link
          to="/login"
          className="rounded-lg bg-perceive-primary px-4 py-2 text-white transition hover:opacity-90"
        >
          Anmelden
        </Link>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center">
        <h1 className="font-serif text-4xl font-semibold sm:text-5xl">
          Prüfungslernen, das zu deinem Kopf passt
        </h1>
        <p className="max-w-xl text-lg text-perceive-muted">
          Perceive strukturiert deine Unterlagen in klare Lernblöcke, führt dich mit
          Active Recall durch den Stoff und erstellt automatisch einen Lernplan bis
          zur Prüfung — gemacht für Studierende mit ADHS.
        </p>
        <Link
          to="/login"
          className="mt-4 rounded-lg bg-perceive-accent px-6 py-3 font-medium text-white transition hover:opacity-90"
        >
          Jetzt starten
        </Link>
      </main>
    </div>
  )
}
