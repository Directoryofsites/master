import React, { useState, useEffect } from 'react';
import { getCurrentBucket, getAuthToken } from '../services/auth';

// Estilos para el componente
const styles = {
  container: {
    marginTop: '20px',
    padding: '15px',
    border: '1px solid #e0e0e0',
    borderRadius: '5px',
    backgroundColor: '#f9f9f9'
  },
  userRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    margin: '5px 0',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px'
  },
  button: {
    padding: '5px 10px',
    margin: '0 5px',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  input: {
    padding: '5px',
    margin: '0 5px',
    borderRadius: '4px',
    border: '1px solid #ccc'
  },
  title: {
    marginBottom: '15px',
    color: '#333'
  },
  message: {
    marginTop: '10px',
    padding: '10px',
    borderRadius: '4px',
  },
  success: {
    backgroundColor: '#d4edda',
    color: '#155724'
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24'
  },
  warning: {
    backgroundColor: '#fff3cd',
    color: '#856404'
  }
};

const RestoreUserManager = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('info');
  const [editingUser, setEditingUser] = useState(null);
  const [newUsername, setNewUsername] = useState('');
  const currentBucket = getCurrentBucket();

  // Cargar usuarios al montar el componente
  useEffect(() => {
    fetchUsers();
  }, []);

  // Función para obtener usuarios
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      
      const response = await fetch(`/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener usuarios');
      }
      
      const data = await response.json();
      
      // Filtrar usuarios que parecen ser restaurados (contienen _ en su nombre)
      const restoredUsers = data.filter(user => 
        user.username.includes('_') && 
        user.bucket === currentBucket
      );
      
      setUsers(restoredUsers);
      
      if (restoredUsers.length === 0) {
        setMessage('No se encontraron usuarios restaurados en este bucket');
        setMessageType('info');
      }
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      setMessage(`Error: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // Función para actualizar nombre de usuario
  const updateUsername = async (userId, newName) => {
    if (!newName || newName.trim() === '') {
      setMessage('El nombre de usuario no puede estar vacío');
      setMessageType('error');
      return;
    }
    
    try {
      setLoading(true);
      const token = getAuthToken();
      
      const response = await fetch(`/api/admin/users/${userId}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          newUsername: newName,
          bucket: currentBucket
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar nombre de usuario');
      }
      
      // Actualizar la lista de usuarios
      fetchUsers();
      
      setMessage(`Usuario actualizado correctamente a: ${newName}`);
      setMessageType('success');
      setEditingUser(null);
      setNewUsername('');
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      setMessage(`Error: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // Función para eliminar un usuario
  const deleteUser = async (userId, username) => {
    if (!window.confirm(`¿Está seguro que desea eliminar el usuario ${username}?`)) {
      return;
    }
    
    try {
      setLoading(true);
      const token = getAuthToken();
      
      // Primero, intentamos una estrategia alternativa para usuarios restaurados
      const fixResponse = await fetch(`/api/admin/users/${userId}/fix`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (fixResponse.ok) {
        console.log('Usuario arreglado para permitir eliminación');
      }
      
      // Ahora intentamos eliminar el usuario
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar usuario');
      }
      
      // Actualizar la lista de usuarios
      fetchUsers();
      
      setMessage(`Usuario ${username} eliminado correctamente`);
      setMessageType('success');
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      setMessage(`Error: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // Función para desactivar un usuario
  const deactivateUser = async (userId, username) => {
    try {
      setLoading(true);
      const token = getAuthToken();
      
      // Primero, intentamos arreglar el usuario restaurado
      const fixResponse = await fetch(`/api/admin/users/${userId}/fix`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (fixResponse.ok) {
        console.log('Usuario arreglado para permitir desactivación');
      }
      
      // Ahora intentamos desactivar el usuario
      const response = await fetch(`/api/admin/users/${userId}/deactivate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al desactivar usuario');
      }
      
      // Actualizar la lista de usuarios
      fetchUsers();
      
      setMessage(`Usuario ${username} desactivado correctamente`);
      setMessageType('success');
    } catch (error) {
      console.error('Error al desactivar usuario:', error);
      setMessage(`Error: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  // Iniciar la edición de un nombre de usuario
  const startEdit = (user) => {
    setEditingUser(user.id);
    setNewUsername(user.username);
  };

  // Cancelar la edición
  const cancelEdit = () => {
    setEditingUser(null);
    setNewUsername('');
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Gestión de Usuarios Restaurados</h3>
      
      <p>
        Esta herramienta le permite gestionar usuarios que han sido restaurados desde un backup.
        Puede cambiar sus nombres de usuario para eliminar sufijos y corregir problemas de activación/eliminación.
      </p>
      
      <button 
        onClick={fetchUsers} 
        style={styles.button}
        disabled={loading}
      >
        {loading ? 'Cargando...' : 'Actualizar Lista'}
      </button>
      
      {message && (
        <div style={{...styles.message, ...styles[messageType]}}>
          {message}
        </div>
      )}
      
      {users.length > 0 ? (
        <div style={{ marginTop: '15px' }}>
          {users.map(user => (
            <div key={user.id} style={styles.userRow}>
              {editingUser === user.id ? (
                <>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    style={styles.input}
                  />
                  <div>
                    <button
                      onClick={() => updateUsername(user.id, newUsername)}
                      style={{...styles.button, backgroundColor: '#28a745', color: 'white', border: 'none'}}
                      disabled={loading}
                    >
                      Guardar
                    </button>
                    <button
                      onClick={cancelEdit}
                      style={{...styles.button, backgroundColor: '#6c757d', color: 'white', border: 'none'}}
                      disabled={loading}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong>{user.username}</strong> (Bucket: {user.bucket}, Activo: {user.active ? 'Sí' : 'No'})
                  </div>
                  <div>
                    <button
                      onClick={() => startEdit(user)}
                      style={{...styles.button, backgroundColor: '#007bff', color: 'white', border: 'none'}}
                      disabled={loading}
                    >
                      Editar Nombre
                    </button>
                    <button
                      onClick={() => deactivateUser(user.id, user.username)}
                      style={{...styles.button, backgroundColor: '#ffc107', border: 'none'}}
                      disabled={loading}
                    >
                      Desactivar
                    </button>
                    <button
                      onClick={() => deleteUser(user.id, user.username)}
                      style={{...styles.button, backgroundColor: '#dc3545', color: 'white', border: 'none'}}
                      disabled={loading}
                    >
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p>No se encontraron usuarios restaurados que requieran atención.</p>
      )}
    </div>
  );
};

export default RestoreUserManager;