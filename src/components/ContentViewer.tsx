import { ExternalLink } from 'lucide-react'
import type { ContentItem } from '../lib/types'
import { contentUrl, videoEmbedUrl } from '../lib/storage'

/** Very small text renderer: blank lines = paragraphs, "# " = heading, "- " = list item. */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/)
  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        if (lines.every((l) => l.startsWith('- '))) return <ul key={i} className="list-disc space-y-1 pl-6">{lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}</ul>
        if (b.startsWith('## ')) return <h3 key={i} className="text-lg font-bold">{b.slice(3)}</h3>
        if (b.startsWith('# ')) return <h2 key={i} className="text-xl font-extrabold">{b.slice(2)}</h2>
        return <p key={i} className="whitespace-pre-wrap">{b}</p>
      })}
    </div>
  )
}

export default function ContentViewer({ item, compact = false }: { item: ContentItem; compact?: boolean }) {
  if (item.type === 'text') return <RichText text={item.body ?? ''} />
  if (item.type === 'image' && item.file_path) {
    return <img src={contentUrl(item.file_path)} alt={item.title} className={`rounded-xl ${compact ? 'max-h-64' : 'max-h-[70vh]'} w-auto max-w-full`} />
  }
  if (item.type === 'pdf' && item.file_path) {
    const url = contentUrl(item.file_path)
    return (
      <div>
        <iframe src={url} title={item.title} className={`w-full rounded-xl border border-ink/10 bg-white ${compact ? 'h-72' : 'h-[75vh]'}`} />
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ink/60 hover:text-ink"><ExternalLink size={14} /> Open PDF in new tab</a>
      </div>
    )
  }
  if (item.type === 'video' && item.body) {
    const src = videoEmbedUrl(item.body)
    if (!src) return <a href={item.body} target="_blank" rel="noreferrer" className="underline">{item.body}</a>
    return (
      <div className={`overflow-hidden rounded-xl bg-black ${compact ? 'max-w-md' : ''}`} style={{ aspectRatio: '16 / 9' }}>
        <iframe src={src} title={item.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
      </div>
    )
  }
  return null
}
