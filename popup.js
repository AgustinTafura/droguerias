let historial = [];
let productoActual = null; // Guardar el producto actual para agregar al carrito
let drogueriaActual = null; // Guardar la droguería actual

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

// Referencias al modal
const modalCantidad = document.getElementById('modalCantidad');
const modalTitle = document.getElementById('modalTitle');
const modalProducto = document.getElementById('modalProducto');
const inputCantidad = document.getElementById('inputCantidad');
const btnConfirmarAgregar = document.getElementById('btnConfirmarAgregar');
const btnCancelarAgregar = document.getElementById('btnCancelarAgregar');
const modalLoading = document.getElementById('modalLoading');
const modalMensaje = document.getElementById('modalMensaje');

// Referencias a botones de agregar carrito
const btnAgregarSuizo = document.getElementById('btnAgregarSuizo');
const btnAgregarAcofar = document.getElementById('btnAgregarAcofar');
const btnAgregarSur = document.getElementById('btnAgregarSur');

// Event listeners
btnBuscar.addEventListener('click', buscarProducto);
inputCodigo.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') buscarProducto();
});

// Event listeners para botones de agregar al carrito
btnAgregarSuizo.addEventListener('click', () => abrirModalCarrito('suizo'));
btnAgregarAcofar.addEventListener('click', () => abrirModalCarrito('acofar'));
btnAgregarSur.addEventListener('click', () => abrirModalCarrito('sur'));

// Event listeners del modal
btnConfirmarAgregar.addEventListener('click', confirmarAgregarCarrito);
btnCancelarAgregar.addEventListener('click', cerrarModalCarrito);

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
  btnAgregarSuizo.style.display = 'none';
  btnAgregarAcofar.style.display = 'none';
  btnAgregarSur.style.display = 'none';
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
      // Guardar resultado globalmente
      productoActual = resultado;
      
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
    document.getElementById('detalleSuizo').textContent = `Cant. mín: ${suizo.producto.minimo} un.`
    btnAgregarSuizo.style.display = 'block';
  } else {
    document.getElementById('precioSuizo').textContent = 'No disponible';
    document.getElementById('detalleSuizo').textContent = '';
    btnAgregarSuizo.style.display = 'none';
  }
  
  // Mostrar Acofar
  if (!acofar.error) {
    document.getElementById('precioAcofar').textContent = '$' + formatearPrecio(acofar.producto.costoUnidadCM);
    document.getElementById('detalleAcofar').textContent = `Cant. mín: ${acofar.producto.cantidadMinima} un.`;
    btnAgregarAcofar.style.display = 'block';
  } else {
    console.log("acofar error", acofar.error);
    document.getElementById('precioAcofar').textContent = 'No disponible';
    document.getElementById('detalleAcofar').textContent = '';
    btnAgregarAcofar.style.display = 'none';
  }
  
  // Mostrar Del Sur
  if (!sur.error) {
    document.getElementById('precioSur').textContent = '$' + formatearPrecio(sur.producto.precioConDescuento);
    document.getElementById('detalleSur').textContent =  `Cant. mín: ${sur.producto.cantidadMinima} un.`;
    btnAgregarSur.style.display = 'block';
  } else {
    document.getElementById('precioSur').textContent = 'No disponible';
    document.getElementById('detalleSur').textContent = '';
    btnAgregarSur.style.display = 'none';
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

// FUNCIONES DEL MODAL DE CARRITO

function abrirModalCarrito(drogueria) {
  drogueriaActual = drogueria;
  
  let producto, nombreDrogueria;
  console.log("productoActual", productoActual);
  if (drogueria === 'suizo' && productoActual && !productoActual.suizo.error) {
    producto = productoActual.suizo.producto;
    nombreDrogueria = 'Suizo Argentina';
  } else if (drogueria === 'acofar' && productoActual && !productoActual.acofar.error) {
    producto = productoActual.acofar.producto;
    nombreDrogueria = 'Acofar';
  } else if (drogueria === 'sur' && productoActual && !productoActual.sur.error) {
    producto = productoActual.sur.producto;
    nombreDrogueria = 'Droguería del Sur';
  } else {
    mostrarError('No se encontró información del producto para esta droguería');
    return;
  }
  
  modalTitle.textContent = `Agregar a ${nombreDrogueria}`;
  modalProducto.textContent = producto.nombre;
  inputCantidad.value = 1;
  modalLoading.classList.add('hidden');
  modalMensaje.classList.add('hidden');
  
  // Mostrar el modal
  modalCantidad.classList.remove('hidden');
  inputCantidad.focus();
}

function cerrarModalCarrito() {
  modalCantidad.classList.add('hidden');
  drogueriaActual = null;
}

async function confirmarAgregarCarrito() {
  const cantidad = parseInt(inputCantidad.value);
  
  if (!cantidad || cantidad < 1) {
    modalMensaje.textContent = 'Por favor, ingrese una cantidad válida';
    modalMensaje.className = 'error';
    modalMensaje.classList.remove('hidden');
    return;
  }
  
  // Ocultar botones y mostrar loading
  btnConfirmarAgregar.disabled = true;
  btnCancelarAgregar.disabled = true;
  modalLoading.classList.remove('hidden');
  modalMensaje.classList.add('hidden');
  
  try {
    let resultado;
    
    if (drogueriaActual === 'suizo') {
      const productoId = productoActual.suizo.producto.productoId;
      
      if (!productoId) {
        throw new Error('No se encontró el ID del producto');
      }
      
      resultado = await chrome.runtime.sendMessage({
        action: 'agregarAlCarritoSuizo',
        productoId: productoId,
        cantidad: cantidad
      });
    } else if (drogueriaActual === 'acofar') {
      const producto = productoActual.acofar.producto;
      console.log('Producto para agregar al carrito Acofar:', productoActual);
      if (!producto.codigoAlternativo) {
        throw new Error('No se encontró el código alternativo del producto');
      }
      
      resultado = await chrome.runtime.sendMessage({
        action: 'agregarAlCarritoAcofar',
        productoData: producto,
        cantidad: cantidad
      });
    } else if (drogueriaActual === 'sur') {
      // TODO: Implementar agregar a Del Sur
      throw new Error('Agregar a Droguería del Sur aún no está implementado');
    }
    
    modalLoading.classList.add('hidden');
    
    if (resultado.error) {
      modalMensaje.textContent = resultado.mensaje;
      modalMensaje.className = 'error';
    } else {
      modalMensaje.textContent = resultado.mensaje;
      modalMensaje.className = 'success';
      
      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        cerrarModalCarrito();
      }, 2000);
    }
    
    modalMensaje.classList.remove('hidden');
    
  } catch (error) {
    modalLoading.classList.add('hidden');
    modalMensaje.textContent = 'Error: ' + error.message;
    modalMensaje.className = 'error';
    modalMensaje.classList.remove('hidden');
  } finally {
    btnConfirmarAgregar.disabled = false;
    btnCancelarAgregar.disabled = false;
  }
}

// Permitir Enter en el input de cantidad
inputCantidad.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    confirmarAgregarCarrito();
  }
});