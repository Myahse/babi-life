import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './store/session'
import { useWorld } from './store/world'
import { Title } from './screens/Title'
import { CreateSim } from './screens/CreateSim'
import { Play } from './screens/Play'
import { Profile } from './screens/Profile'
import { Plumbob } from './components/ui'

export function App() {
  const token = useSession((s) => s.token)
  const { world, error, load } = useWorld()

  useEffect(() => {
    load()
  }, [load])

  if (!world && !error) {
    return (
      <div className="grid h-full place-items-center bg-[var(--color-night)]">
        <Plumbob size={24} />
      </div>
    )
  }

  if (!token || !world) {
    return (
      <Routes>
        <Route path="*" element={<Title />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/creer" element={<CreateSim />} />
      <Route path="/jeu" element={<Play />} />
      <Route path="/profil" element={<Profile />} />
      <Route path="*" element={<Navigate to="/jeu" replace />} />
    </Routes>
  )
}
