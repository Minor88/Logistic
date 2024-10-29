import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Table, Input, Button, Select, Popconfirm, Form, Upload, message } from 'antd';
import { UploadOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, CheckOutlined, CloseOutlined, MailOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';  // Импортируем библиотеку для работы с Excel
import './ManagerDashboard.css';  // Подключаем стили
import { SearchOutlined } from '@ant-design/icons'; // Импортируем иконку поиска
import { Space } from 'antd'; // Импортируем необходимые компоненты для поиска
import Highlighter from 'react-highlight-words'; // Для выделения найденных слов
import { Modal } from 'antd';
import { DatePicker } from 'antd';
import FileManagementModal from './FileManagementModal';


//const API_BASE_URL = process.env.REACT_APP_API_BASE_URL_LOCAL; // Локальная среда
const API_BASE_URL = localStorage.getItem('base_url');

const { RangePicker } = DatePicker;  // Для фильтрации по диапазону дат
const { Option } = Select;

const normalizeDecimalInput = (value) => {
  return value.replace(',', '.');
};

function ManagerDashboard() {
  const [shipments, setShipments] = useState([]);
  const [clients, setClients] = useState([]);
  const [requests, setRequests] = useState([]);
  const [newShipment, setNewShipment] = useState({ number: '', status: '', comment: '' });
  const [newRequest, setNewRequest] = useState({ description: '', declared_weight: null, declared_volume: null, comment: '', client: '', status: '', shipment: '' });
  const [isViewing, setIsViewing] = useState('shipments');
  const [editingKey, setEditingKey] = useState('');  // Для редактирования
  const [form] = Form.useForm();
  const searchInput = useRef(null);
  const [isShipmentModalVisible, setIsShipmentModalVisible] = useState(false);
  const [isRequestModalVisible, setIsRequestModalVisible] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filteredShipments, setFilteredShipments] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [isFileModalVisible, setIsFileModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);  // Текущая запись, для которой открыто окно
  const [currentShipmentRecord, setCurrentShipmentRecord] = useState(null);
  const [selectedShipmentFiles, setSelectedShipmentFiles] = useState([]);
  const [isShipmentFileModalVisible, setIsShipmentFileModalVisible] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(null); // Текущая папка

  

  const statusOptions = [
    { value: 'at_warehouse', label: 'Формируется на складе' },
    { value: 'document_preparation', label: 'Подготовка документов' },
    { value: 'departed', label: 'Вышел со склада' },
    { value: 'border_crossing', label: 'Прохождение границы' },
    { value: 'customs_clearance', label: 'Таможенная очистка' },
    { value: 'on_way_to_warehouse', label: 'В пути на склад выгрузки' },
    { value: 'at_unloading_warehouse', label: 'На складе выгрузки' },
    { value: 'done', label: 'Завершен' }
  ];

  const statusOptionsRequests = [
    { value: 'new', label: 'Новая заявка' },
    { value: 'expected', label: 'Ожидается на складе' },
    { value: 'on_warehouse', label: 'Формируется' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'ready', label: 'Готово к выдаче' },
    { value: 'delivered', label: 'Выдано' }
  ];

  // Обработчик изменений таблицы
  const handleTableChange = (pagination, filters, sorter, extra) => {
    if (isViewing === 'shipments') {
      setFilteredShipments(extra.currentDataSource);  // Сохраняем отфильтрованные данные для отправлений
    } else if (isViewing === 'requests') {
      setFilteredRequests(extra.currentDataSource);   // Сохраняем отфильтрованные данные для заявок
    }
  };

  // Функция отправки писем
  const handleSendEmails = async (shipment) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Token ${token}` };
  
      // Получаем все заявки, связанные с отправлением
      const response = await axios.get(`${API_BASE_URL}/logistic/api/requests/`, { headers });
      const relatedRequests = response.data.filter(request => request.shipment === shipment.id);
  
      // Извлекаем уникальные id клиентов
      const clientIds = [...new Set(relatedRequests.map(request => request.client))];

      // Находим читаемую метку статуса
      const readableStatus = statusOptions.find((option) => option.value === shipment.status)?.label || shipment.status;
  
      // Подготовка писем для отправки
      const emailPromises = clientIds.map(clientId =>
        axios.post(`${API_BASE_URL}/logistic/api/send-email/`, {
          client_id: clientId,  // Отправляем client_id, а не email
          subject: `Отправление №${shipment.number}`,
          message: `Статус отправления: ${readableStatus}\nКомментарий: ${shipment.comment}`,
        }, { headers })
      );
  
      // Отправляем письма
      await Promise.all(emailPromises);
      message.success('Письма отправлены всем клиентам');
    } catch (error) {
      console.error('Ошибка при отправке писем', error);
      message.error('Ошибка при отправке писем');
    }
  };


  // Функция для экспорта данных в Excel
  const exportToExcel = (data, columns, fileName) => {
    // Создаем массив для экспорта
    const exportData = data.map((item) => {
      const row = {};
  
      // Преобразуем каждый элемент данных в объект для экспорта
      columns.forEach((col) => {
        if (col.dataIndex === 'client') {
          // Преобразуем id клиента в имя
          const client = clients.find((c) => c.id === item[col.dataIndex]);
          row[col.title] = client ? client.name : '';
        } else if (col.dataIndex === 'shipment') {
          // Преобразуем id отправления в номер
          const shipment = shipments.find((s) => s.id === item[col.dataIndex]);
          row[col.title] = shipment ? shipment.number : '';
        } else if (col.dataIndex === 'status') {
          // Обрабатываем статусы для заявок и отправлений отдельно
          const statusOptionsToUse = isViewing === 'shipments' ? statusOptions : statusOptionsRequests;
  
          const statusLabel = statusOptionsToUse.find((opt) => opt.value === item[col.dataIndex])?.label || '';
          row[col.title] = statusLabel;
        } else if (col.dataIndex === 'shipment_status') {
          // Обрабатываем статус отправления в заявках
          const shipment = shipments.find((s) => s.id === item['shipment']);
          const shipmentStatusLabel = shipment ? statusOptions.find((opt) => opt.value === shipment.status)?.label || '' : '';
          row[col.title] = shipmentStatusLabel;
        } else if (col.dataIndex === 'shipment_comment') {
          // Добавляем комментарий отправления
          const shipment = shipments.find((s) => s.id === item['shipment']);
          row[col.title] = shipment ? shipment.comment || '' : '';  // Если есть отправление, подтягиваем комментарий, иначе пусто
        } else if (col.dataIndex === 'created_at') {
          // Форматируем дату
          row[col.title] = new Date(item[col.dataIndex]).toLocaleDateString();
        } else if (col.dataIndex !== 'files' && col.dataIndex !== 'actions') {
          // Добавляем все остальные колонки, исключая файлы и действия
          row[col.title] = item[col.dataIndex] || '';
        }
      });
  
      return row;
    });
  
    // Создаем новую книгу Excel и добавляем данные
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
    // Генерируем Excel файл и загружаем
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  // Кнопка экспорта
  const ExportButton = ({ data, columns, fileName }) => (
    <Button
      type="primary"
      icon={<DownloadOutlined />}
      onClick={() => exportToExcel(data, columns, fileName)}
    >
      Экспортировать в Excel
    </Button>
  );


  // Функция фильтрации дат
  const getColumnDateFilterProps = (dataIndex) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
      <div style={{ padding: 8 }}>
        <RangePicker
          onChange={(dates) => {
            if (dates) {
              setSelectedKeys([dates.map(date => date.toISOString())]);
            } else {
              setSelectedKeys([]);
            }
          }}
          style={{ width: 220 }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() => confirm()}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90 }}
          >
            Применить
          </Button>
          <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
            Сбросить
          </Button>
        </Space>
      </div>
    ),
    onFilter: (value, record) => {
      const [start, end] = value || [];
      const recordDate = new Date(record[dataIndex]).toISOString();
      return recordDate >= start && recordDate <= end;
    },
    render: (text) => text ? new Date(text).toLocaleDateString() : '',
  });

  // Функция для загрузки заявок
  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Token ${token}` };
      //const requestsResponse = await axios.get('http://localhost:8000/logistic/api/requests/', { headers });
      const requestsResponse = await axios.get(`${API_BASE_URL}/logistic/api/requests/`, { headers });
      setRequests(requestsResponse.data.map((request) => ({ ...request, key: request.id })));
    } catch (error) {
      console.error('Ошибка загрузки данных заявок', error);
    }
  };

  const showShipmentModal = () => {
    setIsShipmentModalVisible(true);
  };
  
  // Подтверждение добавления отправления из модального окна
  const handleShipmentModalOk = () => {
    handleAddShipment();  // Здесь вызывается функция добавления отправления
    setIsShipmentModalVisible(false);
  };
  
  const handleShipmentModalCancel = () => {
    setIsShipmentModalVisible(false);
  };
  
  const showRequestModal = () => {
    setIsRequestModalVisible(true);
  };
  
  // Подтверждение добавления заявки из модального окна
  const handleRequestModalOk = () => {
    handleAddRequest();  // Здесь вызывается функция добавления заявки
    setIsRequestModalVisible(false);
  };
  
  const handleRequestModalCancel = () => {
    setIsRequestModalVisible(false);
  };

  const shipmentModal = (
    <Modal
      title="Создать отправление"
      open={isShipmentModalVisible}  // Заменяем visible на open
      onOk={handleShipmentModalOk}
      onCancel={handleShipmentModalCancel}
      okText="Создать"
      cancelText="Отмена"
    >
      <form>
        <div className="form-field">
          <label className="form-label">Номер отправления:</label>
          <Input
            value={newShipment.number}
            onChange={(e) => setNewShipment({ ...newShipment, number: e.target.value })}
          />
          <small>Введите уникальный номер отправления.</small>
        </div>
        <div className="form-field">
          <label className="form-label">Статус:</label>
          <Select
            value={newShipment.status}
            onChange={(value) => setNewShipment({ ...newShipment, status: value })}
            popupMatchSelectWidth={false}  // Отключаем подгонку ширины
            style={{ width: '100%' }}  // Устанавливаем полную ширину для самого компонента
          >
            {statusOptions.map((option) => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
          <small>Выберите статус отправления.</small>
        </div>
        <div className="form-field">
          <label className="form-label">Комментарий:</label>
          <Input
            value={newShipment.comment}
            onChange={(e) => setNewShipment({ ...newShipment, comment: e.target.value })}
          />
          <small>Добавьте дополнительную информацию.</small>
        </div>
      </form>
    </Modal>
  );

  // Для корректного отображения названия файла с кириллицей
  const decodeFileName = (fileUrl) => {
    const fileName = decodeURIComponent(fileUrl.split('/').pop());  // Декодируем часть URL с именем файла
    return fileName;
  };

  const beforeFileUpload = (file) => {
    // Добавляем уникальный идентификатор для каждого файла
    file.uid = `${file.name}-${Date.now()}`;
    setSelectedFiles((prevFiles) => [...prevFiles, file]);
    return false;  // Не загружаем файл автоматически
  };

  const handleExistingFileUpload = (file, requestId) => {
    handleUpload([file], requestId);  // Используем функцию загрузки с массивом из одного файла
    return false;  // Предотвращаем автоматическую загрузку файла по умолчанию
  };

  // Для существующих заявок - автоматическая загрузка
  const renderFileUploadForExistingRequests = (record) => (
    <Upload
      multiple
      beforeUpload={(file) => handleExistingFileUpload(file, record.id)}  // Загружаем файл сразу при выборе
      fileList={[]}
    >
      <Button icon={<UploadOutlined />}>Загрузить файлы</Button>
    </Upload>
  );

  // Функция удаления файла из списка выбранных файлов
  const handleRemoveSelectedFile = (fileToRemove) => {
    setSelectedFiles((prevFiles) => prevFiles.filter(file => file.uid !== fileToRemove.uid));
  };

  // Для новых заявок - добавляем в selectedFiles, но не загружаем сразу
  const renderFileUploadForNewRequest = (
    <Upload
      multiple
      beforeUpload={beforeFileUpload}  // Добавляем файл в массив
      fileList={selectedFiles.map((file) => ({
        uid: file.uid,  // Уникальный идентификатор файла
        name: decodeFileName(file.name), // Используем decodeFileName для корректного отображения имени файла
        status: 'done', // Имитируем, что файл уже выбран
        url: file.url || '', // Если есть URL, можно показать превью
      }))}
      onRemove={(file) => handleRemoveSelectedFile(file)}  // Добавляем обработчик удаления файла
    >
      <Button icon={<UploadOutlined />}>Загрузить файлы</Button>
    </Upload>
  );


  const requestModal = (
    <Modal
      title="Создать заявку"
      open={isRequestModalVisible}  // Заменяем visible на open
      onOk={handleRequestModalOk}
      onCancel={handleRequestModalCancel}
      okText="Создать"
      cancelText="Отмена"
    >
      <form>
      <div className="form-field">
        <label className="form-label">Номер:</label>
        <Input
          value={newRequest.number}
          onChange={(e) => setNewRequest({ ...newRequest, number: e.target.value })}
        />
        <small>Введите номер заявки.</small>
      </div>

      <div className="form-field">
        <label className="form-label">Складской №:</label>
        <Input
          value={newRequest.warehouse_number}
          onChange={(e) => setNewRequest({ ...newRequest, warehouse_number: e.target.value })}
        />
        <small>Введите складской номер.</small>
      </div>

      <div className="form-field">
        <label className="form-label">Фактический вес (кг):</label>
        <Input
          value={newRequest.actual_weight}
          onChange={(e) => setNewRequest({ ...newRequest, actual_weight: normalizeDecimalInput(e.target.value) })}
        />
        <small>Введите фактический вес.</small>
      </div>

      <div className="form-field">
        <label className="form-label">Фактический объем (м³):</label>
        <Input
          value={newRequest.actual_volume}
          onChange={(e) => setNewRequest({ ...newRequest, actual_volume: normalizeDecimalInput(e.target.value) })}
        />
        <small>Введите фактический объем.</small>
      </div>

      <div className="form-field">
        <label className="form-label">Ставка:</label>
        <Input
          value={newRequest.rate}
          onChange={(e) => setNewRequest({ ...newRequest, rate: e.target.value })}
        />
        <small>Введите ставку для заявки.</small>
      </div>

        <div className="form-field">
          <label className="form-label">Описание:</label>
            <Input
              value={newRequest.description}
              onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
            />
          <small>Введите описание заявки (необязательно).</small>
        </div>

        <div className="form-field">
          <label className="form-label">Количество мест:</label>
          <Input
            value={newRequest.col_mest}
            onChange={(e) => setNewRequest({ ...newRequest, col_mest: normalizeDecimalInput(e.target.value) })}
          />
          <small>Введите количество мест.</small>
        </div>

      <div className="form-field">
        <label className="form-label">Вес (кг):</label>
        <Input
          value={newRequest.declared_weight}
          onChange={(e) => setNewRequest({ ...newRequest, declared_weight: normalizeDecimalInput(e.target.value) })}
        />
        <small>Введите заявленный вес.</small>
      </div>

      <div className="form-field">
        <label className="form-label">Объем (м³):</label>
        <Input
          value={newRequest.declared_volume}
          onChange={(e) => setNewRequest({ ...newRequest, declared_volume: normalizeDecimalInput(e.target.value) })}
        />
        <small>Введите заявленный объем.</small>
      </div>

      <div className="form-field">
        <label className="form-label">Комментарий:</label>
        <Input
          value={newRequest.comment}
          onChange={(e) => setNewRequest({ ...newRequest, comment: e.target.value })}
        />
        <small>Добавьте дополнительную информацию.</small>
      </div>

      <div className="form-field">
        <label className="form-label">Клиент:</label>
          <Select
            showSearch
            value={newRequest.client || undefined}  // Добавляем fallback на undefined
            onChange={(value) => {
              setNewRequest({ ...newRequest, client: value });
              console.log("Клиент выбран:", value);  // Проверяем, что значение клиента обновляется
            }}
            style={{ width: '100%' }}
            placeholder="Выберите клиента"
            optionFilterProp="children"
            filterOption={(input, option) =>
              option.children.toLowerCase().includes(input.toLowerCase())
            }
          >
            {clients.map((client) => (
              <Option key={client.id} value={client.id}>
                {client.name}
              </Option>
            ))}
          </Select>
        <small>Выберите клиента.</small>
      </div>

      <div className="form-field">
        <label className="form-label">Статус:</label>
        <Select
          value={newRequest.status}
          onChange={(value) => setNewRequest({ ...newRequest, status: value })}
          style={{ width: '100%' }}
        >
          {statusOptionsRequests.map((option) => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
        <small>Выберите статус заявки.</small>
      </div>

      <div className="form-field">
        <label className="form-label">Отправление:</label>
          <Select
            showSearch
            value={newRequest.shipment || undefined}  // Поле может быть пустым
            onChange={(value) => setNewRequest({ ...newRequest, shipment: value || null })}
            style={{ width: '100%' }}
            placeholder="Выберите отправление (необязательно)"
            optionFilterProp="children"
            filterOption={(input, option) =>
              option.children.toLowerCase().includes(input.toLowerCase())
            }
          >
            {shipments.map((shipment) => (
              <Option key={shipment.id} value={shipment.id}>
                {shipment.number}
              </Option>
            ))}
          </Select>
        <small>Выберите отправление для заявки.</small>
      </div>

      <div className="form-field">
        <label className="form-label">Файлы:</label>
        {renderFileUploadForNewRequest}  {/* Файлы добавляются, но не загружаются сразу */}
        <small>Загрузите необходимые файлы для заявки.</small>
      </div>
    </form>
    </Modal>
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Token ${token}` };

        //const shipmentsResponse = await axios.get('http://localhost:8000/logistic/api/shipments/', { headers });
        const shipmentsResponse = await axios.get(`${API_BASE_URL}/logistic/api/shipments/`, { headers });
        setShipments(shipmentsResponse.data.map((shipment) => ({ ...shipment, key: shipment.id })));

        //const clientsResponse = await axios.get('http://localhost:8000/logistic/api/clients/', { headers });
        const clientsResponse = await axios.get(`${API_BASE_URL}/logistic/api/clients/`, { headers });
        setClients(clientsResponse.data);

        //const requestsResponse = await axios.get('http://localhost:8000/logistic/api/requests/', { headers });
        const requestsResponse = await axios.get(`${API_BASE_URL}/logistic/api/requests/`, { headers });
        setRequests(requestsResponse.data.map((request) => ({ ...request, key: request.id })));

        fetchRequests(); // Загружаем заявки
      } catch (error) {
        console.error('Ошибка загрузки данных', error);
      }
    };

    fetchData();
  }, []);

  // Для корректного отображения названия файла с кириллицей
  //const decodeFileName = (fileUrl) => {
    //const fileName = decodeURIComponent(fileUrl.split('/').pop());  // Декодируем часть URL с именем файла
    //return fileName;
  //};

   // Загрузка файла на сервер
 const handleUpload = async (files, requestId) => {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Token ${token}` };
  const formData = new FormData();

  const fileArray = Array.isArray(files) ? files : [files];  // Проверка на массив

  fileArray.forEach((file) => {
    formData.append('files', file);
  });

  try {
    //await axios.post(`http://localhost:8000/logistic/api/requests/${requestId}/upload_files/`, formData, { headers });
    await axios.post(`${API_BASE_URL}/logistic/api/requests/${requestId}/upload_files/`, formData, { headers });
    //const response = await axios.post(`http://localhost:8000/logistic/api/requests/${requestId}/upload_files/`, formData, { headers });
    message.success('Файлы успешно загружены');


    // Обновляем список файлов в currentRecord вручную, добавив новые файлы
    if (currentRecord && currentRecord.id === requestId) {
      setCurrentRecord(prevRecord => ({
        ...prevRecord,
        files: prevRecord.files ? [...prevRecord.files, ...fileArray.map(file => ({ file: file.name }))] : [...fileArray.map(file => ({ file: file.name }))]
      }));
    }

    fetchRequests();  // Обновляем заявки
  } catch (error) {
    console.error('Ошибка при загрузке файлов', error);
    message.error('Ошибка при загрузке файлов');
  }
};


  // Удаление файла с сервера
  const handleDeleteFile = async (requestId, fileId) => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Token ${token}` };
    
    try {
      //await axios.delete(`http://localhost:8000/logistic/api/requests/${requestId}/files/${fileId}/`, { headers });
      await axios.delete(`${API_BASE_URL}/logistic/api/requests/${requestId}/files/${fileId}/`, { headers });
      message.success('Файл успешно удален');

    // Проверяем, если currentRecord соответствует requestId
    if (currentRecord && currentRecord.id === requestId) {
      setCurrentRecord(prevRecord => ({
        ...prevRecord,
        files: prevRecord.files.filter(file => file.id !== fileId)  // Удаляем файл из списка
      }));
    }

      fetchRequests(); // Обновление списка после удаления
    } catch (error) {
      console.error('Ошибка при удалении файла', error);
      message.error('Ошибка при удалении файла');
    }
  };

// Скачивание файла
const handleDownloadFile = (requestId, fileId) => {
  const token = localStorage.getItem('token');

  axios({
    //url: `http://localhost:8000/logistic/api/requests/${requestId}/download_file/${fileId}/`,  // Поправленный URL
    url: `${API_BASE_URL}/logistic/api/requests/${requestId}/download_file/${fileId}/`,  // Поправленный URL
    method: 'GET',
    responseType: 'blob',
    headers: { Authorization: `Token ${token}` },
  })
  .then((response) => {
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;

    // Получаем заголовок Content-Disposition
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

//Модальное окно взфаимодействия с файлами

const openFileModal = (record) => {
  setCurrentRecord(record);  // Устанавливаем текущую запись
  setIsFileModalVisible(true);  // Открываем модальное окно
};

const closeFileModal = () => {
  setIsFileModalVisible(false);  // Закрываем модальное окно
};

const fileModal = (
  <Modal
    title="Управление файлами"
    open={isFileModalVisible}  // Используем open вместо visible
    onCancel={closeFileModal}  // Закрываем окно
    footer={null}  // Убираем стандартные кнопки
  >
    <div>
      {Array.isArray(currentRecord?.files) && currentRecord.files.length > 0 ? (
        currentRecord.files.map((file, index) => (
          <div key={index} style={{ marginBottom: '10px' }}>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadFile(currentRecord.id, file.id)}  // Скачиваем файл
              style={{ marginRight: '10px' }}
            >
              {decodeFileName(file.file)} {/* Для корректного отображения кириллических символов */}
            </Button>
            <Button
              icon={<DeleteOutlined />}
              danger
              onClick={() => handleDeleteFile(currentRecord.id, file.id)}  // Удаляем файл
            >
              Удалить
            </Button>
          </div>
        ))
      ) : (
        <p>Нет файлов</p>
      )}
    </div>
    <div style={{ marginTop: '20px' }}>
      {renderFileUploadForExistingRequests(currentRecord)}  {/* Функция загрузки для существующих записей */}
    </div>
  </Modal>
);

// Открытие модального окна для работы с файлами отправления
const openShipmentFileModal = (record) => {
  setCurrentShipmentRecord(record);
  fetchShipmentFiles(record.id); // Загружаем файлы и папки для отправления
  setIsShipmentFileModalVisible(true);
};

// Закрытие модального окна для файлов
/*const closeShipmentFileModal = () => {
  setIsShipmentFileModalVisible(false);
  setCurrentShipmentRecord(null);
  setSelectedShipmentFiles([]);
};*/
const closeShipmentFileModal = () => {
  setIsShipmentFileModalVisible(false);
  setCurrentShipmentRecord(null); // Сбрасываем запись, чтобы избежать ошибки
};

// Функция для загрузки списка файлов и папок отправления
const fetchShipmentFiles = async (shipmentId) => {
  try {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Token ${token}` };
    const response = await axios.get(`${API_BASE_URL}/logistic/api/shipments/${shipmentId}/files/`, { headers });

    // Обновляем состояние для текущей записи отправления
    setCurrentShipmentRecord((prevRecord) => ({
      ...prevRecord,
      files: response.data.files,
      folders: response.data.folders
    }));
  } catch (error) {
    console.error("Ошибка при загрузке файлов и папок", error);
    message.error("Ошибка при загрузке файлов и папок");
  }
};


// Модальное окно для управления файлами отправления с функциями для создания, удаления папок и работы с файлами
const shipmentFileModal = (
  /*<Modal
    title="Управление файлами отправления"
    open={isShipmentFileModalVisible}
    onCancel={closeShipmentFileModal}
    footer={null}
  >*/
    <FileManagementModal
      visible={isShipmentFileModalVisible}
      onClose={closeShipmentFileModal}
      shipmentId={currentShipmentRecord?.id}
      fetchShipmentFiles={() => fetchShipmentFiles(currentShipmentRecord.id)}
      currentShipmentRecord={currentShipmentRecord}
    />
  /*</Modal>*/
);

  //Поиск в сортировке
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');

  const handleSearch = (selectedKeys, confirm, dataIndex) => {
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };

  const handleReset = (clearFilters) => {
    clearFilters();
    setSearchText('');
  };

  const getColumnSearchProps = (dataIndex) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
      <div style={{ padding: 8 }}>
        <Input
          ref={searchInput}
          placeholder={`Поиск по ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
          style={{ marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90 }}
          >
            Поиск
          </Button>
          <Button onClick={() => handleReset(clearFilters)} size="small" style={{ width: 90 }}>
            Сброс
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
    onFilter: (value, record) => {
      if (dataIndex === 'client') {
        // Ищем клиента по имени
        const clientName = clients.find((c) => c.id === record.client)?.name || '';
        return clientName.toLowerCase().includes(value.toLowerCase());
      } else {
        // Поиск для обычных полей
        return record[dataIndex]
          ? record[dataIndex].toString().toLowerCase().includes(value.toLowerCase())
          : '';
      }
    },
    onFilterDropdownOpenChange: (visible) => {
      if (visible) {
        setTimeout(() => searchInput.current.select(), 100); // Используем current для focus
      }
    },
    render: (text) =>
      searchedColumn === dataIndex ? (
        <Highlighter
          highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
          searchWords={[searchText]}
          autoEscape
          textToHighlight={text ? text.toString() : ''}
        />
      ) : (
        text
      ),
  });

  // Функция для проверки, находится ли запись в режиме редактирования
  const isEditing = (record) => record.key === editingKey;

  // Начать редактирование
  const edit = (record) => {
    form.setFieldsValue({ ...record });
    setEditingKey(record.key);
  };

  // Отмена редактирования
  const cancel = () => setEditingKey('');

  // Сохранение изменений
  const save = async (key) => {
    try {
      const row = await form.validateFields();
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Token ${token}` };

      if (isViewing === 'shipments') {
        // Логика сохранения для отправлений
        const newData = [...shipments];
        const index = newData.findIndex((item) => key === item.key);

        if (index > -1) {
          const item = newData[index];
          newData.splice(index, 1, { ...item, ...row });
          setShipments(newData);
          setEditingKey('');
          //await axios.put(`http://localhost:8000/logistic/api/shipments/${item.id}/`, row, { headers });
          await axios.put(`${API_BASE_URL}/logistic/api/shipments/${item.id}/`, row, { headers });
          console.log('Отправление успешно обновлено');
        } else {
          newData.push(row);
          setShipments(newData);
          setEditingKey('');
        }
      } else if (isViewing === 'requests') {
        // Логика сохранения для заявок
        const newData = [...requests];
        const index = newData.findIndex((item) => key === item.key);

        if (index > -1) {
          const item = newData[index];
          newData.splice(index, 1, { ...item, ...row });
          setRequests(newData);
          setEditingKey('');
          //await axios.put(`http://localhost:8000/logistic/api/requests/${item.id}/`, row, { headers });
          await axios.put(`${API_BASE_URL}/logistic/api/requests/${item.id}/`, row, { headers });
          console.log('Заявка успешно обновлена');
        } else {
          newData.push(row);
          setRequests(newData);
          setEditingKey('');
        }
      }
    } catch (err) {
      console.error('Ошибка при сохранении данных:', err);
    }
  };

  // Удаление отправления
  const deleteShipment = async (shipmentId) => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Token ${token}` };
    try {
      //await axios.delete(`http://localhost:8000/logistic/api/shipments/${shipmentId}/`, { headers });
      await axios.delete(`${API_BASE_URL}/logistic/api/shipments/${shipmentId}/`, { headers });
      setShipments(shipments.filter((shipment) => shipment.id !== shipmentId));
    } catch (error) {
      console.error('Ошибка удаления отправления', error);
    }
  };

  // Удаление заявки
  const deleteRequest = async (requestId) => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Token ${token}` };
    try {
      //await axios.delete(`http://localhost:8000/logistic/api/requests/${requestId}/`, { headers });
      await axios.delete(`${API_BASE_URL}/logistic/api/requests/${requestId}/`, { headers });
      setRequests(requests.filter((request) => request.id !== requestId));
    } catch (error) {
      console.error('Ошибка удаления заявки', error);
    }
  };

  // Добавление нового отправления
  const handleAddShipment = async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Token ${token}` };
  
    try {
      //const response = await axios.post('http://localhost:8000/logistic/api/shipments/', newShipment, { headers });
      const response = await axios.post(`${API_BASE_URL}/logistic/api/shipments/`, newShipment, { headers });
      setShipments([...shipments, { ...response.data, key: response.data.id }]);
      setNewShipment({ number: '', status: '', comment: '' });
      message.success('Отправление успешно добавлено');
    } catch (error) {
      console.error('Ошибка добавления отправления', error);
      message.error('Ошибка добавления отправления');
    }
  };

  // Добавление новой заявки
  const handleAddRequest = async () => {
    console.log("Данные заявки перед отправкой:", newRequest);  // Проверяем данные перед отправкой
  
    // Проверяем обязательные поля
    if (!newRequest.client || !newRequest.status) {
      message.error('Пожалуйста, заполните все обязательные поля.');
      return;
    }

    // Если фактический вес или объем пусты, заменяем на null
    const preparedRequest = {
      ...newRequest,
      actual_weight: newRequest.actual_weight === "" ? null : newRequest.actual_weight,
      actual_volume: newRequest.actual_volume === "" ? null : newRequest.actual_volume,
    };
  
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Token ${token}` };

    try {
      // Сначала создаём заявку
      //const response = await axios.post('http://localhost:8000/logistic/api/requests/', newRequest, { headers });
      const response = await axios.post(`${API_BASE_URL}/logistic/api/requests/`, preparedRequest, { headers });
      const createdRequest = response.data;

      // После создания заявки, если есть файлы, загружаем их
      if (selectedFiles.length > 0) {
        await handleUpload(selectedFiles, createdRequest.id);  // Загружаем файлы с использованием ID созданной заявки
      }

      // Очищаем форму после добавления
      setRequests([...requests, { ...createdRequest, key: createdRequest.id }]);
      setNewRequest({ description: '', declared_weight: '', declared_volume: '', comment: '', client: '', status: '', shipment: '' });
      setSelectedFiles([]);  // Очищаем выбранные файлы
      message.success('Заявка успешно добавлена');
    } catch (error) {
      console.error('Ошибка добавления заявки', error);
      message.error('Ошибка добавления заявки');
    }
  };

  const EditableCell = ({
    editing,
    dataIndex,
    title,
    inputType,
    record,
    index,
    children,
    ...restProps
  }) => {
    // Выбираем, какой набор статусов использовать: для отправлений или для заявок
    const statusOptionsToUse = dataIndex === 'status' && isViewing === 'shipments'
      ? statusOptions
      : statusOptionsRequests;

    const inputNode = dataIndex === 'status' || dataIndex === 'client' || dataIndex === 'shipment' ? (
      <Select
      showSearch  // Добавляем поиск
      optionFilterProp="children"  // Фильтрация происходит по содержимому option
      filterOption={(input, option) =>
        option.children.toLowerCase().includes(input.toLowerCase())
      }  // Логика фильтрации
    >
        {dataIndex === 'status' &&
          statusOptionsToUse.map((option) => <Option key={option.value} value={option.value}>{option.label}</Option>)}
        {dataIndex === 'client' &&
          clients.map((client) => <Option key={client.id} value={client.id}>{client.name}</Option>)}
        {dataIndex === 'shipment' &&
          shipments.map((shipment) => <Option key={shipment.id} value={shipment.id}>{shipment.number}</Option>)}
      </Select>
    ) : (
      <Input />
    );
    return (
      <td {...restProps}>
        {editing ? (
          <Form.Item
            name={dataIndex}
            style={{ margin: 0 }}
            rules={
              // Для определенных полей правила валидации убираем, делаем необязательными
              ['comment', 'number', 'warehouse_number', 'declared_weight', 'warehouse', 'description', 'declared_volume', 'actual_weight', 'actual_volume', 'rate', 'shipment'].includes(dataIndex)
                ? [] // Эти поля необязательные
                : [{ required: true, message: `Пожалуйста, введите ${title}!` }] // Все остальные поля обязательны
            }
          >
            {inputNode}
          </Form.Item>
        ) : (
          children
        )}
      </td>
    );
  };


  const columnsShipments = [
    { title: 'Дата создания', dataIndex: 'created_at', key: 'created_at', 
      sorter: (a, b) => new Date(b.created_at) - new Date(a.created_at), // Сортировка по дате от позднего к раннему
      //defaultSortOrder: 'descend',  // По умолчанию сортируем по убыванию (новее - выше)
      defaultSortOrder: 'ascend',  // По умолчанию сортируем по возрастанию (раньше - выше)
      ...getColumnDateFilterProps('created_at'),  // Добавляем фильтрацию по диапазону дат
    },
    { title: 'Номер', dataIndex: 'number', key: 'number', editable: true,
      sorter: (a, b) => a.number.localeCompare(b.number),//поиск
      ...getColumnSearchProps('number'),
     },
    { title: 'Комментарий', dataIndex: 'comment', key: 'comment', editable: true },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      editable: true,
      filters: statusOptions.map((option) => ({
        text: option.label,
        value: option.value,
      })), // Фильтрация по статусам
      onFilter: (value, record) => record.status.includes(value), // Логика фильтрации по статусу
      render: (status) => statusOptions.find((opt) => opt.value === status)?.label || 'Нет данных',
      sorter: (a, b) => a.status.localeCompare(b.status), // Сортировка по статусу
    },
    {
      title: 'Файлы',
      dataIndex: 'files',
      key: 'files',
      render: (text, record) => (
        <Button icon={<UploadOutlined />} onClick={() => openShipmentFileModal(record)}>
          Управление файлами
        </Button>
      ),
    },
    {
      title: 'Действия',
      render: (_, record) => {
        const editable = isEditing(record);
        return editable ? (
          <span>
            <div className="table-actions">
            <Button
              icon={<CheckOutlined />}
              onClick={() => save(record.key)}
              className="custom-small-btn"  // Добавляем свой класс
            >
              {/*Сохранить*/}
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={cancel}
              className="custom-small-btn"  // Добавляем свой класс
            >
              {/*Отмена*/}
            </Button>
            </div>
          </span>
        ) : (
          <span>
            <div className="table-actions">
            <Button
                icon={<EditOutlined/>}
                onClick={() => edit(record)}
                className="custom-small-btn"  // Добавляем свой класс
              >
                {/*Редактировать*/}
              </Button>
            <Popconfirm title="Удалить заявку?" onConfirm={() => deleteShipment(record.id)}>
                <Button
                  danger
                  icon={<DeleteOutlined/>} // Иконка корзины для удаления
                  className="custom-small-btn"  // Добавляем свой класс
                >
                  {/*Удалить*/}
                </Button>
              </Popconfirm>
                <Button
                  icon={<MailOutlined />}
                  onClick={() => handleSendEmails(record)}  // Вызов функции отправки писем
                  className="custom-small-btn"
                />
                {/*отправить письмо*/}
              </div>
          </span>
        );
      },  
    },
  ];

  const columnsRequests = [
    { title: 'Дата создания', dataIndex: 'created_at', key: 'created_at',
      sorter: (a, b) => new Date(b.created_at) - new Date(a.created_at), 
      //defaultSortOrder: 'descend',
      defaultSortOrder: 'ascend',  // По умолчанию сортируем по возрастанию (раньше - выше)
      //render: (text) => new Date(text).toLocaleDateString() 
      ...getColumnDateFilterProps('created_at'),  // Добавляем фильтрацию по диапазону дат
    },
    { title: 'Номер', dataIndex: 'number', key: 'number', editable: true,
      //sorter: (a, b) => a.number.localeCompare(b.number), //Сортировакка
      ...getColumnSearchProps('number'), // Фильтрация и поиск по номеру
     },
    { title: 'Складской №', dataIndex: 'warehouse_number', key: 'warehouse_number', editable: true,
      //sorter: (a, b) => a.warehouse_number.localeCompare(b.warehouse_number), //Сортировакка
      ...getColumnSearchProps('warehouse_number'), // Фильтрация и поиск по номеру 
    },
    { title: 'Описание', dataIndex: 'description', key: 'description', editable: true,
      sorter: (a, b) => a.description.localeCompare(b.description), //Сортировакка
      ...getColumnSearchProps('description'), // Фильтрация и поиск по номеру 
    },
    {
      title: 'Кол-во мест',
      dataIndex: 'col_mest',
      key: 'col_mest',
      editable: true
    },
    { title: 'Вес (кг)', dataIndex: 'declared_weight', key: 'declared_weight', editable: true },
    { title: 'Объем (м³)', dataIndex: 'declared_volume', key: 'declared_volume', editable: true },
    { title: 'Фактический вес (кг)', dataIndex: 'actual_weight', key: 'actual_weight', editable: true },
    { title: 'Фактический объем (м³)', dataIndex: 'actual_volume', key: 'actual_volume', editable: true },
    { title: 'Комментарий', dataIndex: 'comment', key: 'comment', editable: true,
      sorter: (a, b) => a.comment.localeCompare(b.comment), //Сортировакка
      ...getColumnSearchProps('comment'), // Фильтрация и поиск по номеру 
    },
    { title: 'Ставка', dataIndex: 'rate', key: 'rate', editable: true },
    {
      title: 'Клиент',
      dataIndex: 'client',
      key: 'client',
      editable: true,
      ...getColumnSearchProps('client'),
      sorter: (a, b) => {
        const clientA = clients.find((c) => c.id === a.client)?.name || '';
        const clientB = clients.find((c) => c.id === b.client)?.name || '';
        return clientA.localeCompare(clientB);
      },
      render: (clientId) => {
        const client = clients.find((c) => c.id === clientId);
        return client ? client.name : 'Нет данных';
      },
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      editable: true,
      filters: statusOptionsRequests.map((option) => ({
        text: option.label,
        value: option.value,
      })), // Фильтрация по статусам
      onFilter: (value, record) => record.status.includes(value), // Логика фильтрации по статусу
      render: (status) => statusOptionsRequests.find((opt) => opt.value === status)?.label || 'Нет данных',
    },
    {
      title: 'Отправление',
      dataIndex: 'shipment',
      key: 'shipment',
      editable: true,
      ...getColumnSearchProps('shipment'), // Добавляем поиск по отправлению
      sorter: (a, b) => {
        const shipmentA = shipments.find((s) => s.id === a.shipment)?.number || '';
        const shipmentB = shipments.find((s) => s.id === b.shipment)?.number || '';
        return shipmentA.localeCompare(shipmentB);
      },
      render: (shipmentId) => {
        const shipment = shipments.find((s) => s.id === shipmentId);
        return shipment ? shipment.number : 'Нет данных';
      },
      onFilter: (value, record) => {
        const shipment = shipments.find((s) => s.id === record.shipment);
        return shipment ? shipment.number.toLowerCase().includes(value.toLowerCase()) : false;
      },
    },
    {
      title: 'Статус отправления', // Новая колонка для статуса отправления
      dataIndex: 'shipment_status',
      key: 'shipment_status',
      filters: statusOptions.map((option) => ({
        text: option.label,
        value: option.value,
      })), // Фильтрация по статусам
      onFilter: (value, record) => {
        const shipment = shipments.find((s) => s.id === record.shipment); // Ищем отправление
        return shipment ? shipment.status.includes(value) : false; // Фильтруем по статусу отправления
      },
      render: (_, record) => {
        const shipment = shipments.find((s) => s.id === record.shipment);
        return shipment ? statusOptions.find((opt) => opt.value === shipment.status)?.label || 'Нет данных' : 'Нет данных';
      },
    },
    {
      title: 'Комментарий отправления', // Новая колонка для комментария отправления
      dataIndex: 'shipment_comment',
      key: 'shipment_comment',
      render: (_, record) => {
        const shipment = shipments.find((s) => s.id === record.shipment);
        return shipment ? shipment.comment || 'Нет данных' : 'Нет данных';
      },
    },
    {
      title: 'Файлы',
      dataIndex: 'files',
      key: 'files',
      render: (text, record) => (
        <Button
          icon={<UploadOutlined/>}
          onClick={() => openFileModal(record)}  // Открываем модальное окно для конкретной записи
          className="custom-small-btn"  // Добавляем свой класс
        >
          {/*Управление файлами*/}
        </Button>
      ),
    
    },
    {
      title: 'Действия',
      render: (_, record) => {
        const editable = isEditing(record);
        return editable ? (
          <span>
            <div className="table-actions">
            <Button
              icon={<CheckOutlined />}
              onClick={() => save(record.key)}
              className="custom-small-btn"  // Добавляем свой класс
            >
              {/*Сохранить*/}
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={cancel}
              className="custom-small-btn"  // Добавляем свой класс
            >
              {/*Отмена*/}
            </Button>
            </div>
          </span>
        ) : (
          <span>
              <div className="table-actions">
              <Button
                icon={<EditOutlined/>}
                onClick={() => edit(record)}
                className="custom-small-btn"  // Добавляем свой класс
              >
                {/*Редактировать*/}
              </Button>
              <Popconfirm title="Удалить заявку?" onConfirm={() => deleteRequest(record.id)}>
                <Button
                  danger
                  icon={<DeleteOutlined/>} // Иконка корзины для удаления
                  className="custom-small-btn"  // Добавляем свой класс
                >
                  {/*Удалить*/}
                </Button>
              </Popconfirm>
              </div>
          </span>
        );
      },
    },
  ];

  const mergedColumnsShipments = columnsShipments.map((col) => {
    if (!col.editable) {
      return col;
    }

    return {
      ...col,
      onCell: (record) => ({
        record,
        inputType: col.dataIndex === 'status' || col.dataIndex === 'client' || col.dataIndex === 'shipment' ? 'select' : 'text',
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing(record),
      }),
    };
  });

  const mergedColumnsRequests = columnsRequests.map((col) => {
    if (!col.editable) {
      return col;
    }

    return {
      ...col,
      onCell: (record) => ({
        record,
        inputType: col.dataIndex === 'status' || col.dataIndex === 'client' || col.dataIndex === 'shipment' ? 'select' : 'text',
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing(record),
      }),
    };
  });

  return (
    <div className="container">
      <h2>Менеджер</h2>
      <div className="tab-buttons">
        <Button type="default" onClick={() => setIsViewing('shipments')}>Отправления</Button>
        <Button type="default" onClick={() => setIsViewing('requests')}>Заявки</Button>
      </div>

      {isViewing === 'shipments' && (
        <>
          <h3>Отправления</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <Button type="primary" onClick={showShipmentModal}>Создать отправление</Button>
          <ExportButton data={filteredShipments} columns={columnsShipments} fileName="Отправления" />
          </div>
          {shipmentModal}
          <Form form={form} component={false}>
          <Table
            components={{
              body: {
                cell: EditableCell,
              },
            }}
            bordered
            dataSource={shipments}
            columns={mergedColumnsShipments}
            rowClassName="editable-row"
            pagination={{ pageSize: 30, onChange: cancel }}
            onChange={handleTableChange}  // Добавляем обработчик для отслеживания изменений фильтров и сортировки
          />
          </Form>
        </>
      )}
      {shipmentFileModal}

      {isViewing === 'requests' && (
        <>
          <h3>Заявки</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <Button type="primary" onClick={showRequestModal}>Создать заявку</Button>
          <ExportButton data={filteredRequests} columns={columnsRequests} fileName="Заявки" />
          </div>
          {requestModal}
          <Form form={form} component={false}>
          <Table
            components={{
              body: {
                cell: EditableCell,
              },
            }}
            bordered
            dataSource={requests}
            columns={mergedColumnsRequests}
            rowClassName="editable-row"
            pagination={{ pageSize: 30, onChange: cancel }}
            onChange={handleTableChange}  // Добавляем обработчик для отслеживания изменений фильтров и сортировки
          />
          </Form>
        </>
      )}
      {fileModal} {/* Добавляем модальное окно для управления файлами */}
    </div>
  );
}

export default ManagerDashboard;