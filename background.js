// Escuchar mensajes del popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'consultarProducto') {
    consultarEnAmbasDroguerias(request.codigoBarras)
      .then(resultado => sendResponse(resultado))
      .catch(error => sendResponse({ error: true, mensaje: error.message }));
    return true;
  }
});

async function consultarEnAmbasDroguerias(codigoBarras) {
  try {
    console.log('🔍 Consultando en ambas droguerías...');
    
    // Consultar Suizo y Acofar en paralelo
    const [resultadoSuizo, resultadoAcofar] = await Promise.all([
      consultarSuizo(codigoBarras),
      consultarAcofar(codigoBarras)
    ]);

    return {
      error: false,
      suizo: resultadoSuizo,
      acofar: resultadoAcofar,
      comparacion: compararPrecios(resultadoSuizo, resultadoAcofar)
    };
    
  } catch (error) {
    console.error('Error consultando droguerías:', error);
    return {
      error: true,
      mensaje: error.message
    };
  }
}

async function consultarSuizo(codigoBarras) {
  try {
    const tabs = await chrome.tabs.query({ 
      url: ["https://web1.suizoargentina.com/*", "https://*.suizoargentina.com/*"] 
    });
    
    if (tabs.length > 0) {
      try {
        return await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'consultarProducto',
          codigoBarras: codigoBarras
        });
      } catch (error) {
        return await crearPestanaYConsultar('suizo', codigoBarras);
      }
    } else {
      return await crearPestanaYConsultar('suizo', codigoBarras);
    }
  } catch (error) {
    return { error: true, mensaje: 'Error Suizo: ' + error.message };
  }
}

async function consultarAcofar(codigoBarras) {
  try {
    const tabs = await chrome.tabs.query({ url: "https://www.acofarnet.com/*" });
    
    if (tabs.length > 0) {
      try {
        return await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'consultarProductoAcofar',
          codigoBarras: codigoBarras
        });
      } catch (error) {
        return await crearPestanaYConsultar('acofar', codigoBarras);
      }
    } else {
      return await crearPestanaYConsultar('acofar', codigoBarras);
    }
  } catch (error) {
    return { error: true, mensaje: 'Error Acofar: ' + error.message };
  }
}

async function crearPestanaYConsultar(drogueria, codigoBarras) {
  return new Promise((resolve) => {
    const url = drogueria === 'suizo' 
      ? 'https://web1.suizoargentina.com/stock'
      : 'https://www.acofarnet.com/iniciar-pedido/';
    
    const action = drogueria === 'suizo' 
      ? 'consultarProducto'
      : 'consultarProductoAcofar';

    chrome.tabs.create({ url, active: false }, async (tab) => {
      console.log(`Pestaña ${drogueria} creada:`, tab.id);
      
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          
          setTimeout(async () => {
            try {
              const resultado = await chrome.tabs.sendMessage(tab.id, {
                action: action,
                codigoBarras: codigoBarras
              });
              
              setTimeout(() => chrome.tabs.remove(tab.id), 1000);
              resolve(resultado);
            } catch (error) {
              chrome.tabs.remove(tab.id);
              resolve({
                error: true,
                mensaje: `No se pudo conectar con ${drogueria}. Por favor, inicia sesión.`
              });
            }
          }, drogueria === 'acofar' ? 2000 : 1500);
        }
      });
    });
  });
}

function compararPrecios(suizo, acofar) {
  // Si alguno tiene error, no comparar
  if (suizo.error || acofar.error) {
    return { hayComparacion: false };
  }

  const precioSuizo = suizo.producto.precioConDescuentoNumerico;
  const precioAcofarCM = acofar.producto.costoUnidadCM;
  const precioAcofarSM = acofar.producto.costoUnidadSM;
  const cantidadMinima = acofar.producto.cantidadMinima;

  // Determinar mejor precio según cantidad mínima
  const mejorPrecioAcofar = precioAcofarCM; // Asumimos que compra cantidad mínima
  const diferencia = precioSuizo - mejorPrecioAcofar;
  const porcentajeDiferencia = (diferencia / precioSuizo) * 100;

  return {
    hayComparacion: true,
    masConveniente: diferencia > 0 ? 'acofar' : 'suizo',
    precioSuizo: precioSuizo,
    precioAcofarCM: precioAcofarCM,
    precioAcofarSM: precioAcofarSM,
    cantidadMinima: cantidadMinima,
    diferencia: Math.abs(diferencia),
    porcentajeDiferencia: Math.abs(porcentajeDiferencia),
    descCondicionAcofar: acofar.producto.descCondicion
  };
}