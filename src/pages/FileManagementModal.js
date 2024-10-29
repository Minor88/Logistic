import React, { useState } from 'react';
import { Modal, Button, Tree, Upload, Input, message, Popconfirm } from 'antd';
import { UploadOutlined, DeleteOutlined, FolderAddOutlined, DownloadOutlined } from '@ant-design/icons'; // Удаляем PlusOutlined
import axios from 'axios';

const FileManagementModal = ({ visible, onClose, shipmentId, fetchShipmentFiles, currentShipmentRecord }) => {
  const [selectedFolderKey, setSelectedFolderKey] = useState('root');
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);

  const API_BASE_URL = localStorage.getItem('base_url');
  const token = localStorage.getItem('token'); // Добавляем токен для авторизации
  const headers = { Authorization: `Token ${token}` };


  // Подготовка данных для отображения папок в дереве
  const prepareFolderTreeData = () => {
    if (!currentShipmentRecord || !currentShipmentRecord.folders) {
      return [{ title: 'Корневая папка', key: 'root', children: [] }];
    }
    const folders = currentShipmentRecord.folders.map(folder => ({
      title: (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span>{folder.name}</span>
          <Popconfirm
            title="Удалить папку и все вложенные файлы?"
            onConfirm={() => handleDelete(folder.id, true)}
          >
            <Button
              icon={<DeleteOutlined />}
              danger
              size="small"
              style={{ marginLeft: '10px' }}
            />
          </Popconfirm>
        </div>
      ),
      key: folder.id.toString(),
      children: [],
    }));
    return [{ title: 'Корневая папка', key: 'root', children: folders }];
  };

  // Подготовка списка файлов для выбранной папки
  const prepareFilesInSelectedFolder = () => {
    if (!currentShipmentRecord || !currentShipmentRecord.files) {
      return [];
    }
    return currentShipmentRecord.files
      .filter(file => (file.folder ? file.folder.id.toString() === selectedFolderKey : selectedFolderKey === 'root'))
      .map(file => (
        <div key={file.id} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(file.id)}
            style={{ marginRight: '10px' }}
          >
            {file.file}
          </Button>
          <Popconfirm title="Удалить?" onConfirm={() => handleDelete(file.id, false)}>
          <Button
              icon={<DeleteOutlined />}
              danger
              size="small"
              style={{ marginLeft: '10px' }}
            />
          </Popconfirm>
        </div>
      ));
  };


  // Загрузка новых файлов
  const handleFileUpload = async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Token ${token}` };
    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));
  
    // Если выбрана корневая папка, передаем null; иначе - id выбранной папки
    const folderId = selectedFolderKey === 'root' ? '' : selectedFolderKey;
    formData.append('folder_id', folderId); // передаем folder_id вместо имени папки
    
    try {
      await axios.post(`${API_BASE_URL}/logistic/api/shipments/${shipmentId}/upload_files/`, formData, { headers });
      message.success('Файлы успешно загружены');
      setSelectedFiles([]);
      fetchShipmentFiles(); // обновляем список файлов и папок
    } catch (error) {
      console.error(error);
      message.error('Ошибка загрузки файлов');
    }
  };

  // Создание новой папки
  const handleCreateFolder = async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Token ${token}` };
    try {
      await axios.post(`${API_BASE_URL}/logistic/api/shipments/${shipmentId}/create_folder/`, { folder_name: newFolderName }, { headers });
      message.success('Папка создана');
        setNewFolderName(''); // очищаем поле ввода имени папки
        fetchShipmentFiles(); // обновляем список папок и файлов
    } catch (error) {
      console.error(error);
      message.error('Ошибка создания папки');
    }
  };

  // Удаление файла или папки
const handleDelete = async (key, isFolder) => {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Token ${token}` };
  const url = isFolder
    ? `${API_BASE_URL}/logistic/api/shipments/${shipmentId}/folders/${key}`
    : `${API_BASE_URL}/logistic/api/shipments/${shipmentId}/files/${key}`;

  try {
    await axios.delete(url, { headers });
    message.success(`${isFolder ? 'Папка' : 'Файл'} успешно удален`);
    fetchShipmentFiles(); // обновляем список файлов и папок
  } catch (error) {
    console.error(error);
    message.error(`Ошибка при удалении ${isFolder ? 'папки' : 'файла'}`);
  }
};

  // Скачивание файла
  const handleDownload = (fileId) => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Token ${token}` };
    axios({
      url: `${API_BASE_URL}/logistic/api/shipments/${shipmentId}/download_file/${fileId}/`,
      method: 'GET',
      responseType: 'blob',
      headers,
    })
    .then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
  
      // Попытка получить имя файла из заголовка Content-Disposition
      const contentDisposition = response.headers['content-disposition'];
      console.log('Заголовок Content-Disposition:', contentDisposition);  // Для отладки
  
      let fileName = 'default_filename';
  
      if (contentDisposition) {
        // Проверяем наличие Base64-кодировки для UTF-8
        const base64Match = contentDisposition.match(/=\?utf-8\?b\?(.+)\?=/i);
        if (base64Match && base64Match[1]) {
          // Декодируем Base64-строку и преобразуем в строку UTF-8
          const base64String = base64Match[1];
          const decodedFileName = decodeURIComponent(escape(atob(base64String)));  // Декодируем Base64 в UTF-8
          console.log('Декодированное имя файла:', decodedFileName);
  
          // Применяем регулярное выражение для извлечения имени файла из декодированной строки
          const fileNameMatch = decodedFileName.match(/filename="?([^"]+)"?/i);
          if (fileNameMatch && fileNameMatch[1]) {
            fileName = fileNameMatch[1];
          }
        } else {
          // Фолбэк на обычное имя файла
          const fileNameFallbackMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
          if (fileNameFallbackMatch && fileNameFallbackMatch[1]) {
            fileName = fileNameFallbackMatch[1];
          }
        }
      }
  
      console.log('Имя файла:', fileName);  // Для отладки
  
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link); // Удаляем элемент после скачивания
    })
    .catch((error) => {
      console.error('Ошибка при скачивании файла:', error);
      message.error('Ошибка при скачивании файла');
    });
  };

  // Закрытие окна
  const handleClose = () => {
    onClose();
    setSelectedFolderKey('root');
  };

  return (
    <Modal
      title="Управление файлами отправления"
      open={visible}
      onCancel={handleClose}
      footer={null}
      style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}  // Заменяем bodyStyle на style
    >
      {/* Верхняя часть: список папок */}
      <div style={{ flex: '1', paddingBottom: '20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Input
            placeholder="Имя новой папки"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            style={{ width: '60%' }}
          />
          <Button
            icon={<FolderAddOutlined />}
            type="primary"
            onClick={handleCreateFolder}
            disabled={!newFolderName}
          >
            Создать папку
          </Button>
        </div>
        <Tree
          treeData={prepareFolderTreeData()}
          onSelect={(keys) => setSelectedFolderKey(keys[0])}
          defaultExpandAll
          style={{ marginTop: '10px', flexGrow: 1, overflowY: 'auto' }}
        />
      </div>

      {/* Нижняя часть: список файлов */}
      <div style={{ flex: '2', borderTop: '1px solid #f0f0f0', paddingTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <Upload
            multiple
            beforeUpload={(file) => {
              setSelectedFiles([...selectedFiles, file]);
              return false;
            }}
            fileList={selectedFiles}
            onRemove={(file) => setSelectedFiles(selectedFiles.filter(f => f !== file))}
          >
            <Button icon={<UploadOutlined />}>Выбрать файлы</Button>
          </Upload>
          <Button type="primary" onClick={handleFileUpload} style={{ marginTop: 0 }}>
            Загрузить файлы
          </Button>
        </div>
        <div style={{ overflowY: 'auto', height: '100%' }}>{prepareFilesInSelectedFolder()}</div>
      </div>
    </Modal>
  );
};

export default FileManagementModal;