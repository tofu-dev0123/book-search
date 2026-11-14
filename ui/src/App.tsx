import { Route, Routes } from 'react-router'

import { Home } from './pages/Home'
import { Search } from './pages/Search'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/search" element={<Search />} />
    </Routes>
  )
}
