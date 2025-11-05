console.log('✅ Content script de Droguería del Sur cargado');

// Escuchar mensajes del background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Mensaje recibido en content script Droguería del Sur:', request.action);
  
  if (request.action === 'consultarProductoSur') {
    consultarProductoSur(request.codigoBarras)
      .then(resultado => {
        console.log('✅ Resultado Droguería del Sur obtenido:', resultado);
        sendResponse(resultado);
      })
      .catch(error => {
        console.error('❌ Error Droguería del Sur:', error);
        sendResponse({ error: true, mensaje: error.message });
      });
    return true;
  }
});

async function consultarProductoSur(codigoBarras) {
  try {
    console.log('🔍 Consultando producto en Droguería del Sur:', codigoBarras);
    
    const formData = new URLSearchParams({
      'terminobuscar': codigoBarras,
      'monodroga_id': '',
      'accionfar_id': '',
      'laboratorio_id': '',
      'ofertas': '',
      'codigobarras': '0',
      'search_barra_texto': '0'
    });

    console.log('📤 Enviando petición a Droguería del Sur...');

    const response = await fetch('https://www.drogueriasur.com.ar/ds/carritos/search_ajax', {
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

    console.log('📥 Response Droguería del Sur status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    console.log('📄 HTML recibido de Droguería del Sur, length:', html.length);
    
    // Verificar si hay sesión válida
    if (html.includes('login') && !html.includes('tablasearch')) {
      return {
        error: true,
        mensaje: 'Sesión no válida. Por favor, inicia sesión en https://www.drogueriasur.com.ar'
      };
    }

    // Parsear el HTML
    const resultado = parsearHTMLSur(html, codigoBarras);
    
    if (!resultado) {
      return {
        error: true,
        mensaje: 'Producto no encontrado en Droguería del Sur'
      };
    }

    console.log('✅ Producto Droguería del Sur encontrado:', resultado.nombre);

    return {
      error: false,
      producto: resultado
    };
    
  } catch (error) {
    console.error('❌ Error consultando Droguería del Sur:', error);
    return {
      error: true,
      mensaje: 'Error: ' + error.message
    };
  }
}

function parsearHTMLSur(html, codigoBarras) {
  try {
    console.log('🔧 Parseando HTML de Droguería del Sur...');
    
    // Buscar la tabla con class="tablasearch"
    const tablaMatch = html.match(/<table class=['"]tablasearch.*?>([\s\S]*?)<\/table>/i);
    if (!tablaMatch) {
      console.log('❌ No se encontró tabla con resultados');
      return null;
    }

    const tbody = tablaMatch[1];
    
    // Buscar la primera fila <tr> con datos (no el header)
    const trMatch = tbody.match(/<tr>\s*<td[\s\S]*?<\/tr>/i);
    if (!trMatch) {
      console.log('❌ No se encontró <tr> con datos');
      return null;
    }

    const tr = trMatch[0];
    
    // Extraer el nombre del producto
    const nombreMatch = tr.match(/onclick="openmodalinfo[^"]*">\s*([^<]+?)\s*(?:<img|<span)/i);
    const nombre = nombreMatch ? limpiarTexto(nombreMatch[1]) : '';

    // Extraer código de barras del data-ean o del texto
    const eanMatch = tr.match(/data-ean="(\d+)\.jpg"/i);
    const codigoBarrasExtraido = eanMatch ? eanMatch[1] : codigoBarras;

    // Extraer troquel
    const troquelMatch = tr.match(/Troquel:<\/b>\s*(\d+)/i) || 
                        tr.match(/'(\d{8})'/);  // Del onclick openmodalinfo
    const troquel = troquelMatch ? troquelMatch[1] : '';

    // Extraer stock
    let hayStock = false;
    let stockTexto = 'Sin información';
    
    if (tr.includes('bajo.png')) {
      hayStock = true;
      stockTexto = 'Stock Bajo';
    } else if (tr.includes('alto.png')) {
      hayStock = true;
      stockTexto = 'Stock Alto';
    } else if (tr.includes('falta.png')) {
      hayStock = false;
      stockTexto = 'Sin Stock';
    }

    // Extraer pack
    const packMatch = tr.match(/<b>\s*(\d+)\s*<\/b>/);
    const pack = packMatch ? parseInt(packMatch[1]) : 1;

    // Extraer precios - buscar todos los td con class="colprecio"
    const preciosMatches = tr.match(/<td class=['"]colprecio['"][^>]*>\s*\$\s*([\d.,]+)\s*<\/td>/gi);
    
    let precioPublico = 0;
    let precioConDescuento = 0;
    
    if (preciosMatches && preciosMatches.length >= 2) {
      // Primer precio: Precio Público
      const precio1Match = preciosMatches[0].match(/\$\s*([\d.,]+)/);
      precioPublico = precio1Match ? parsePrecio(precio1Match[1]) : 0;
      
      // Segundo precio: Precio con Descuento
      const precio2Match = preciosMatches[1].match(/\$\s*([\d.,]+)/);
      precioConDescuento = precio2Match ? parsePrecio(precio2Match[1]) : 0;
    }

    // Extraer descuento
    const descuentoMatch = tr.match(/<font color="red"[^>]*>\s*(\d+(?:\.\d+)?)\s*%/i);
    const porcentajeDescuento = descuentoMatch ? parseFloat(descuentoMatch[1]) : 0;

    // Extraer cantidad mínima de oferta
    const minOfertaMatch = tr.match(/class="td-sub-tabla"[^>]*>\s*(\d+)\s*<\/td>/);
    const cantidadMinima = minOfertaMatch ? parseInt(minOfertaMatch[1]) : 1;

    // Extraer tipo de oferta/plazo
    const plazoMatch = tr.match(/class="td-sub-tabla"[^>]*>\s*([A-Z\s]+)\s*<\/td>/i);
    const plazo = plazoMatch ? limpiarTexto(plazoMatch[1]) : '';

    // Extraer tipo de oferta (siguiente td)
    const tipoOfertaMatches = tr.match(/class="td-sub-tabla"[^>]*>([^<]*)<\/td>/gi);
    let tipoOferta = '';
    if (tipoOfertaMatches && tipoOfertaMatches.length >= 3) {
      const match = tipoOfertaMatches[2].match(/>([^<]+)</);
      tipoOferta = match ? limpiarTexto(match[1]) : '';
    }

    const resultado = {
      nombre: nombre,
      codigoBarras: codigoBarrasExtraido,
      troquel: troquel,
      stock: stockTexto,
      hayStock: hayStock,
      pack: pack,
      
      // Precios
      precioPublico: precioPublico,
      precioConDescuento: precioConDescuento,
      
      // Descuentos y ofertas
      porcentajeDescuento: porcentajeDescuento,
      cantidadMinima: cantidadMinima,
      plazo: plazo,
      tipoOferta: tipoOferta,
      
      // Texto de oferta completo
      oferta: porcentajeDescuento > 0 ? `${porcentajeDescuento}% por ${cantidadMinima} unidad(es)` : ''
    };

    console.log('✅ Parseado exitoso de Droguería del Sur');
    return resultado;

  } catch (error) {
    console.error('❌ Error parseando HTML de Droguería del Sur:', error);
    return null;
  }
}

function parsePrecio(precioStr) {
  // Convertir "11.994,91" a número 11994.91
  return parseFloat(precioStr.replace(/\./g, '').replace(',', '.')) || 0;
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