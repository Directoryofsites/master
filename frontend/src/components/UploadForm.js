import React, { useState, useRef, useEffect } from 'react';
import * as api from '../services/api';  // Importar todo el módulo api
import { hasAdminPermission } from '../services/auth';  // Importar función de verificación de permisos

const UploadForm = ({ currentPath, onUploadComplete }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dropAreaRef = useRef(null);

  // Configurar los event listeners para arrastrar y soltar
  useEffect(() => {
    const dropArea = dropAreaRef.current;
    
    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    const highlight = () => {
      setIsDragging(true);
    };
    
    const unhighlight = () => {
      setIsDragging(false);
    };
    
    const handleDrop = (e) => {
      preventDefaults(e);
      unhighlight();
      
      const dt = e.dataTransfer;
      const files = dt.files;
      
      if (files && files.length > 0) {
        setSelectedFiles(Array.from(files));
        setError(null);
      }
    };
    
    // Eventos para prevenir comportamiento predeterminado
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Eventos para resaltar/desresaltar
    ['dragenter', 'dragover'].forEach(eventName => {
      dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    // Evento para manejar el drop
    dropArea.addEventListener('drop', handleDrop, false);
    
    // Limpieza
    return () => {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.removeEventListener(eventName, preventDefaults, false);
        document.body.removeEventListener(eventName, preventDefaults, false);
      });
      
      ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.removeEventListener(eventName, highlight, false);
      });
      
      ['dragleave', 'drop'].forEach(eventName => {
        dropArea.removeEventListener(eventName, unhighlight, false);
      });
      
      dropArea.removeEventListener('drop', handleDrop, false);
    };
  }, []);

  const handleFileChange = (event) => {
    setSelectedFiles(Array.from(event.target.files));
    setError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Verificar si el usuario tiene permiso para subir archivos
  if (!hasAdminPermission('upload_files')) {
    setError('No tienes permiso para subir archivos');
    return;
  }
    
    if (selectedFiles.length === 0) {
      setError('Por favor selecciona al menos un archivo');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Contador para archivos completados
      let completedFiles = 0;
      const totalFiles = selectedFiles.length;
      
      // Resultados de cada carga
      const results = {
        success: [],
        errors: []
      };

      // Cargar cada archivo
      for (const file of selectedFiles) {
        try {
          // Actualizar progreso basado en archivos completados
          const fileProgressBase = (completedFiles / totalFiles) * 100;
          
          // Simular progreso para el archivo actual
          const progressInterval = setInterval(() => {
            const fileProgress = Math.min(90, Math.random() * 30 + 60); // Progreso aleatorio entre 60-90%
            const overallProgress = fileProgressBase + (fileProgress / totalFiles);
            setUploadProgress(Math.min(99, Math.round(overallProgress)));
          }, 300);
          
         // Realizar la carga utilizando el servicio API
const result = await api.uploadFile(file, currentPath);

clearInterval(progressInterval);

// Registrar resultado
if (result && result.success) {
  // Asegurarse que los metadatos estén correctamente configurados
  if (result.filePath) {
    try {
      // Crear metadatos con la fecha actual
      const currentDate = new Date().toISOString().split('T')[0];
      const fileMetadata = {
        uploadDate: currentDate,
        fileDate: currentDate,
        uploadedBy: 'admin1', // O usar la información del usuario actual
        tags: [],
        lastModified: currentDate
      };
      
      // Actualizar los metadatos del archivo recién subido
      await api.updateFileMetadata(result.filePath, fileMetadata);
      console.log(`Metadatos actualizados para ${file.name} con fecha ${currentDate}`);
    } catch (metadataError) {
      console.error(`Error al actualizar los metadatos de ${file.name}:`, metadataError);
    }
  }
  
  results.success.push({
    name: file.name,
    result: result
  });
} else {
  results.errors.push({
    name: file.name,
    error: result && result.message ? result.message : 'Error desconocido'
  });
}
        } catch (fileError) {
          console.error(`Error al subir archivo ${file.name}:`, fileError);
          results.errors.push({
            name: file.name,
            error: fileError.message || 'Error desconocido'
          });
        }
        
        // Incrementar contador de archivos completados
        completedFiles++;
        
        // Actualizar progreso general
        setUploadProgress(Math.round((completedFiles / totalFiles) * 100));
      }
      
      // Finalizar y mostrar resultados
      setTimeout(() => {
        setSelectedFiles([]);
        setUploadProgress(0);
        setIsUploading(false);
        
        if (onUploadComplete) {
          onUploadComplete();
        }
        
        // Mostrar mensaje de resultado
        if (results.errors.length === 0) {
          alert(`${results.success.length} archivo(s) subidos exitosamente`);
        } else if (results.success.length === 0) {
          alert(`Error: No se pudo subir ningún archivo`);
        } else {
          alert(`${results.success.length} archivo(s) subidos exitosamente. ${results.errors.length} archivo(s) fallaron.`);
        }
      }, 500);
    } catch (error) {
      console.error('Error general al subir archivos:', error);
      setError(`Error: ${error.message || 'Ocurrió un error al subir los archivos'}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };
  
  // Eliminar un archivo de la lista de seleccionados
  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="upload-form">
      <h3>Subir Archivos</h3>
      
      <div 
        ref={dropAreaRef}
        className={`drop-area ${isDragging ? 'active' : ''}`}
        style={{
          border: `2px dashed ${isDragging ? '#007bff' : '#ccc'}`,
          borderRadius: '4px',
          padding: '20px',
          textAlign: 'center',
          marginBottom: '15px',
          backgroundColor: isDragging ? 'rgba(0, 123, 255, 0.1)' : 'transparent',
          transition: 'all 0.3s ease'
        }}
      >
        <p style={{ margin: '0', marginBottom: '10px' }}>
          {selectedFiles.length > 0 
            ? `${selectedFiles.length} archivo(s) seleccionado(s)` 
            : isDragging 
              ? '¡Suelta los archivos aquí!' 
              : 'Arrastra y suelta archivos aquí, o...'}
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="file-input-container">
            <input
              type="file"
              onChange={handleFileChange}
              disabled={isUploading}
              className="file-input"
              style={{ margin: '10px 0' }}
              multiple // Permitir selección múltiple
            />
          </div>
          
          {/* Lista de archivos seleccionados */}
          {selectedFiles.length > 0 && (
            <div className="selected-files" style={{
              marginTop: '15px',
              textAlign: 'left',
              maxHeight: '150px',
              overflowY: 'auto',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '10px'
            }}>
              <h4 style={{ marginTop: '0', fontSize: '14px' }}>Archivos seleccionados:</h4>
              <ul style={{ listStyleType: 'none', padding: '0', margin: '0' }}>
                {selectedFiles.map((file, index) => (
                  <li key={index} style={{
                    padding: '5px 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: index < selectedFiles.length - 1 ? '1px solid #eee' : 'none'
                  }}>
                    <span style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                    {!isUploading && (
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'red',
                          cursor: 'pointer',
                          fontSize: '16px'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {error && <div className="error-message" style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
          
          {isUploading && (
            <div className="progress-container" style={{ marginTop: '15px' }}>
              <div 
                className="progress-bar" 
                style={{ 
                  width: `${uploadProgress}%`,
                  height: '10px',
                  backgroundColor: '#007bff',
                  borderRadius: '5px',
                  transition: 'width 0.3s ease'
                }}
              ></div>
              <div className="progress-text" style={{ textAlign: 'center', marginTop: '5px' }}>
                {uploadProgress}% ({Math.round(uploadProgress / 100 * selectedFiles.length)}/{selectedFiles.length} archivos)
              </div>
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={selectedFiles.length === 0 || isUploading}
            className="btn btn-primary upload-btn"
            style={{
              marginTop: '15px',
              padding: '8px 15px',
              backgroundColor: selectedFiles.length === 0 || isUploading ? '#ccc' : '#007bff',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: selectedFiles.length === 0 || isUploading ? 'not-allowed' : 'pointer'
            }}
          >
            {isUploading ? 'Subiendo...' : 'Subir Archivos'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadForm;