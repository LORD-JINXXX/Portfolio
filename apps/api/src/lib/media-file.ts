export const MAX_CMS_MEDIA_BYTES = 8 * 1024 * 1024

function ascii(bytes: Buffer, start: number, length: number) { return bytes.subarray(start, start + length).toString('ascii') }

export function sniffMediaMime(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 6 && ['GIF87a','GIF89a'].includes(ascii(bytes,0,6))) return 'image/gif'
  if (bytes.length >= 12 && ascii(bytes,0,4) === 'RIFF' && ascii(bytes,8,4) === 'WEBP') return 'image/webp'
  if (bytes.length >= 5 && ascii(bytes,0,5) === '%PDF-') return 'application/pdf'
  if (bytes.length >= 12 && ascii(bytes,4,4) === 'ftyp') return 'video/mp4'
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm'
  if (bytes.length >= 3 && ascii(bytes,0,3) === 'ID3') return 'audio/mpeg'
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg'
  if (bytes.length >= 12 && ascii(bytes,0,4) === 'RIFF' && ascii(bytes,8,4) === 'WAVE') return 'audio/wav'
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096))
  if (sample.length && !sample.includes(0)) {
    const text = sample.toString('utf8')
    if (!text.includes('\uFFFD')) return 'text/plain'
  }
  return null
}

export function mediaKindForMime(mime: string): 'image' | 'video' | 'audio' | 'document' | 'file' {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'application/pdf' || mime.startsWith('text/')) return 'document'
  return 'file'
}

export function validateDeclaredMime(declared: string, detected: string | null): string {
  if (!detected) throw new Error('Unsupported or unrecognized media file content')
  const normalizedDeclared = declared.toLowerCase().trim()
  const aliases = new Set([`${normalizedDeclared}|${detected}`, `${detected}|${normalizedDeclared}`])
  if (normalizedDeclared && normalizedDeclared !== 'application/octet-stream' && normalizedDeclared !== detected && !aliases.has('image/jpg|image/jpeg') && !aliases.has('image/jpeg|image/jpg')) {
    throw new Error(`Declared MIME type ${normalizedDeclared} does not match detected file content ${detected}`)
  }
  return detected
}
