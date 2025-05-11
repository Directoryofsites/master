import React, { useState, useEffect } from 'react';
import { BASE_URL, getUsers, createUser, updateUser, deleteUser, getFolderPermissions, updateFolderPermissions } from '../services/api';

// Lista de permisos administrativos disponibles
const ADMIN_PERMISSIONS = [
  { id: 'create_folders', label: 'Crear carpetas' },
  { id: 'delete_folders', label: 'Eliminar carpetas' },
  { id: 'upload_files', label: 'Subir archivos' },
  { id: 'delete_files', label: 'Eliminar archivos' },
  { id: 'rename_folders', label: 'Renombrar carpetas' },
  { id: 'rename_files', label: 'Renombrar archivos' },
  { id: 'duplicate_files', label: 'Duplicar archivos' },
  { id: 'duplicate_folders', label: 'Duplicar carpetas' },
  { id: 'copy_files', label: 'Copiar archivos' },
  { id: 'generate_backup', label: 'Generar copias de seguridad' },
  { id: 'manage_tags', label: 'Gestionar etiquetas' },
  { id: 'manage_users', label: 'Gestionar usuarios' },
  { id: 'manage_media_links', label: 'Gestionar enlaces multimedia' }
];

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Estado para el formulario de creación/edición
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    assigned_folders: [],
    group_name: ''
  });
  
  // Estado para los permisos administrativos
  const [adminPermissions, setAdminPermissions] = useState({});
  
  // Estado para la carpeta que se va a añadir
  const [newFolder, setNewFolder] = useState('');
  
  // Estado para mostrar/ocultar formulario
  const [showForm, setShowForm] = useState(false);
  
  // Estado para depuración
  const [debugInfo, setDebugInfo] = useState('');
  
  // Cargar lista de usuarios
  const fetchUsers = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const data = await getUsers();
      
      if (data.success) {
        console.log('Usuarios cargados:', JSON.stringify(data.users, null, 2));
        
        // Verificar explícitamente la estructura de permisos para cada usuario
        const usersWithVerifiedPerms = data.users.map(user => {
          const permissionsObj = user.assigned_folders?.find(folder => 
            typeof folder === 'object' && folder.type === 'admin_permissions'
          );
          
          if (permissionsObj) {
            console.log(`Usuario ${user.username} tiene permisos:`, 
              JSON.stringify(permissionsObj.permissions, null, 2));
          } else {
            console.log(`Usuario ${user.username} no tiene permisos administrativos`);
          }
          
          return user;
        });
        
        setUsers(usersWithVerifiedPerms || []);
      } else {
        setError(data.message || 'Error al cargar usuarios');
      }
    } catch (err) {
      setError('Error de conexión al cargar usuarios');
      console.error('Error al cargar usuarios:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Cargar usuarios al montar el componente
  useEffect(() => {
    fetchUsers();
  }, []);
  
  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Manejar cambios en los permisos administrativos
  const handlePermissionChange = (permissionId) => {
    setAdminPermissions(prev => {
      const updatedPermissions = {
        ...prev,
        [permissionId]: !prev[permissionId]
      };
      console.log('Permisos actualizados:', updatedPermissions);
      return updatedPermissions;
    });
  };
  
  // Añadir una carpeta a la lista
  const handleAddFolder = () => {
    if (!newFolder) return;
    
    // Asegurarse de que la carpeta comience con /
    const folderPath = newFolder.startsWith('/') ? newFolder : `/${newFolder}`;
    
    // Verificar que la carpeta no esté ya en la lista
    if (formData.assigned_folders.includes(folderPath)) {
      alert('Esta carpeta ya está en la lista');
      return;
    }
    
    setFormData({
      ...formData,
      assigned_folders: [...formData.assigned_folders, folderPath]
    });
    
    setNewFolder('');
  };
  
  // Eliminar una carpeta de la lista
  const handleRemoveFolder = (folder) => {
    setFormData({
      ...formData,
      assigned_folders: formData.assigned_folders.filter(f => f !== folder)
    });
  };
  
  // Preparar los datos de usuario con permisos administrativos
const prepareUserData = () => {
  const userData = { ...formData };
  
  // IMPORTANTE: NO filtrar objetos de carpetas asignadas aquí
  // Solo filtrar cadenas repetidas o valores no válidos si es necesario
  
  // Verificar si hay al menos un permiso activo
  const activePermissions = {};
  let hasActivePermissions = false;
  
  // Recorrer todos los permisos y agregar solo los que están en true
  Object.keys(adminPermissions).forEach(permId => {
    if (adminPermissions[permId] === true) {
      activePermissions[permId] = true;
      hasActivePermissions = true;
    }
  });
  
  // Eliminar cualquier objeto de permisos anterior en assigned_folders
  userData.assigned_folders = userData.assigned_folders.filter(folder => 
    !(typeof folder === 'object' && folder.type === 'admin_permissions')
  );
  
  // Crear objeto de permisos administrativos solo si hay al menos uno activo
  if (hasActivePermissions) {
    const permissionsObj = {
      type: 'admin_permissions',
      permissions: activePermissions
    };
    
    // Añadir a las carpetas asignadas
    userData.assigned_folders.push(permissionsObj);
    
    console.log('Datos preparados con permisos:', JSON.stringify(permissionsObj, null, 2));
    setDebugInfo(JSON.stringify(userData.assigned_folders, null, 2));
  } else {
    console.log('No hay permisos activos para guardar');
    setDebugInfo('No hay permisos activos para guardar');
  }
  
  return userData;
};
  
  // Crear un nuevo usuario
const handleCreateUser = async (e) => {
  e.preventDefault();
  setError('');
  
  // Validar datos
  if (!formData.username || !formData.password) {
    setError('El nombre de usuario y la contraseña son obligatorios');
    return;
  }
  
  try {
    const userData = prepareUserData();
    
    // Agregar log de depuración
    console.log('Enviando datos para nuevo usuario:', userData);
    
    // Si no existe el campo bucket, la API lo agregará automáticamente usando el del admin
    const data = await createUser(userData);
    
    if (data.success) {
      alert('Usuario creado correctamente');
      resetForm();
      fetchUsers(); // Recargar lista de usuarios
    } else {
      setError(data.message || 'Error al crear usuario');
    }
  } catch (err) {
    setError('Error de conexión al crear usuario');
    console.error('Error al crear usuario:', err);
  }
};
  
  // Actualizar un usuario existente
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!selectedUser) return;
    
    // Preparar datos para actualización (omitir contraseña si está vacía)
    const updateData = prepareUserData();
    if (!updateData.password) {
      delete updateData.password;
    }
    
    // Logs detallados para depuración
    console.log('Enviando datos para actualizar usuario:', JSON.stringify(updateData, null, 2));
    console.log('Permisos enviados:', JSON.stringify(adminPermissions, null, 2));
    
    // Verificar si hay un objeto de permisos en assigned_folders
    const hasPermissionsObj = updateData.assigned_folders?.some(
      folder => typeof folder === 'object' && folder.type === 'admin_permissions'
    );
    console.log('¿Contiene objeto de permisos?', hasPermissionsObj);
    
    if (hasPermissionsObj) {
      const permObj = updateData.assigned_folders.find(
        folder => typeof folder === 'object' && folder.type === 'admin_permissions'
      );
      console.log('Objeto de permisos:', JSON.stringify(permObj, null, 2));
    }
    
    try {
      const data = await updateUser(selectedUser.id, updateData);
      
      if (data.success) {
        alert('Usuario actualizado correctamente');
        console.log('Respuesta del servidor:', JSON.stringify(data, null, 2));
        resetForm();
        fetchUsers(); // Recargar lista de usuarios
      } else {
        setError(data.message || 'Error al actualizar usuario');
        console.error('Error del servidor:', data);
      }


    } catch (err) {
      setError('Error de conexión al actualizar usuario');
      console.error('Error al actualizar usuario:', err);
    }
  };
  
  // Resetear el formulario y estados relacionados
  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      assigned_folders: [],
      group_name: ''
    });
    setAdminPermissions({});
    setSelectedUser(null);
    setShowForm(false);
    setDebugInfo('');
  };
  
  // Desactivar un usuario
  const handleDeleteUser = async (userId) => {
    // Usar window.confirm en lugar de confirm global
    if (!window.confirm('¿Estás seguro de que deseas desactivar este usuario?')) {
      return;
    }
    
    setError('');
    
    try {
      const data = await deleteUser(userId);
      
      if (data.success) {
        alert('Usuario desactivado correctamente');
        fetchUsers(); // Recargar lista de usuarios
      } else {
        setError(data.message || 'Error al desactivar usuario');
      }
    } catch (err) {
      setError('Error de conexión al desactivar usuario');
      console.error('Error al desactivar usuario:', err);
    }
  };

  // Reactivar un usuario
const handleReactivateUser = async (user) => {
  if (!window.confirm('¿Estás seguro de que deseas reactivar este usuario?')) {
    return;
  }
  
  setError('');
  
  try {
    // Para reactivar, simplemente actualizamos el campo active a true
    const data = await updateUser(user.id, { active: true });
    
    if (data.success) {
      alert('Usuario reactivado correctamente');
      fetchUsers(); // Recargar lista de usuarios
    } else {
      setError(data.message || 'Error al reactivar usuario');
    }
  } catch (err) {
    setError('Error de conexión al reactivar usuario');
    console.error('Error al reactivar usuario:', err);
  }
};

// Eliminar permanentemente un usuario
const handlePermanentDelete = async (userId) => {
  if (!window.confirm('¿Estás seguro de que deseas ELIMINAR PERMANENTEMENTE este usuario? Esta acción no se puede deshacer.')) {
    return;
  }
  
  setError('');
  
  try {
    // Necesitamos implementar esta función en api.js
    const data = await deleteUser(userId, true); // El segundo parámetro indica eliminación permanente
    
    if (data.success) {
      alert('Usuario eliminado permanentemente');
      fetchUsers(); // Recargar lista de usuarios
    } else {
      setError(data.message || 'Error al eliminar usuario');
    }
  } catch (err) {
    setError('Error de conexión al eliminar usuario');
    console.error('Error al eliminar usuario:', err);
  }
};
  
  // Editar un usuario existente
  const handleEditUser = (user) => {
    console.log('Usuario a editar:', user);
    setSelectedUser(user);
    
    // Filtrar las carpetas para excluir objetos (permisos)
    const stringFolders = user.assigned_folders
      ? user.assigned_folders.filter(f => typeof f === 'string')
      : [];
    
    // Preparar datos del formulario
    setFormData({
      username: user.username,
      password: '', // No mostrar contraseña actual
      assigned_folders: stringFolders,
      group_name: user.group_name || ''
    });
    
    // Extraer permisos administrativos existentes
    const permissionsObj = user.assigned_folders?.find(folder => 
      typeof folder === 'object' && folder.type === 'admin_permissions'
    );
    
    console.log('Objeto de permisos encontrado:', permissionsObj);
    
    // Inicializar permisos en falso para todos los permisos disponibles
    const defaultPerms = {};
    ADMIN_PERMISSIONS.forEach(perm => {
      defaultPerms[perm.id] = false;
    });
    
    if (permissionsObj && permissionsObj.permissions) {
      // Combinar con los permisos existentes
      const existingPerms = permissionsObj.permissions;
      
      const mergedPerms = { ...defaultPerms };
      
      // Activar los permisos que están en true en el objeto existente
      Object.keys(existingPerms).forEach(key => {
        if (existingPerms[key] === true) {
          mergedPerms[key] = true;
        }
      });
      
      console.log('Permisos combinados:', mergedPerms);
      setAdminPermissions(mergedPerms);
      setDebugInfo(JSON.stringify(permissionsObj, null, 2));
    } else {
      // Si no hay permisos, usar todos en falso
      console.log('No se encontraron permisos, usando valores por defecto');
      setAdminPermissions(defaultPerms);
      setDebugInfo('No se encontraron permisos para este usuario');
    }
    
    setShowForm(true);
  };
  
  // Cancelar edición/creación
  const handleCancel = () => {
    resetForm();
  };
  
  // Función para renderizar los permisos de un usuario en la tabla
  const renderUserPermissions = (user) => {
    const permissionsObj = user.assigned_folders?.find(folder => 
      typeof folder === 'object' && folder.type === 'admin_permissions'
    );
    
    if (!permissionsObj || !permissionsObj.permissions) {
      return <span>Ninguno</span>;
    }
    
    const activePermissions = Object.entries(permissionsObj.permissions)
      .filter(([_, value]) => value === true)
      .map(([key, _]) => {
        const permission = ADMIN_PERMISSIONS.find(p => p.id === key);
        return permission ? permission.label : key;
      });
    
    if (activePermissions.length === 0) {
      return <span>Ninguno</span>;
    }
    
    return (
      <ul className="user-permissions">
        {activePermissions.map((perm, idx) => (
          <li key={idx}>{perm}</li>
        ))}
      </ul>
    );
  };
  
  return (
    <div className="user-management">
      <h2>Gestión de Usuarios</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="user-management-actions">
        {!showForm && (
          <button 
            onClick={() => setShowForm(true)} 
            className="btn-create-user"
          >
            Crear Nuevo Usuario
          </button>
        )}
      </div>
      
      {showForm && (
        <div className="user-form-container">
          <h3>{selectedUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</h3>
          <form onSubmit={selectedUser ? handleUpdateUser : handleCreateUser}>
            <div className="form-group">
              <label htmlFor="username">Nombre de Usuario</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                disabled={selectedUser}
                placeholder="Nombre de usuario"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">
                Contraseña {selectedUser && '(dejar en blanco para mantener actual)'}
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required={!selectedUser}
                placeholder="Contraseña"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="group_name">Grupo (opcional)</label>
              <input
                type="text"
                id="group_name"
                name="group_name"
                value={formData.group_name}
                onChange={handleInputChange}
                placeholder="Nombre del grupo"
              />
            </div>
            
            <div className="form-group">
              <label>Carpetas Asignadas</label>
              <div className="folder-input-group">
                <input
                  type="text"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  placeholder="Ruta de carpeta (ej. /documentos)"
                />
                <button 
                  type="button" 
                  onClick={handleAddFolder}
                  className="btn-add-folder"
                >
                  Añadir
                </button>
              </div>
              
              <ul className="folder-list">
                {formData.assigned_folders.map((folder, index) => (
                  <li key={index}>
                    {folder}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveFolder(folder)}
                      className="btn-remove-folder"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Nueva sección de permisos administrativos */}
            <div className="form-group admin-permissions-section">
              <label>Permisos Administrativos</label>
              <p className="help-text">
                Selecciona los permisos administrativos que deseas asignar a este usuario:
              </p>
              
              <div className="permissions-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '10px',
                marginTop: '15px'
              }}>
                {ADMIN_PERMISSIONS.map(permission => (
                  <div key={permission.id} className="permission-item" style={{
                    display: 'flex',
                    alignItems: 'center',
                    margin: '5px 0'
                  }}>
                    <input
                      type="checkbox"
                      id={`perm-${permission.id}`}
                      checked={!!adminPermissions[permission.id]}
                      onChange={() => handlePermissionChange(permission.id)}
                      style={{ marginRight: '8px' }}
                    />
                    <label htmlFor={`perm-${permission.id}`}>{permission.label}</label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Información de depuración */}
            {debugInfo && (
              <div className="debug-info" style={{
                marginTop: '20px',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: '#f9f9f9'
              }}>
                <h4>Información de Permisos (Debug)</h4>
                <pre style={{ overflow: 'auto', maxHeight: '200px' }}>{debugInfo}</pre>
              </div>
            )}
            
            <div className="form-actions">
              <button type="submit" className="btn-save">
                {selectedUser ? 'Actualizar Usuario' : 'Crear Usuario'}
              </button>
              <button 
                type="button" 
                onClick={handleCancel}
                className="btn-cancel"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
      
      {isLoading ? (
        <div className="loading">Cargando usuarios...</div>
      ) : (
        <div className="users-list">
          <h3>Usuarios Existentes</h3>
          {users.length === 0 ? (
            <p>No hay usuarios creados</p>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Grupo</th>
                  <th>Carpetas</th>
                  <th>Permisos Administrativos</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className={!user.active ? 'user-inactive' : ''}>
                    <td>{user.username}</td>
                    <td>{user.group_name || '-'}</td>
                    <td>
                      {user.assigned_folders && user.assigned_folders.filter(f => typeof f === 'string').length > 0 ? (
                        <ul className="user-folders">
                          {user.assigned_folders.filter(f => typeof f === 'string').map((folder, idx) => (
                            <li key={idx}>{folder}</li>
                          ))}
                        </ul>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{renderUserPermissions(user)}</td>
                    <td>{user.active ? 'Activo' : 'Inactivo'}</td>

                    <td>
  <button 
    onClick={() => handleEditUser(user)}
    className="btn-edit"
  >
    Editar
  </button>
  {user.active ? (
    <button 
      onClick={() => handleDeleteUser(user.id)}
      className="btn-delete"
    >
      Desactivar
    </button>
  ) : (
    <>
      <button 
        onClick={() => handleReactivateUser(user)}
        className="btn-reactivate"
        style={{ backgroundColor: '#28a745', color: 'white', marginRight: '5px' }}
      >
        Reactivar
      </button>
      <button 
        onClick={() => handlePermanentDelete(user.id)}
        className="btn-permanent-delete"
        style={{ backgroundColor: '#dc3545', color: 'white' }}
      >
        Eliminar
      </button>
    </>
  )}
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default UserManagement;