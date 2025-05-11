import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert, Modal, ProgressBar } from 'react-bootstrap';
import axios from 'axios'; // Asegúrate de tener axios instalado

const BackupRestoreManager = () => {
  const [backupStatus, setBackupStatus] = useState('idle');
  const [backupError, setBackupError] = useState(null);
  const [backupResult, setBackupResult] = useState(null);
  const [backupProgress, setBackupProgress] = useState(0);
  
  const [restoreStatus, setRestoreStatus] = useState('idle');
  const [restoreError, setRestoreError] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [backupFile, setBackupFile] = useState(null);
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const [currentBucket, setCurrentBucket] = useState('');
  
  // Obtener el bucket del usuario del localStorage al cargar
useEffect(() => {
  try {
    // Primero intentar obtener el usuario completo (que tiene el formato que veo en los logs)
    const userString = localStorage.getItem('user');
    if (userString) {
      const userData = JSON.parse(userString);
      console.log('Datos de usuario en localStorage:', userData);
      if (userData && userData.bucket) {
        setCurrentBucket(userData.bucket);
        console.log('Bucket obtenido del objeto user:', userData.bucket);
        return;
      }
    }
    
    // Si no funciona, intentar con el token como estaba antes
    const tokenData = localStorage.getItem('token');
    if (tokenData) {
      const decoded = JSON.parse(atob(tokenData));
      console.log('Token decodificado:', decoded);
      setCurrentBucket(decoded.bucket || '');
      console.log('Bucket obtenido del token:', decoded.bucket);
    } else {
      // Último recurso: usar valores duros para pruebas
      console.log('No se encontró información de bucket en localStorage');
      console.log('Estableciendo bucket contenedor003 para pruebas');
      setCurrentBucket('contenedor003'); // Para pruebas
    }
  } catch (error) {
    console.error('Error al obtener bucket del localStorage:', error);
    // Establecer un valor por defecto para pruebas
    setCurrentBucket('contenedor003');
    console.log('Estableciendo bucket contenedor003 debido a error');
  }
}, []);

  // Crear backup
  const handleCreateBackup = async () => {
    console.log('Función handleCreateBackup ejecutada');
    console.log('Bucket actual:', currentBucket);
    
    if (!currentBucket) {
      setBackupError('No se ha identificado un bucket válido');
      return;
    }
    
    try {
      console.log('Iniciando proceso de backup...');
      setBackupStatus('loading');
      setBackupError(null);
      setBackupProgress(10);
      
      // Usar la nueva ruta API
      console.log(`Haciendo solicitud a: http://localhost:3000/api/backup/create/${currentBucket}`);
      const response = await axios.get(`http://localhost:3000/api/backup/create/${currentBucket}`);
      
      console.log('Respuesta recibida:', response.data);
      setBackupProgress(70);
      
      const data = response.data;
      setBackupProgress(100);
      
      setBackupResult(data);
      setBackupStatus('success');
    } catch (error) {
      console.error('Error al crear backup:', error);
      setBackupError(error.response?.data?.message || error.message || 'Error al crear el backup');
      setBackupStatus('error');
    }
  };

 // Descargar backup
  const handleDownloadBackup = () => {
    if (backupResult && backupResult.filename) {
      window.location.href = `http://localhost:3000/api/backup/download/${backupResult.filename}`;
    }
  };

  // Manejar cambio de archivo para restauración
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBackupFile(file);
      setRestoreError(null);
    }
  };
  
  // Mostrar modal de confirmación
  const confirmRestore = () => {
    console.log('Función confirmRestore ejecutada');
    setShowConfirmModal(true);
  };
  
  // Restaurar desde backup
  const handleRestore = async () => {
    console.log('Función handleRestore ejecutada');
    
    if (!backupFile) {
      setRestoreError('Por favor seleccione un archivo de respaldo');
      return;
    }
    
    setShowConfirmModal(false);
    setRestoreStatus('loading');
    setRestoreError(null);
    setRestoreProgress(10);
    
    // Crear FormData para enviar el archivo
    const formData = new FormData();
    formData.append('backupFile', backupFile);
    formData.append('targetBucket', currentBucket);
    
    // Logs para depuración
    console.log('Archivo a subir:', backupFile);
    console.log('Bucket destino:', currentBucket);
    
   // Llamada a la API para restaurar usando una ruta directa
    console.log('Realizando solicitud a ruta directa para restaurar...');
    
    try {
      const response = await axios.post('http://localhost:3000/direct_restore', formData, {

        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 50) / progressEvent.total);
          setRestoreProgress(percentCompleted);
        }
      });
      
      console.log('Respuesta recibida, status:', response.status);
      setRestoreProgress(90);
      
      const data = response.data;
      setRestoreProgress(100);
      
      setRestoreStatus('success');
      
      // Recargar la página después de 3 segundos para mostrar los cambios
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
    } catch (error) {
      console.error('Error al restaurar:', error);
      setRestoreError(error.response?.data?.message || error.message || 'Error al restaurar desde backup');
      setRestoreStatus('error');
    }
  };

  return (
    <Container className="my-4">
      <h2 className="mb-4">Copias de Seguridad y Restauración</h2>
      
      <Row>
        {/* Sección de Crear Backup */}
        <Col md={6} className="mb-4">
          <Card>
            <Card.Header>Crear Copia de Seguridad</Card.Header>
            <Card.Body>
              <p>Crea una copia de seguridad completa del bucket actual ({currentBucket || 'No identificado'}).</p>
              
              {backupStatus === 'loading' && (
                <div className="my-3">
                  <ProgressBar animated now={backupProgress} />
                  <p className="text-center mt-2">Creando copia de seguridad...</p>
                </div>
              )}
              
              {backupStatus === 'success' && (
                <Alert variant="success">
                  <Alert.Heading>¡Copia de seguridad creada!</Alert.Heading>
                  <p>La copia de seguridad se ha creado correctamente.</p>
                  <Button 
                    variant="outline-success" 
                    onClick={handleDownloadBackup}
                    className="mt-2"
                  >
                    Descargar archivo de copia
                  </Button>
                </Alert>
              )}
              
              {backupStatus === 'error' && (
                <Alert variant="danger">
                  <Alert.Heading>Error</Alert.Heading>
                  <p>{backupError}</p>
                </Alert>
              )}
              
              <div className="d-grid gap-2">

                <Button 
                  variant="primary" 
                  onClick={handleCreateBackup} 
                  disabled={backupStatus === 'loading'}
                >
                  {backupStatus === 'loading' ? 'Creando...' : 'Crear Copia de Seguridad'}
                </Button>

              </div>
            </Card.Body>
          </Card>
        </Col>
        
        {/* Sección de Restaurar Backup */}
        <Col md={6}>
          <Card>
            <Card.Header>Restaurar desde Copia de Seguridad</Card.Header>
            <Card.Body>
              <p className="text-warning">
                <strong>Advertencia:</strong> La restauración reemplazará datos existentes. Realice una copia de seguridad antes de continuar.
              </p>
              
              <Form.Group controlId="backupFile" className="mb-3">
                <Form.Label>Seleccionar archivo de copia de seguridad</Form.Label>
                <Form.Control 
                  type="file" 
                  accept=".zip"
                  onChange={handleFileChange}
                />
              </Form.Group>
              
              {restoreStatus === 'loading' && (
                <div className="my-3">
                  <ProgressBar animated now={restoreProgress} />
                  <p className="text-center mt-2">Restaurando desde copia de seguridad...</p>
                </div>
              )}
              
              {restoreStatus === 'success' && (
                <Alert variant="success">
                  <Alert.Heading>¡Restauración completada!</Alert.Heading>
                  <p>La restauración se ha completado correctamente.</p>
                  <p>La página se recargará automáticamente.</p>
                </Alert>
              )}
              
              {restoreStatus === 'error' && (
                <Alert variant="danger">
                  <Alert.Heading>Error</Alert.Heading>
                  <p>{restoreError}</p>
                </Alert>
              )}
              
              {restoreError && restoreStatus !== 'error' && (
                <Alert variant="danger">
                  <p>{restoreError}</p>
                </Alert>
              )}
              
              <div className="d-grid gap-2">
                <Button 
                  variant="warning" 
                  onClick={confirmRestore} 
                  disabled={!backupFile || restoreStatus === 'loading'}
                >
                  {restoreStatus === 'loading' ? 'Restaurando...' : 'Restaurar desde Copia'}
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Log para depuración */}
      {console.log('Estado del modal:', showConfirmModal)}
      
      {/* Modal de confirmación para restauración */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar Restauración</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>¿Está seguro de que desea restaurar desde la copia de seguridad?</p>
          <p className="text-danger">
            <strong>Advertencia:</strong> Esta acción reemplazará los datos existentes y no se puede deshacer.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleRestore}>
            Sí, Restaurar
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default BackupRestoreManager;