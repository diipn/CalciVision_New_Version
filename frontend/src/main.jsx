import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import './styles/scrollbar.css'
import App from './App.jsx'

const storedColorMode = localStorage.getItem('calcivision-color-mode')
document.documentElement.dataset.colorMode =
  storedColorMode === 'original' ? 'original' : 'current'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
