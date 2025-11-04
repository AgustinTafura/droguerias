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
const resultadoDiv = document.getElementById('resultado');

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
  resultadoDiv.classList.add('hidden');
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
      mostrarResultado(resultado.producto);
      agregarAlHistorial(resultado.producto);
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

function mostrarResultado(producto) {
  // Nombre
  document.getElementById('nombreProducto').textContent = producto.nombre;
  
  // Badge de stock
  const stockBadge = document.getElementById('stockBadge');
  stockBadge.textContent = producto.hayStock ? 'En Stock' : 'Sin Stock';
  stockBadge.className = 'badge ' + (producto.hayStock ? 'stock-si' : 'stock-no');
  
  // Información
  document.getElementById('codigoBarrasResultado').textContent = producto.codigoBarras;
  document.getElementById('stock').textContent = producto.stock;
  
  // Troquel (ocultar si no existe)
  const troquelItem = document.getElementById('troquelItem');
  if (producto.troquel) {
    document.getElementById('troquel').textContent = producto.troquel;
    troquelItem.style.display = 'flex';
  } else {
    troquelItem.style.display = 'none';
  }
  
  // Descuento
  const descuentoItem = document.getElementById('descuentoItem');
  if (producto.porcentajeDescuento > 0) {
    document.getElementById('descuento').textContent = producto.porcentajeDescuento + '%';
    descuentoItem.style.display = 'flex';
  } else {
    descuentoItem.style.display = 'none';
  }
  
  // Mínimo
  const minimoItem = document.getElementById('minimoItem');
  if (producto.minimo) {
    document.getElementById('minimo').textContent = producto.minimo + ' unidades';
    minimoItem.style.display = 'flex';
  } else {
    minimoItem.style.display = 'none';
  }
  
  // Precios
  document.getElementById('precio').textContent = '$' + formatearPrecio(producto.precioNumerico);
  document.getElementById('precioConDescuento').textContent = '$' + formatearPrecio(producto.precioConDescuentoNumerico);
  document.getElementById('precioPublico').textContent = '$' + formatearPrecio(producto.precioPublicoSugeridoNumerico);
  
  // Oferta detalle
  const ofertaDetalle = document.getElementById('ofertaDetalle');
  if (producto.oferta && producto.oferta !== '') {
    ofertaDetalle.textContent = '🎯 ' + producto.oferta;
    ofertaDetalle.style.display = 'block';
  } else {
    ofertaDetalle.style.display = 'none';
  }
  
  resultadoDiv.classList.remove('hidden');
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