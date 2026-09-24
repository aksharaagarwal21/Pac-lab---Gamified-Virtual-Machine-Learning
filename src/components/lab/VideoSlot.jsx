import { useEffect, useState } from 'react'
import { PlayCircle } from 'lucide-react'
import { labNumber } from '../../data/labs.js'

const PROBE_TIMEOUT = 8000

// Asks the browser to read the video's metadata. This works on any server, including ones that
// answer missing files with the app page instead of a 404.
function canPlay(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const finish = (ok) => {
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      resolve(ok)
    }
    const timer = setTimeout(() => finish(false), PROBE_TIMEOUT)
    video.preload = 'metadata'
    video.onloadedmetadata = () => finish(true)
    video.onerror = () => finish(false)
    video.src = url
  })
}

async function findVideo(base) {
  for (const extension of ['mp4', 'webm']) {
    const url = `${base}.${extension}`
    if (await canPlay(url)) return url
  }
  return null
}

// Lesson video at the top of the Theory step. Files live in public/videos (see README.txt there).
export function VideoSlot({ lab }) {
  const base = `/videos/experiment-${labNumber(lab.id)}`
  const [source, setSource] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    setSource(undefined)
    findVideo(base).then((url) => {
      if (!cancelled) setSource(url)
    })
    return () => {
      cancelled = true
    }
  }, [base])

  if (source) {
    return (
      <figure className="lab-video">
        <video controls preload="metadata" poster={`${base}.jpg`} src={source}>
          <track kind="captions" src={`${base}.vtt`} srcLang="en" label="English" />
        </video>
        <figcaption className="mz-sr-only">Lesson video: {lab.title}</figcaption>
      </figure>
    )
  }

  return (
    <div className="lab-video lab-video-empty" aria-busy={source === undefined}>
      <PlayCircle aria-hidden="true" />
      <p className="lab-video-kicker">VIDEO LESSON</p>
      <p className="lab-video-title">{source === undefined ? 'Loading video…' : 'Video coming soon'}</p>
      {source === null && import.meta.env.DEV && (
        <p className="lab-video-hint">
          Add <code>public{base}.mp4</code> to show it here.
        </p>
      )}
    </div>
  )
}
