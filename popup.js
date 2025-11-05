let historial = [];

// Cargar historial al iniciar
chrome.storage.local.get(['historial'], (result) => {
  historial = result.historial || [];
  mostrarHistorial();
});

// Referencias a elementos
const inputCodigo = document.getElementById('codigoBarras');
const btnBuscar = document.getElementById('btnBuscar');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const comparacionDiv = document.getElementById('comparacion');
const resultadoSuizoDiv = document.getElementById('resultadoSuizo');
const resultadoAcofarDiv = document.getElementById('resultadoAcofar');

// Event listeners
btnBuscar.addEventListener('click', buscarProducto);
inputCodigo.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') buscarProducto();
});

async function buscarProducto() {
  const codigoBarras = inputCodigo.value.trim();
  
  if (!codigoBarras) {
    mostrarError('Por favor, ingrese un código de barras');
    return;
  }

  // Ocultar elementos previos
  errorDiv.classList.add('hidden');
  comparacionDiv.classList.add('hidden');
  resultadoSuizoDiv.classList.add('hidden');
  resultadoAcofarDiv.classList.add('hidden');
  loadingDiv.classList.remove('hidden');

  try {
    // Enviar mensaje al background script
    const resultado = await chrome.runtime.sendMessage({
      action: 'consultarProducto',
      codigoBarras: codigoBarras
    });

    loadingDiv.classList.add('hidden');

    if (resultado.error) {
      mostrarError(resultado.mensaje);
    } else {
      // Mostrar comparación
      if (resultado.comparacion.hayComparacion) {
        mostrarComparacion(resultado.comparacion, resultado.suizo.producto, resultado.acofar.producto);
      }
      
      // Mostrar detalles de Suizo
      if (!resultado.suizo.error) {
        mostrarResultadoSuizo(resultado.suizo.producto);
      }
      
      // Mostrar detalles de Acofar
      if (!resultado.acofar.error) {
        mostrarResultadoAcofar(resultado.acofar.producto);
      }
      
      // Agregar al historial
      const productoParaHistorial = !resultado.suizo.error 
        ? resultado.suizo.producto 
        : resultado.acofar.producto;
      agregarAlHistorial(productoParaHistorial);
    }
  } catch (error) {
    loadingDiv.classList.add('hidden');
    mostrarError('Error de conexión: ' + error.message);
  }
}

function mostrarError(mensaje) {
  errorDiv.textContent = mensaje;
  errorDiv.classList.remove('hidden');
}

function mostrarComparacion(comparacion, productoSuizo, productoAcofar) {
  comparacionDiv.classList.remove('hidden');
  
  // Precios
  document.getElementById('precioSuizo').textContent = '$' + formatearPrecio(comparacion.precioSuizo);
  document.getElementById('precioAcofar').textContent = '$' + formatearPrecio(comparacion.precioAcofarCM);
  
  // Detalles
  document.getElementById('detalleSuizo').textContent = 'Con descuento';
  document.getElementById('detalleAcofar').textContent = `Cant. mín: ${comparacion.cantidadMinima} un.`;
  
  // Marcar el más conveniente
  const cardSuizo = document.getElementById('cardSuizo');
  const cardAcofar = document.getElementById('cardAcofar');
  
  cardSuizo.classList.remove('mejor-precio');
  cardAcofar.classList.remove('mejor-precio');
  
  if (comparacion.masConveniente === 'suizo') {
    cardSuizo.classList.add('mejor-precio');
  } else {
    cardAcofar.classList.add('mejor-precio');
  }
  
  // Resultado de comparación
  const resultadoComparacion = document.getElementById('resultadoComparacion');
  const nombreGanador = comparacion.masConveniente === 'suizo' ? 'Suizo Argentina' : 'Acofar';
  const ahorro = formatearPrecio(comparacion.diferencia);
  const porcentaje = comparacion.porcentajeDiferencia.toFixed(2);
  
  resultadoComparacion.innerHTML = `
    <div class="resultado-icono">🏆</div>
    <div class="resultado-texto">
      <strong>${nombreGanador}</strong> es más conveniente<br>
      <span class="ahorro">Ahorrás $${ahorro} (${porcentaje}%)</span>
    </div>
  `;
  
  if (comparacion.masConveniente === 'acofar' && comparacion.cantidadMinima > 1) {
    resultadoComparacion.innerHTML += `
      <div class="nota-cantidad">
        ⚠️ Precio de Acofar válido comprando ${comparacion.cantidadMinima} o más unidades
      </div>
    `;
  }
  
  if (comparacion.descCondicionAcofar > 0) {
    resultadoComparacion.innerHTML += `
      <div class="nota-descuento">
        📊 Acofar incluye ${comparacion.descCondicionAcofar}% de descuento por condición
      </div>
    `;
  }
}

function mostrarResultadoSuizo(producto) {
  resultadoSuizoDiv.classList.remove('hidden');
  
  // Nombre
  document.getElementById('nombreProductoSuizo').textContent = producto.nombre;
  
  // Badge de stock
  const stockBadge = document.getElementById('stockBadgeSuizo');
  stockBadge.textContent = producto.hayStock ? 'En Stock' : 'Sin Stock';
  stockBadge.className = 'badge ' + (producto.hayStock ? 'stock-si' : 'stock-no');
  
  // Información
  document.getElementById('codigoSuizo').textContent = producto.codigoBarras;
  
  // Troquel
  const troquelRow = document.getElementById('troquelRowSuizo');
  if (producto.troquel) {
    document.getElementById('troquelSuizo').textContent = producto.troquel;
    troquelRow.style.display = 'flex';
  } else {
    troquelRow.style.display = 'none';
  }
  
  // Descuento
  const descuentoRow = document.getElementById('descuentoRowSuizo');
  if (producto.porcentajeDescuento > 0) {
    document.getElementById('descuentoSuizo').textContent = producto.porcentajeDescuento + '%';
    descuentoRow.style.display = 'flex';
  } else {
    descuentoRow.style.display = 'none';
  }
  
  // Precios
  document.getElementById('precioBaseSuizo').textContent = '$' + formatearPrecio(producto.precioNumerico);
  document.getElementById('precioDescSuizo').textContent = '$' + formatearPrecio(producto.precioConDescuentoNumerico);
  document.getElementById('precioPubSuizo').textContent = '$' + formatearPrecio(producto.precioPublicoSugeridoNumerico);
  
  // Oferta
  const ofertaDetalle = document.getElementById('ofertaDetalleSuizo');
  if (producto.oferta && producto.oferta !== '') {
    ofertaDetalle.textContent = '🎯 ' + producto.oferta;
    ofertaDetalle.style.display = 'block';
  } else {
    ofertaDetalle.style.display = 'none';
  }
}

function mostrarResultadoAcofar(producto) {
  resultadoAcofarDiv.classList.remove('hidden');
  
  // Nombre
  document.getElementById('nombreProductoAcofar').textContent = producto.nombre;
  
  // Badge de stock
  const stockBadge = document.getElementById('stockBadgeAcofar');
  stockBadge.textContent = producto.hayStock ? `En Stock (${producto.cantidad})` : 'Sin Stock';
  stockBadge.className = 'badge ' + (producto.hayStock ? 'stock-si' : 'stock-no');
  
  // Información
  document.getElementById('codigoAcofar').textContent = producto.codigoBarras;
  document.getElementById('proveedorAcofar').textContent = producto.proveedor;
  document.getElementById('cantidadMinimaAcofar').textContent = producto.cantidadMinima + ' unidades';
  document.getElementById('descCondicionAcofar').textContent = producto.descCondicion + '%';
  
  // Precios
  document.getElementById('precioSMAcofar').textContent = '$' + formatearPrecio(producto.costoUnidadSM);
  document.getElementById('precioCMAcofar').textContent = '$' + formatearPrecio(producto.costoUnidadCM);
  document.getElementById('pvpAcofar').textContent = '$' + formatearPrecio(producto.pvp);
}

function formatearPrecio(precio) {
  return precio.toLocaleString('es-AR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

function agregarAlHistorial(producto) {
  // Evitar duplicados
  historial = historial.filter(item => item.codigoBarras !== producto.codigoBarras);
  
  // Agregar al inicio
  historial.unshift({
    nombre: producto.nombre,
    codigoBarras: producto.codigoBarras,
    timestamp: Date.now()
  });
  
  // Limitar a 5 elementos
  historial = historial.slice(0, 5);
  
  // Guardar en storage
  chrome.storage.local.set({ historial: historial });
  
  mostrarHistorial();
}

function mostrarHistorial() {
  const listaHistorial = document.getElementById('listaHistorial');
  
  if (historial.length === 0) {
    listaHistorial.innerHTML = '<p style="text-align: center; color: #999; font-size: 13px;">Sin consultas recientes</p>';
    return;
  }
  
  listaHistorial.innerHTML = historial.map(item => `
    <div class="historial-item" data-codigo="${item.codigoBarras}">
      <span class="nombre">${item.nombre}</span>
      <span class="codigo">${item.codigoBarras}</span>
    </div>
  `).join('');
  
  // Agregar event listeners
  document.querySelectorAll('.historial-item').forEach(item => {
    item.addEventListener('click', () => {
      inputCodigo.value = item.dataset.codigo;
      buscarProducto();
    });
  });
}