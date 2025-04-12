// services/auth.js
const AUTH_KEY = 'user_session';

export const login = (userData) => {
  // Simula un inicio de sesión
  try {
    // Depuración: mostrar los datos que recibimos
    console.log('[AUTH-DEBUG] Datos de login recibidos:', userData);
    
    // Guardar información de usuario en localStorage
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      ...userData,
      timestamp: Date.now()
    }));
    
    // Verificar que se guardó correctamente
    const saved = localStorage.getItem(AUTH_KEY);
    console.log('[AUTH-DEBUG] Datos guardados en localStorage:', saved);
    
    return userData;
  } catch (error) {
    console.error('[AUTH-DEBUG] Error al guardar sesión:', error);
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
    // Intentar obtener del localStorage
    const userSession = localStorage.getItem(AUTH_KEY);
    const user = userSession ? JSON.parse(userSession) : null;
    
    // Depuración: mostrar lo que estamos obteniendo
    console.log('[AUTH-DEBUG] Usuario obtenido del localStorage:', user);
    
    if (!user) {
      console.log('[AUTH-DEBUG] No hay usuario en localStorage');
      return null;
    }
    
    // Verificar que tenga las propiedades necesarias
    if (!user.username) {
      console.log('[AUTH-DEBUG] Usuario sin username:', user);
    }
    
    if (!user.bucket) {
      console.log('[AUTH-DEBUG] Usuario sin bucket:', user);
    }
    
    if (!user.role) {
      console.log('[AUTH-DEBUG] Usuario sin role:', user);
    }
    
    return user;
  } catch (error) {
    console.error('[AUTH-DEBUG] Error al obtener usuario actual:', error);
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

export const getUserBucket = () => {
  const user = getCurrentUser();
  return user ? user.bucket : null;
};

// También añadir esta función para crear el token de autorización

export const getAuthToken = () => {
  const user = getCurrentUser();
  console.log('[AUTH-DEBUG] getAuthToken - Usuario obtenido:', user);
  
  if (!user) {
    console.log('[AUTH-DEBUG] getAuthToken - No hay usuario, retornando null');
    return null;
  }
  
  // Crear un token completo con toda la información del usuario
  const tokenData = {
    username: user.username,
    role: user.role,
    bucket: user.bucket,
    // Incluir datos adicionales para usuarios dinámicos
    type: user.type || 'static',
    folders: user.folders || [],
    createdBy: user.createdBy,
    userId: user.userId
  };
  
  console.log('[AUTH-DEBUG] getAuthToken - Token a codificar:', tokenData);
  
  // Codificar en base64
  const token = btoa(JSON.stringify(tokenData));
  console.log('[AUTH-DEBUG] getAuthToken - Token codificado:', token);
  
  return token;
};