import React, { useState, useEffect } from 'react';
import FileExplorer from './components/FileExplorer';
import Login from './components/Login';
import SiteSettings from './components/SiteSettings';
import UserManagement from './components/UserManagement';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [siteSettings, setSiteSettings] = useState({
    title: 'Contenedor de Documentos',
    subtitle: 'Sistema Integral de Gestion',
    logo: ''
  });

  // Cargar datos de sesión y configuración del sitio
  useEffect(() => {
    // Verificar si hay una sesión activa en localStorage usando la clave correcta
    const userSession = localStorage.getItem('user_session');
    
    console.log('[APP-DEBUG] Al cargar, estado de localStorage:', {
      user_session: userSession,
      user: localStorage.getItem('user')
    });
    
    if (userSession) {
      const userData = JSON.parse(userSession);
      console.log('[APP-DEBUG] Datos de usuario cargados:', userData);
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
    console.log('[APP-DEBUG] Datos recibidos en handleLogin:', userData);
    setIsLoggedIn(true);
    setUserRole(userData.role);
    setUsername(userData.username);
    
    // Guardar sesión en localStorage con la clave correcta para auth.js
    localStorage.setItem('user_session', JSON.stringify(userData));
    
    // También guardar en 'user' para mantener la compatibilidad con el código actual
    localStorage.setItem('user', JSON.stringify(userData));
    
    console.log('[APP-DEBUG] Datos guardados en localStorage:', {
      user_session: localStorage.getItem('user_session'),
      user: localStorage.getItem('user')
    });
  };

  const handleLogout = () => {
    console.log('[APP-DEBUG] Cerrando sesión de usuario');
    setIsLoggedIn(false);
    setUserRole('');
    setUsername('');
    
    // Eliminar sesión de localStorage (ambas claves)
    localStorage.removeItem('user');
    localStorage.removeItem('user_session');
    
    console.log('[APP-DEBUG] Sesión eliminada de localStorage');
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
    // Cerrar otros paneles si están abiertos
    if (!showSettings) {
      setShowUserManagement(false);
    }
  };

  const toggleUserManagement = () => {
    setShowUserManagement(!showUserManagement);
    // Cerrar otros paneles si están abiertos
    if (!showUserManagement) {
      setShowSettings(false);
    }
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
            <span className="user-bucket">Bucket: {localStorage.getItem('user_session') ? JSON.parse(localStorage.getItem('user_session')).bucket || 'No definido' : 'No definido'}</span>
            {userRole === 'admin' && (
              <>
                <button onClick={toggleSettings} className="settings-btn">
                  ⚙️ Configuración
                </button>
                <button onClick={toggleUserManagement} className="users-btn">
                  👥 Gestión Usuarios
                </button>
              </>
            )}
            <button onClick={handleLogout} className="logout-btn">Cerrar Sesión</button>
          </div>
        )}
      </header>

      <main className="app-content">
        {isLoggedIn ? (
          <FileExplorer userRole={userRole} username={username} />
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

      {showUserManagement && userRole === 'admin' && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button onClick={toggleUserManagement} className="close-modal">×</button>
            <UserManagement />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;