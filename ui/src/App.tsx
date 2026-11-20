import { Route, Routes } from 'react-router'

import { Book } from './pages/Book'
import { Home } from './pages/Home'
import { Search } from './pages/Search'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/search" element={<Search />} />
      <Route path="/books/:isbn" element={<Book />} />
    </Routes>
  )
}
