import { useRef, useState } from 'react'

function SonneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  )
}

function WocheIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M7 14h.01M11 14h.01M15 14h.01M17 14h.01M7 17h.01M11 17h.01M15 17h.01" />
    </svg>
  )
}

function FaecherIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="4" rx="1" />
      <rect x="4" y="10" width="16" height="4" rx="1" />
      <rect x="4" y="16" width="16" height="4" rx="1" />
    </svg>
  )
}

function LernenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6 3.5-6 3.5v-7z" fill="currentColor" stroke="none" />
    </svg>
  )
}

const TABS = [
  { key: 'heute', label: 'Heute', tooltip: 'Heute', Icon: SonneIcon },
  { key: 'woche', label: 'Woche', tooltip: 'Diese Woche', Icon: WocheIcon },
  { key: 'faecher', label: 'Fächer', tooltip: 'Fächer', Icon: FaecherIcon },
  { key: 'lernen', label: 'Lernen', tooltip: 'Lernen', Icon: LernenIcon },
]

export default function BottomTabBar({ activeTab, onTabChange, onLernenClick }) {
  const [hoveredTab, setHoveredTab] = useState(null)
  const hoverTimeout = useRef(null)

  function handleClick(key) {
    if (key === 'lernen') {
      onLernenClick()
      return
    }
    onTabChange(key)
  }

  function handleMouseEnter(key) {
    clearTimeout(hoverTimeout.current)
    hoverTimeout.current = setTimeout(() => setHoveredTab(key), 200)
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimeout.current)
    setHoveredTab(null)
  }

  return (
    <>
      {/* Mobile: fixe Bottom-Tab-Bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch bg-white md:hidden dark:bg-perceive-darkcard"
        style={{
          borderTop: '1px solid var(--card-border)',
          boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        }}
      >
        {TABS.map(({ key, label, Icon }) => {
          const aktiv = activeTab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleClick(key)}
              className="relative flex flex-1 flex-col items-center justify-center gap-1"
              style={{ color: aktiv ? 'var(--color-primary)' : '#9CA3AF' }}
            >
              {aktiv && (
                <span
                  className="absolute top-0 h-[3px] w-6 rounded-full"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                />
              )}
              <span className="h-5 w-5">
                <Icon />
              </span>
              <span className="text-[10px]">{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Desktop: schmale Sidebar links, nur Icons */}
      <nav
        className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center justify-center gap-6 bg-white md:flex dark:bg-perceive-darkcard"
        style={{ borderRight: '1px solid var(--card-border)' }}
      >
        {TABS.map(({ key, label, tooltip, Icon }) => {
          const aktiv = activeTab === key
          return (
            <div
              key={key}
              className="relative"
              onMouseEnter={() => handleMouseEnter(key)}
              onMouseLeave={handleMouseLeave}
            >
              <button
                type="button"
                onClick={() => handleClick(key)}
                aria-label={label}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg transition"
                style={{
                  color: aktiv ? 'var(--color-primary)' : '#9CA3AF',
                  backgroundColor: aktiv ? 'var(--hero-bg)' : 'transparent',
                }}
              >
                <span className="h-5 w-5">
                  <Icon />
                </span>
              </button>
              <span
                className="pointer-events-none absolute top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md px-2.5 py-1 text-xs text-white transition-opacity duration-150"
                style={{
                  left: 72,
                  backgroundColor: '#1a2b3c',
                  opacity: hoveredTab === key ? 1 : 0,
                }}
              >
                {tooltip}
              </span>
            </div>
          )
        })}
      </nav>
    </>
  )
}
