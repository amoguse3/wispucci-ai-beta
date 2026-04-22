import React from 'react'
import ReactDOM from 'react-dom/client'
import './web-bridge'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'
import { LanguageProvider } from './contexts/LanguageContext'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <LanguageProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </LanguageProvider>
  </ErrorBoundary>
)
