console.log('✅ Content script de Consulta Stock cargado');

// Escuchar mensajes del background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Mensaje recibido en content script:', request.action);
  
  if (request.action === 'consultarProducto') {
    consultarProducto(request.codigoBarras)
      .then(resultado => {
        console.log('✅ Resultado obtenido:', resultado);
        sendResponse(resultado);
      })
      .catch(error => {
        console.error('❌ Error:', error);
        sendResponse({ error: true, mensaje: error.message });
      });
    return true; // Mantener el canal abierto
  }
  
  if (request.action === 'agregarAlCarritoSuizo') {
    agregarAlCarritoSuizo(request.productoId, request.cantidad)
      .then(resultado => {
        console.log('✅ Producto agregado al carrito:', resultado);
        sendResponse(resultado);
      })
      .catch(error => {
        console.error('❌ Error agregando al carrito:', error);
        sendResponse({ error: true, mensaje: error.message });
      });
    return true;
  }
});

async function agregarAlCarritoSuizo(productoId, cantidad) {
  try {
    console.log(`🛒 Agregando al carrito: ID=${productoId}, Cantidad=${cantidad}`);
    
    // Construir el body del formulario
    const formData = new URLSearchParams({
      'tipo_busqueda': 'codigo',
      'carroid': '1',
      [`cant[${productoId}]`]: cantidad.toString(),
      'contieneDrog': '',
      'tip': '1'
    });

    console.log('📤 Body para agregar al carrito:', formData.toString());

    // Hacer la petición POST
    const response = await fetch('https://web1.suizoargentina.com/carro/agregar', {
      method: 'POST',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Cache-Control': 'max-age=0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      },
      body: formData.toString(),
      credentials: 'include',
      mode: 'cors'
    });

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return {
      error: false,
      mensaje: `${cantidad} unidad(es) agregada(s) al carrito exitosamente`
    };
    
  } catch (error) {
    console.error('❌ Error agregando al carrito:', error);
    return {
      error: true,
      mensaje: 'Error: ' + error.message
    };
  }
}

async function consultarProducto(codigoBarras) {
  try {
    console.log('🔍 Consultando producto:', codigoBarras);
    
    // Preparar los datos del formulario
    const formData = new URLSearchParams({
      'buscar[codigo]': codigoBarras,
      'buscar[tipo_codigo]': '0',
      'buscarbtn': 'Buscar',
      'buscar[tipo_busqueda]': 'codigo'
    });

    console.log('📤 Body que se enviará:', formData.toString());

    // Hacer la consulta POST con los headers correctos
    const response = await fetch('https://web1.suizoargentina.com/stock', {
      method: 'POST',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Cache-Control': 'max-age=0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      },
      body: formData.toString(),
      credentials: 'include',
      mode: 'cors'
    });

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    console.log('📄 HTML recibido, length:', html.length);
    
    // Verificar si la sesión expiró
    if (html.includes('login') && html.includes('usuario') && !html.includes('tbody id="tbl-art"')) {
      return {
        error: true,
        mensaje: 'Sesión no válida. Por favor, inicia sesión en https://web1.suizoargentina.com/principal'
      };
    }

    // Parsear el HTML
    const resultado = parsearHTML(html, codigoBarras);
    
    if (!resultado) {
      return {
        error: true,
        mensaje: 'Producto no encontrado con código: ' + codigoBarras
      };
    }

    console.log('✅ Producto encontrado:', resultado.nombre);

    return {
      error: false,
      producto: resultado
    };
    
  } catch (error) {
    console.error('❌ Error en la consulta:', error);
    return {
      error: true,
      mensaje: 'Error: ' + error.message
    };
  }
}

function parsearHTML(html, codigoBarras) {
  try {
    console.log('🔧 Parseando HTML...');
    
    // Buscar la fila del producto en tbody#tbl-art
    const tbodyMatch = html.match(/<tbody id="tbl-art">([\s\S]*?)<\/tbody>/);
    if (!tbodyMatch) {
      console.log('❌ No se encontró tbody#tbl-art');
      return null;
    }

    const tbody = tbodyMatch[1];
    
    // Buscar la primera fila <tr>
    const trMatch = tbody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/);
    if (!trMatch) {
      console.log('❌ No se encontró <tr>');
      return null;
    }

    const tr = trMatch[1];
    
    // IMPORTANTE: Extraer el ID del producto (data-id del input)
    const productoIdMatch = tr.match(/data-id="(\d+)"/);
    const productoId = productoIdMatch ? productoIdMatch[1] : null;
    
    console.log('🆔 ID del producto extraído:', productoId);
    
    // Extraer todas las celdas <td>
    const celdas = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let match;
    while ((match = tdRegex.exec(tr)) !== null) {
      celdas.push(match[1]);
    }

    console.log('📊 Celdas encontradas:', celdas.length);

    if (celdas.length < 10) {
      console.log('❌ No hay suficientes celdas');
      return null;
    }

    const resultado = {};
    
    // Agregar el ID del producto al resultado
    resultado.productoId = productoId;

    // Celda 2: Nombre y datos del tooltip (td class="t1")
    const celdaNombre = celdas[2];
    
    // Extraer nombre del producto
    const nombreMatch = celdaNombre.match(/>([^<]+)<\/a>/);
    resultado.nombre = nombreMatch ? nombreMatch[1].trim() : '';

    // Extraer código de barras del tooltip
    const codigoBarrasMatch = celdaNombre.match(/Cod\.Barras:<\/b>\s*(\d+)/);
    resultado.codigoBarras = codigoBarrasMatch ? codigoBarrasMatch[1] : codigoBarras;

    // Extraer troquel
    const troquelMatch = celdaNombre.match(/Troquel:<\/b>\s*(\d+)/);
    resultado.troquel = troquelMatch ? troquelMatch[1] : '';

    // Celda 4: Descuento (%)
    resultado.descuento = limpiarTexto(celdas[4]);

    // Celda 5: Oferta
    const ofertaText = limpiarTexto(celdas[5]);
    resultado.oferta = ofertaText;

    // Extraer porcentaje de descuento
    const descuentoMatch = ofertaText.match(/(\d+\.?\d*)%/);
    resultado.porcentajeDescuento = descuentoMatch ? parseFloat(descuentoMatch[1]) : 0;

    // Extraer mínimo
    const minimoMatch = ofertaText.match(/Min\.:(\d+)/);
    resultado.minimo = minimoMatch ? parseInt(minimoMatch[1]) : null;

    // Celda 6: Stock
    resultado.stock = limpiarTexto(celdas[6]);
    resultado.hayStock = resultado.stock.toLowerCase() === 'si';

    // Celda 8: Su Precio
    const precioText = limpiarTexto(celdas[8]);
    resultado.precio = precioText;
    resultado.precioNumerico = parseFloat(precioText.replace(/\./g, '').replace(',', '.')) || 0;

    // Celda 9: Su Precio con Descuento
    const precioDescText = limpiarTexto(celdas[9]);
    resultado.precioConDescuento = precioDescText;
    resultado.precioConDescuentoNumerico = parseFloat(precioDescText.replace(/\./g, '').replace(',', '.')) || 0;

    // Celda 11: Precio Público Sugerido
    const precioPubText = limpiarTexto(celdas[11]);
    resultado.precioPublicoSugerido = precioPubText;
    resultado.precioPublicoSugeridoNumerico = parseFloat(precioPubText.replace(/\./g, '').replace(',', '.')) || 0;

    console.log('✅ Parseado exitoso');
    return resultado;

  } catch (error) {
    console.error('❌ Error parseando HTML:', error);
    return null;
  }
}

function limpiarTexto(html) {
  let texto = html.replace(/<[^>]*>/g, '');
  texto = texto
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ');
  return texto.trim();
}