import { makeTurn, playOpponent } from './chessArcadeModel.js'

self.onmessage = ({ data }) => {
  const { id, run, question, type } = data
  try {
    const reply = type === 'reply' ? playOpponent(run) : { run, move: null }
    const turn = reply.run.outcome || !question ? null : makeTurn(reply.run, question)
    self.postMessage({ id, ...reply, turn })
  } catch (error) {
    self.postMessage({ id, error: error.message })
  }
}
