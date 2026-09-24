import { useNavigate } from '@tanstack/react-router'
import AuthForm from '../components/AuthForm.jsx'
import { signInFaculty } from '../facultySession.js'
import { facultyFetch } from '../lib/facultyApi.js'
import { usePageMeta } from '../meta.js'
import { say } from '../sound.js'

export default function FacultyLogin() {
  const navigate = useNavigate()

  usePageMeta('Faculty Login | PAC-LAB', 'Faculty sign-in for PAC-LAB, the arcade-styled virtual machine learning lab.')

  const handleSignIn = async (facultyId, password) => {
    const { token, faculty } = await facultyFetch('/login', { method: 'POST', body: { facultyId, password } })
    signInFaculty({ token, ...faculty })
    say(`Welcome, ${faculty.name}.`)
    navigate({ to: '/faculty' })
  }

  return (
    <AuthForm
      role="FACULTY"
      subtitle="PLAYER 2 // FACULTY ACCESS"
      idLabel="FACULTY ID"
      idPlaceholder="FAC-ML-014"
      accent="faculty"
      loadingNote="CHECKING ACCESS..."
      onSignIn={handleSignIn}
    />
  )
}
