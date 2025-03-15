// services/auth.js
const AUTH_KEY = 'user_session';

export const login = (userData) => {
  // Simula un inicio de sesión
  // En un escenario real, esto incluiría una llamada al backend
  try {
    // Guardar información de usuario en localStorage
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      ...userData,
      timestamp: Date.now()
    }));
    return userData;
  } catch (error) {
    console.error('Error al guardar sesión:', error);
    throw error;
  }
};

export const logout = () => {
  // Eliminar información de sesión
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
};

export const getCurrentUser = () => {
  try {
    const userSession = localStorage.getItem(AUTH_KEY);
    return userSession ? JSON.parse(userSession) : null;
  } catch (error) {
    console.error('Error al obtener usuario actual:', error);
    return null;
  }
};

export const isAuthenticated = () => {
  const user = getCurrentUser();
  // Puedes añadir lógica adicional como expiración de sesión
  return !!user;
};

export const getUserRole = () => {
  const user = getCurrentUser();
  return user ? user.role : null;
};

export const isAdmin = () => {
  return getUserRole() === 'admin';
};