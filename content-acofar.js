console.log('✅ Content script de Acofar cargado');

// Escuchar mensajes del background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Mensaje recibido en content script Acofar:', request.action);
  
  if (request.action === 'consultarProductoAcofar') {
    consultarProductoAcofar(request.codigoBarras, request.csrfToken)
      .then(resultado => {
        console.log('✅ Resultado Acofar obtenido:', resultado);
        sendResponse(resultado);
      })
      .catch(error => {
        console.error('❌ Error Acofar:', error);
        sendResponse({ error: true, mensaje: error.message });
      });
    return true;
  }
  
  if (request.action === 'obtenerCsrfToken') {
    obtenerCsrfToken()
      .then(token => sendResponse({ token }))
      .catch(error => sendResponse({ error: true, mensaje: error.message }));
    return true;
  }
  
  if (request.action === 'agregarAlCarritoAcofar') {
    agregarAlCarritoAcofar(request.productoData, request.cantidad)
      .then(resultado => {
        console.log('✅ Producto agregado al carrito Acofar:', resultado);
        sendResponse(resultado);
      })
      .catch(error => {
        console.error('❌ Error agregando al carrito Acofar:', error);
        sendResponse({ error: true, mensaje: error.message });
      });
    return true;
  }
});

async function agregarAlCarritoAcofar(productoData, cantidad) {
  try {
    console.log(`🛒 Agregando al carrito Acofar:`, productoData, cantidad);
    
    // Calcular importes
    const precioUnitario = productoData.costoUnidadCM;
    const importe = precioUnitario * cantidad;
    const importeSinDescuento = productoData.costoUnidadSM * cantidad;
    
    // Construir el body del formulario
    const formData = new URLSearchParams({
      'prods[0][cantidad]': cantidad.toString(),
      'prods[0][filial]': '1',
      'prods[0][descuento]': productoData.descProdRent.toFixed(2),
      'prods[0][codigo]': productoData.codigoAlternativo,
      'prods[0][stock]': productoData.hayStock ? 'S' : 'N',
      'prods[0][stockOtraSucursal]': '0',
      'prods[0][descripcion]': productoData.nombre,
      'prods[0][importe]': importe.toFixed(2),
      'prods[0][importeSinDescuento]': importeSinDescuento.toFixed(2),
      'prods[0][dosporuno]': '0',
      'prods[0][preciolista]': productoData.precioLista.toFixed(2),
      'prods[0][descuentoConvenioPorcentaje]': '0.00',
      'prods[0][DescCondicion]': productoData.descCondicion.toFixed(2),
      'prods[0][DescProdRent]': productoData.descProdRent.toFixed(2),
      'prods[0][pvp]': productoData.pvp.toFixed(2),
      'pendientePerfumeria': 'false'
    });

    console.log('📤 Body para agregar al carrito Acofar:', formData.toString());

    // Hacer la petición POST
    const response = await fetch('https://www.acofarnet.com/wp-content/themes/acofar2016/app/ajax/tablaCarrito.php', {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      },
      body: formData.toString(),
      credentials: 'include',
      mode: 'cors'
    });

    console.log('📥 Response status Acofar carrito:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('📄 JSON recibido de Acofar carrito:', data);

    return {
      error: false,
      mensaje: `${cantidad} unidad(es) agregada(s) al carrito de Acofar exitosamente`
    };
    
  } catch (error) {
    console.error('❌ Error agregando al carrito Acofar:', error);
    return {
      error: true,
      mensaje: 'Error: ' + error.message
    };
  }
}

async function obtenerCsrfToken() {
  try {
    // Intentar obtener el token de la página
    const tokenInput = document.querySelector('input[name="csrf_token"]');
    if (tokenInput) {
      return tokenInput.value;
    }
    
    // Si no está en el DOM, buscar en el HTML
    const htmlText = document.documentElement.outerHTML;
    const tokenMatch = htmlText.match(/csrf_token["\s:=]+([a-f0-9]{128})/i);
    if (tokenMatch) {
      return tokenMatch[1];
    }
    
    // Token por defecto (puede que funcione sin él)
    return '';
  } catch (error) {
    console.error('Error obteniendo CSRF token:', error);
    return '';
  }
}

async function consultarProductoAcofar(codigoBarras, csrfToken = '') {
  try {
    console.log('🔍 Consultando producto en Acofar:', codigoBarras);
    
    // Si no tenemos token, intentar obtenerlo
    if (!csrfToken) {
      csrfToken = await obtenerCsrfToken();
    }
    
    const formData = new URLSearchParams({
      'rubro': '0',
      'descripcion': '',
      'codigo': '',
      'codigoBarra': codigoBarras,
      'troquel': '',
      'laboratorio': '0',
      'droga': '',
      'accion': '',
      'ofertas': '0',
      'ofertasDia': '0',
      'nuevos': '0',
      'masFarmacia': '0',
      'outlet': '0',
      'transfers': '0',
      'telemarketing': '0',
      'DosporUno': '0',
      'CadenaFrio': '0',
      'Plazo': '0',
      'DesdeDto': '0',
      'HastaDto': '0',
      'bonificados': '0',
      'productos': '',
      'csrf_token': csrfToken,
      'csrf_desde': 'buscador'
    });

    console.log('📤 Enviando petición a Acofar...');

    const response = await fetch('https://www.acofarnet.com/wp-content/themes/acofar2016/app/ajax/archivo_6fed86768f.php', {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      },
      body: formData.toString(),
      credentials: 'include',
      mode: 'cors'
    });

    console.log('📥 Response Acofar status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('📄 JSON recibido de Acofar:', data);
    
    if (!data.html_productos || data.html_productos.length === 0) {
      return {
        error: true,
        mensaje: 'Producto no encontrado en Acofar'
      };
    }

    const producto = data.html_productos[0];
    
    const resultado = {
      nombre: producto.Descripcion,
      codigoBarras: producto.BarrasInput || producto.Barras,
      codigoAlternativo: producto.CodigoAlternativo || '', // IMPORTANTE para agregar al carrito
      troquel: producto.Troquel || '',
      stock: producto.HayStk === 'S' ? 'Sí' : 'No',
      hayStock: producto.HayStk === 'S',
      cantidad: parseInt(producto.Cantidad) || 0,
      
      // Precios
      precioLista: parseFloat(producto.PrecioLista) || 0,
      suPrecio: parseFloat(producto.SuPrecio) || 0,
      pvp: parseFloat(producto.PVP) || 0,
      
      // Costos según cantidad mínima
      costoUnidadSM: parseFloat(producto.CostoUnidadSM) || 0,
      costoUnidadCM: parseFloat(producto.CostoUnidadCM) || 0,
      cantidadMinima: parseInt(producto.CM) || 1,
      
      // Descuentos
      descCondicion: parseFloat(producto.DescCondicion) || 0,
      descProdRent: parseFloat(producto.DescProdRent) || 0,
      porcentajeDescuentoEx: parseFloat(producto.PorcentajeDescuentoEx) || 0,
      
      // Otros
      proveedor: producto.Proveedor,
      rubro: producto.Rubro,
      oferta: producto.Oferta,
      ofertaDia: producto.OfertaDia === 'S'
    };

    console.log('✅ Producto Acofar encontrado:', resultado.nombre);

    return {
      error: false,
      producto: resultado
    };
    
  } catch (error) {
    console.error('❌ Error consultando Acofar:', error);
    return {
      error: true,
      mensaje: 'Error: ' + error.message
    };
  }
}