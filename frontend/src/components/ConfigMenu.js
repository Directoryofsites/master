import React, { useState, useRef, useEffect } from 'react';

const ConfigMenu = ({ 
  onToggleSettings, 
  onToggleUserManagement, 
  onToggleTagManager, 
  onToggleBackupManager,
  onToggleDashboard
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // Cerrar el menú cuando se hace clic fuera de él
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="config-menu-container" ref={menuRef}>
      <button onClick={toggleMenu} className="config-menu-btn">
        ⚙️ Administración
      </button>
      
      {isOpen && (
        <div className="config-menu-dropdown">
          <button onClick={() => {
            onToggleSettings();
            setIsOpen(false);
          }}>
            ⚙️ Configuración del Sitio
          </button>
          
          <button onClick={() => {
            onToggleUserManagement();
            setIsOpen(false);
          }}>
            👥 Gestión de Usuarios y Permisos
          </button>
          
          <button onClick={() => {
            onToggleTagManager();
            setIsOpen(false);
          }}>
            🏷️ Administración de Taxonomías y Etiquetas
          </button>
          
          <button onClick={() => {
            onToggleBackupManager();
            setIsOpen(false);
          }}>
            💾 Copias de Seguridad y Restauración
          </button>
          
          {onToggleDashboard && (
            <button onClick={() => {
              onToggleDashboard();
              setIsOpen(false);
            }}>
              📊 Dashboard de Métricas del Sistema
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ConfigMenu;