import { useEffect, useState } from 'react'

export default function SessionToast({ anzahl, onClose }) {
  const [sichtbar, setSichtbar] = useState(false)

  useEffect(() => {
    const einblenden = setTimeout(() => setSichtbar(true), 10)
    const ausblenden = setTimeout(() => setSichtbar(false), 3000)
    const schliessen = setTimeout(() => onClose(), 3300)
    return () => {
      clearTimeout(einblenden)
      clearTimeout(ausblenden)
      clearTimeout(schliessen)
    }
  }, [onClose])

  function handleClick() {
    setSichtbar(false)
    setTimeout(() => onClose(), 300)
  }

  return (
    <div
      onClick={handleClick}
      role="status"
      className={`fixed inset-x-0 top-0 z-[60] cursor-pointer px-5 py-3 text-center text-[14px] font-bold text-white transition-transform duration-300 ease-out motion-reduce:transition-none ${
        sichtbar ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ backgroundColor: 'var(--color-primary)' }}
    >
      ✓ {anzahl} {anzahl === 1 ? 'Block' : 'Blöcke'} heute gelernt
    </div>
  )
}
