// Crear un archivo en: frontend/src/utils/searchCache.js

/**
 * Sistema de caché para optimizar las búsquedas por etiquetas
 * 
 * Esta utilidad permite almacenar temporalmente los resultados de búsquedas
 * para mejorar la velocidad de respuesta cuando se repiten búsquedas similares.
 */

// Configuración de la caché
const CACHE_SIZE = 20; // Número máximo de búsquedas guardadas
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutos en milisegundos

// Estructura de la caché
let searchCache = {
  items: [], // Array de {key, results, timestamp}
  hits: 0,
  misses: 0
};

/**
 * Genera una clave única para una búsqueda basada en los IDs de etiquetas
 * @param {Array|string} tagIds - IDs de etiquetas, puede ser array o string separado por comas
 * @returns {string} - Clave de caché normalizada
 */
export const generateCacheKey = (tagIds) => {
  // Normalizar a array si es un string
  const idsArray = Array.isArray(tagIds) 
    ? tagIds 
    : tagIds.split(',').map(id => id.trim());
  
  // Ordenar para que el orden no afecte la clave
  return idsArray.sort().join(',');
};

/**
 * Intenta obtener resultados de búsqueda desde la caché
 * @param {string} key - Clave de caché
 * @returns {Array|null} - Resultados si existen en caché, null si no existen o han expirado
 */
export const getCachedResults = (key) => {
  const now = Date.now();
  const cacheItem = searchCache.items.find(item => item.key === key);
  
  if (cacheItem) {
    // Verificar si la caché ha expirado
    if (now - cacheItem.timestamp < CACHE_EXPIRY) {
      searchCache.hits++;
      console.log(`[CACHE] Hit para clave: ${key}. Total hits: ${searchCache.hits}`);
      return cacheItem.results;
    } else {
      // Caché expirada, eliminar el item
      searchCache.items = searchCache.items.filter(item => item.key !== key);
      console.log(`[CACHE] Expirada para clave: ${key}`);
    }
  }
  
  searchCache.misses++;
  console.log(`[CACHE] Miss para clave: ${key}. Total misses: ${searchCache.misses}`);
  return null;
};

/**
 * Guarda los resultados de una búsqueda en la caché
 * @param {string} key - Clave de caché
 * @param {Array} results - Resultados a guardar
 */
export const cacheResults = (key, results) => {
  if (!key || !results) return;
  
  // Eliminar entrada anterior con la misma clave si existe
  searchCache.items = searchCache.items.filter(item => item.key !== key);
  
  // Añadir nueva entrada
  searchCache.items.push({
    key,
    results: [...results], // Clonar array para evitar referencias
    timestamp: Date.now()
  });
  
  // Mantener tamaño de caché limitado
  if (searchCache.items.length > CACHE_SIZE) {
    // Eliminar el item más antiguo
    searchCache.items.sort((a, b) => b.timestamp - a.timestamp);
    searchCache.items.pop();
  }
  
  console.log(`[CACHE] Guardados ${results.length} resultados para clave: ${key}`);
  console.log(`[CACHE] Tamaño actual: ${searchCache.items.length}/${CACHE_SIZE} items`);
};

/**
 * Limpia la caché completamente
 */
export const clearCache = () => {
  searchCache.items = [];
  console.log('[CACHE] Caché limpiada completamente');
};

/**
 * Obtiene estadísticas de la caché
 * @returns {Object} - Estadísticas (tamaño, hits, misses, ratio)
 */
export const getCacheStats = () => {
  const totalRequests = searchCache.hits + searchCache.misses;
  const hitRatio = totalRequests > 0 ? searchCache.hits / totalRequests : 0;
  
  return {
    size: searchCache.items.length,
    maxSize: CACHE_SIZE,
    hits: searchCache.hits,
    misses: searchCache.misses,
    hitRatio: hitRatio.toFixed(2),
    expiryMinutes: CACHE_EXPIRY / (60 * 1000)
  };
};

/**
 * Realiza una búsqueda con soporte de caché
 * @param {function} searchFn - Función de búsqueda que devuelve una promesa con los resultados
 * @param {string} cacheKey - Clave para identificar la búsqueda en caché
 * @returns {Promise<Array>} - Resultados de la búsqueda (desde caché o nuevos)
 */
export const cachedSearch = async (searchFn, cacheKey) => {
  // Intentar obtener de caché primero
  const cachedResults = getCachedResults(cacheKey);
  
  if (cachedResults) {
    console.log(`[CACHE] Usando ${cachedResults.length} resultados desde caché para: ${cacheKey}`);
    return cachedResults;
  }
  
  // Si no está en caché, realizar búsqueda
  try {
    const results = await searchFn();
    
    // Guardar en caché para futuras búsquedas
    cacheResults(cacheKey, results);
    
    return results;
  } catch (error) {
    // Si hay error, no cachear y propagar el error
    console.error('[CACHE] Error en búsqueda:', error);
    throw error;
  }
};

// Exportar todos los elementos
export default {
  generateCacheKey,
  getCachedResults,
  cacheResults,
  clearCache,
  getCacheStats,
  cachedSearch