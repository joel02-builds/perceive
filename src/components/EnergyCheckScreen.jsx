const OPTIONEN = [
  { level: 'fit', emoji: '🔥', label: 'Fit', text: 'Schwere Blöcke zuerst.' },
  { level: 'okay', emoji: '😐', label: 'Geht so', text: 'Mix aus leicht und schwer.' },
  { level: 'muede', emoji: '😴', label: 'Müde', text: 'Nur Wiederholungen und kurze Blöcke.' },
]

export default function EnergyCheckScreen({ onSelect }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-perceive-bg px-6 dark:bg-perceive-darkbg">
      <div className="text-center">
        <h1 className="font-serif text-3xl font-semibold text-perceive-text dark:text-perceive-bg">
          Wie fühlst du dich heute?
        </h1>
        <p className="mt-2 text-perceive-muted">Das bestimmt deinen Tagesplan.</p>
      </div>

      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-3">
        {OPTIONEN.map((option) => (
          <button
            key={option.level}
            type="button"
            onClick={() => onSelect(option.level)}
            className="flex flex-col items-center gap-2 rounded-xl border border-perceive-border bg-perceive-card p-6 text-center shadow-sm transition-transform duration-150 ease-in-out hover:scale-[1.02] dark:border-gray-700 dark:bg-perceive-darkcard"
          >
            <span className="text-4xl">{option.emoji}</span>
            <span className="font-serif text-lg font-semibold text-perceive-text dark:text-perceive-bg">
              {option.label}
            </span>
            <span className="text-xs text-perceive-muted">{option.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
