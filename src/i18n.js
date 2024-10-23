import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "Login": "Login",
      "Username": "Username",
      "Password": "Password",
      "Submit": "Submit"
    }
  },
  ru: {
    translation: {
      "Login": "Вход",
      "Username": "Логин",
      "Password": "Пароль",
      "Submit": "Отправить"
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: "ru", // Установите язык по умолчанию
  interpolation: {
    escapeValue: false
  }
});

export default i18n;