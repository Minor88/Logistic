import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import Select from 'react-select';

// Кастомный компонент для редактирования с поиском
const CustomShipmentSelect = forwardRef((props, ref) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [filteredOptions, setFilteredOptions] = useState([]);

  useEffect(() => {
    // Устанавливаем первоначальное значение
    const initialValue = props.options.find(option => option.value === props.value);
    setSelectedOption(initialValue || null);
  }, [props.options, props.value]);

  useImperativeHandle(ref, () => ({
    getValue: () => selectedOption ? selectedOption.value : null, // Возвращаем ID выбранного отправления
  }));

  const handleSearch = (inputValue) => {
    // Фильтруем варианты отправлений на основе ввода
    setFilteredOptions(
      props.options.filter(option => option.label.toLowerCase().includes(inputValue.toLowerCase()))
    );
  };

  const handleChange = (selected) => {
    setSelectedOption(selected);
    setTimeout(() => {
      props.stopEditing();  // Завершаем редактирование после изменения
    }, 0);
  };

  return (
    <div style={{ zIndex: 1000, position: 'relative' }}>
      <Select
        value={selectedOption}
        onInputChange={handleSearch} // Обработчик для поиска
        onChange={handleChange}
        options={filteredOptions.length > 0 ? filteredOptions : props.options} // Показываем отфильтрованные варианты
        isSearchable={true}
        placeholder="Поиск..."
        menuPortalTarget={document.body} // Рендерим меню в body, чтобы избежать проблем с z-index
        menuPosition="fixed" // Это заставит меню отображаться под ячейкой
        styles={{
          menuPortal: base => ({ ...base, zIndex: 9999 }), // Высокий z-index для выпадающего списка
          menu: base => ({ ...base, marginTop: 0 }) // Убираем отступ
        }}
      />
    </div>
  );
});

export default CustomShipmentSelect;