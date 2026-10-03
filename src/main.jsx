import { createRoot } from 'react-dom/client'
import { createRootRoute, createRoute, createRouter, Outlet, redirect, RouterProvider } from '@tanstack/react-router'
import Home from './routes/Home.jsx'
import LoginIndex from './routes/LoginIndex.jsx'
import StudentLogin from './routes/StudentLogin.jsx'
import FacultyLogin from './routes/FacultyLogin.jsx'
import StudentRegister from './routes/StudentRegister.jsx'
import JoinClassroom from './routes/JoinClassroom.jsx'
import StudentClassrooms from './routes/StudentClassrooms.jsx'
import MazeHome from './routes/MazeHome.jsx'
import StudentHome from './routes/StudentHome.jsx'
import Dashboard from './routes/Dashboard.jsx'
import ExperimentPage from './routes/ExperimentPage.jsx'
import FacultyHome from './routes/faculty/FacultyHome.jsx'
import FacultyClass from './routes/faculty/FacultyClass.jsx'
import FacultyStudent from './routes/faculty/FacultyStudent.jsx'
import FacultyClassrooms from './routes/faculty/FacultyClassrooms.jsx'
import FacultyClassroom from './routes/faculty/FacultyClassroom.jsx'
import NotFound from './routes/NotFound.jsx'
import { getLab } from './data/labs.js'
import { getFaculty } from './facultySession.js'
import { isJoinCode, normalizeJoinCode } from './lib/classrooms.js'
import { getProgress, labStatus } from './progress.js'
import { getStudent, getStudentAuth } from './session.js'
import { useArcadeSounds } from './sound.js'
import { VoiceAssistant } from './components/VoiceAssistant.jsx'
import './styles.css'
import './maze.css'
import './lab.css'
import './home.css'
import './faculty.css'
import './assistant.css'
import './classroom.css'

function Root() {
  useArcadeSounds()
  return (
    <>
      <Outlet />
      <VoiceAssistant />
    </>
  )
}

const rootRoute = createRootRoute({ component: Root, notFoundComponent: NotFound })

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home })

// ?join=CODE on sign-in and registration: return to that classroom's join page afterwards.
const joinSearch = (search) => {
  const code = normalizeJoinCode(search.join)
  return isJoinCode(code) ? { join: code } : {}
}

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: 'login', component: Outlet })
const loginIndexRoute = createRoute({ getParentRoute: () => loginRoute, path: '/', component: LoginIndex })
const studentLoginRoute = createRoute({ getParentRoute: () => loginRoute, path: 'student', validateSearch: joinSearch, component: StudentLogin })
const facultyLoginRoute = createRoute({ getParentRoute: () => loginRoute, path: 'faculty', component: FacultyLogin })
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: 'register', validateSearch: joinSearch, component: StudentRegister })

// Classroom invite links: open to everyone, the page itself asks visitors to sign in.
const joinRoute = createRoute({ getParentRoute: () => rootRoute, path: 'join/$code', component: JoinClassroom })

// Student area: only reachable after signing in.
const studentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'student',
  beforeLoad: () => {
    if (!getStudent() || !getStudentAuth()?.token) throw redirect({ to: '/login/student' })
  },
  component: Outlet,
})

const studentHomeRoute = createRoute({ getParentRoute: () => studentRoute, path: '/', component: StudentHome })
const mazeRoute = createRoute({ getParentRoute: () => studentRoute, path: 'maze', component: MazeHome })
const dashboardRoute = createRoute({ getParentRoute: () => studentRoute, path: 'dashboard', component: Dashboard })
const studentClassroomsRoute = createRoute({ getParentRoute: () => studentRoute, path: 'classrooms', component: StudentClassrooms })

const labRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: 'lab/$labId',
  beforeLoad: ({ params }) => {
    const lab = getLab(params.labId)
    if (!lab || labStatus(getProgress(), lab.id) === 'locked') throw redirect({ to: '/student/maze' })
  },
  component: ExperimentPage,
})

// Faculty console: class-wise student data from the MySQL-backed API.
const facultyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'faculty',
  beforeLoad: () => {
    if (!getFaculty()) throw redirect({ to: '/login/faculty' })
  },
  component: Outlet,
})

// Faculty pages keep the open section in ?tab= so refresh, back and shared links reopen it.
const facultySearch = (search) => (typeof search.tab === 'string' ? { tab: search.tab } : {})
const facultyHomeRoute = createRoute({ getParentRoute: () => facultyRoute, path: '/', validateSearch: facultySearch, component: FacultyHome })
const facultyClassRoute = createRoute({ getParentRoute: () => facultyRoute, path: 'class/$classCode', validateSearch: facultySearch, component: FacultyClass })
const facultyStudentRoute = createRoute({ getParentRoute: () => facultyRoute, path: 'student/$studentId', validateSearch: facultySearch, component: FacultyStudent })
const facultyClassroomsRoute = createRoute({ getParentRoute: () => facultyRoute, path: 'classrooms', component: FacultyClassrooms })
const facultyClassroomRoute = createRoute({ getParentRoute: () => facultyRoute, path: 'classrooms/$classroomId', component: FacultyClassroom })

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute.addChildren([loginIndexRoute, studentLoginRoute, facultyLoginRoute]),
  registerRoute,
  joinRoute,
  studentRoute.addChildren([studentHomeRoute, mazeRoute, dashboardRoute, studentClassroomsRoute, labRoute]),
  facultyRoute.addChildren([facultyHomeRoute, facultyClassRoute, facultyStudentRoute, facultyClassroomsRoute, facultyClassroomRoute]),
])

const router = createRouter({ routeTree, scrollRestoration: true })

createRoot(document.getElementById('root')).render(<RouterProvider router={router} />)
