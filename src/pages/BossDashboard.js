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
import { InputNumber } from 'antd';
import moment from 'moment';  // Убедитесь, что moment импортирован
import ShipmentCalculation from './ShipmentCalculation'; // Импортируем компонент ShipmentCalculation
import { Checkbox } from 'antd';



//const API_BASE_URL = process.env.REACT_APP_API_BASE_URL_LOCAL; // Локальная среда
const API_BASE_URL = localStorage.getItem('base_url');

const { RangePicker } = DatePicker;  // Для фильтрации по диапазону дат
const { Option } = Select;

const normalizeDecimalInput = (value) => {
  return value.replace(',', '.');
};

function BossDashboard({ children }) {
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
  const [isShipmentFileModalVisible, setIsShipmentFileModalVisible] = useState(false);
  const [shipmentFilter, setShipmentFilter] = useState(null);
  const [isShipmentFilterActive, setIsShipmentFilterActive] = useState(false); // Отслеживаем активацию фильтра
  const [isArticleFormVisible, setIsArticleFormVisible] = useState(false);
  const [articles, setArticles] = useState([]);
  const [article, setArticle] = useState({});
  const [finances, setFinances] = useState([]);
  const [editingFinanceKey, setEditingFinanceKey] = useState('');
  const [shipmentsFilteredInfo, setShipmentsFilteredInfo] = useState({});
  const [shipmentsSortedInfo, setShipmentsSortedInfo] = useState({
    columnKey: 'created_at',
    order: 'ascend',
  });

  const [requestsFilteredInfo, setRequestsFilteredInfo] = useState({});
  const [requestsSortedInfo, setRequestsSortedInfo] = useState({
    columnKey: 'created_at',
    order: 'ascend',
  });

  const [financesFilteredInfo, setFinancesFilteredInfo] = useState({});
  const [financesSortedInfo, setFinancesSortedInfo] = useState({
    columnKey: 'number',
    order: 'ascend',
  });
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [balance, setBalance] = useState(null);
  const [paymentForecastData, setPaymentForecastData] = useState([]);
  const [paymentForecast, setPaymentForecast] = useState(null);
  const [counterpartyBalances, setCounterpartyBalances] = useState(null);
  const [selectedCounterparty, setSelectedCounterparty] = useState(null);
  const [financeRecords, setFinanceRecords] = useState([]);
  const [counterparties, setCounterparties] = useState([]);

  

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

  const currencyMapping = {
    'rub': 'Рубль',
    'rubbn': 'Безнал',
    'rubnds': 'НДС',
    'eur': 'Евро',
    'usd': 'Доллар'
  };

  //Балансы контрагентов
  useEffect(() => {
    const fetchCounterparties = async () => {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Token ${token}` };

      try {
        const response = await axios.get(`${API_BASE_URL}/logistic/api/clients/`, { headers });
        setCounterparties(response.data);
      } catch (error) {
        console.error('Ошибка при загрузке контрагентов:', error);
        message.error('Не удалось загрузить контрагентов.');
      }
    };

    fetchCounterparties();
  }, []);

  const handleCounterpartyChange = async (value) => {
    setSelectedCounterparty(value);

    if (!value) {
      setCounterpartyBalances(null);
      setFinanceRecords([]);
      return;
    }

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Token ${token}` };

    try {
      const response = await axios.get(
        `${API_BASE_URL}/logistic/api/finance/counterparty-balance/`,
        {
          headers,
          params: { counterparty_id: value },
        }
      );

      setCounterpartyBalances(response.data.balances);
      setFinanceRecords(response.data.finances);
    } catch (error) {
      console.error('Ошибка при загрузке баланса контрагента:', error);
      message.error('Не удалось загрузить баланс контрагента.');
    }
  };

  const balanceColumns = [
    {
      title: 'Валюта',
      dataIndex: 'currency',
      key: 'currency',
    },
    {
      title: 'Баланс',
      dataIndex: 'balance',
      key: 'balance',
    },
  ];

  const financeColumns = [
    {
      title: 'Дата создания',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => date ? moment(date).format('YYYY-MM-DD') : 'Нет данных',
      sorter: (a, b) => new Date(b.created_at) - new Date(a.created_at), // Сортировка по дате от позднего к раннему
      defaultSortOrder: 'ascend',  // По умолчанию сортируем по возрастанию (раньше - выше)
    },
    {
      title: 'Номер',
      dataIndex: 'number',
      key: 'number',
      sorter: (a, b) => b.number - a.number,
    },
    {
      title: 'Тип операции',
      dataIndex: 'operation_type',
      key: 'operation_type',
      render: (text) => operationTypeMapping[text] || text,
    },
    {
      title: 'Дата оплаты',
      dataIndex: 'payment_date',
      key: 'payment_date',
    },
    {
      title: 'Тип документа',
      dataIndex: 'document_type',
      key: 'document_type',
      render: (text) => documentTypeMapping[text] || text,
    },
    {
      title: 'Валюта',
      dataIndex: 'currency',
      key: 'currency',
      render: (text) => currencyMapping[text] || text,
    },
    {
      title: 'Сумма',
      dataIndex: 'amount',
      key: 'amount',
    },
    {
      title: 'Комментарий',
      dataIndex: 'comment',
      key: 'comment',
    },
    {
      title: 'Статья',
      dataIndex: 'article',
      key: 'article',
      render: (articleId) => {
        const article = articles.find((a) => a.id === articleId);
        return article ? article.name : 'Нет данных';
      }
    },
    {
      title: 'Отправление',
      dataIndex: 'shipment',
      key: 'shipment',
      render: (shipmentId) => {
        const shipment = shipments.find((s) => s.id === shipmentId);
        return shipment ? shipment.number : 'Нет данных';
      }
    },
    {
      title: 'Заявка',
      dataIndex: 'request',
      key: 'request',
      render: (requestId) => {
        const request = requests.find((r) => r.id === requestId);
        return request ? request.number : 'Нет данных';
      }
    },
    {
      title: 'Основание',
      dataIndex: 'basis',
      key: 'basis',
      render: (basisId) => {
        const basis = finances.find((f) => f.number === basisId);
        return basis ? basis.number : 'Нет данных';
      }
    },
  ];

  

  // Функция для обновления таблицы Прогноз оплат
const updatePaymentForecast = async (currency) => {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Token ${token}` };

  try {
    // Запрос на получение данных Finance
    const response = await axios.get(`${API_BASE_URL}/logistic/api/finance/`, { headers });
    const finances = response.data.filter(
      (item) => item.document_type === 'bill' && !item.is_paid && item.currency === currency
    );

    // Расчёт данных для таблицы
    const forecastData = finances.map((item) => ({
      key: item.id, // Уникальный ключ
      id: item.id,
      payment_date: item.payment_date,
      incoming: item.operation_type === 'in' ? item.amount : 0,
      outgoing: item.operation_type === 'out' ? item.amount : 0,
      number: item.number,
      counterparty: item.counterparty,
      article: item.article,
      comment: item.comment,
    }));

    // Обновляем таблицу
    setPaymentForecastData(forecastData);

    // Расчёт прогноза оплат
    const totalIncoming = forecastData.reduce(
      (sum, item) => sum + parseFloat(item.incoming || 0), 
      0
    );
    const totalOutgoing = forecastData.reduce(
      (sum, item) => sum + parseFloat(item.outgoing || 0), 
      0
    ); 
    // Устанавливаем прогноз, даже если totalOutgoing отсутствует
    const paymentForecast = (totalOutgoing || 0) - (totalIncoming || 0);
    setPaymentForecast(paymentForecast);
  } catch (error) {
    console.error('Ошибка при загрузке данных для прогноза оплат:', error);
    message.error('Ошибка при загрузке данных для прогноза оплат.');
  }
};

  // Функция для получения баланса с бэкенда
  const fetchBalance = async (currency) => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Token ${token}` };
  
    try {
      const response = await axios.get(`${API_BASE_URL}/logistic/api/finance/balance/`, {
        headers,
        params: { currency }, // Передаём выбранную валюту как параметр
      });
      setBalance(response.data.balance); // Предполагаем, что сервер возвращает { balance: значение }
    } catch (error) {
      console.error('Ошибка при получении баланса:', error);
      message.error('Ошибка при получении баланса');
    }
  };

  //обработчик изменения валюты
  /*const handleCurrencyChange = (value) => {
    setSelectedCurrency(value);
    if (value) {
      fetchBalance(value); // Запрашиваем баланс при выборе валюты
    } else {
      setBalance(null); // Сбрасываем баланс, если валюта не выбрана
    }
  };*/
  const handleCurrencyChange = (value) => {
    setSelectedCurrency(value); // Устанавливаем выбранную валюту
    if (value) {
      fetchBalance(value); // Запрашиваем баланс для выбранной валюты
      updatePaymentForecast(value); // Обновляем прогноз оплат
    } else {
      setBalance(null); // Сбрасываем баланс, если валюта не выбрана
      setPaymentForecast(null); // Сбрасываем прогноз оплат
      setPaymentForecastData([]); // Сбрасываем данные таблицы
    }
  };

  // Инициализация данных
  useEffect(() => {
  if (selectedCurrency) {
    updatePaymentForecast(selectedCurrency);
  }
}, [selectedCurrency]);

  //Форма для отображения баланса
  const balanceForm = (
    <div>
      <h3>Баланс</h3>
      <Form layout="vertical">
        <Form.Item label="Выберите валюту">
          <Select
            placeholder="Выберите валюту"
            style={{ width: 200 }}
            onChange={handleCurrencyChange}
          >
            {Object.entries(currencyMapping).map(([value, label]) => (
              <Select.Option key={value} value={value}>
                {label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        {selectedCurrency && (
          <Form.Item label={`Баланс (${currencyMapping[selectedCurrency]})`}>
            <Input value={balance !== null ? balance : '—'} readOnly 
            style={{
              width: 'auto', // Автоматическая ширина
              display: 'inline-block', // Обеспечиваем корректное сжатие
              minWidth: '100px', // Минимальная ширина для удобства чтения
            }}
            />
          </Form.Item>
        )}
      </Form>
      {/* Таблица Прогноз оплат */}
    <h3>Прогноз оплат</h3>
    <Form layout="vertical" style={{ marginTop: '20px' }}>
      <Form.Item>
        <Input
          value={paymentForecast !== null ? paymentForecast : '—'}
          readOnly
          style={{
            width: 'auto',
            display: 'inline-block',
            minWidth: '100px',
          }}
        />
      </Form.Item>
    </Form>
    <Table
      dataSource={paymentForecastData}
      columns={[
        {
          title: 'Дата оплаты',
          dataIndex: 'payment_date',
          key: 'payment_date',
          render: (date) => (date ? moment(date).format('YYYY-MM-DD') : 'Нет данных'),
        },
        {
          title: 'Входящие счета',
          dataIndex: 'incoming',
          key: 'incoming',
        },
        {
          title: 'Исходящие счета',
          dataIndex: 'outgoing',
          key: 'outgoing',
        },
        {
          title: 'Номер',
          dataIndex: 'number',
          key: 'number',
        },
        {
          title: 'Контрагент',
          dataIndex: 'counterparty',
          key: 'counterparty',
          render: (counterpartyId) => {
            const counterparty = clients.find((c) => c.id === counterpartyId);
            return counterparty ? counterparty.name : 'Нет данных';
          },
        },
        {
          title: 'Статья',
          dataIndex: 'article',
          key: 'article',
          render: (articleId) => {
            const article = articles.find((a) => a.id === articleId);
            return article ? article.name : 'Нет данных';
          },
        },
        {
          title: 'Комментарий',
          dataIndex: 'comment',
          key: 'comment',
        },
      ]}
      pagination={{ pageSize: 10 }}
      //rowKey="id"
      rowKey={(record) => record.id || `${record.number}-${record.payment_date}`} // Генерируем уникальный ключ
    />
    </div>
  );


  // Функция сброса фильтров в таблице заявок
  const resetFiltersRequests = () => {
    form.resetFields(); // Сброс полей формы редактирования
    setRequestsFilteredInfo({}); // Сбрасываем фильтры
    setRequestsSortedInfo({ columnKey: 'created_at', order: 'ascend' }); // Устанавливаем сортировку по умолчанию
    setSearchText(''); // Очищаем текст поиска
    setSearchedColumn(''); // Сбрасываем колонку поиска
    setShipmentFilter(null); // Убираем фильтр по отправлению
    setIsShipmentFilterActive(false); // Деактивируем фильтр отправления
    // Возвращаем исходные данные в таблицу
    setFilteredRequests(requests);
};

  // Кнопка экспорта для финансов
  const ExportButtonFinance = ({ data, columns, fileName, shipments, requests }) => (
    <Button
      type="primary"
      icon={<DownloadOutlined />}
      onClick={() => exportToExcelFinance(data, columns, fileName, shipments, requests)}
    >
      Экспортировать счета и оплаты
    </Button>
  );

  // Функция для экспорта данных финансов в Excel, включая маппинг для Отправления и Заявки
  const exportToExcelFinance = (data, columns, fileName, shipments, requests) => {
    // Создаем массив для экспорта
    const exportData = data.map((item) => {
      const row = {};

      // Преобразуем каждый элемент данных в объект для экспорта
      columns.forEach((col) => {
        if (col.dataIndex === 'counterparty') {
          // Преобразование id контрагента в имя
          const client = clients.find((c) => c.id === item[col.dataIndex]);
          row[col.title] = client ? client.name : '';
        } else if (col.dataIndex === 'operation_type') {
          // Маппинг для Типа операции
          row[col.title] = operationTypeMapping[item[col.dataIndex]] || item[col.dataIndex];
        } else if (col.dataIndex === 'document_type') {
          // Маппинг для Типа документа
          row[col.title] = documentTypeMapping[item[col.dataIndex]] || item[col.dataIndex];
        } else if (col.dataIndex === 'currency') {
          // Маппинг для Валюты
          row[col.title] = currencyMapping[item[col.dataIndex]] || item[col.dataIndex];
        } else if (col.dataIndex === 'article') {
          // Преобразование id статьи в имя статьи
          const article = articles.find((a) => a.id === item[col.dataIndex]);
          row[col.title] = article ? article.name : '';
        } else if (col.dataIndex === 'shipment') {
          // Преобразование id отправления в номер отправления
          const shipment = shipments.find((s) => s.id === item[col.dataIndex]);
          row[col.title] = shipment ? shipment.number : '';
        } else if (col.dataIndex === 'request') {
          // Преобразование id заявки в номер заявки
          const request = requests.find((r) => r.id === item[col.dataIndex]);
          row[col.title] = request ? request.number : '';
        } else if (col.dataIndex === 'created_at' || col.dataIndex === 'payment_date') {
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

  // Обработчик изменений таблицы
  const handleTableChange = (pagination, filters, sorter, extra) => {
    if (isViewing === 'shipments') {
      setFilteredShipments(extra.currentDataSource);  // Сохраняем отфильтрованные данные для отправлений
    } else if (isViewing === 'requests') {
      setFilteredRequests(extra.currentDataSource);   // Сохраняем отфильтрованные данные для заявок
    }  else if (isViewing === 'finance') {
      setFinances(extra.currentDataSource);  // Сохраняем отфильтрованные данные для финансов
    }
  };

  //Работа с движением денег
  const operationTypeMapping = {
    'in': 'Входящий',
    'out': 'Исходящий'
  };
  
  const documentTypeMapping = {
    'bill': 'Счёт',
    'payment': 'Оплата'
  };
  
  /*const currencyMapping = {
    'rub': 'Рубль',
    'rubbn': 'Безнал',
    'rubnds': 'НДС',
    'eur': 'Евро',
    'usd': 'Доллар'
  };*/
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get(`${API_BASE_URL}/logistic/api/articles/`, {
      headers: {
        Authorization: `Token ${token}`,
      },
    })
      .then((response) => {
        setArticles(response.data);
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  //Форма создания Счёта или оплаты
 //Создание счёта и оплаты 2.0

  // Функция для создания новой строки и отправки её на сервер
const createNewFinanceRow = async () => {
  resetFilters(); // Сбрасываем все фильтры перед созданием новой записи
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Token ${token}` };
  
  // Данные с обязательными полями для создания записи
  const newFinanceData = {
    operation_type: 'in', // или другой начальный тип
    payment_date: moment().format('YYYY-MM-DD'),
    document_type: 'bill', // или другой начальный тип документа
    currency: 'rub', // или другая валюта по умолчанию
    amount: 0.0, // начальная сумма
    is_paid: false, // Новое поле
  };

  try {
    // Создание новой записи на сервере
    const response = await axios.post(`${API_BASE_URL}/logistic/api/finance/`, newFinanceData, { headers });
    const createdFinance = response.data;

    // Добавление новой записи в состояние и активация её редактирования
    setFinances([...finances, createdFinance]);
    setEditingFinanceKey(createdFinance.number); // Включаем режим редактирования для новой строки

  } catch (error) {
    console.error('Ошибка при создании записи', error);
    message.error('Ошибка при создании новой записи');
  }
};
  
  // Обновленная функция отмены для новой строки
  const cancelFinance = () => {
    setEditingFinanceKey('');
  };

  // Функция для фильтрации по дате
const getColumnDateFilterProps1 = (dataIndex) => ({
  filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
    <div style={{ padding: 8 }}>
      <DatePicker
        onChange={(date) => {
          setSelectedKeys(date ? [date.startOf('day').toISOString()] : []);
        }}
        style={{ width: '100%' }}
      />
      <Space>
        <Button type="primary" onClick={() => confirm()} size="small" style={{ width: 90 }}>
          Применить
        </Button>
        <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
          Сбросить
        </Button>
      </Space>
    </div>
  ),
  onFilter: (value, record) => moment(record[dataIndex]).isSame(value, 'day'),
  render: (date) => date ? moment(date).format('YYYY-MM-DD') : '',
});


  // Функция для фильтрации и поиска по тексту
const getColumnSearchProps1 = (dataIndex) => ({
  filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
    <div style={{ padding: 8 }}>
      <Input
        placeholder={`Поиск ${dataIndex}`}
        value={selectedKeys[0]}
        onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={() => confirm()}
        style={{ marginBottom: 8, display: 'block' }}
      />
      <Space>
        <Button type="primary" onClick={() => confirm()} size="small" style={{ width: 90 }}>
          Применить
        </Button>
        <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
          Сбросить
        </Button>
      </Space>
    </div>
  ),
  onFilter: (value, record) =>
    record[dataIndex] ? record[dataIndex].toString().toLowerCase().includes(value.toLowerCase()) : '',
});

// Функция для поиска в выпадающем списке
const getColumnSelectSearchProps1 = (dataIndex, data, nameProp) => ({
  filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
    <div style={{ padding: 8 }}>
      <Select
        showSearch
        placeholder={`Поиск ${dataIndex}`}
        optionFilterProp="children"
        onChange={(value) => {
          setSelectedKeys(value ? [value] : []);
          confirm();
        }}
        onClear={() => clearFilters()}
        allowClear
        style={{ width: '100%' }}
      >
        {data.map((item) => (
          <Select.Option key={item.id || item.number} value={item.id || item.number}> {/* Убедитесь в наличии key */}
            {item[nameProp]}
          </Select.Option>
        ))}
      </Select>
    </div>
  ),
  onFilter: (value, record) => record[dataIndex] === value,
});

  const mergedColumnsFinance = [
    {
      title: 'Номер',
      dataIndex: 'number',
      key: 'number',
      editable: false,
      sorter: (a, b) => b.number - a.number,
      defaultSortOrder: 'ascend',  // сортировка от большего к меньшему по умолчанию
      ...getColumnSearchProps1('number'),  // добавляем поиск по номеру
    },
    {
      title: 'Дата создания',
      dataIndex: 'created_at',
      key: 'created_at',
      editable: false,
      render: (date) => date ? moment(date).format('YYYY-MM-DD') : 'Нет данных',
      ...getColumnDateFilterProps1('created_at'),  // добавляем фильтр по дате
    },
    {
      title: 'Тип операции',
      dataIndex: 'operation_type',
      key: 'operation_type',
      editable: true,
      render: (text) => operationTypeMapping[text] || text,
      filters: Object.entries(operationTypeMapping).map(([value, label]) => ({ text: label, value, key: value })), // добавляем уникальный ключ
      onFilter: (value, record) => record.operation_type === value,
    },
    {
      title: 'Дата оплаты',
      dataIndex: 'payment_date',
      key: 'payment_date',
      editable: true,
      render: (date) => date ? moment(date).format('YYYY-MM-DD') : 'Нет данных',
      ...getColumnDateFilterProps1('payment_date'),  // добавляем фильтр по дате
    },
    {
      title: 'Тип документа',
      dataIndex: 'document_type',
      key: 'document_type',
      editable: true,
      render: (text) => documentTypeMapping[text] || text,
      filters: Object.entries(documentTypeMapping).map(([value, label]) => ({ text: label, value, key: value })), // добавляем уникальный ключ
      onFilter: (value, record) => record.document_type === value,
    },
    {
      title: 'Валюта',
      dataIndex: 'currency',
      key: 'currency',
      editable: true,
      render: (text) => currencyMapping[text] || text,
      filters: Object.entries(currencyMapping).map(([value, label]) => ({ text: label, value })), // фильтр по валютам
      onFilter: (value, record) => record.currency === value,
    },
    {
      title: 'Контрагент',
      dataIndex: 'counterparty',
      key: 'counterparty',
      editable: true,
      render: (counterpartyId) => {
        const counterparty = clients.find((c) => c.id === counterpartyId);
        return counterparty ? counterparty.name : 'Нет данных';
      },
      ...getColumnSelectSearchProps1('counterparty', clients, 'name'),  // добавляем поиск по наименованиям контрагентов
    },
    {
      title: 'Статья',
      dataIndex: 'article',
      key: 'article',
      editable: true,
      render: (articleId) => {
        const article = articles.find((a) => a.id === articleId);
        return article ? article.name : 'Нет данных';
      },
      filters: articles.map((article) => ({ text: article.name, value: article.id })),  // фильтр по статьям
      onFilter: (value, record) => record.article === value,
    },
    {
      title: 'Сумма',
      dataIndex: 'amount',
      key: 'amount',
      editable: true,
    },
    {
      title: 'Комментарий',
      dataIndex: 'comment',
      key: 'comment',
      editable: true,
      ...getColumnSearchProps1('comment'),  // добавляем поиск по комментарию
    },
    {
      title: 'Отправление',
      dataIndex: 'shipment',
      key: 'shipment',
      editable: true,
      render: (shipmentId) => {
        const shipment = shipments.find((s) => s.id === shipmentId);
        return shipment ? shipment.number : 'Нет данных';
      },
      ...getColumnSelectSearchProps1('shipment', shipments, 'number'),  // добавляем поиск по отправлениям
    },
    {
      title: 'Заявка',
      dataIndex: 'request',
      key: 'request',
      editable: true,
      render: (requestId) => {
        const request = requests.find((r) => r.id === requestId);
        return request ? request.number : 'Нет данных';
      },
      ...getColumnSelectSearchProps1('basis', finances, 'number'),  // добавляем поиск по основаниям
    },
    {
      title: 'Основание',
      dataIndex: 'basis',
      key: 'basis',
      editable: true,
      render: (basisId) => {
        const basis = finances.find((f) => f.number === basisId);
        return basis ? basis.number : 'Нет данных';
      },
      ...getColumnSelectSearchProps1('basis', finances, 'number'),  // добавляем поиск по основаниям
    },
    {
      title: 'Оплата',
      dataIndex: 'is_paid',
      key: 'is_paid',
      editable: true, // Позволяем редактирование
      render: (_, record) => {
        const editable = isEditingFinance(record); // Проверяем, редактируется ли строка
        return editable ? (
          <Checkbox
            checked={record.is_paid}
            onChange={(e) => form.setFieldsValue({ is_paid: e.target.checked })}
          />
        ) : (
          <Checkbox checked={record.is_paid} disabled /> // Неактивный чекбокс вне режима редактирования
        );
      },
      filters: [
        { text: 'Оплачено', value: true },
        { text: 'Не оплачено', value: false },
      ],
      onFilter: (value, record) => record.is_paid === value, // Логика фильтрации
    },
    {
      title: 'Действия',
      dataIndex: 'actions',
      key: 'actions',
      render: (_, record) => {
        const editable = isEditingFinance(record);
        return editable ? (
          <Space>
            <Button icon={<CheckOutlined />} onClick={() => saveFinance(record.number)} className="custom-small-btn" />
            <Button icon={<CloseOutlined />} onClick={cancelFinance} className="custom-small-btn" />
          </Space>
        ) : (
          <Space>
            <Button icon={<EditOutlined />} onClick={() => editFinance(record)} className="custom-small-btn" />
            <Popconfirm title="Удалить запись?" onConfirm={() => deleteFinance(record.number)}>
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ].map((col) => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: (record) => ({
        record,
        inputType:
          col.dataIndex === 'operation_type' ||
          col.dataIndex === 'document_type' ||
          col.dataIndex === 'currency' ||
          col.dataIndex === 'counterparty' ||
          col.dataIndex === 'article'
            ? 'select'
            : 'text',
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditingFinance(record), // Используем проверку `isEditingFinance`
    }),
    }
});
  
  
  const EditableFinanceCell = ({
    editing,
    dataIndex,
    title,
    inputType,
    record,
    index,
    children,
    ...restProps
  }) => {

    const handleDateChange = (e) => {
      record[dataIndex] = e.target.value; // Обновляем значение даты в record
    };


    const inputNode = ['operation_type', 'document_type', 'currency', 'counterparty', 'article', 'shipment', 'request', 'basis'].includes(dataIndex) ? (
      <Select
        showSearch  // Включаем поиск
        optionFilterProp="children"  // Фильтрация по содержимому option
        allowClear  // Позволяет очищать выбор
        popupMatchSelectWidth={false} // Новый способ отключения привязки ширины к полю
        dropdownStyle={{ maxWidth: '500px' }} // Максимальная ширина выпадающего окна
        filterOption={(input, option) => {
          if (option.children) {
            return option.children.toString().toLowerCase().includes(input.toLowerCase());
          }
          return false;
        }}
      >
        {dataIndex === 'operation_type' && Object.entries(operationTypeMapping).map(([value, label]) => (
          <Option key={value} value={value}>{label}</Option>
        ))}
        {dataIndex === 'document_type' && Object.entries(documentTypeMapping).map(([value, label]) => (
          <Option key={value} value={value}>{label}</Option>
        ))}
        {dataIndex === 'currency' && Object.entries(currencyMapping).map(([value, label]) => (
          <Option key={value} value={value}>{label}</Option>
        ))}
        {dataIndex === 'counterparty' && clients.map((client) => (
          <Option key={client.id} value={client.id}>{client.name}</Option>
        ))}
        {dataIndex === 'article' && articles.map((article) => (
          <Option key={article.id} value={article.id}>{article.name}</Option>
        ))}
        {dataIndex === 'shipment' && shipments.map((shipment) => (
          <Option key={shipment.id} value={shipment.id}>{shipment.number}</Option>
        ))}
        {dataIndex === 'request' && requests.map((request) => (
          <Option key={request.id} value={request.id}>{request.number}</Option>
        ))}
        {dataIndex === 'basis' && finances.map((finance) => (
          <Option key={finance.number} value={finance.number}>{finance.number}</Option>
        ))}
      </Select>
      ) : 
        dataIndex === 'payment_date' ? (
          <input
          type="date"
          value={record[dataIndex] || ''}
          onChange={handleDateChange}
          style={{ width: '100%' }}
        />
    ) : (
      dataIndex === 'amount' ? (
        <InputNumber
          value={record[dataIndex]}
          onChange={(value) => {
            record[dataIndex] = normalizeDecimalInput(value ? value.toString() : '');  // Применяем нормализацию
          }}
          decimalSeparator="." // Устанавливаем десятичный разделитель
          formatter={(value) => value.replace(',', '.')} // Заменяем запятые на точки
          parser={(value) => value.replace(',', '.')}
        />
      ) : (
        dataIndex === 'is_paid' ? (
          <Checkbox />
        ) : (
        <Input />
      )
    )
    );
  
    return (
      <td {...restProps}>
        {editing ? (
          <Form.Item
            name={dataIndex}
            valuePropName={dataIndex === 'is_paid' ? 'checked' : 'value'} // Указываем привязку значения
            style={{ margin: 0 }}
            rules={
              ['comment', 'shipment', 'request', 'basis', 'is_paid'].includes(dataIndex)
                ? [] // Эти поля необязательны
                : [{ required: true, message: `Пожалуйста, введите ${title}!` }] // Остальные поля обязательны
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

  // Функция для сброса фильтров финансов
  /*const resetFilters = () => {
    form.resetFields(); // Сброс формы поиска
    
    // Сбрасываем фильтры, сортировку, текст поиска и выбранную колонку
    setFilteredInfo({});
    setSortedInfo({ columnKey: 'number', order: 'ascend' });  // Устанавливаем сортировку по умолчанию
    setSearchText(''); // Сброс текста поиска
    setSearchedColumn(''); // Сброс выбранной для поиска колонки
    
    // Обновляем данные для отображения всех записей
    setFinances([]); // Временно очищаем данные, чтобы сброс сработал
    setTimeout(() => {
      setFinances([...finances]); // Возвращаем данные после очистки
    }, 0);
  };*/
  const resetFilters = () => {
    form.resetFields(); // Сброс полей формы

    // Сбрасываем фильтры и сортировку к состоянию по умолчанию
    setFinancesFilteredInfo({});
    setFinancesSortedInfo({ columnKey: 'number', order: 'ascend' }); // Устанавливаем сортировку по умолчанию
    setSearchText(''); // Очищаем текст поиска
    setSearchedColumn(''); // Сбрасываем колонку поиска

    // Возвращаем исходные данные в таблицу
    setFinances(finances);
};

  const financeTable = (
    <div>
      {/* Заголовок таблицы */}
      <h3>Счета и оплаты</h3>
  
      {/* Контейнер для кнопок */}
      <div className="finance-actions">

      <div className="finance-buttons-left">
      {/* Кнопка для открытия формы создания новой записи */}
      <Button type="default" className="finance-create-button" onClick={createNewFinanceRow} >
        Создать счёт или оплату
      </Button>

      {/* Кнопка для сброса фильтров */}
      <Button type="default" onClick={resetFilters} icon={<CloseOutlined />}>Сбросить фильтры</Button>
      </div>

      {/* Кнопка для экспорта в Excel */}
      <div className="finance-button-right">
      <ExportButtonFinance
        data={finances}
        columns={mergedColumnsFinance}
        fileName="Счета_и_оплаты"
        shipments={shipments}
        requests={requests}
      />
      </div>
      </div>
  
      {/* Таблица для отображения и редактирования записей */}
      <Form form={form} component={false}>
      <Table
        components={{
          body: {
            cell: EditableFinanceCell,
          },
        }}
        dataSource={finances}
        //columns={mergedColumnsFinance}
        /*columns={mergedColumnsFinance.map(col => ({
          ...col,
          filteredValue: filteredInfo[col.dataIndex] || null,
          sortOrder: sortedInfo.columnKey === col.dataIndex ? sortedInfo.order : null,
          // Сбросить фильтр поиска для колонки при очистке
          onFilterDropdownOpenChange: () => setSearchText('')
        }))}*/
          columns={mergedColumnsFinance.map((col) => ({
            ...col,
            filteredValue: financesFilteredInfo[col.dataIndex] || null,
            sortOrder: financesSortedInfo.columnKey === col.dataIndex ? financesSortedInfo.order : null,
          }))}
        rowKey="number"
        rowClassName="editable-row"
        pagination={{ pageSize: 30, onChange: cancelFinance }}
        /*onChange={(pagination, filters, sorter) => {
          setFilteredInfo(filters);  // Устанавливаем фильтры
          setSortedInfo(sorter);     // Устанавливаем сортировку
        }}*/
          onChange={(pagination, filters, sorter) => {
            setFinancesFilteredInfo(filters); // Сохраняем фильтры для финансов
            setFinancesSortedInfo(sorter); // Сохраняем сортировку для финансов
          }}
      />
    </Form>
    </div>
  );
  
  
  //Редактирование счёта и оплаты
  const isEditingFinance = (record) => record.number === editingFinanceKey;

  const editFinance = (record) => {
    form.setFieldsValue({ ...record });
    setEditingFinanceKey(record.number);
  };
  
  //Сохранение счёта и оплаты
  const saveFinance = async (number) => {
    try {
      const row = await form.validateFields();
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Token ${token}` };
  
      // Логика для редактирования существующей записи
      const newData = [...finances];
      const index = newData.findIndex((item) => item.number === number);
  
      if (index > -1) {
        const item = newData[index];
        const updatedFinance = { ...item, ...row };
  
        // Обновляем запись на сервере
        const response = await axios.put(`${API_BASE_URL}/logistic/api/finance/${item.number}/`, updatedFinance, { headers });
        
        // Используем данные из ответа сервера для обновления состояния
        newData.splice(index, 1, response.data);
        setFinances(newData);  // Обновляем состояние с актуальными данными
  
        message.success('Запись успешно обновлена');
      }
  
      // Сбрасываем ключ редактирования
      setEditingFinanceKey('');
    } catch (error) {
      console.error('Ошибка при сохранении данных:', error);
      message.error('Ошибка при сохранении данных');
    }
  };


  //Удаление счёта и оплаты
  const deleteFinance = (number) => {
    const token = localStorage.getItem('token');
    axios.delete(`${API_BASE_URL}/logistic/api/finance/${number}/`, {
      headers: {
        Authorization: `Token ${token}`,
      },
    })
      .then((response) => {
        setFinances(finances.filter((finance) => finance.number !== number));
      })
      .catch((error) => {
        console.error(error);
      });
  };
  
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get(`${API_BASE_URL}/logistic/api/finance/`, {
      headers: {
        Authorization: `Token ${token}`,
      },
    })
      .then((response) => {
        setFinances(response.data);
        setFinancesSortedInfo({ columnKey: 'number', order: 'ascend' });  // Устанавливаем начальную сортировку
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);
  

  //Работа с статьями расходов и доходов
  const articleForm = (
    <div>
      <h3>Статьи расходов и доходов</h3>
      <Button type="default" onClick={() => setIsArticleFormVisible(true)}>Создать статью</Button>
      {isArticleFormVisible && (
        <Form>
          <Form.Item label="Наименование статьи">
            <Input value={article.name} onChange={(e) => setArticle({ ...article, name: e.target.value })} className="article-form-input"/>
          </Form.Item>
          <Form.Item>
            {article.id ? (
              <Button type="primary" onClick={() => updateArticle()} className="article-form-button">Сохранить</Button>
            ) : (
              <Button type="primary" onClick={() => createNewArticle()} className="article-form-button">Создать</Button>
            )}
            <Button type="default" onClick={() => setIsArticleFormVisible(false)}>Отмена</Button>
          </Form.Item>
        </Form>
      )}
      <Table
      columns={[
        {
          title: 'Наименование статьи',
          dataIndex: 'name',
          key: 'name',
        },
        {
          title: 'Действия',
          key: 'actions',
          render: (record) => (
            <Space size="middle">
              <Button type="default" icon={<EditOutlined />} onClick={() => editArticle(record)}>Редактировать</Button>
              <Popconfirm
                title="Вы уверены, что хотите удалить статью?"
                onConfirm={() => deleteArticle(record.id)}
                okText="Да"
                cancelText="Нет"
              >
                <Button type="default" icon={<DeleteOutlined />}>Удалить</Button>
              </Popconfirm>
            </Space>
          ),
        },
      ]}
      dataSource={articles}
      rowKey="id"
      className="table"
    />
    </div>
  );

  const editArticle = (record) => {
    setIsArticleFormVisible(true);
    setArticle(record);
  };
  
  const deleteArticle = (id) => {
    const token = localStorage.getItem('token');
    axios.delete(`${API_BASE_URL}/logistic/api/articles/${id}/`, {
      headers: {
        Authorization: `Token ${token}`,
      },
    })
      .then((response) => {
        setArticles(articles.filter((article) => article.id !== id));
      })
      .catch((error) => {
        console.error(error);
      });
  };
  
  
  useEffect(() => {
    if (isViewing === 'article') {
    const token = localStorage.getItem('token');
    axios.get(`${API_BASE_URL}/logistic/api/articles/`, {
      headers: {
        Authorization: `Token ${token}`,
      },
    })
      .then((response) => {
        setArticles(response.data);
      })
      .catch((error) => {
        console.error(error);
      });
    }
  }, [isViewing]);
  
  
  const createNewArticle = () => {
    const token = localStorage.getItem('token');
    axios.post(`${API_BASE_URL}/logistic/api/articles/`, article, {
      headers: {
        Authorization: `Token ${token}`,
      },
    })
      .then((response) => {
        setArticles([...articles, response.data]);
        setIsArticleFormVisible(false);
      })
      .catch((error) => {
        console.error(error);
      });
  };

  const updateArticle = () => {
    const token = localStorage.getItem('token');
    axios.put(`${API_BASE_URL}/logistic/api/articles/${article.id}/`, article, {
      headers: {
        Authorization: `Token ${token}`,
      },
    })
      .then((response) => {
        setArticles(articles.map((a) => a.id === article.id ? response.data : a));
        setIsArticleFormVisible(false);
      })
      .catch((error) => {
        console.error(error);
      });
  };



  //переход в отфильтрованные заявки из отправлений
  const handleViewRequestsForShipment = (shipmentNumber) => {
    setShipmentFilter(shipmentNumber); // Устанавливаем номер отправления для фильтра
    setIsShipmentFilterActive(true); // Активируем фильтр
    setIsViewing('requests'); // Переход на отображение заявок
    
    // Устанавливаем значение поиска в колонке 'Отправление'
    setSearchText(shipmentNumber);
    setSearchedColumn('shipment');
  
    // Триггерим поиск в таблице
    if (searchInput.current) {
      searchInput.current.input.value = shipmentNumber; // Проставляем значение в инпут
    }
  };
  
  
  // Обновление useEffect для сброса фильтра
  useEffect(() => {
  
    if (isViewing === 'requests' && shipmentFilter) {
      const filtered = requests.filter((request) => {
        const shipment = shipments.find((s) => s.id === request.shipment);
        const match = shipment ? shipment.number.includes(shipmentFilter) : false;
        return match;
      });
  
      setFilteredRequests(filtered);
    } else {
      setFilteredRequests(requests);  // Возвращаем все заявки, если фильтр неактивен
    }
  }, [isViewing, shipmentFilter, requests, shipments]);


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


  const handleReset = (clearFilters, dataIndex) => {
    clearFilters();
    setSearchText('');
    setSearchedColumn('');
  
    if (dataIndex === 'shipment') {
      setShipmentFilter(null);  // Сброс фильтра по отправлению
      setIsShipmentFilterActive(false);  // Деактивация фильтра
      fetchRequests();  // Загрузка всех заявок
    }
  };

  // Функция поиска по колонке "shipment"
  const getColumnShipmentSearchProps = (dataIndex) => ({
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
          <Button onClick={() => handleReset(clearFilters, dataIndex)} size="small" style={{ width: 90 }}>
            Сброс
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
    onFilter: (value, record) => {
      const shipment = shipments.find((s) => s.id === record.shipment);
      return shipment ? shipment.number.includes(value) : false;
    },
  });


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
    ) : dataIndex === 'actual_weight' || dataIndex === 'actual_volume' || dataIndex === 'declared_weight' || dataIndex === 'declared_volume' ? (
        <InputNumber
          value={record[dataIndex]}
          onChange={(value) => {
            record[dataIndex] = value;
          }}
          type="number"
        />
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
     {
      title: 'Номер',
      dataIndex: 'number',
      key: 'number',
      editable: true,
      sorter: (a, b) => a.number.localeCompare(b.number),
      ...getColumnShipmentSearchProps('number'),
      render: (text, record) => (
        <Button
          type="link"
          onClick={() => handleViewRequestsForShipment(text)}
          style={{ padding: 0 }}
        >
          {text}
        </Button>
      ),
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
      sorter: (a, b) => (a.number || 0) - (b.number || 0),
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
      //...getColumnSearchProps('shipment'), // Добавляем поиск по отправлению
      ...getColumnShipmentSearchProps('shipment'), // Добавляем поиск по отправлению
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
        const match = shipment ? shipment.number.toLowerCase().includes(value.toLowerCase()) : false;
        //return shipment ? shipment.number.toLowerCase().includes(value.toLowerCase()) : false;
        console.log(`Применение фильтра в колонке 'Отправление': значение - ${value}, номер - ${shipment?.number || 'Нет данных'}, результат - ${match}`);
        return match;
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
        <Button type="default" onClick={() => setIsViewing('finance')}>Финансы</Button>
        {children}
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
            //columns={mergedColumnsShipments}
            columns={mergedColumnsShipments.map((col) => ({
              ...col,
              filteredValue: shipmentsFilteredInfo[col.dataIndex] || null,
              sortOrder: shipmentsSortedInfo.columnKey === col.dataIndex ? shipmentsSortedInfo.order : null,
            }))}
            rowClassName="editable-row"
            pagination={{ pageSize: 30, onChange: cancel }}
            //onChange={handleTableChange}  // Добавляем обработчик для отслеживания изменений фильтров и сортировки
            onChange={(pagination, filters, sorter) => {
              setShipmentsFilteredInfo(filters); // Сохраняем фильтры для отправлений
              setShipmentsSortedInfo(sorter); // Сохраняем сортировку для отправлений
            }}
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
            <div>
              <Button
                type="default"
                onClick={resetFiltersRequests} // Привязываем функцию сброса
                icon={<CloseOutlined />}
                style={{ marginRight: '10px' }}
              >
                Сбросить фильтры
              </Button>
              <ExportButton data={filteredRequests} columns={columnsRequests} fileName="Заявки" />
            </div>
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
            dataSource={isShipmentFilterActive ? filteredRequests : requests} // Используем filteredRequests при активном фильтре
            //columns={mergedColumnsRequests}
            columns={mergedColumnsRequests.map((col) => ({
              ...col,
              filteredValue: requestsFilteredInfo[col.dataIndex] || null,
              sortOrder: requestsSortedInfo.columnKey === col.dataIndex ? requestsSortedInfo.order : null,
            }))}
              
            rowClassName="editable-row"
            pagination={{ pageSize: 30, onChange: cancel }}
            //onChange={handleTableChange}  // Добавляем обработчик для отслеживания изменений фильтров и сортировки
            onChange={(pagination, filters, sorter) => {
              setRequestsFilteredInfo(filters); // Сохраняем фильтры для заявок
              setRequestsSortedInfo(sorter); // Сохраняем сортировку для заявок
            }}
          />
          </Form>
        </>
      )}
      {fileModal} {/* Добавляем модальное окно для управления файлами */}

      {isViewing === 'finance' && (
        <>
          <h3>Финансы</h3>
          <div className="finance-menu">
            <Button type="default" onClick={() => setIsViewing('article')}>Статьи расходов и доходов</Button>
            <Button type="default" onClick={() => setIsViewing('financeTable')}>Счета и оплаты</Button>
            <Button type="default" onClick={() => setIsViewing('calculation')}>Калькуляция отправления</Button>
            <Button type="default" onClick={() => setIsViewing('balance')}>Баланс</Button>
            <Button type="default" onClick={() => setIsViewing('balanceCounterparty')}>Баланс контрагентов</Button>
            {isViewing === 'article' && articleForm}
            {isViewing === 'financeTable' && financeTable}
            {children}
            {isViewing === 'calculation' && <ShipmentCalculation />}
            {isViewing === 'balance' && balanceForm}
          </div>
        </>
      )}
      {isViewing === 'article' && (
        <div>
          {articleForm}
        </div>
      )}
      {isViewing === 'financeTable' && (
        <div>
          {financeTable}
        </div>
      )}
      {isViewing === 'calculation' && (
        <div>
          <ShipmentCalculation />
        </div>
      )}
      {isViewing === 'balance' && (
        <div>
          {balanceForm}
        </div>
      )}
      {isViewing === 'balanceCounterparty' && (
        <div>
          <h3>Баланс контрагентов</h3>
          <Form layout="vertical">
            <Form.Item label="Выберите контрагента">
              <Select
                showSearch
                placeholder="Выберите контрагента"
                optionFilterProp="children"
                style={{ minWidth: '150px', maxWidth: '100%', width: 'auto' }} // Автоматическая ширина
                onChange={handleCounterpartyChange}
              >
                {counterparties.map((counterparty) => (
                  <Option key={counterparty.id} value={counterparty.id}>
                    {counterparty.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Form>

          {counterpartyBalances && (
            <div>
              <h4>Баланс по валютам</h4>
              <Table
                dataSource={Object.entries(counterpartyBalances).map(([currency, balance]) => ({
                  key: currency,
                  currency: currencyMapping[currency] || currency,
                  balance,
                }))}
                columns={balanceColumns}
                pagination={false}
              />
            </div>
          )}

          {financeRecords.length > 0 && (
            <div>
              <h4>Финансовые записи контрагента</h4>
              <Table
                dataSource={financeRecords.map((record) => ({
                  ...record,
                  key: record.number,
                }))}
                columns={financeColumns}
                pagination={{ pageSize: 10 }}
              />
            </div>
          )}
        </div>
      )}
      
    </div>
  );
}

export default BossDashboard;