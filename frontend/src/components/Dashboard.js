import React, { useState, useEffect } from 'react';

const Dashboard = ({ onClose }) => {

  const [stats, setStats] = useState({
    totalFiles: 0,
    totalFolders: 0,
    totalUsers: 3,
    storageUsed: '0 MB',
    storageTotal: '1 GB',
    storagePercentage: 0,
    recentUploads: 0,
    recentDownloads: 0
  });
  
  // Simulación de carga de datos
  useEffect(() => {
    // Aquí podrías hacer una llamada a la API para obtener datos reales
    // Por ahora usamos datos de muestra con el valor real de almacenamiento
    setTimeout(() => {
      const storageUsed = '116.42 MB';
      const storageTotal = '1 GB';
      // Calculamos el porcentaje - Asumiendo 1 GB = 1024 MB
      const usedMB = 116.42;
      const totalMB = 1024;
      const percentage = Math.round((usedMB / totalMB) * 100);
      
      setStats({
        totalFiles: 217,
        totalFolders: 35,
        totalUsers: 3,
        storageUsed,
        storageTotal,
        storagePercentage: percentage,
        recentUploads: 7,
        recentDownloads: 12
      });
    }, 1000);
  }, []);

  return (
    <div className="dashboard-container">
      <h2>Dashboard de Métricas del Sistema</h2>
      
      <div className="dashboard-grid">
        <div className="metric-card">
          <h3>Archivos</h3>
          <p className="metric-value">{stats.totalFiles}</p>
          <p className="metric-description">Total de archivos en el sistema</p>
        </div>
        
        <div className="metric-card">
          <h3>Carpetas</h3>
          <p className="metric-value">{stats.totalFolders}</p>
          <p className="metric-description">Total de carpetas creadas</p>
        </div>
        
        <div className="metric-card">
          <h3>Usuarios</h3>
          <p className="metric-value">{stats.totalUsers}</p>
          <p className="metric-description">Usuarios registrados</p>
        </div>
        
        <div className="metric-card">
          <h3>Almacenamiento</h3>
          <div className="storage-progress-container">
            <div className="storage-progress-bar">
              <div 
                className="storage-progress" 
                style={{
                  width: `${stats.storagePercentage}%`,
                  backgroundColor: stats.storagePercentage > 90 ? '#dc3545' : 
                                  stats.storagePercentage > 70 ? '#ffc107' : 
                                  '#28a745'
                }}
              ></div>
            </div>
            <span className="storage-percentage">{stats.storagePercentage}%</span>
          </div>
          <p className="metric-description">
            {stats.storageUsed} de {stats.storageTotal} usados
          </p>
        </div>
        
        <div className="metric-card">
          <h3>Actividad Reciente</h3>
          <div className="activity-stats">
            <div className="activity-item">
              <span className="activity-icon">⬆️</span>
              <span className="activity-value">{stats.recentUploads}</span>
              <span className="activity-label">Subidas (7 días)</span>
            </div>
            <div className="activity-item">
              <span className="activity-icon">⬇️</span>
              <span className="activity-value">{stats.recentDownloads}</span>
              <span className="activity-label">Descargas (7 días)</span>
            </div>
          </div>
        </div>
      </div>

      <button onClick={onClose} className="close-dashboard-btn">
        Cerrar Dashboard
      </button>
    </div>
  );
};

export default Dashboard;