import { createRoot } from 'react-dom/client'
import { createRootRoute, createRoute, createRouter, Outlet, redirect, RouterProvider } from '@tanstack/react-router'
import Home from './routes/Home.jsx'
import LoginIndex from './routes/LoginIndex.jsx'
import StudentLogin from './routes/StudentLogin.jsx'
import FacultyLogin from './routes/FacultyLogin.jsx'
import MazeHome from './routes/MazeHome.jsx'
import StudentHome from './routes/StudentHome.jsx'
import Dashboard from './routes/Dashboard.jsx'
import ExperimentPage from './routes/ExperimentPage.jsx'
import FacultyHome from './routes/faculty/FacultyHome.jsx'
import FacultyClass from './routes/faculty/FacultyClass.jsx'
import FacultyStudent from './routes/faculty/FacultyStudent.jsx'
import NotFound from './routes/NotFound.jsx'
import { getLab } from './data/labs.js'
import { getFaculty } from './facultySession.js'
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

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: 'login', component: Outlet })
const loginIndexRoute = createRoute({ getParentRoute: () => loginRoute, path: '/', component: LoginIndex })
const studentLoginRoute = createRoute({ getParentRoute: () => loginRoute, path: 'student', component: StudentLogin })
const facultyLoginRoute = createRoute({ getParentRoute: () => loginRoute, path: 'faculty', component: FacultyLogin })

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

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute.addChildren([loginIndexRoute, studentLoginRoute, facultyLoginRoute]),
  studentRoute.addChildren([studentHomeRoute, mazeRoute, dashboardRoute, labRoute]),
  facultyRoute.addChildren([facultyHomeRoute, facultyClassRoute, facultyStudentRoute]),
])

const router = createRouter({ routeTree, scrollRestoration: true })

createRoot(document.getElementById('root')).render(<RouterProvider router={router} />)
