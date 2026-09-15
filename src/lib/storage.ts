import { supabase } from './supabase'

export const CONTENT_BUCKET = 'content'
export const HOMEWORK_BUCKET = 'homework'

const slug = (s: string) => s.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(0, 80)

export async function uploadContentFile(moduleId: string, file: File): Promise<string> {
  const path = `${moduleId}/${Date.now()}_${slug(file.name)}`
  const { error } = await supabase.storage.from(CONTENT_BUCKET).upload(path, file, { upsert: false })
  if (error) throw error
  return path
}

export function contentUrl(path: string): string {
  return supabase.storage.from(CONTENT_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function uploadHomeworkFile(userId: string, homeworkId: string, file: File): Promise<string> {
  const path = `${userId}/${homeworkId}/${Date.now()}_${slug(file.name)}`
  const { error } = await supabase.storage.from(HOMEWORK_BUCKET).upload(path, file, { upsert: false })
  if (error) throw error
  return path
}

export async function homeworkSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(HOMEWORK_BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

/** Turn a YouTube / Vimeo / Loom URL into an embeddable iframe src. Returns null if unknown. */
export function videoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    if (host.endsWith('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return url
      if (u.pathname.startsWith('/shorts/')) return `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
    }
    if (host === 'vimeo.com') return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean)[0]}`
    if (host === 'player.vimeo.com') return url
    if (host.endsWith('loom.com')) return url.replace('/share/', '/embed/')
    if (host.endsWith('drive.google.com') && u.pathname.includes('/file/d/')) {
      return `https://drive.google.com/file/d/${u.pathname.split('/')[3]}/preview`
    }
  } catch { /* not a URL */ }
  return null
}
