import React, { useState } from 'react';
import { BASE_URL } from '../services/api'; // Importar BASE_URL de api.js

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    // Validación básica
    if (!username || !password) {
      setError('Por favor, introduce usuario y contraseña');
      setIsLoading(false);
      return;
    }

    try {
      // Llamar al endpoint de autenticación en el servidor
      const response = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Éxito en el inicio de sesión

    
        onLogin({
          username: data.user.username,
          role: data.user.role,
          bucket: data.user.bucket,  // Cambiado de bucketName a bucket para consistencia
          loggedInAt: new Date().toISOString()
        });
        
        // No es necesario guardar userBucket por separado, ya se guarda en el objeto de usuario
        // localStorage.setItem('userBucket', data.user.bucket);

        
      } else {
        setError(data.message || 'Credenciales incorrectas');
      }
    } catch (err) {
      setError('Error al iniciar sesión');
      console.error('Error de inicio de sesión:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <form onSubmit={handleSubmit} className="login-form">
          <h2 className="login-title">Explorador de Archivos</h2>
          <h3 className="login-subtitle">Iniciar Sesión</h3>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Introduce tu usuario"
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Introduce tu contraseña"
              required
              disabled={isLoading}
            />
          </div>
          
          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
          
          <div className="login-help">
            <p>Contacte al administrador del sistema para obtener credenciales de acceso.</p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;