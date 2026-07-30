export async function extractTextFromDocument(file) {
  const istTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')
  if (istTxt) {
    return (await file.text()).trim()
  }

  // Dynamisch geladen, damit mammoth (recht groß) nicht das Hauptbundle aufbläht
  // und nur geladen wird, wenn tatsächlich eine DOCX-Datei hochgeladen wird.
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value.trim()
}
