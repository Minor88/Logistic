import React, { useState, useEffect } from 'react';
import { Select, InputNumber, Button, Table, message } from 'antd';
import axios from 'axios';
import { useMemo } from 'react';
import * as XLSX from 'xlsx'; // Импортируем библиотеку xlsx
import './ShipmentCalculation.css';
import { DownloadOutlined } from '@ant-design/icons';

const { Option } = Select;

const API_BASE_URL = localStorage.getItem('base_url');

function ShipmentCalculation() {
  const [shipments, setShipments] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [usdRate, setUsdRate] = useState(0);
  const [eurRate, setEurRate] = useState(0);
  const [requests, setRequests] = useState([]);
  const [clients, setClients] = useState([]); // Хранилище данных о клиентах
  const [calculatedRequests, setCalculatedRequests] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const token = localStorage.getItem('token');
  //const headers = { Authorization: `Token ${token}` };
  const headers = useMemo(() => ({ Authorization: `Token ${token}` }), [token]);

  // Загрузка отправлений
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/logistic/api/shipments/`, { headers })
      .then((response) => setShipments(response.data))
      .catch((error) => console.error('Ошибка загрузки отправлений:', error));
  }, [headers]);

  // Загрузка списка клиентов
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/logistic/api/clients/`, { headers })
      .then((response) => setClients(response.data))
      .catch((error) => console.error('Ошибка загрузки клиентов:', error));
  }, [headers]);

  // Загрузка заявок для выбранного отправления
  const fetchRequestsForShipment = (shipmentId) => {
    if (!shipmentId) return;
  
    // Получаем полный список заявок
    axios
      .get(`${API_BASE_URL}/logistic/api/requests/`, { headers })
      .then((response) => {
        // Фильтруем заявки по shipmentId
        const filteredRequests = response.data.filter(
          (request) => request.shipment === shipmentId
        );
  
        // Добавляем имя клиента в отфильтрованные заявки
        const enrichedRequests = filteredRequests.map((request) => {
          const client = clients.find((client) => client.id === request.client);
          return { ...request, client_name: client ? client.name : 'Нет данных' };
        });
  
        setRequests(enrichedRequests);
      })
      .catch((error) => console.error('Ошибка загрузки заявок:', error));
  };

  //Загрузка связанных затрат
  const fetchExpensesForShipment = (shipmentId) => {
    if (!shipmentId) return;

    axios
        .get(`${API_BASE_URL}/logistic/api/shipment_calculations/${shipmentId}/expenses/`, { headers })
        .then((response) => {
            setExpenses(response.data);
        })
        .catch((error) => {
            console.error('Ошибка загрузки затрат:', error);
            message.error('Не удалось загрузить затраты.');
        });
};

  // Сохранение курсов валют
    const saveRates = () => {
        if (!selectedShipment) {
            message.error('Выберите отправление!');
            return;
        }

        // Проверяем, существует ли запись
        axios
            .get(`${API_BASE_URL}/logistic/api/shipment_calculations/by-shipment/${selectedShipment}/`, { headers })
            .then((response) => {
                // Если запись существует, обновляем ее
                axios
                    .put(
                        `${API_BASE_URL}/logistic/api/shipment_calculations/${response.data.id}/`,
                        {
                            euro_rate: eurRate,
                            usd_rate: usdRate,
                        },
                        { headers }
                    )
                    .then(() => message.success('Курсы валют успешно обновлены!'))
                    .catch((error) => message.error('Ошибка обновления курсов валют:', error));
            })
            .catch((error) => {
                if (error.response && error.response.status === 404) {
                    // Если запись не существует, создаем новую
                    axios
                        .post(
                            `${API_BASE_URL}/logistic/api/shipment_calculations/`,
                            {
                                shipment: selectedShipment,
                                euro_rate: eurRate,
                                usd_rate: usdRate,
                            },
                            { headers }
                        )
                        .then(() => message.success('Курсы валют успешно сохранены!'))
                        .catch((error) => message.error('Ошибка сохранения курсов валют:', error));
                } else {
                    console.error('Ошибка загрузки курсов валют:', error);
                    message.error('Произошла ошибка при обработке запроса.');
                }
            });
    };

   // Обработчик выбора отправления
   const handleShipmentChange = (shipmentId) => {
    setSelectedShipment(shipmentId);
    fetchRequestsForShipment(shipmentId);
    fetchExpensesForShipment(shipmentId); // Загружаем затраты

    // Загрузка данных из ShipmentCalculation
       axios
           .get(`${API_BASE_URL}/logistic/api/shipment_calculations/by-shipment/${shipmentId}/`, { headers })
           .then((response) => {
               setUsdRate(response.data.usd_rate);
               setEurRate(response.data.euro_rate);
           })
           .catch((error) => {
               if (error.response && error.response.status === 404) {
                   message.info('Запись для данного отправления отсутствует. Используйте новые курсы.');
               } else {
                   console.error('Ошибка загрузки курсов валют:', error);
               }
           });
  };

  // Обработчик расчёта себестоимости
  const handleCalculate = () => {
    if (!selectedShipment) {
        message.error('Выберите отправление!');
        return;
    }

    axios
        .post(`${API_BASE_URL}/logistic/api/shipment_calculations/${selectedShipment}/calculate-costs/`, {}, { headers })
        .then((response) => {
            setCalculatedRequests(response.data);
            message.success('Расчет выполнен успешно!');
        })
        .catch((error) => {
            console.error('Ошибка расчета:', error);
            if (error.response && error.response.data.error) {
                message.error(error.response.data.error);
            } else {
                message.error('Произошла ошибка при расчете.');
            }
        });
};

// Экспорт в Excel
const exportToExcel = () => {
  if (!calculatedRequests.length) {
      message.error('Нет данных для экспорта!');
      return;
  }

  // Определяем русские заголовки
  const columns = [
      { header: 'Номер', key: 'number' },
      { header: 'Описание', key: 'description' },
      { header: 'Кол-во мест', key: 'col_mest' },
      { header: 'Фактический вес (кг)', key: 'actual_weight' },
      { header: 'Фактический объем (м³)', key: 'actual_volume' },
      { header: 'Комментарий', key: 'comment' },
      { header: 'Клиент', key: 'client_name' },
      { header: 'Расчётный вес', key: 'calculatedWeight' },
      { header: 'Себестоимость руб.', key: 'costRub' },
  ];

  // Создаем массив данных с русскими заголовками
  const dataWithHeaders = calculatedRequests.map((request) =>
      columns.reduce((row, column) => {
          row[column.header] = request[column.key];
          return row;
      }, {})
  );

  // Создаем таблицу с русскими заголовками
  const worksheet = XLSX.utils.json_to_sheet(dataWithHeaders, {
      header: columns.map((col) => col.header), // Используем русские заголовки
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Калькуляция');

  // Сохраняем файл
  XLSX.writeFile(workbook, `Shipment_Calculation_${selectedShipment}.xlsx`);
  message.success('Данные успешно экспортированы в Excel!');
};


  return (
    <div className="shipment-calculation-container">
      <h3 className="shipment-calculation-header">Калькуляция отправления</h3>
      <div className="shipment-calculation-select">
        <label>Выберите отправление:</label>
        <Select
          style={{ width: 200 }}
          onChange={handleShipmentChange}
          placeholder="Выберите отправление"
        >
          {shipments.map((shipment) => (
            <Option key={shipment.id} value={shipment.id}>
              {shipment.number}
            </Option>
          ))}
        </Select>
      </div>
      <div className="shipment-calculation-input-group">
        <label>Курс USD:</label>
        <InputNumber
          min={0}
          value={usdRate}
          onChange={(value) => setUsdRate(value)}
        />
        <label>Курс EUR:</label>
        <InputNumber
          min={0}
          value={eurRate}
          onChange={(value) => setEurRate(value)}
        />
        <Button onClick={saveRates}>Сохранить курсы</Button>
      </div>
      <div className="shipment-calculation-actions">
        <div className="action-buttons">
          <Button onClick={handleCalculate}>Считать</Button>
        </div>
        <div className="export-button">
          <Button onClick={exportToExcel} icon={<DownloadOutlined />}>Экспорт в Excel</Button>
        </div>
      </div>

      <Table
        dataSource={calculatedRequests.length ? calculatedRequests : requests}
        rowKey="id" // Уникальный ключ для строк
        className="shipment-calculation-table"
        columns={[
          { title: 'Номер', dataIndex: 'number', key: 'number' },
          { title: 'Описание', dataIndex: 'description', key: 'description' },
          { title: 'Кол-во мест', dataIndex: 'col_mest', key: 'col_mest' },
          { title: 'Фактический вес (кг)', dataIndex: 'actual_weight', key: 'actual_weight' },
          { title: 'Фактический объем (м³)', dataIndex: 'actual_volume', key: 'actual_volume' },
          { title: 'Комментарий', dataIndex: 'comment', key: 'comment' },
          { title: 'Клиент', dataIndex: 'client_name', key: 'client_name' }, // Имя клиента
          { title: 'Расчётный вес', dataIndex: 'calculatedWeight', key: 'calculatedWeight' },
          { title: 'Себестоимость руб.', dataIndex: 'costRub', key: 'costRub' },
        ]}
      />

      <h4>Затраты на отправление</h4>
      <Table
        dataSource={expenses}
        rowKey={(record) => record.id || `${record.number}-${record.currency_display}`}
        className="shipment-expenses-table"
        columns={[
          { title: 'Номер', dataIndex: 'number', key: 'number' },
          { title: 'Валюта', dataIndex: 'currency_display', key: 'currency_display' },
          { title: 'Сумма', dataIndex: 'amount', key: 'amount' },
          { title: 'Контрагент', dataIndex: 'counterparty_display', key: 'counterparty_display' },
          { title: 'Статья', dataIndex: 'article_display', key: 'article_display' },
          { title: 'Комментарий', dataIndex: 'comment', key: 'comment' },
        ]}
      />
    </div>
  );
}

export default ShipmentCalculation;