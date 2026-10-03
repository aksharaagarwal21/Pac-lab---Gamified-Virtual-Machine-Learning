import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { sfx } from '../sound.js'

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older browsers or a page served over plain http: copy through a hidden text box.
    const box = document.createElement('textarea')
    box.value = text
    box.setAttribute('readonly', '')
    box.style.position = 'fixed'
    box.style.opacity = '0'
    document.body.append(box)
    box.select()
    const copied = document.execCommand('copy')
    box.remove()
    return copied
  }
}

// A button that copies `text` and says "Copied!" for two seconds.
export function CopyButton({ text, label, className = 'lab-btn', icon: Icon = Copy }) {
  const [state, setState] = useState('idle')

  useEffect(() => {
    if (state === 'idle') return undefined
    const timer = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(timer)
  }, [state])

  const copy = async () => {
    const copied = await copyText(text)
    setState(copied ? 'copied' : 'failed')
    if (copied) sfx.select()
    else sfx.denied()
  }

  return (
    <button type="button" className={className} onClick={copy}>
      {state === 'copied' ? <Check aria-hidden="true" /> : <Icon aria-hidden="true" />}
      <span aria-live="polite">{state === 'copied' ? 'Copied!' : state === 'failed' ? 'Copy failed' : label}</span>
    </button>
  )
}
