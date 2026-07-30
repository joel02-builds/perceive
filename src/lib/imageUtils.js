export function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Verkleinert das Bild vor dem Versand — Vercel-Functions haben ein striktes
// Body-Size-Limit, unkomprimierte Handyfotos (mehrere MB, teils bis 10MB) würden
// das bei 2-3 Bildern zuverlässig sprengen. 1600px Kantenlänge reicht Claude
// zum Lesen von Text/Handschrift locker.
export async function compressImage(file, maxDimension = 1600, quality = 0.82) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) return { blob: file, mediaType: file.type || 'image/jpeg' }
    return { blob, mediaType: 'image/jpeg' }
  } catch {
    // z. B. HEIC — von Canvas/createImageBitmap in vielen Browsern nicht dekodierbar.
    // Fallback: Originaldatei unkomprimiert verwenden.
    return { blob: file, mediaType: file.type || 'image/jpeg' }
  }
}
