import React from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import TournamentPage from './pages/TournamentPage.jsx'
import TeamsPage from './pages/TeamsPage.jsx'
import './App.css'

function App() {
  return (
    <BrowserRouter basename="/PokeTorneio">
      <div className="app-layout">
        <header className="app-header">
          <div className="header-inner">
            <div className="header-logo">
              <img src="/PokeTorneio/pokeball.svg" alt="Pokéball" className="header-pokeball" />
              <span className="header-title">TORNEIO<br /><span className="header-subtitle">POKÉMON</span></span>
            </div>
            <nav className="main-nav">
              <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                🏆 Torneio
              </NavLink>
              <NavLink to="/times" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                👾 Times
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<TournamentPage />} />
            <Route path="/times" element={<TeamsPage />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>⚡ Torneio Pokémon · Dados salvos localmente · Não afiliado à The Pokémon Company</p>
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
