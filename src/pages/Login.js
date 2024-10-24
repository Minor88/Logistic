import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';  // Импорт i18next
import './Login.css';

//const API_BASE_URL = process.env.REACT_APP_API_BASE_URL_LOCAL; // Локальная среда

// Функция для определения правильного URL
export const getBaseUrl = () => {
  const isLocalNetwork = window.location.hostname.includes('192.168.1.11') || window.location.hostname === 'localhost';
  return isLocalNetwork 
    ? process.env.REACT_APP_API_BASE_URL_LOCAL 
    : process.env.REACT_APP_API_BASE_URL_EXTERNAL;
};

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();  // Подключение перевода

  // Получаем правильный URL и сохраняем его в localStorage
  const API_BASE_URL = getBaseUrl();
  localStorage.setItem('base_url', API_BASE_URL);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/api/login/`, {
        username: username,
        password: password
      });


      const { token, user_group, id } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user_group', user_group); // Сохраняем группу пользователя
      // Перенаправляем на нужную страницу в зависимости от группы

      // Получаем профиль клиента
      const profileResponse = await axios.get(`${API_BASE_URL}/logistic/api/userprofiles/`, {
        headers: { Authorization: `Token ${token}` }
      });

      // Поиск профиля по id из auth_user
      const userProfile = profileResponse.data.find(profile => profile.user === id); // Ищем профиль по auth_user id
      console.log("profileResponse.data", profileResponse.data);

      if (userProfile) {
        // Сохраняем ID профиля клиента
        localStorage.setItem('user_id', userProfile.user);
        console.log("Сохраняемый user_id:", userProfile.user);
      } else {
        console.error('Профиль пользователя не найден');
      }
    


      if (user_group === 'manager') {
        navigate('/manager');
      } else if (user_group === 'client') {
        navigate('/client');
      } else if (user_group === 'warehouse') {
        navigate('/warehouse');
      }
    } catch (error) {
      console.error("Ошибка авторизации", error);
    }
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);  // Смена языка
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleLogin}>
        <h2>{t('Login')}</h2>
        <div>
          <label>{t('Username')}</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label>{t('Password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit">{t('Submit')}</button>
      </form>
      <div className="language-buttons">
        <button onClick={() => changeLanguage('en')}>English</button>
        <button onClick={() => changeLanguage('ru')}>Русский</button>
      </div>
    </div>
  );
}

export default Login;