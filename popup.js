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
const resultadoSurDiv = document.getElementById('resultadoSur');

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
  resultadoSurDiv.classList.add('hidden');
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
        mostrarComparacion(resultado);
      }
      
      // Mostrar detalles de cada droguería
      if (!resultado.suizo.error) {
        mostrarResultadoSuizo(resultado.suizo.producto);
      }
      
      if (!resultado.acofar.error) {
        mostrarResultadoAcofar(resultado.acofar.producto);
      }
      
      if (!resultado.sur.error) {
        mostrarResultadoSur(resultado.sur.producto);
      }
      
      // Agregar al historial (usar el primer producto válido)
      const productoParaHistorial = !resultado.suizo.error 
        ? resultado.suizo.producto 
        : !resultado.acofar.error 
          ? resultado.acofar.producto 
          : resultado.sur.producto;
      
      if (productoParaHistorial) {
        agregarAlHistorial(productoParaHistorial);
      }
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

function mostrarComparacion(resultado) {
  comparacionDiv.classList.remove('hidden');
  
  const { comparacion, suizo, acofar, sur } = resultado;
  
  // Limpiar clases de mejor precio
  document.getElementById('cardSuizo').classList.remove('mejor-precio');
  document.getElementById('cardAcofar').classList.remove('mejor-precio');
  document.getElementById('cardSur').classList.remove('mejor-precio');
  
  // Mostrar Suizo
  if (!suizo.error) {
    document.getElementById('precioSuizo').textContent = '$' + formatearPrecio(suizo.producto.precioConDescuentoNumerico);
    document.getElementById('detalleSuizo').textContent = 'Con descuento';
  } else {
    document.getElementById('precioSuizo').textContent = 'No disponible';
    document.getElementById('detalleSuizo').textContent = '';
  }
  
  // Mostrar Acofar
  if (!acofar.error) {
    document.getElementById('precioAcofar').textContent = '$' + formatearPrecio(acofar.producto.costoUnidadCM);
    document.getElementById('detalleAcofar').textContent = `Cant. mín: ${acofar.producto.cantidadMinima} un.`;
  } else {
    document.getElementById('precioAcofar').textContent = 'No disponible';
    document.getElementById('detalleAcofar').textContent = '';
  }
  
  // Mostrar Del Sur
  if (!sur.error) {
    document.getElementById('precioSur').textContent = '$' + formatearPrecio(sur.producto.precioConDescuento);
    document.getElementById('detalleSur').textContent = sur.producto.porcentajeDescuento > 0 
      ? `${sur.producto.porcentajeDescuento}% dto` 
      : 'Precio normal';
  } else {
    document.getElementById('precioSur').textContent = 'No disponible';
    document.getElementById('detalleSur').textContent = '';
  }
  
  // Marcar la más conveniente
  if (comparacion.masConveniente === 'suizo') {
    document.getElementById('cardSuizo').classList.add('mejor-precio');
  } else if (comparacion.masConveniente === 'acofar') {
    document.getElementById('cardAcofar').classList.add('mejor-precio');
  } else if (comparacion.masConveniente === 'sur') {
    document.getElementById('cardSur').classList.add('mejor-precio');
  }
  
  // Resultado de comparación
  const resultadoComparacion = document.getElementById('resultadoComparacion');
  const nombreGanador = comparacion.nombreMejor || 'Mejor opción';
  const ahorro = formatearPrecio(comparacion.diferencia);
  const porcentaje = comparacion.porcentajeDiferencia.toFixed(2);
  
  resultadoComparacion.innerHTML = `
    <div class="resultado-icono">🏆</div>
    <div class="resultado-texto">
      <strong>${nombreGanador}</strong> es más conveniente<br>
      <span class="ahorro">Ahorrás $${ahorro} (${porcentaje}%)</span>
    </div>
  `;
  
  // Notas adicionales
  if (comparacion.masConveniente === 'acofar' && !acofar.error && acofar.producto.cantidadMinima > 1) {
    resultadoComparacion.innerHTML += `
      <div class="nota-cantidad">
        ⚠️ Precio de Acofar válido comprando ${acofar.producto.cantidadMinima} o más unidades
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

function mostrarResultadoSur(producto) {
  resultadoSurDiv.classList.remove('hidden');
  
  // Nombre
  document.getElementById('nombreProductoSur').textContent = producto.nombre;
  
  // Badge de stock
  const stockBadge = document.getElementById('stockBadgeSur');
  stockBadge.textContent = producto.stock;
  stockBadge.className = 'badge ' + (producto.hayStock ? 'stock-si' : 'stock-no');
  
  // Información
  document.getElementById('codigoSur').textContent = producto.codigoBarras;
  
  // Troquel
  const troquelRow = document.getElementById('troquelRowSur');
  if (producto.troquel) {
    document.getElementById('troquelSur').textContent = producto.troquel;
    troquelRow.style.display = 'flex';
  } else {
    troquelRow.style.display = 'none';
  }
  
  // Pack
  document.getElementById('packSur').textContent = producto.pack + ' unidades';
  
  // Descuento
  const descuentoRow = document.getElementById('descuentoRowSur');
  if (producto.porcentajeDescuento > 0) {
    document.getElementById('descuentoSur').textContent = producto.porcentajeDescuento + '%';
    descuentoRow.style.display = 'flex';
  } else {
    descuentoRow.style.display = 'none';
  }
  
  // Precios
  document.getElementById('precioPubSur').textContent = '$' + formatearPrecio(producto.precioPublico);
  document.getElementById('precioDescSur').textContent = '$' + formatearPrecio(producto.precioConDescuento);
  
  // Oferta
  const ofertaDetalle = document.getElementById('ofertaDetalleSur');
  if (producto.oferta && producto.oferta !== '') {
    ofertaDetalle.textContent = '🎯 ' + producto.oferta;
    if (producto.plazo) {
      ofertaDetalle.textContent += ' - ' + producto.plazo;
    }
    if (producto.tipoOferta) {
      ofertaDetalle.textContent += ' (' + producto.tipoOferta + ')';
    }
    ofertaDetalle.style.display = 'block';
  } else {
    ofertaDetalle.style.display = 'none';
  }
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