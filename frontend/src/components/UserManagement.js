import React, { useState, useEffect } from 'react';
import { BASE_URL, getUsers, createUser, updateUser, deleteUser, getFolderPermissions, updateFolderPermissions } from '../services/api';

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
  
  // Estado para la carpeta que se va a añadir
  const [newFolder, setNewFolder] = useState('');
  
  // Estado para mostrar/ocultar formulario
  const [showForm, setShowForm] = useState(false);
  
  // Cargar lista de usuarios
  const fetchUsers = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const data = await getUsers();
      
      if (data.success) {
        setUsers(data.users || []);
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
      const data = await createUser(formData);
      
      if (data.success) {
        alert('Usuario creado correctamente');
        setFormData({
          username: '',
          password: '',
          assigned_folders: [],
          group_name: ''
        });
        setShowForm(false);
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
    const updateData = { ...formData };
    if (!updateData.password) {
      delete updateData.password;
    }
    
    try {
      const data = await updateUser(selectedUser.id, updateData);
      
      if (data.success) {
        alert('Usuario actualizado correctamente');
        setFormData({
          username: '',
          password: '',
          assigned_folders: [],
          group_name: ''
        });
        setSelectedUser(null);
        setShowForm(false);
        fetchUsers(); // Recargar lista de usuarios
      } else {
        setError(data.message || 'Error al actualizar usuario');
      }
    } catch (err) {
      setError('Error de conexión al actualizar usuario');
      console.error('Error al actualizar usuario:', err);
    }
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
  
  // Editar un usuario existente
  const handleEditUser = (user) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: '', // No mostrar contraseña actual
      assigned_folders: user.assigned_folders || [],
      group_name: user.group_name || ''
    });
    setShowForm(true);
  };
  
  // Cancelar edición/creación
  const handleCancel = () => {
    setSelectedUser(null);
    setFormData({
      username: '',
      password: '',
      assigned_folders: [],
      group_name: ''
    });
    setShowForm(false);
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
                      {user.assigned_folders && user.assigned_folders.length > 0 ? (
                        <ul className="user-folders">
                          {user.assigned_folders.map((folder, idx) => (
                            <li key={idx}>{folder}</li>
                          ))}
                        </ul>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{user.active ? 'Activo' : 'Inactivo'}</td>
                    <td>
                      <button 
                        onClick={() => handleEditUser(user)}
                        className="btn-edit"
                      >
                        Editar
                      </button>
                      {user.active && (
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="btn-delete"
                        >
                          Desactivar
                        </button>
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