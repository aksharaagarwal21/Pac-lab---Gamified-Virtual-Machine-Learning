import React from 'react'
import { createRoot } from 'react-dom/client'
import { ChessPretest } from '../../src/components/lab/ChessPretest.jsx'
import { pretest } from '../../src/experiments/quiz/exp02.js'
import '../../src/styles.css'
createRoot(document.getElementById('root')).render(<ChessPretest lab={{ id: 2 }} questions={pretest} />)
