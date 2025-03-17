import React, { useState } from 'react';
import * as api from '../services/api';  // Importar todo el módulo api

const UploadForm = ({ currentPath, onUploadComplete }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!selectedFile) {
      setError('Por favor selecciona un archivo');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Simular progreso de carga
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) clearInterval(progressInterval);
          return Math.min(prev + 10, 90);
        });
      }, 300);

      // Realizar la carga utilizando el servicio API
      const result = await api.uploadFile(selectedFile, currentPath);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (result && result.success) {
        setTimeout(() => {
          setSelectedFile(null);
          setUploadProgress(0);
          setIsUploading(false);
          
          if (onUploadComplete) {
            onUploadComplete();
          }
          
          alert('Archivo subido exitosamente');
        }, 500); // Pequeña pausa para mostrar el 100% antes de resetear
      } else {
        setError(`Error: ${result && result.message ? result.message : 'No se pudo subir el archivo'}`);
        setIsUploading(false);
      }
    } catch (error) {
      console.error('Error al subir archivo:', error);
      setError(`Error: ${error.message || 'Ocurrió un error al subir el archivo'}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="upload-form">
      <h3>Subir Archivo</h3>
      
      <form onSubmit={handleSubmit}>
        <div className="file-input-container">
          <input
            type="file"
            onChange={handleFileChange}
            disabled={isUploading}
            className="file-input"
          />
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        {isUploading && (
          <div className="progress-container">
            <div 
              className="progress-bar" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
            <div className="progress-text">{uploadProgress}%</div>
          </div>
        )}
        
        <button 
          type="submit" 
          disabled={!selectedFile || isUploading}
          className="btn btn-primary upload-btn"
        >
          {isUploading ? 'Subiendo...' : 'Subir Archivo'}
        </button>
      </form>
    </div>
  );
};

export default UploadForm;