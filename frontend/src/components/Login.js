import React, { useState } from 'react';

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
      // Simular retardo para dar sensación de procesamiento
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Para fines de demostración, aceptamos dos usuarios:
      // 1. admin/admin123 (rol administrador)
      // 2. usuario/usuario123 (rol usuario normal)
      if (
        (username === 'admin' && password === 'Jh811880') || 
        (username === 'usuario' && password === 'usuario123')
      ) {
        // Determinar el rol basado en el nombre de usuario
        const role = username === 'admin' ? 'admin' : 'user';
        
        // Éxito en el inicio de sesión
        onLogin({
          username,
          role,
          // Agregar otros datos que puedan ser útiles
          loggedInAt: new Date().toISOString()
        });
      } else {
        setError('Credenciales incorrectas');
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