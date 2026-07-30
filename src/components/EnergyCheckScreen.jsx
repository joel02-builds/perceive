const OPTIONEN = [
  { level: 'fit', emoji: '🔥', label: 'Fit', text: 'Schwere Blöcke zuerst.' },
  { level: 'okay', emoji: '😐', label: 'Geht so', text: 'Mix aus leicht und schwer.' },
  { level: 'muede', emoji: '😴', label: 'Müde', text: 'Nur Wiederholungen und kurze Blöcke.' },
]

export default function EnergyCheckScreen({ onSelect }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-perceive-bg px-6 dark:bg-perceive-darkbg">
      <div className="text-center">
        <img
          src="/per.png"
          alt="Per"
          className="mx-auto mb-4"
          style={{ width: 48, height: 48, objectFit: 'contain', mixBlendMode: 'multiply' }}
        />
        <h1 className="font-serif text-[24px] font-semibold text-[var(--heading)] sm:text-[32px]">
          Wie fühlst du dich heute?
        </h1>
        <p className="mb-12 mt-2 text-[15px] text-[var(--muted-2)]">
          Das bestimmt deinen Tagesplan.
        </p>
      </div>

      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-3">
        {OPTIONEN.map((option) => (
          <button
            key={option.level}
            type="button"
            onClick={() => onSelect(option.level)}
            className="flex flex-col items-center gap-2 rounded-2xl border-[1.5px] border-[var(--card-border)] bg-perceive-card p-7 text-center transition-all duration-150 ease-in-out hover:scale-[1.02] hover:border-perceive-accent hover:bg-[var(--hero-bg)] dark:bg-perceive-darkcard"
          >
            <span className="text-4xl">{option.emoji}</span>
            <span className="font-serif text-lg font-bold text-[var(--heading)]">
              {option.label}
            </span>
            <span className="text-[13px] text-[var(--muted-2)]">{option.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
