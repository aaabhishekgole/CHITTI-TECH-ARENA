import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import BuzzPlayer from './BuzzPlayer.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/buzz" element={<BuzzPlayer />} />
    </Routes>
  </BrowserRouter>
)
