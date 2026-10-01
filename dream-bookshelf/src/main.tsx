import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted variable serif (weight + optical size axes) so headings look right offline.
import '@fontsource-variable/newsreader/opsz.css'
import '@fontsource-variable/newsreader/opsz-italic.css'
import './styles/index.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
