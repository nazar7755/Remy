/** Sample indexed text for browser mock previews (txt, pdf, docx, images). */
export const MOCK_FILE_CONTENT: Record<string, string> = {
  'invoice-march.pdf':
    'Invoice March 2026. Payment terms net 30. Total due $4,280.00.',
  'api-notes.txt':
    'API versioning notes. Rate limit 1000 req/min. Auth uses bearer tokens.',
  'Improved_App_Investigation_Review.docx':
    'Executive summary of the improved app investigation. Key finding: comparison between WhatsApp and Microsoft Teams for async collaboration. Recommendation: pilot Teams integration in Q3.',
  'proposal-draft.docx':
    'Draft proposal for Remy memory layer. Scope includes local indexing and search across Downloads.',
  'screenshot-notes.png':
    'Screenshot OCR sample. Meeting notes: ship OCR indexing in Phase 1.',
  'diagram.webp': 'Architecture diagram labels: API Gateway, SQLite cache, OCR pipeline.',
}

export function mockContentForFile(fileName: string): string | null {
  return MOCK_FILE_CONTENT[fileName] ?? null
}
