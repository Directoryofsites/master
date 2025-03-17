import React, { useState, useEffect } from 'react';
import FileExplorer from './components/FileExplorer';
import Login from './components/Login';
import SiteSettings from './components/SiteSettings';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [siteSettings, setSiteSettings] = useState({
    title: 'Sistema Explorador',
    subtitle: 'Contenedor Documentos',
    logo: ''
  });

  // Cargar datos de sesión y configuración del sitio
  useEffect(() => {
    // Verificar si hay una sesión activa en localStorage
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setIsLoggedIn(true);
      setUserRole(userData.role);
      setUsername(userData.username);
    }

    // Cargar configuración del sitio
    try {
      const savedSettings = localStorage.getItem('siteSettings');
      if (savedSettings) {
        setSiteSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error al cargar configuración del sitio:', error);
    }

    setIsLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setIsLoggedIn(true);
    setUserRole(userData.role);
    setUsername(userData.username);
    // Guardar sesión en localStorage
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole('');
    setUsername('');
    // Eliminar sesión de localStorage
    localStorage.removeItem('user');
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  const handleSaveSettings = (newSettings) => {
    setSiteSettings(newSettings);
    setShowSettings(false);
  };

  if (isLoading) {
    return <div className="loading-container">Cargando...</div>;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="site-branding">
          {siteSettings.logo && (
            <img 
              src={siteSettings.logo} 
              alt="Logo" 
              className="site-logo" 
            />
          )}
          <div className="site-titles">
            <h1>{siteSettings.title}</h1>
            {siteSettings.subtitle && <h2 className="site-subtitle">{siteSettings.subtitle}</h2>}
          </div>
        </div>
        
        {isLoggedIn && (
          <div className="user-info">
            <span>Bienvenido, {username}</span>
            <span className="user-role">{userRole === 'admin' ? 'Administrador' : 'Usuario'}</span>
            {userRole === 'admin' && (
              <button onClick={toggleSettings} className="settings-btn">
                ⚙️ Configuración
              </button>
            )}
            <button onClick={handleLogout} className="logout-btn">Cerrar Sesión</button>
          </div>
        )}
      </header>

      <main className="app-content">
        {isLoggedIn ? (
          <FileExplorer userRole={userRole} />
        ) : (
          <Login onLogin={handleLogin} />
        )}
      </main>

      <footer className="app-footer">
        <p>&copy; 2025 - {siteSettings.title}</p>
      </footer>
      
      {showSettings && (
        <SiteSettings 
          onClose={toggleSettings} 
          onSave={handleSaveSettings} 
        />
      )}
    </div>
  );
}

export default App;