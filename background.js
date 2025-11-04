// Escuchar mensajes del popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'consultarProducto') {
    consultarProductoConTab(request.codigoBarras)
      .then(resultado => sendResponse(resultado))
      .catch(error => sendResponse({ error: true, mensaje: error.message }));
    return true;
  }
});

async function consultarProductoConTab(codigoBarras) {
  try {
    // Buscar una pestaña de Suizo Argentina abierta
    const tabs = await chrome.tabs.query({ 
      url: ["https://web1.suizoargentina.com/*", "https://*.suizoargentina.com/*"] 
    });
    
    if (tabs.length > 0) {
      // Usar una pestaña existente
      console.log('Usando pestaña existente:', tabs[0].id);
      
      try {
        const resultado = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'consultarProducto',
          codigoBarras: codigoBarras
        });
        return resultado;
      } catch (error) {
        console.error('Error comunicando con content script:', error);
        // Si falla, crear una pestaña nueva
        return await crearPestanaYConsultar(codigoBarras);
      }
    } else {
      // No hay pestañas abiertas, crear una nueva
      return await crearPestanaYConsultar(codigoBarras);
    }
    
  } catch (error) {
    console.error('Error en consultarProductoConTab:', error);
    return {
      error: true,
      mensaje: 'Error: ' + error.message
    };
  }
}

async function crearPestanaYConsultar(codigoBarras) {
  return new Promise((resolve) => {
    // Crear una pestaña en segundo plano
    chrome.tabs.create({
      url: 'https://web1.suizoargentina.com/stock',
      active: false
    }, async (tab) => {
      console.log('Pestaña creada:', tab.id);
      
      // Esperar a que cargue completamente
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          
          // Esperar un poco más para asegurar que el content script se inyectó
          setTimeout(async () => {
            try {
              const resultado = await chrome.tabs.sendMessage(tab.id, {
                action: 'consultarProducto',
                codigoBarras: codigoBarras
              });
              
              // Cerrar la pestaña después de 1 segundo
              setTimeout(() => chrome.tabs.remove(tab.id), 1000);
              
              resolve(resultado);
            } catch (error) {
              chrome.tabs.remove(tab.id);
              resolve({
                error: true,
                mensaje: 'No se pudo conectar con la página. Por favor, inicia sesión en https://web1.suizoargentina.com/principal'
              });
            }
          }, 1500);
        }
      });
    });
  });
}