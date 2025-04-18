import React, { useState, useEffect } from 'react';
import * as api from '../services/api';

const SearchForm = ({ onSearch, isLoading }) => {
  // Estados básicos de búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [isTagSearch, setIsTagSearch] = useState(false);
  const [isDateSearch, setIsDateSearch] = useState(false);
  const [isCombinedSearch, setIsCombinedSearch] = useState(false);
  const [isMultipleTagsSearch, setIsMultipleTagsSearch] = useState(false);
  const [isMultipleTagsWithDateSearch, setIsMultipleTagsWithDateSearch] = useState(false);
  const [isTextAndDateSearch, setIsTextAndDateSearch] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Estados para búsqueda de etiquetas
  const [availableTags, setAvailableTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  
  // Estados para búsqueda de múltiples etiquetas
  const [selectedTags, setSelectedTags] = useState([]);
  
  // Estados para búsqueda por fecha
  const [dateSearchType, setDateSearchType] = useState('specific');
  const [specificDate, setSpecificDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  
  // Estados para búsqueda combinada (etiqueta + fecha)
  const [combinedSearchTag, setCombinedSearchTag] = useState('');
  const [combinedSearchDate, setCombinedSearchDate] = useState('');
  const [combinedDateType, setCombinedDateType] = useState('specific');
  
  // Estados para búsqueda múltiples etiquetas + fecha
  const [multipleTagsWithDate, setMultipleTagsWithDate] = useState('');
  const [multipleTagsDateType, setMultipleTagsDateType] = useState('specific');
  
  // Estados para búsqueda texto + fecha
  const [textAndDateSearchText, setTextAndDateSearchText] = useState('');
  const [textAndDateDate, setTextAndDateDate] = useState('');
  const [textAndDateType, setTextAndDateType] = useState('specific');

  // Obtener el bucket actual del token en localStorage
  const getCurrentBucket = () => {
    try {
      // Intentar primero obtener desde user_session (nuevo formato)
      const userSession = localStorage.getItem('user_session');
      if (userSession) {
        const userData = JSON.parse(userSession);
        if (userData.bucket) {
          console.log('Obteniendo bucket desde user_session:', userData.bucket);
          return userData.bucket;
        }
      }
      
      // Si no funciona, intentar desde authToken (formato usado en otros componentes)
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const tokenData = JSON.parse(atob(token));
          if (tokenData.bucket) {
            console.log('Obteniendo bucket desde authToken:', tokenData.bucket);
            return tokenData.bucket;
          }
        } catch (tokenError) {
          console.error('Error al decodificar authToken:', tokenError);
        }
      }
    } catch (error) {
      console.error('Error al obtener bucket del almacenamiento:', error);
    }

    console.log('Usando bucket por defecto: master');
    return 'master'; // valor por defecto
  };

  // Cargar etiquetas cuando sea necesario
  useEffect(() => {
    if (isTagSearch || isCombinedSearch || isMultipleTagsSearch || isMultipleTagsWithDateSearch) {
      fetchAvailableTags();
    }
  }, [isTagSearch, isCombinedSearch, isMultipleTagsSearch, isMultipleTagsWithDateSearch]);

  // Función para cargar todas las etiquetas disponibles desde la API
  const fetchAvailableTags = async () => {
    try {
      setLoadingTags(true);
      console.log('Cargando etiquetas desde la API para el buscador...');
      
      // Obtener etiquetas desde la API
      const response = await api.getTags();
      
      console.log('Respuesta de la API getTags para búsqueda:', response);
      
      if (response && response.success && response.tags) {
        // Extraer todas las etiquetas
        const allTags = response.tags.map(tag => tag.tag_name);
        
        // Eliminar duplicados
        const uniqueTags = [...new Set(allTags)];
        console.log('Etiquetas únicas extraídas para búsqueda:', uniqueTags);
        setAvailableTags(uniqueTags);
        console.log(`${uniqueTags.length} etiquetas cargadas desde la API para búsqueda`);
      } else if (response && response.success && response.tagsByCategory) {
        // Alternativa: extraer de tagsByCategory si está disponible
        const allTags = [];
        Object.entries(response.tagsByCategory).forEach(([category, tags]) => {
          allTags.push(...tags);
          console.log(`Categoría ${category} tiene ${tags.length} etiquetas para búsqueda`);
        });
        
        const uniqueTags = [...new Set(allTags)];
        console.log('Etiquetas únicas extraídas de tagsByCategory para búsqueda:', uniqueTags);
        setAvailableTags(uniqueTags);
        console.log(`${uniqueTags.length} etiquetas cargadas desde la API para búsqueda (usando tagsByCategory)`);
      } else {
        console.log('No se pudieron cargar etiquetas desde la API para búsqueda. Respuesta:', response);
        setAvailableTags([]);
      }
    } catch (error) {
      console.error('Error al cargar etiquetas disponibles desde la API:', error);
      setAvailableTags([]);
    } finally {
      setLoadingTags(false);
    }
  };

  // Función para filtrar etiquetas basado en el término de búsqueda
  const getFilteredTags = () => {
    if (!tagFilter.trim()) {
      return availableTags;
    }
    
    const filterLower = tagFilter.toLowerCase();
    return availableTags.filter(tag => 
      tag.toLowerCase().includes(filterLower)
    );
  };

  // Generar años para el selector (últimos 10 años)
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= currentYear - 10; year--) {
      years.push(year.toString());
    }
    return years;
  };

  // Generar meses para el selector
  const getMonthOptions = () => {
    return [
      {value: '01', name: 'Enero'},
      {value: '02', name: 'Febrero'},
      {value: '03', name: 'Marzo'},
      {value: '04', name: 'Abril'},
      {value: '05', name: 'Mayo'},
      {value: '06', name: 'Junio'},
      {value: '07', name: 'Julio'},
      {value: '08', name: 'Agosto'},
      {value: '09', name: 'Septiembre'},
      {value: '10', name: 'Octubre'},
      {value: '11', name: 'Noviembre'},
      {value: '12', name: 'Diciembre'}
    ];
  };

  // Manejar cambio en tipo de búsqueda
  const handleSearchTypeChange = (type) => {
    // Resetear todos los estados de tipo de búsqueda
    setIsTagSearch(false);
    setIsDateSearch(false);
    setIsCombinedSearch(false);
    setIsMultipleTagsSearch(false);
    setIsMultipleTagsWithDateSearch(false);
    setIsTextAndDateSearch(false);
    
    // Activar solo el tipo seleccionado
    switch (type) {
      case 'tag':
        setIsTagSearch(true);
        setSearchTerm(selectedTag);
        break;
      case 'date':
        setIsDateSearch(true);
        updateDateSearchTerm();
        break;
      case 'combined':
        setIsCombinedSearch(true);
        updateCombinedSearchTerm();
        break;
      case 'multipleTags':
        setIsMultipleTagsSearch(true);
        updateMultipleTagsSearchTerm();
        break;
      case 'multipleTagsWithDate':
        setIsMultipleTagsWithDateSearch(true);
        updateMultipleTagsWithDateSearchTerm();
        break;
      case 'textAndDate':
        setIsTextAndDateSearch(true);
        updateTextAndDateSearchTerm();
        break;
      default: // texto simple
        // Ya se resetean todos los estados arriba
        break;
    }
  };

  // Manejar el cambio de etiqueta seleccionada
  const handleTagChange = (e) => {
    setSelectedTag(e.target.value);
    setSearchTerm(e.target.value); // También actualizar el término de búsqueda
  };

  // Actualizar término de búsqueda basado en los campos de fecha
  const updateDateSearchTerm = () => {
    if (dateSearchType === 'specific' && specificDate) {
      setSearchTerm(`date:${specificDate}`);
    } else if (dateSearchType === 'month' && selectedMonth) {
      setSearchTerm(`month:${selectedMonth}`);
    } else if (dateSearchType === 'year' && selectedYear) {
      setSearchTerm(`year:${selectedYear}`);
    }
  };

  // Función para actualizar el término de búsqueda combinada
  const updateCombinedSearchTerm = () => {
    let term = '';
    
    // Añadir la parte de etiqueta si existe
    if (combinedSearchTag) {
      term = `tag:${combinedSearchTag}`;
    }
    
    // Añadir la parte de fecha si existe
    if (combinedSearchDate) {
      if (term) term += ' ';
      
      if (combinedDateType === 'specific') {
        term += `date:${combinedSearchDate}`;
      } else if (combinedDateType === 'month') {
        // Verificar que el formato sea correcto para mes
        const dateParts = combinedSearchDate.split('-');
        if (dateParts.length >= 2) {
          term += `month:${dateParts[0]}-${dateParts[1]}`;
        } else {
          term += `month:${combinedSearchDate}`;
        }
      } else if (combinedDateType === 'year') {
        term += `year:${combinedSearchDate}`;
      }
    }
    
    console.log('Término de búsqueda combinada actualizado:', term);
    setSearchTerm(term);
  };

  // Función para actualizar el término de búsqueda de múltiples etiquetas
  const updateMultipleTagsSearchTerm = () => {
    if (selectedTags && selectedTags.length > 0) {
      // Mostrar las etiquetas seleccionadas en el campo de búsqueda
      const tagsString = selectedTags.join(', ');
      setSearchTerm(`Múltiples etiquetas: ${tagsString}`);
      console.log('Término de búsqueda de múltiples etiquetas actualizado:', tagsString);
    } else {
      setSearchTerm('');
    }
  };

  // Función para actualizar el término de búsqueda combinada de múltiples etiquetas y fecha
  const updateMultipleTagsWithDateSearchTerm = () => {
    let term = '';
    
    // Añadir la parte de etiquetas si existen
    if (selectedTags && selectedTags.length > 0) {
      const tagsString = selectedTags.join(', ');
      term = `Etiquetas: ${tagsString}`;
    }
    
    // Añadir la parte de fecha si existe
    if (multipleTagsWithDate) {
      if (term) term += ' + ';
      
      if (multipleTagsDateType === 'specific') {
        term += `Fecha: ${multipleTagsWithDate}`;
      } else if (multipleTagsDateType === 'month') {
        // Verificar que el formato sea correcto para mes
        const dateParts = multipleTagsWithDate.split('-');
        if (dateParts.length >= 2) {
          term += `Mes: ${dateParts[0]}-${dateParts[1]}`;
        } else {
          term += `Mes: ${multipleTagsWithDate}`;
        }
      } else if (multipleTagsDateType === 'year') {
        term += `Año: ${multipleTagsWithDate}`;
      }
    }
    
    console.log('Término de búsqueda de múltiples etiquetas con fecha actualizado:', term);
    setSearchTerm(term);
  };

  // Función para actualizar el término de búsqueda de texto + fecha
  const updateTextAndDateSearchTerm = () => {
    let term = '';
    
    // Añadir la parte de texto si existe
    if (textAndDateSearchText) {
      term = textAndDateSearchText;
    }
    
    // Añadir la parte de fecha si existe
    if (textAndDateDate) {
      if (term) term += ' + ';
      
      if (textAndDateType === 'specific') {
        term += `Fecha: ${textAndDateDate}`;
      } else if (textAndDateType === 'month') {
        // Verificar que el formato sea correcto para mes
        const dateParts = textAndDateDate.split('-');
        if (dateParts.length >= 2) {
          term += `Mes: ${dateParts[0]}-${dateParts[1]}`;
        } else {
          term += `Mes: ${textAndDateDate}`;
        }
      } else if (textAndDateType === 'year') {
        term += `Año: ${textAndDateDate}`;
      }
    }
    
    console.log('Término de búsqueda texto + fecha actualizado:', term);
    setSearchTerm(term);
  };

  // Efectos para actualizar los términos de búsqueda cuando cambian los campos
  useEffect(() => {
    if (isDateSearch) updateDateSearchTerm();
  }, [dateSearchType, specificDate, selectedMonth, selectedYear, isDateSearch]);

  useEffect(() => {
    if (isCombinedSearch) updateCombinedSearchTerm();
  }, [combinedSearchTag, combinedSearchDate, combinedDateType, isCombinedSearch]);

  useEffect(() => {
    if (isMultipleTagsSearch) updateMultipleTagsSearchTerm();
  }, [selectedTags, isMultipleTagsSearch]);

  useEffect(() => {
    if (isMultipleTagsWithDateSearch) updateMultipleTagsWithDateSearchTerm();
  }, [selectedTags, multipleTagsWithDate, multipleTagsDateType, isMultipleTagsWithDateSearch]);

  useEffect(() => {
    if (isTextAndDateSearch) updateTextAndDateSearchTerm();
  }, [textAndDateSearchText, textAndDateDate, textAndDateType, isTextAndDateSearch]);

  // Función para manejar el envío del formulario

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    
    try {
      // Para búsqueda de texto + fecha
      if (isTextAndDateSearch && textAndDateSearchText && textAndDateDate) {
        console.log('Realizando búsqueda por texto y fecha');
        
        try {
          const results = await api.searchTextWithDate(
            textAndDateSearchText,
            textAndDateDate,
            textAndDateType
          );
          
          console.log(`Búsqueda por texto y fecha exitosa: ${results.length} resultados`);
          onSearch(results, false, false, null, true, true); // Último parámetro indica filtrar metadata
          return;
        } catch (error) {
          console.error('Error al realizar búsqueda por texto y fecha:', error);
        }
      }
      
      // Guardar la etiqueta en localStorage si es una búsqueda por etiqueta y no existe ya
      if (isTagSearch && !availableTags.includes(searchTerm.trim())) {
        // Código para guardar etiqueta (sin cambios)
        // ...
      }
      
      // Para búsqueda combinada de etiqueta + fecha
      if (isCombinedSearch && combinedSearchTag && combinedSearchDate) {
        console.log('Realizando búsqueda combinada con API especializada');
        
        try {
          const results = await api.searchFilesCombined(
            combinedSearchTag,
            combinedSearchDate,
            combinedDateType
          );
          
          console.log(`Búsqueda combinada exitosa: ${results.length} resultados`);
          onSearch(results, false, false, null, true, true); // Último parámetro indica filtrar metadata
          return;
        } catch (error) {
          console.error('Error al realizar búsqueda combinada:', error);
        }
      }
      
      // Para búsqueda de múltiples etiquetas
      if (isMultipleTagsSearch && selectedTags.length > 0) {
        console.log('Realizando búsqueda por múltiples etiquetas');
        
        try {
          const results = await api.searchFilesByMultipleTags(selectedTags);
          
          console.log(`Búsqueda por múltiples etiquetas exitosa: ${results.length} resultados`);
          onSearch(results, false, false, null, true, true); // Último parámetro indica filtrar metadata
          return;
        } catch (error) {
          console.error('Error al realizar búsqueda por múltiples etiquetas:', error);
        }
      }
      
      // Para búsqueda de múltiples etiquetas con fecha
      if (isMultipleTagsWithDateSearch && selectedTags.length > 0 && multipleTagsWithDate) {
        console.log('Realizando búsqueda por múltiples etiquetas con fecha');
        
        try {
          const results = await api.searchMultipleTagsWithDate(
            selectedTags,
            multipleTagsWithDate,
            multipleTagsDateType
          );
          
          console.log(`Búsqueda por múltiples etiquetas con fecha exitosa: ${results.length} resultados`);
          onSearch(results, false, false, null, true, true); // Último parámetro indica filtrar metadata
          return;
        } catch (error) {
          console.error('Error al realizar búsqueda por múltiples etiquetas con fecha:', error);
        }
      }
      
      // Para tipos de búsqueda básicos o si las anteriores fallaron
      onSearch(searchTerm, isTagSearch, isDateSearch, dateSearchType, false, true); // Último parámetro indica filtrar metadata
    } catch (error) {
      console.error('Error al realizar la búsqueda:', error);
    }
  };

  // Renderizado del componente
  return (
    <div className="search-form">
      <form onSubmit={handleSubmit}>
        <div className="search-container">
          {/* Opciones de Tipo de Búsqueda */}
          <div className="search-options-container">
            <div className="basic-search-options">
              <label className="search-option">
                <input
                  type="radio"
                  name="searchType"
                  checked={!isTagSearch && !isDateSearch && !isCombinedSearch && !isMultipleTagsSearch && !isMultipleTagsWithDateSearch && !isTextAndDateSearch}
                  onChange={() => handleSearchTypeChange('text')}
                  disabled={isLoading}
                />
                Texto
              </label>
              <label className="search-option">
                <input
                  type="radio"
                  name="searchType"
                  checked={isTagSearch}
                  onChange={() => handleSearchTypeChange('tag')}
                  disabled={isLoading}
                />
                Etiqueta
              </label>
              <label className="search-option">
                <input
                  type="radio"
                  name="searchType"
                  checked={isDateSearch}
                  onChange={() => handleSearchTypeChange('date')}
                  disabled={isLoading}
                />
                Fecha
              </label>
              <button 
                type="button" 
                className="toggle-advanced-button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              >
                {showAdvancedOptions ? '▲ Ocultar opciones' : '▼ Mostrar opciones'}
              </button>
            </div>
            
            {showAdvancedOptions && (
              <div className="advanced-search-types">
                <label className="search-option">
                  <input
                    type="radio"
                    name="searchType"
                    checked={isCombinedSearch}
                    onChange={() => handleSearchTypeChange('combined')}
                    disabled={isLoading}
                  />
                  Etiqueta + Fecha
                </label>
                <label className="search-option">
                  <input
                    type="radio"
                    name="searchType"
                    checked={isMultipleTagsSearch}
                    onChange={() => handleSearchTypeChange('multipleTags')}
                    disabled={isLoading}
                  />
                  Múltiples Etiquetas
                </label>
                <label className="search-option">
                  <input
                    type="radio"
                    name="searchType"
                    checked={isMultipleTagsWithDateSearch}
                    onChange={() => handleSearchTypeChange('multipleTagsWithDate')}
                    disabled={isLoading}
                  />
                  Múltiples Etiquetas + Fecha
                </label>
                <label className="search-option">
                  <input
                    type="radio"
                    name="searchType"
                    checked={isTextAndDateSearch}
                    onChange={() => handleSearchTypeChange('textAndDate')}
                    disabled={isLoading}
                  />
                  Texto + Fecha
                </label>
              </div>
            )}
          </div>
          
          {/* Opciones Específicas para cada tipo de Búsqueda */}
          <div className="search-type-options">
            {/* Búsqueda por Etiqueta */}
            {isTagSearch && (
              <div className="tag-search-options">
                <div className="tag-filter-container">
                  <input
                    type="text"
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    placeholder="Filtrar etiquetas..."
                    className="tag-filter-input"
                    disabled={isLoading || loadingTags}
                  />
                </div>
                <select 
                  value={selectedTag} 
                  onChange={handleTagChange}
                  disabled={isLoading || loadingTags}
                  className="tag-selector"
                >
                  <option value="">-- Seleccionar etiqueta --</option>
                  {getFilteredTags().map((tag, index) => (
                    <option key={index} value={tag}>{tag}</option>
                  ))}
                </select>
                {loadingTags && <span className="loading-indicator">Cargando etiquetas...</span>}
              </div>
            )}
            
            {/* Búsqueda por Fecha */}
            {isDateSearch && (
              <div className="date-search-options">
                <div className="date-type-selector">
                  <label>
                    <input
                      type="radio"
                      name="dateSearchType"
                      value="specific"
                      checked={dateSearchType === 'specific'}
                      onChange={() => setDateSearchType('specific')}
                      disabled={isLoading}
                    />
                    Fecha específica
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="dateSearchType"
                      value="month"
                      checked={dateSearchType === 'month'}
                      onChange={() => setDateSearchType('month')}
                      disabled={isLoading}
                    />
                    Mes y año
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="dateSearchType"
                      value="year"
                      checked={dateSearchType === 'year'}
                      onChange={() => setDateSearchType('year')}
                      disabled={isLoading}
                    />
                    Año
                  </label>
                </div>
                
                {dateSearchType === 'specific' && (
                  <input
                    type="date"
                    value={specificDate}
                    onChange={(e) => setSpecificDate(e.target.value)}
                    disabled={isLoading}
                    className="date-input"
                  />
                )}
                
                {dateSearchType === 'month' && (
                  <div className="month-year-selector">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      disabled={isLoading}
                      className="month-selector"
                    >
                      <option value="">-- Mes --</option>
                      {getMonthOptions().map(month => (
                        <option key={month.value} value={month.value}>{month.name}</option>
                      ))}
                    </select>
                    
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      disabled={isLoading}
                      className="year-selector"
                    >
                      <option value="">-- Año --</option>
                      {getYearOptions().map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {dateSearchType === 'year' && (
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    disabled={isLoading}
                    className="year-selector full-width"
                  >
                    <option value="">-- Seleccionar año --</option>
                    {getYearOptions().map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            
            {/* Búsqueda Combinada (Etiqueta + Fecha) */}
            {isCombinedSearch && (
              <div className="combined-search-options">
                <h4>Búsqueda combinada</h4>
                
                <div className="combined-tag-section">
                  <label>Seleccionar etiqueta:</label>
                  <div className="tag-filter-container">
                    <input
                      type="text"
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      placeholder="Filtrar etiquetas..."
                      className="tag-filter-input"
                      disabled={isLoading || loadingTags}
                    />
                  </div>
                  <select 
                    value={combinedSearchTag} 
                    onChange={(e) => {
                      setCombinedSearchTag(e.target.value);
                      updateCombinedSearchTerm();
                    }}
                    disabled={isLoading || loadingTags}
                    className="tag-selector"
                  >
                    <option value="">-- Seleccionar etiqueta --</option>
                    {getFilteredTags().map((tag, index) => (
                      <option key={index} value={tag}>{tag}</option>
                    ))}
                  </select>
                  {loadingTags && <span className="loading-indicator">Cargando etiquetas...</span>}
                </div>
                
                <div className="combined-date-section">
                  <label>Seleccionar fecha:</label>
                  <div className="date-type-selector">
                    <label>
                      <input
                        type="radio"
                        name="combinedDateType"
                        value="specific"
                        checked={combinedDateType === 'specific'}
                        onChange={() => {
                          setCombinedDateType('specific');
                          updateCombinedSearchTerm();
                        }}
                        disabled={isLoading}
                      />
                      Fecha específica
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="combinedDateType"
                        value="month"
                        checked={combinedDateType === 'month'}
                        onChange={() => {
                          setCombinedDateType('month');
                          updateCombinedSearchTerm();
                        }}
                        disabled={isLoading}
                      />
                      Mes y año
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="combinedDateType"
                        value="year"
                        checked={combinedDateType === 'year'}
                        onChange={() => {
                          setCombinedDateType('year');
                          updateCombinedSearchTerm();
                        }}
                        disabled={isLoading}
                      />
                      Año
                    </label>
                  </div>
                  
                  {combinedDateType === 'specific' && (
                    <input
                      type="date"
                      value={combinedSearchDate}
                      onChange={(e) => {
                        setCombinedSearchDate(e.target.value);
                        updateCombinedSearchTerm();
                      }}
                      disabled={isLoading}
                      className="date-input"
                    />
                  )}
                  
                  {combinedDateType === 'month' && (
                    <div className="month-year-selector">
                      <select
                        value={combinedSearchDate.split('-')[1] || ''}
                        onChange={(e) => {
                          const yearPart = combinedSearchDate.split('-')[0] || '';
                          const newDate = yearPart ? `${yearPart}-${e.target.value}` : '';
                          setCombinedSearchDate(newDate);
                          updateCombinedSearchTerm();
                        }}
                        disabled={isLoading}
                        className="month-selector"
                      >
                        <option value="">-- Mes --</option>
                        {getMonthOptions().map(month => (
                          <option key={month.value} value={month.value}>{month.name}</option>
                        ))}
                      </select>
                      
                      <select
                        value={combinedSearchDate.split('-')[0] || ''}
                        onChange={(e) => {
                          const monthPart = combinedSearchDate.split('-')[1] || '';
                          const newDate = monthPart ? `${e.target.value}-${monthPart}` : e.target.value;
                          setCombinedSearchDate(newDate);
                          updateCombinedSearchTerm();
                        }}
                        disabled={isLoading}
                        className="year-selector"
                      >
                        <option value="">-- Año --</option>
                        {getYearOptions().map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {combinedDateType === 'year' && (
                    <select
                      value={combinedSearchDate}
                      onChange={(e) => {
                        setCombinedSearchDate(e.target.value);
                        updateCombinedSearchTerm();
                      }}
                      disabled={isLoading}
                      className="year-selector full-width"
                    >
                      <option value="">-- Seleccionar año --</option>
                      {getYearOptions().map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
            
            {/* Búsqueda por Múltiples Etiquetas */}
            {isMultipleTagsSearch && (
              <div className="multiple-tags-search-options">
                <h4>Búsqueda por múltiples etiquetas</h4>
                
                <div className="multiple-tags-selector">
                  <label>Seleccionar etiquetas (hasta 4):</label>
                  <div className="tag-filter-container">
                    <input
                      type="text"
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      placeholder="Filtrar etiquetas..."
                      className="tag-filter-input"
                      disabled={isLoading || loadingTags}
                    />
                  </div>
                  <div className="tags-selection-container">
                    {getFilteredTags().map((tag, index) => (
                      <label key={index} className="tag-checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Limitar a máximo 4 etiquetas
                              if (selectedTags.length < 4) {
                                setSelectedTags([...selectedTags, tag]);
                              }
                            } else {
                              setSelectedTags(selectedTags.filter(t => t !== tag));
                            }
                          }}
                          disabled={isLoading || (selectedTags.length >= 4 && !selectedTags.includes(tag))}
                          className="tag-checkbox"
                        />
                        {tag}
                      </label>
                    ))}
                  </div>
                  {loadingTags && <span className="loading-indicator">Cargando etiquetas...</span>}
                  <div className="selected-tags-summary">
                    <strong>Etiquetas seleccionadas:</strong> {selectedTags.length > 0 ? selectedTags.join(', ') : 'Ninguna'}
                  </div>
                </div>
              </div>
            )}
            
            {/* Búsqueda por Múltiples Etiquetas + Fecha */}
            {isMultipleTagsWithDateSearch && (
              <div className="multiple-tags-date-search-options">
                <h4>Búsqueda por múltiples etiquetas y fecha</h4>
                
                <div className="multiple-tags-selector">
                  <label>Seleccionar etiquetas (hasta 4):</label>
                  <div className="tag-filter-container">
                    <input
                      type="text"
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      placeholder="Filtrar etiquetas..."
                      className="tag-filter-input"
                      disabled={isLoading || loadingTags}
                    />
                  </div>
                  <div className="tags-selection-container">
                    {getFilteredTags().map((tag, index) => (
                      <label key={index} className="tag-checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Limitar a máximo 4 etiquetas
                              if (selectedTags.length < 4) {
                                setSelectedTags([...selectedTags, tag]);
                              }
                            } else {
                              setSelectedTags(selectedTags.filter(t => t !== tag));
                            }
                          }}
                          disabled={isLoading || (selectedTags.length >= 4 && !selectedTags.includes(tag))}
                          className="tag-checkbox"
                        />
                        {tag}
                      </label>
                    ))}
                  </div>
                  {loadingTags && <span className="loading-indicator">Cargando etiquetas...</span>}
                  <div className="selected-tags-summary">
                    <strong>Etiquetas seleccionadas:</strong> {selectedTags.length > 0 ? selectedTags.join(', ') : 'Ninguna'}
                  </div>
                </div>
                
                <div className="multiple-tags-date-section">
                  <label>Seleccionar fecha:</label>
                  <div className="date-type-selector">
                    <label>
                      <input
                        type="radio"
                        name="multipleTagsDateType"
                        value="specific"
                        checked={multipleTagsDateType === 'specific'}
                        onChange={() => {
                          setMultipleTagsDateType('specific');
                          updateMultipleTagsWithDateSearchTerm();
                        }}
                        disabled={isLoading}
                      />
                      Fecha específica
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="multipleTagsDateType"
                        value="month"
                        checked={multipleTagsDateType === 'month'}
                        onChange={() => {
                          setMultipleTagsDateType('month');
                          updateMultipleTagsWithDateSearchTerm();
                        }}
                        disabled={isLoading}
                      />
                      Mes y año
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="multipleTagsDateType"
                        value="year"
                        checked={multipleTagsDateType === 'year'}
                        onChange={() => {
                          setMultipleTagsDateType('year');
                          updateMultipleTagsWithDateSearchTerm();
                        }}
                        disabled={isLoading}
                      />
                      Año
                    </label>
                  </div>
                  
                  {multipleTagsDateType === 'specific' && (
                    <input
                      type="date"
                      value={multipleTagsWithDate}
                      onChange={(e) => {
                        setMultipleTagsWithDate(e.target.value);
                        updateMultipleTagsWithDateSearchTerm();
                      }}
                      disabled={isLoading}
                      className="date-input"
                    />
                  )}
                  
                  {multipleTagsDateType === 'month' && (
                    <div className="month-year-selector">
                      <select
                        value={multipleTagsWithDate.split('-')[1] || ''}
                        onChange={(e) => {
                          const yearPart = multipleTagsWithDate.split('-')[0] || '';
                          const newDate = yearPart ? `${yearPart}-${e.target.value}` : '';
                          setMultipleTagsWithDate(newDate);
                          updateMultipleTagsWithDateSearchTerm();
                        }}
                        disabled={isLoading}
                        className="month-selector"
                      >
                        <option value="">-- Mes --</option>
                        {getMonthOptions().map(month => (
                          <option key={month.value} value={month.value}>{month.name}</option>
                        ))}
                      </select>
                      
                      <select
                        value={multipleTagsWithDate.split('-')[0] || ''}
                        onChange={(e) => {
                          const monthPart = multipleTagsWithDate.split('-')[1] || '';
                          const newDate = monthPart ? `${e.target.value}-${monthPart}` : e.target.value;
                          setMultipleTagsWithDate(newDate);
                          updateMultipleTagsWithDateSearchTerm();
                        }}
                        disabled={isLoading}
                        className="year-selector"
                      >
                        <option value="">-- Año --</option>
                        {getYearOptions().map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {multipleTagsDateType === 'year' && (
                    <select
                      value={multipleTagsWithDate}
                      onChange={(e) => {
                        setMultipleTagsWithDate(e.target.value);
                        updateMultipleTagsWithDateSearchTerm();
                      }}
                      disabled={isLoading}
                      className="year-selector full-width"
                    >
                      <option value="">-- Seleccionar año --</option>
                      {getYearOptions().map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
            
            {/* Búsqueda por Texto + Fecha */}
            {isTextAndDateSearch && (
              <div className="text-date-search-options">
                <h4>Búsqueda por texto y fecha</h4>
                
                <div className="text-date-text-section">
                  <label>Ingrese texto:</label>
                  <input
                    type="text"
                    value={textAndDateSearchText}
                    onChange={(e) => {
                      setTextAndDateSearchText(e.target.value);
                      updateTextAndDateSearchTerm();
                    }}
                    placeholder="Buscar en nombres de archivos..."
                    className="search-input"
                    disabled={isLoading}
                  />
                </div>
                
                <div className="text-date-date-section">
                  <label>Seleccionar fecha:</label>
                  <div className="date-type-selector">
                    <label>
                      <input
                        type="radio"
                        name="textAndDateType"
                        value="specific"
                        checked={textAndDateType === 'specific'}
                        onChange={() => {
                          setTextAndDateType('specific');
                          updateTextAndDateSearchTerm();
                        }}
                        disabled={isLoading}
                      />
                      Fecha específica
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="textAndDateType"
                        value="month"
                        checked={textAndDateType === 'month'}
                        onChange={() => {
                          setTextAndDateType('month');
                          updateTextAndDateSearchTerm();
                        }}
                        disabled={isLoading}
                      />
                      Mes y año
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="textAndDateType"
                        value="year"
                        checked={textAndDateType === 'year'}
                        onChange={() => {
                          setTextAndDateType('year');
                          updateTextAndDateSearchTerm();
                        }}
                        disabled={isLoading}
                      />
                      Año
                    </label>
                  </div>
                  
                  {textAndDateType === 'specific' && (
                    <input
                      type="date"
                      value={textAndDateDate}
                      onChange={(e) => {
                        setTextAndDateDate(e.target.value);
                        updateTextAndDateSearchTerm();
                      }}
                      disabled={isLoading}
                      className="date-input"
                    />
                  )}
                  
                  {textAndDateType === 'month' && (
                    <div className="month-year-selector">
                      <select
                        value={textAndDateDate.split('-')[1] || ''}
                        onChange={(e) => {
                          const yearPart = textAndDateDate.split('-')[0] || '';
                          const newDate = yearPart ? `${yearPart}-${e.target.value}` : '';
                          setTextAndDateDate(newDate);
                          updateTextAndDateSearchTerm();
                        }}
                        disabled={isLoading}
                        className="month-selector"
                      >
                        <option value="">-- Mes --</option>
                        {getMonthOptions().map(month => (
                          <option key={month.value} value={month.value}>{month.name}</option>
                        ))}
                      </select>
                      
                      <select
                        value={textAndDateDate.split('-')[0] || ''}
                        onChange={(e) => {
                          const monthPart = textAndDateDate.split('-')[1] || '';
                          const newDate = monthPart ? `${e.target.value}-${monthPart}` : e.target.value;
                          setTextAndDateDate(newDate);
                          updateTextAndDateSearchTerm();
                        }}
                        disabled={isLoading}
                        className="year-selector"
                      >
                        <option value="">-- Año --</option>
                        {getYearOptions().map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {textAndDateType === 'year' && (
                    <select
                      value={textAndDateDate}
                      onChange={(e) => {
                        setTextAndDateDate(e.target.value);
                        updateTextAndDateSearchTerm();
                      }}
                      disabled={isLoading}
                      className="year-selector full-width"
                    >
                      <option value="">-- Seleccionar año --</option>
                      {getYearOptions().map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Campo de Búsqueda y Botón */}
          <div className="search-input-container">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                isTagSearch 
                  ? "Ingrese etiqueta..." 
                  : isDateSearch
                    ? "Fecha de búsqueda"
                    : isTextAndDateSearch
                      ? "Texto + Fecha"
                      : "Buscar archivos o carpetas..."
              }
              disabled={isLoading || (isDateSearch && dateSearchType !== 'text')}
              className="search-input"
              readOnly={isDateSearch && dateSearchType !== 'text'}
            />
            <button 
              type="submit" 
              disabled={isLoading || !searchTerm.trim() || (isDateSearch && !searchTerm)} 
              className="search-button"
            >
              {isLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SearchForm;