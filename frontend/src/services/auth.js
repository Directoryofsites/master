// services/auth.js
const AUTH_KEY = 'user_session';

export const login = (userData) => {
  // Simula un inicio de sesión
  try {
    // Depuración: mostrar los datos que recibimos
    console.log('[AUTH-DEBUG] Datos de login recibidos:', userData);
    
    // Asegurarse de que los permisos administrativos se estructuren correctamente
    let processedUserData = { ...userData };
    
    // Normalizar la estructura de permisos para que sea consistente
    if (userData.assigned_folders && Array.isArray(userData.assigned_folders)) {
      // Asegurarse de que userData.folders exista
      processedUserData.folders = [...userData.assigned_folders];
      
      console.log('[AUTH-DEBUG] Folders normalizados desde assigned_folders:', processedUserData.folders);
    }
    
    // Guardar información de usuario en localStorage con formato normalizado
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      ...processedUserData,
      timestamp: Date.now()
    }));
    
    // Verificar que se guardó correctamente
    const saved = localStorage.getItem(AUTH_KEY);
    console.log('[AUTH-DEBUG] Datos guardados en localStorage:', saved);
    
    return processedUserData;
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
  // Asegurando que se transfieran correctamente los permisos
  const tokenData = {
    username: user.username,
    role: user.role,
    bucket: user.bucket,
    // Incluir datos adicionales para usuarios dinámicos
    type: user.type || 'static',
    // Preservar la estructura original de carpetas y permisos administrativos
    folders: user.folders || [],
    assigned_folders: user.assigned_folders || [],
    // Asegurarse de que los permisos administrativos se incluyan directamente
    permissions: {},
    createdBy: user.createdBy,
    userId: user.userId
  };
  
  // Extraer permisos de admin_permissions para acceso más directo
  // Esto permite que hasAdminPermission verifique en múltiples lugares
  if (user.assigned_folders && Array.isArray(user.assigned_folders)) {
    const permObj = user.assigned_folders.find(
      folder => typeof folder === 'object' && folder.type === 'admin_permissions'
    );
    
    if (permObj && permObj.permissions) {
      tokenData.permissions = { ...permObj.permissions };
      console.log('[AUTH-DEBUG] Permisos extraídos de assigned_folders:', tokenData.permissions);
    }
  } else if (user.folders && Array.isArray(user.folders)) {
    const permObj = user.folders.find(
      folder => typeof folder === 'object' && folder.type === 'admin_permissions'
    );
    
    if (permObj && permObj.permissions) {
      tokenData.permissions = { ...permObj.permissions };
      console.log('[AUTH-DEBUG] Permisos extraídos de folders:', tokenData.permissions);
    }
  }
  
  console.log('[AUTH-DEBUG] getAuthToken - Token a codificar:', tokenData);
  
  // Codificar en base64
  const token = btoa(JSON.stringify(tokenData));
  console.log('[AUTH-DEBUG] getAuthToken - Token codificado:', token);
  
  // Almacenar en localStorage para asegurar consistencia
  localStorage.setItem('authToken', token);
  
  return token;
};

export const getCurrentBucket = () => {
  try {
    // Primero intentar obtener desde user_session
    const user = getCurrentUser();
    if (user && user.bucket) {
      console.log('[AUTH-DEBUG] Bucket obtenido de user_session:', user.bucket);
      return user.bucket;
    }
    
    // Si no funciona, intentar desde authToken
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
      try {
        const tokenData = JSON.parse(atob(authToken));
        if (tokenData.bucket) {
          console.log('[AUTH-DEBUG] Bucket obtenido de authToken:', tokenData.bucket);
          return tokenData.bucket;
        }
      } catch (error) {
        console.error('[AUTH-DEBUG] Error al decodificar authToken:', error);
      }
    }
  } catch (error) {
    console.error('[AUTH-DEBUG] Error al obtener bucket:', error);
  }
  
  console.log('[AUTH-DEBUG] Usando bucket por defecto: master');
  return 'master'; // valor por defecto
}

export const hasAdminPermission = (permissionName) => {
  try {
    const user = getCurrentUser();
    
    // Depuración detallada
    console.log(`[PERM-DEBUG] Verificando permiso '${permissionName}' para usuario:`, user ? user.username : 'No autenticado');
    
    if (!user) {
      console.log('[PERM-DEBUG] No hay usuario autenticado');
      return false;
    }
    
    // Si es admin estático (role === 'admin'), siempre tiene todos los permisos
    if (user.role === 'admin' && (!user.type || user.type === 'static')) {
      console.log('[PERM-DEBUG] Usuario es admin estático, permiso concedido');
      return true;
    }
    
    // CASO ESPECIAL: editar metadatos
    if (permissionName === 'edit_metadata') {
      // Para evitar recursión infinita, comprobamos directamente los permisos
      let hasUploadPermission = false;
      
      // Verificar en permissions directamente
      if (user.permissions && user.permissions.upload_files) {
        hasUploadPermission = true;
      } 
      // Verificar en assigned_folders
      else if (user.assigned_folders && Array.isArray(user.assigned_folders)) {
        const permObj = user.assigned_folders.find(
          folder => typeof folder === 'object' && folder.type === 'admin_permissions'
        );
        if (permObj && permObj.permissions && permObj.permissions.upload_files) {
          hasUploadPermission = true;
        }
      }
      // Verificar en folders
      else if (user.folders && Array.isArray(user.folders)) {
        const permObj = user.folders.find(
          folder => typeof folder === 'object' && folder.type === 'admin_permissions'
        );
        if (permObj && permObj.permissions && permObj.permissions.upload_files) {
          hasUploadPermission = true;
        }
      }
      
      if (hasUploadPermission) {
        console.log('[PERM-DEBUG] Permiso edit_metadata concedido porque tiene upload_files');
        return true;
      }
    }
    
    // Verificar en assigned_folders (formato del backend)
    if (user.assigned_folders && Array.isArray(user.assigned_folders)) {
      console.log('[PERM-DEBUG] Verificando en assigned_folders:', user.assigned_folders);
      
      const permissionObj = user.assigned_folders.find(
        folder => typeof folder === 'object' && folder.type === 'admin_permissions'
      );
      
      if (permissionObj) {
        console.log('[PERM-DEBUG] Objeto de permisos encontrado:', permissionObj);
        
        if (permissionObj.permissions && permissionObj.permissions[permissionName]) {
          console.log(`[PERM-DEBUG] Permiso '${permissionName}' concedido desde assigned_folders`);
          return true;
        }
      }
    }
    
    // También verificar en folders (formato del token de sesión)
    if (user.folders && Array.isArray(user.folders)) {
      console.log('[PERM-DEBUG] Verificando en folders:', user.folders);
      
      const permissionObj = user.folders.find(
        folder => typeof folder === 'object' && folder.type === 'admin_permissions'
      );
      
      if (permissionObj) {
        console.log('[PERM-DEBUG] Objeto de permisos encontrado en folders:', permissionObj);
        
        if (permissionObj.permissions && permissionObj.permissions[permissionName]) {
          console.log(`[PERM-DEBUG] Permiso '${permissionName}' concedido desde folders`);
          return true;
        }
      }
    }
    
    // Verificar directamente en el objeto user
    if (user.permissions && typeof user.permissions === 'object') {
      console.log('[PERM-DEBUG] Verificando en user.permissions:', user.permissions);
      
      if (user.permissions[permissionName]) {
        console.log(`[PERM-DEBUG] Permiso '${permissionName}' concedido desde user.permissions`);
        return true;
      }
    }
    
    // Si llegamos hasta aquí, el usuario no tiene el permiso
    console.log(`[PERM-DEBUG] Permiso '${permissionName}' denegado - no encontrado`);
    return false;
  } catch (error) {
    console.error('[PERM-DEBUG] Error al verificar permiso:', error);
    return false;
  }
};