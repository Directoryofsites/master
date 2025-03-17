import React, { useState, useEffect } from 'react';

const SiteSettings = ({ onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [logo, setLogo] = useState('');
  const [previewLogo, setPreviewLogo] = useState('');

  // Cargar configuración actual al iniciar
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('siteSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setTitle(settings.title || 'Explorador de Archivos');
        setSubtitle(settings.subtitle || '');
        setLogo(settings.logo || '');
        setPreviewLogo(settings.logo || '');
      } else {
        // Valores por defecto
        setTitle('Explorador de Archivos');
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    }
  }, []);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Leer el archivo como URL de datos
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setLogo(base64String);
        setPreviewLogo(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = () => {
    const settings = {
      title: title || 'Explorador de Archivos',
      subtitle,
      logo
    };
    
    try {
      localStorage.setItem('siteSettings', JSON.stringify(settings));
      if (onSave) {
        onSave(settings);
      }
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      alert('Error al guardar la configuración');
    }
  };

  return (
    <div className="site-settings-overlay">
      <div className="site-settings-container">
        <h2>Configuración del Sitio</h2>
        
        <div className="settings-form">
          <div className="form-group">
            <label htmlFor="site-title">Título del Sitio:</label>
            <input
              id="site-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del sitio"
              className="settings-input"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="site-subtitle">Subtítulo:</label>
            <input
              id="site-subtitle"
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Subtítulo del sitio"
              className="settings-input"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="site-logo">Logo:</label>
            <input
              id="site-logo"
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="settings-input"
            />
            {previewLogo && (
              <div className="logo-preview">
                <p>Vista previa:</p>
                <img src={previewLogo} alt="Logo preview" style={{ maxWidth: '200px', maxHeight: '100px' }} />
              </div>
            )}
          </div>
        </div>
        
        <div className="settings-actions">
          <button onClick={handleSaveSettings} className="save-settings-btn">Guardar</button>
          <button onClick={onClose} className="cancel-settings-btn">Cancelar</button>
        </div>
      </div>
    </div>
  );
};

export default SiteSettings;