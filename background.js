// Escuchar mensajes del popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'consultarProducto') {
    consultarEnTresDroguerias(request.codigoBarras)
      .then(resultado => sendResponse(resultado))
      .catch(error => sendResponse({ error: true, mensaje: error.message }));
    return true;
  }
  
  if (request.action === 'agregarAlCarritoSuizo') {
    agregarAlCarritoSuizo(request.productoId, request.cantidad)
      .then(resultado => sendResponse(resultado))
      .catch(error => sendResponse({ error: true, mensaje: error.message }));
    return true;
  }
  
  if (request.action === 'agregarAlCarritoAcofar') {
    agregarAlCarritoAcofar(request.productoData, request.cantidad)
      .then(resultado => sendResponse(resultado))
      .catch(error => sendResponse({ error: true, mensaje: error.message }));
    return true;
  }
});

async function agregarAlCarritoAcofar(productoData, cantidad) {
  try {
    console.log('🛒 Agregando al carrito Acofar:', productoData, cantidad);
    
    // Buscar pestaña de Acofar
    const tabs = await chrome.tabs.query({ url: "https://www.acofarnet.com/iniciar-pedido/*" });
    
    if (tabs.length > 0) {
      // Enviar mensaje al content script existente
      try {
        return await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'agregarAlCarritoAcofar',
          productoData: productoData,
          cantidad: cantidad
        });
      } catch (error) {
        // Si falla, crear pestaña temporal
        return await crearPestanaYAgregarCarrito('acofar', productoData, cantidad);
      }
    } else {
      // Crear pestaña temporal
      return await crearPestanaYAgregarCarrito('acofar', productoData, cantidad);
    }
  } catch (error) {
    console.error('Error agregando al carrito Acofar:', error);
    return { error: true, mensaje: 'Error: ' + error.message };
  }
}

async function agregarAlCarritoSuizo(productoId, cantidad) {
  try {
    console.log('🛒 Agregando al carrito Suizo:', productoId, cantidad);
    
    // Buscar pestaña de Suizo
    const tabs = await chrome.tabs.query({ 
      url: ["https://web1.suizoargentina.com/*", "https://*.suizoargentina.com/*"] 
    });
    
    if (tabs.length > 0) {
      // Enviar mensaje al content script existente
      try {
        return await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'agregarAlCarritoSuizo',
          productoId: productoId,
          cantidad: cantidad
        });
      } catch (error) {
        // Si falla, crear pestaña temporal
        return await crearPestanaYAgregarCarrito('suizo', productoId, cantidad);
      }
    } else {
      // Crear pestaña temporal
      return await crearPestanaYAgregarCarrito('suizo', productoId, cantidad);
    }
  } catch (error) {
    console.error('Error agregando al carrito:', error);
    return { error: true, mensaje: 'Error: ' + error.message };
  }
}

async function crearPestanaYAgregarCarrito(drogueria, productoData, cantidad) {
  return new Promise((resolve) => {
    let url, action;
    
    if (drogueria === 'suizo') {
      url = 'https://web1.suizoargentina.com/stock';
      action = 'agregarAlCarritoSuizo';
    } else if (drogueria === 'acofar') {
      url = 'https://www.acofarnet.com/iniciar-pedido/';
      action = 'agregarAlCarritoAcofar';
    }
    
    chrome.tabs.create({ url, active: false }, async (tab) => {
      console.log(`Pestaña ${drogueria} creada para agregar al carrito:`, tab.id);
      
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          
          const delay = drogueria === 'acofar' ? 2500 : 1500;
          
          setTimeout(async () => {
            try {
              const resultado = await chrome.tabs.sendMessage(tab.id, {
                action: action,
                productoId: drogueria === 'suizo' ? productoData : undefined,
                productoData: drogueria === 'acofar' ? productoData : undefined,
                cantidad: cantidad
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
          }, delay);
        }
      });
    });
  });
}

async function consultarEnTresDroguerias(codigoBarras) {
  try {
    console.log('🔍 Consultando en las tres droguerías...');
    
    // Consultar Suizo, Acofar y Del Sur en paralelo
    const [resultadoSuizo, resultadoAcofar, resultadoSur] = await Promise.all([
      consultarSuizo(codigoBarras),
      consultarAcofar(codigoBarras),
      consultarSur(codigoBarras)
    ]);

    return {
      error: false,
      suizo: resultadoSuizo,
      acofar: resultadoAcofar,
      sur: resultadoSur,
      comparacion: compararPrecios(resultadoSuizo, resultadoAcofar, resultadoSur)
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
    console.log('🔵 [ACOFAR] Iniciando consulta para:', codigoBarras);
    const tabs = await chrome.tabs.query({ url: "https://www.acofarnet.com/iniciar-pedido/*" });
    
    console.log('🔵 [ACOFAR] Pestañas encontradas:', tabs.length, tabs.map(t => ({
      id: t.id,
      url: t.url,
      status: t.status
    })));
    
    if (tabs.length > 0) {
      try {
        console.log('🔵 [ACOFAR] Intentando enviar mensaje a pestaña existente:', tabs[0].id);
        
        // Verificar que la pestaña esté completamente cargada
        if (tabs[0].status !== 'complete') {
          console.warn('⚠️ [ACOFAR] Pestaña no completamente cargada, creando nueva');
          return await crearPestanaYConsultar('acofar', codigoBarras);
        }
        
        const resultado = await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'consultarProductoAcofar',
          codigoBarras: codigoBarras
        });
        
        console.log('✅ [ACOFAR] Respuesta recibida:', resultado);
        return resultado;
        
      } catch (error) {
        console.error('❌ [ACOFAR] Error al enviar mensaje:', error);
        return await crearPestanaYConsultar('acofar', codigoBarras);
      }
    } else {
      console.log('🔵 [ACOFAR] No hay pestañas abiertas, creando nueva');
      return await crearPestanaYConsultar('acofar', codigoBarras);
    }
  } catch (error) {
    console.error('❌ [ACOFAR] Error general:', error);
    return { error: true, mensaje: 'Error Acofar: ' + error.message };
  }
}

async function consultarSur(codigoBarras) {
  try {
    const tabs = await chrome.tabs.query({ url: "https://www.drogueriasur.com.ar/*" });
    
    if (tabs.length > 0) {
      try {
        return await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'consultarProductoSur',
          codigoBarras: codigoBarras
        });
      } catch (error) {
        return await crearPestanaYConsultar('sur', codigoBarras);
      }
    } else {
      return await crearPestanaYConsultar('sur', codigoBarras);
    }
  } catch (error) {
    return { error: true, mensaje: 'Error Droguería del Sur: ' + error.message };
  }
}

async function crearPestanaYConsultar(drogueria, codigoBarras) {
  return new Promise((resolve) => {
    let url, action;
    
    if (drogueria === 'suizo') {
      url = 'https://web1.suizoargentina.com/stock';
      action = 'consultarProducto';
    } else if (drogueria === 'acofar') {
      url = 'https://www.acofarnet.com/iniciar-pedido/';
      action = 'consultarProductoAcofar';
    } else if (drogueria === 'sur') {
      url = 'https://www.drogueriasur.com.ar/ds/carritos/search';
      action = 'consultarProductoSur';
    }

    console.log(`🟢 [${drogueria.toUpperCase()}] Creando pestaña temporal:`, url);

    chrome.tabs.create({ url, active: false }, async (tab) => {
      if (chrome.runtime.lastError) {
        console.error(`❌ [${drogueria.toUpperCase()}] Error al crear pestaña:`, chrome.runtime.lastError);
        resolve({
          error: true,
          mensaje: `Error al crear pestaña de ${drogueria}: ${chrome.runtime.lastError.message}`
        });
        return;
      }

      console.log(`🟢 [${drogueria.toUpperCase()}] Pestaña creada:`, tab.id);
      
      // Timeout de seguridad
      const timeoutId = setTimeout(() => {
        console.error(`⏱️ [${drogueria.toUpperCase()}] Timeout esperando carga de página`);
        chrome.tabs.remove(tab.id).catch(() => {});
        resolve({
          error: true,
          mensaje: `Timeout esperando carga de ${drogueria}`
        });
      }, 15000); // 15 segundos máximo
      
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id) {
          console.log(`🔄 [${drogueria.toUpperCase()}] Estado pestaña:`, info.status, info.url);
          
          if (info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            clearTimeout(timeoutId);
            
            const delay = drogueria === 'acofar' ? 2000 : drogueria === 'sur' ? 2500 : 1500;
            
            console.log(`⏳ [${drogueria.toUpperCase()}] Esperando ${delay}ms antes de consultar...`);
            
            setTimeout(async () => {
              try {
                console.log(`📤 [${drogueria.toUpperCase()}] Enviando mensaje:`, {
                  action,
                  codigoBarras,
                  tabId: tab.id
                });
                
                const resultado = await chrome.tabs.sendMessage(tab.id, {
                  action: action,
                  codigoBarras: codigoBarras
                });
                
                console.log(`✅ [${drogueria.toUpperCase()}] Resultado recibido:`, resultado);
                
                setTimeout(() => {
                  console.log(`🗑️ [${drogueria.toUpperCase()}] Cerrando pestaña temporal`);
                  chrome.tabs.remove(tab.id).catch(() => {});
                }, 1000);
                
                resolve(resultado);
                
              } catch (error) {
                console.error(`❌ [${drogueria.toUpperCase()}] Error al enviar mensaje:`, {
                  error: error.message,
                  stack: error.stack
                });
                
                chrome.tabs.remove(tab.id).catch(() => {});
                resolve({
                  error: true,
                  mensaje: `No se pudo conectar con ${drogueria}. Por favor, inicia sesión.`,
                  detalleError: error.message
                });
              }
            }, delay);
          }
        }
      });
    });
  });
}

function compararPrecios(suizo, acofar, sur) {
  // Recopilar los precios válidos
  const precios = [];
  
  if (!suizo.error) {
    precios.push({
      drogueria: 'suizo',
      nombre: 'Suizo Argentina',
      precio: suizo.producto.precioConDescuentoNumerico,
      detalle: 'Con descuento',
      datos: suizo.producto
    });
  }
  
  if (!acofar.error) {
    precios.push({
      drogueria: 'acofar',
      nombre: 'Acofar',
      precio: acofar.producto.costoUnidadCM,
      detalle: `Cant. mín: ${acofar.producto.cantidadMinima} un.`,
      datos: acofar.producto
    });
  }
  
  if (!sur.error) {
    precios.push({
      drogueria: 'sur',
      nombre: 'Droguería del Sur',
      precio: sur.producto.precioConDescuento,
      detalle: sur.producto.porcentajeDescuento > 0 ? `${sur.producto.porcentajeDescuento}% dto` : 'Precio normal',
      datos: sur.producto
    });
  }
  
  // Si no hay precios válidos, no comparar
  if (precios.length === 0) {
    return { hayComparacion: false };
  }
  
  // Ordenar por precio (menor a mayor)
  precios.sort((a, b) => a.precio - b.precio);
  
  // El primero es el más barato
  const mejorOpcion = precios[0];
  const peorOpcion = precios[precios.length - 1];
  
  // Calcular diferencias
  const diferencia = peorOpcion.precio - mejorOpcion.precio;
  const porcentajeDiferencia = (diferencia / peorOpcion.precio) * 100;
  
  return {
    hayComparacion: true,
    masConveniente: mejorOpcion.drogueria,
    nombreMejor: mejorOpcion.nombre,
    precios: precios,
    diferencia: diferencia,
    porcentajeDiferencia: porcentajeDiferencia,
    // Mantener compatibilidad con código anterior
    precioSuizo: !suizo.error ? suizo.producto.precioConDescuentoNumerico : 0,
    precioAcofarCM: !acofar.error ? acofar.producto.costoUnidadCM : 0,
    precioSur: !sur.error ? sur.producto.precioConDescuento : 0
  };
}