import { useNavigate } from '@tanstack/react-router'
import AuthForm from '../components/AuthForm.jsx'
import { CLASSES, saveClass } from '../data/classes.js'
import { studentFetch } from '../lib/studentApi.js'
import { usePageMeta } from '../meta.js'
import { adoptServerProgress } from '../progress.js'
import { signInStudent } from '../session.js'
import { say } from '../sound.js'

export default function StudentLogin() {
  const navigate = useNavigate()

  usePageMeta('Student Login | PAC-LAB', 'Student sign-in for PAC-LAB, the arcade-styled virtual machine learning lab.')

  const handleSignIn = async (studentId, password) => {
    const { token, student, state } = await studentFetch('/login', { method: 'POST', body: { studentId, password } })
    signInStudent(student.id, { token, name: student.name, className: student.className })
    await adoptServerProgress(state)
    if (CLASSES.includes(student.className)) saveClass(student.id, student.className)
    say(`Player one. Welcome back, ${student.name.split(' ')[0]}.`)
    // Leave time for the coin sound and loading note before switching screens.
    setTimeout(() => navigate({ to: '/student' }), 900)
  }

  return (
    <AuthForm
      role="STUDENT"
      subtitle="PLAYER 1 // STUDENT ACCESS"
      idLabel="ROLL NUMBER"
      idPlaceholder="ML-2026-901"
      accent="student"
      onSignIn={handleSignIn}
    />
  )
}
