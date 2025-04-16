import React, { useState, useEffect } from 'react';
import * as api from '../services/api';

const SearchForm = ({ onSearch, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isTagSearch, setIsTagSearch] = useState(false);
  const [isDateSearch, setIsDateSearch] = useState(false);

  const [isCombinedSearch, setIsCombinedSearch] = useState(false);
  const [combinedSearchTag, setCombinedSearchTag] = useState('');
  const [combinedSearchDate, setCombinedSearchDate] = useState('');
  const [combinedDateType, setCombinedDateType] = useState('specific');

  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [dateSearchType, setDateSearchType] = useState('specific'); // 'specific', 'month', 'year'
  const [specificDate, setSpecificDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);

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
  
// Cargar etiquetas disponibles cuando cambia el tipo de búsqueda o se activan búsquedas combinadas
useEffect(() => {
  if (isTagSearch || isCombinedSearch) {
    fetchAvailableTags();
  }
}, [isTagSearch, isCombinedSearch]);

  // Función para cargar todas las etiquetas disponibles
const fetchAvailableTags = async () => {
  try {
    setLoadingTags(true);
    // Obtener el bucket actual
    const currentBucket = getCurrentBucket();
    const storageKey = `docubox_tags_categories_${currentBucket}`;
    
    console.log(`Cargando categorías de etiquetas para búsqueda desde bucket: ${currentBucket}`);
    
    // Intentar cargar etiquetas categorizadas
    const savedCategories = localStorage.getItem(storageKey);
    
    if (savedCategories) {
      const parsedCategories = JSON.parse(savedCategories);
      if (Array.isArray(parsedCategories)) {
        // Extraer todas las etiquetas de todas las categorías
        const allTags = [];
        parsedCategories.forEach(category => {
          if (category.tags && Array.isArray(category.tags)) {
            allTags.push(...category.tags);
          }
        });
        
        // Eliminar duplicados
        const uniqueTags = [...new Set(allTags)];
        setAvailableTags(uniqueTags);
        console.log(`${uniqueTags.length} etiquetas cargadas de ${parsedCategories.length} categorías para búsqueda`);
      }
    } else {
      // Intentar cargar del formato antiguo como respaldo
      const oldStorageKey = `docubox_saved_tags_${currentBucket}`;
      const oldSavedTags = localStorage.getItem(oldStorageKey);
      
      if (oldSavedTags) {
        const parsedTags = JSON.parse(oldSavedTags);
        if (Array.isArray(parsedTags)) {
          setAvailableTags(parsedTags);
          console.log(`${parsedTags.length} etiquetas cargadas del formato antiguo para búsqueda`);
        }
      } else {
        console.log(`No hay etiquetas disponibles para búsqueda en el bucket ${currentBucket}`);
        setAvailableTags([]);
      }
    }
  } catch (error) {
    console.error('Error al cargar etiquetas disponibles:', error);
    setAvailableTags([]);
  } finally {
    setLoadingTags(false);
  }
};

  // Manejar el cambio de etiqueta seleccionada
  const handleTagChange = (e) => {
    setSelectedTag(e.target.value);
    setSearchTerm(e.target.value); // También actualizar el término de búsqueda
  };

  // Manejar cambio en tipo de búsqueda
const handleSearchTypeChange = (type) => {
  if (type === 'tag') {
    setIsTagSearch(true);
    setIsDateSearch(false);
    setIsCombinedSearch(false);
    setSearchTerm(selectedTag);
  } else if (type === 'date') {
    setIsDateSearch(true);
    setIsTagSearch(false);
    setIsCombinedSearch(false);
    updateDateSearchTerm();
  } else if (type === 'combined') {
    setIsCombinedSearch(true);
    setIsTagSearch(false);
    setIsDateSearch(false);
    updateCombinedSearchTerm();
  } else {
    setIsTagSearch(false);
    setIsDateSearch(false);
    setIsCombinedSearch(false);
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

   // Actualizar término de búsqueda cuando cambian los campos de fecha
useEffect(() => {
  if (isDateSearch) {
    updateDateSearchTerm();
  }
}, [dateSearchType, specificDate, selectedMonth, selectedYear, isDateSearch]);

// Actualizar término de búsqueda combinada cuando cambian los campos
useEffect(() => {
  if (isCombinedSearch) {
    updateCombinedSearchTerm();
  }
}, [combinedSearchTag, combinedSearchDate, combinedDateType, isCombinedSearch]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      try {

       // Guardar la etiqueta en localStorage si es una búsqueda por etiqueta y no existe ya
if (isTagSearch && !availableTags.includes(searchTerm.trim())) {
  const newTag = searchTerm.trim();
  const updatedTags = [...availableTags, newTag];
  setAvailableTags(updatedTags);
  
  try {
    // Obtener el bucket actual
    const currentBucket = getCurrentBucket();
    const categoriesStorageKey = `docubox_tags_categories_${currentBucket}`;
    
    // Intentar guardar en el formato de categorías
    const savedCategories = localStorage.getItem(categoriesStorageKey);
    
    if (savedCategories) {
      const parsedCategories = JSON.parse(savedCategories);
      // Buscar la categoría General o crear una nueva
      let defaultCategoryIndex = parsedCategories.findIndex(cat => cat.name === 'General');
      
      if (defaultCategoryIndex === -1) {
        // Si no existe la categoría General, crearla
        parsedCategories.push({
          id: 'default',
          name: 'General',
          tags: [newTag]
        });
      } else {
        // Asegurarse de que la categoría tiene un array de tags
        if (!parsedCategories[defaultCategoryIndex].tags) {
          parsedCategories[defaultCategoryIndex].tags = [];
        }
        // Añadir la nueva etiqueta si no existe ya
        if (!parsedCategories[defaultCategoryIndex].tags.includes(newTag)) {
          parsedCategories[defaultCategoryIndex].tags.push(newTag);
        }
      }
      
      // Guardar categorías actualizadas
      localStorage.setItem(categoriesStorageKey, JSON.stringify(parsedCategories));
      console.log(`Etiqueta "${newTag}" guardada en la categoría General para bucket ${currentBucket}`);
    } else {
      // Si no hay formato de categorías, crear uno nuevo con una categoría General
      const newCategories = [{
        id: 'default',
        name: 'General',
        tags: [newTag]
      }];
      localStorage.setItem(categoriesStorageKey, JSON.stringify(newCategories));
      console.log(`Creado nuevo almacén de categorías con etiqueta "${newTag}" para bucket ${currentBucket}`);
    }
  } catch (error) {
    console.error('Error al guardar etiqueta en localStorage:', error);
  }
}
        
        // Para búsqueda combinada, realizar la búsqueda especializada directamente
        if (isCombinedSearch && combinedSearchTag && combinedSearchDate) {
          console.log('Realizando búsqueda combinada con API especializada');
          
          try {
            // Mostrar que estamos cargando
            // onSearch puede tener un parámetro para indicar que estamos cargando
            
            // Realizar la búsqueda combinada directamente
            const results = await api.searchFilesCombined(
              combinedSearchTag,
              combinedSearchDate,
              combinedDateType
            );
            
            console.log(`Búsqueda combinada exitosa: ${results.length} resultados`);
            
            // Mostrar los resultados al componente padre directamente
            // Usar una propiedad especial para indicar que es una búsqueda combinada (5to parámetro)
            onSearch(results, false, false, null, true);
            
            // Terminar aquí para evitar la búsqueda adicional
            return;
          } catch (error) {
            console.error('Error al realizar búsqueda combinada:', error);
            // Continuar con la búsqueda normal si la combinada falla
          }
        }
        
        // Para otros tipos de búsqueda, o si la búsqueda combinada falló
        onSearch(searchTerm, isTagSearch, isDateSearch, dateSearchType);
      } catch (error) {
        console.error('Error al realizar la búsqueda:', error);
      }
    }
  };

  return (
    <div className="search-form">
      <form onSubmit={handleSubmit}>
        <div className="search-container">
          <div className="search-options">
            <label className="search-option">
              <input
                type="radio"
                name="searchType"
                checked={!isTagSearch && !isDateSearch}
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


          </div>
          
          {showAdvancedOptions && (
            <div className="advanced-search-options">

{isTagSearch && (
  <div className="tag-search-options">
    <select 
      value={selectedTag} 
      onChange={handleTagChange}
      disabled={isLoading || loadingTags}
      className="tag-selector"
    >
      <option value="">-- Seleccionar etiqueta --</option>
      
      {/* Cargar las etiquetas organizadas por categorías */}
      {(() => {
        // Intentar cargar categorías del localStorage
        try {
          const currentBucket = getCurrentBucket();
          const storageKey = `docubox_tags_categories_${currentBucket}`;
          const savedCategories = localStorage.getItem(storageKey);
          
          if (savedCategories) {
            const parsedCategories = JSON.parse(savedCategories);
            if (Array.isArray(parsedCategories) && parsedCategories.length > 0) {
              return parsedCategories.map(category => (
                <optgroup key={category.id} label={category.name}>
                  {category.tags && category.tags.map((tag, tagIndex) => (
                    <option key={`${category.id}-${tagIndex}`} value={tag}>
                      {tag}
                    </option>
                  ))}
                </optgroup>
              ));
            }
          }
        } catch (e) {
          console.error("Error al cargar categorías de etiquetas:", e);
        }
        
        // Si no hay categorías o hubo error, mostrar lista plana
        return availableTags.map((tag, index) => (
          <option key={index} value={tag}>{tag}</option>
        ));
      })()}
    </select>
    {loadingTags && <span className="loading-indicator">Cargando etiquetas...</span>}
  </div>
)}

{isCombinedSearch && (
  <div className="combined-search-options">
    <h4>Búsqueda combinada</h4>
    
    <div className="combined-tag-section">
      <label>Seleccionar etiqueta:</label>
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
        {(() => {
          // Intentar cargar categorías del localStorage
          try {
            const currentBucket = getCurrentBucket();
            const storageKey = `docubox_tags_categories_${currentBucket}`;
            const savedCategories = localStorage.getItem(storageKey);
            
            if (savedCategories) {
              const parsedCategories = JSON.parse(savedCategories);
              if (Array.isArray(parsedCategories) && parsedCategories.length > 0) {
                return parsedCategories.map(category => (
                  <optgroup key={category.id} label={category.name}>
                    {category.tags && category.tags.map((tag, tagIndex) => (
                      <option key={`${category.id}-${tagIndex}`} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </optgroup>
                ));
              }
            }
          } catch (e) {
            console.error("Error al cargar categorías de etiquetas:", e);
          }
          
          // Si no hay categorías o hubo error, mostrar lista plana
          return availableTags.map((tag, index) => (
            <option key={index} value={tag}>{tag}</option>
          ));
        })()}
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
            </div>
          )}
          
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