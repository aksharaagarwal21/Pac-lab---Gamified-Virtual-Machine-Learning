// Renders experiment text written as data blocks, e.g.
// { h2: '2.1 What Is Regression?' }, { p: 'Text' }, { eq: 'y = b₀ + b₁·x' }, { list: [...] },
// { steps: [...] }, { table: { head: [...], rows: [[...]] } }, { note: { title, text } }, { code: '...' }.
// Text can be a string or an array mixing strings with { b }, { i } and { code } pieces.

export function Rich({ text }) {
  if (!Array.isArray(text)) return text
  return text.map((part, index) => {
    if (typeof part === 'string') return part
    if (part.b) return <strong key={index}>{part.b}</strong>
    if (part.i) return <em key={index}>{part.i}</em>
    if (part.code) return <code key={index}>{part.code}</code>
    return null
  })
}

export function ContentBlocks({ blocks }) {
  return blocks.map((block, index) => {
    if (block.h2) return <h3 key={index} className="lab-h2">{block.h2}</h3>
    if (block.h3) return <h4 key={index} className="lab-h3">{block.h3}</h4>
    if (block.p) {
      return (
        <p key={index} className="lab-p">
          <Rich text={block.p} />
        </p>
      )
    }
    if (block.eq) return <p key={index} className="lab-eq">{block.eq}</p>
    if (block.list) {
      return (
        <ul key={index} className="lab-list">
          {block.list.map((item, i) => (
            <li key={i}>
              <Rich text={item} />
            </li>
          ))}
        </ul>
      )
    }
    if (block.steps) {
      return (
        <ol key={index} className="lab-steps">
          {block.steps.map((item, i) => (
            <li key={i}>
              <span className="lab-steps-num">Step {i + 1}</span>
              <span>
                <Rich text={item} />
              </span>
            </li>
          ))}
        </ol>
      )
    }
    if (block.table) {
      return (
        <div key={index} className="lab-table-wrap">
          <table className="lab-table">
            {block.table.caption && <caption className="mz-sr-only">{block.table.caption}</caption>}
            <thead>
              <tr>
                {block.table.head.map((cell) => (
                  <th key={cell} scope="col">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.table.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <Rich text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    if (block.note) {
      return (
        <aside key={index} className="lab-callout">
          {block.note.title && <strong>{block.note.title} </strong>}
          <Rich text={block.note.text} />
        </aside>
      )
    }
    if (block.code) {
      return (
        <pre key={index} className="lab-code">
          <code>{block.code}</code>
        </pre>
      )
    }
    return null
  })
}
