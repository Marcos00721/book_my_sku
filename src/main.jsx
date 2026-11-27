import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/workspace.css'
import './styles/auth.css'
import './styles/admin.css'
import './styles/custom-products.css'
import './crm-theme/components.css'
import App from './App.jsx'
import { ConfirmProvider } from './components/common/ConfirmProvider'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
)
