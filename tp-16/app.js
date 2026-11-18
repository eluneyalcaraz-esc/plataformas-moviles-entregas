const API_URL = 'https://pokeapi.co/api/v2';
const CANTIDAD_INICIAL = 151;
const CANTIDAD_POR_CARGA = 50;
const CONCURRENCIA_MAXIMA = 8;

const grilla = document.getElementById('pokemon-grid');
const estadoCarga = document.getElementById('estado-carga');
const textoCarga = document.getElementById('texto-carga');
const cantidadPokemon = document.getElementById('cantidad-pokemon');
const alertaError = document.getElementById('alerta-error');
const mensajeError = document.getElementById('mensaje-error');
const botonReintentarLista = document.getElementById('reintentar-lista');
const botonCargarMas = document.getElementById('cargar-mas');
const pokemonPorId = new Map();
const pokemonFallidos = new Map();
let cantidadCargada = 0;
let totalPokemon = 0;
let limitePendiente = CANTIDAD_INICIAL;
let errorGeneral = '';
let cargando = false;

async function obtenerJson(url) {
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
        throw new Error(`La API respondió con estado ${respuesta.status}.`);
    }
    return respuesta.json();
}

function mostrarError() {
    if (errorGeneral) {
        mensajeError.textContent = errorGeneral;
        botonReintentarLista.classList.remove('d-none');
        alertaError.classList.remove('d-none');
        return;
    }

    if (pokemonFallidos.size > 0) {
        mensajeError.textContent = `No se pudieron cargar ${pokemonFallidos.size} Pokémon. Podés reintentar desde cada tarjeta.`;
        botonReintentarLista.classList.add('d-none');
        alertaError.classList.remove('d-none');
        return;
    }

    alertaError.classList.add('d-none');
}

function actualizarInterfazCarga(activa, texto = '') {
    cargando = activa;
    estadoCarga.classList.toggle('d-none', !activa);
    if (texto) textoCarga.textContent = texto;
    botonCargarMas.disabled = activa;
    grilla.querySelectorAll('[data-accion="reintentar"]').forEach(boton => {
        boton.disabled = activa;
    });
}

function obtenerId(url) {
    return Number(url.split('/').filter(Boolean).pop());
}

function formatearNombre(nombre) {
    return nombre.charAt(0).toUpperCase() + nombre.slice(1).replaceAll('-', ' ');
}

function obtenerImagen(pokemon) {
    const ilustracion = pokemon.sprites.other
        && pokemon.sprites.other['official-artwork']
        && pokemon.sprites.other['official-artwork'].front_default;
    return ilustracion || pokemon.sprites.front_default || '';
}

function crearTarjetaError(entrada, id, error) {
    const columna = document.createElement('div');
    columna.className = 'col-12 col-sm-6 col-lg-4 col-xl-3';
    columna.dataset.pokemonCard = id;

    const tarjeta = document.createElement('article');
    tarjeta.className = 'card h-100 border-warning';
    const cuerpo = document.createElement('div');
    cuerpo.className = 'card-body d-flex flex-column';

    const titulo = document.createElement('h2');
    titulo.className = 'h5 card-title';
    titulo.textContent = `#${String(id).padStart(3, '0')} ${formatearNombre(entrada.name)}`;

    const detalleError = document.createElement('p');
    detalleError.className = 'small text-danger';
    detalleError.textContent = `No se pudo cargar la información: ${error.message}`;

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn btn-outline-warning mt-auto';
    boton.dataset.accion = 'reintentar';
    boton.dataset.id = id;
    boton.textContent = 'Reintentar';

    cuerpo.append(titulo, detalleError, boton);
    tarjeta.append(cuerpo);
    columna.append(tarjeta);
    return columna;
}

function crearTarjetaPokemon(pokemon) {
    const columna = document.createElement('div');
    columna.className = 'col-12 col-sm-6 col-lg-4 col-xl-3';
    columna.dataset.pokemonCard = pokemon.id;

    const tarjeta = document.createElement('article');
    tarjeta.className = 'card h-100 pokemon-card';

    const imagenUrl = obtenerImagen(pokemon);
    if (imagenUrl) {
        const imagen = document.createElement('img');
        imagen.className = 'card-img-top pokemon-image p-3';
        imagen.src = imagenUrl;
        imagen.alt = `Imagen de ${formatearNombre(pokemon.name)}`;
        imagen.loading = 'lazy';
        tarjeta.append(imagen);
    } else {
        const sinImagen = document.createElement('div');
        sinImagen.className = 'pokemon-image d-flex align-items-center justify-content-center text-secondary';
        sinImagen.textContent = 'Imagen no disponible';
        tarjeta.append(sinImagen);
    }

    const cuerpo = document.createElement('div');
    cuerpo.className = 'card-body d-flex flex-column';

    const identificador = document.createElement('p');
    identificador.className = 'small text-body-secondary mb-1';
    identificador.textContent = `#${String(pokemon.id).padStart(3, '0')}`;

    const titulo = document.createElement('h2');
    titulo.className = 'h5 card-title';
    titulo.textContent = formatearNombre(pokemon.name);

    const tipos = document.createElement('div');
    tipos.className = 'd-flex flex-wrap gap-1 mb-3';
    pokemon.types.forEach(tipo => {
        const etiqueta = document.createElement('span');
        etiqueta.className = 'badge text-bg-secondary';
        etiqueta.textContent = formatearNombre(tipo.type.name);
        tipos.append(etiqueta);
    });

    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn btn-outline-primary mt-auto';
    boton.dataset.accion = 'detalles';
    boton.dataset.id = pokemon.id;
    boton.textContent = 'Ver detalles';
    boton.setAttribute('aria-label', `Ver detalles de ${formatearNombre(pokemon.name)}`);

    cuerpo.append(identificador, titulo, tipos, boton);
    tarjeta.append(cuerpo);
    columna.append(tarjeta);
    return columna;
}

async function cargarDetalles(entries) {
    const resultados = new Array(entries.length);
    let proximoIndice = 0;
    let completados = 0;

    async function trabajador() {
        while (true) {
            const indice = proximoIndice;
            proximoIndice += 1;
            if (indice >= entries.length) return;

            try {
                resultados[indice] = { pokemon: await obtenerJson(entries[indice].url) };
            } catch (error) {
                resultados[indice] = { error };
            }

            completados += 1;
            textoCarga.textContent = `Cargando Pokémon... ${completados} de ${entries.length}`;
        }
    }

    const cantidadTrabajadores = Math.min(CONCURRENCIA_MAXIMA, entries.length);
    await Promise.all(Array.from({ length: cantidadTrabajadores }, () => trabajador()));
    return resultados;
}

function actualizarContador() {
    cantidadPokemon.textContent = totalPokemon
        ? `Mostrando ${cantidadCargada} de ${totalPokemon} Pokémon.`
        : '';
    botonCargarMas.classList.toggle('d-none', cantidadCargada >= totalPokemon);
}

async function cargarHasta(limite) {
    if (cargando) return;

    limitePendiente = limite;
    errorGeneral = '';
    mostrarError();
    actualizarInterfazCarga(true, 'Obteniendo listado...');

    try {
        const listado = await obtenerJson(`${API_URL}/pokemon?limit=${limite}&offset=0`);
        totalPokemon = listado.count;
        const entradas = listado.results.slice(cantidadCargada, limite);
        const resultados = await cargarDetalles(entradas);

        resultados.forEach((resultado, indice) => {
            const entrada = entradas[indice];
            const id = obtenerId(entrada.url);
            if (resultado.error) {
                pokemonFallidos.set(id, entrada);
                grilla.append(crearTarjetaError(entrada, id, resultado.error));
            } else {
                pokemonPorId.set(id, resultado.pokemon);
                grilla.append(crearTarjetaPokemon(resultado.pokemon));
            }
        });

        cantidadCargada += entradas.length;
        limitePendiente = cantidadCargada;
        actualizarContador();
    } catch (error) {
        errorGeneral = `No se pudo obtener la lista de Pokémon. ${error.message}`;
        mostrarError();
    } finally {
        actualizarInterfazCarga(false);
        mostrarError();
    }
}

function agregarEtiquetas(contenedor, nombres) {
    contenedor.replaceChildren();
    nombres.forEach(nombre => {
        const etiqueta = document.createElement('span');
        etiqueta.className = 'badge text-bg-secondary me-1';
        etiqueta.textContent = formatearNombre(nombre);
        contenedor.append(etiqueta);
    });
}

function mostrarDetalles(pokemon) {
    document.getElementById('modal-titulo').textContent =
        `#${String(pokemon.id).padStart(3, '0')} ${formatearNombre(pokemon.name)}`;

    const imagen = document.getElementById('modal-imagen');
    imagen.src = obtenerImagen(pokemon);
    imagen.alt = `Imagen de ${formatearNombre(pokemon.name)}`;
    imagen.classList.toggle('d-none', !imagen.src);

    agregarEtiquetas(
        document.getElementById('modal-tipos'),
        pokemon.types.map(tipo => tipo.type.name)
    );
    agregarEtiquetas(
        document.getElementById('modal-habilidades'),
        pokemon.abilities.map(habilidad => habilidad.ability.name)
    );
    document.getElementById('modal-altura').textContent = `${pokemon.height / 10} m`;
    document.getElementById('modal-peso').textContent = `${pokemon.weight / 10} kg`;

    const movimientos = document.getElementById('modal-movimientos');
    movimientos.replaceChildren();
    pokemon.moves.slice(0, 4).forEach(item => {
        const movimiento = document.createElement('li');
        movimiento.className = 'list-group-item';
        movimiento.textContent = formatearNombre(item.move.name);
        movimientos.append(movimiento);
    });

    bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-pokemon')).show();
}

async function reintentarPokemon(id, boton) {
    if (cargando) return;
    const entrada = pokemonFallidos.get(id);
    if (!entrada) return;

    actualizarInterfazCarga(true, `Reintentando ${formatearNombre(entrada.name)}...`);
    try {
        const pokemon = await obtenerJson(entrada.url);
        pokemonFallidos.delete(id);
        pokemonPorId.set(id, pokemon);
        const tarjetaActual = grilla.querySelector(`[data-pokemon-card="${id}"]`);
        if (tarjetaActual) tarjetaActual.replaceWith(crearTarjetaPokemon(pokemon));
        actualizarContador();
    } catch (error) {
        const tarjeta = boton.closest('[data-pokemon-card]');
        const detalleError = tarjeta && tarjeta.querySelector('.text-danger');
        if (detalleError) {
            detalleError.textContent = `No se pudo cargar la información: ${error.message}`;
        }
    } finally {
        actualizarInterfazCarga(false);
        mostrarError();
    }
}

grilla.addEventListener('click', event => {
    const boton = event.target.closest('button[data-accion]');
    if (!boton) return;

    const id = Number(boton.dataset.id);
    if (boton.dataset.accion === 'detalles') {
        const pokemon = pokemonPorId.get(id);
        if (pokemon) mostrarDetalles(pokemon);
    } else if (boton.dataset.accion === 'reintentar') {
        reintentarPokemon(id, boton);
    }
});

botonCargarMas.addEventListener('click', () => {
    cargarHasta(Math.min(cantidadCargada + CANTIDAD_POR_CARGA, totalPokemon));
});

botonReintentarLista.addEventListener('click', () => {
    cargarHasta(limitePendiente);
});

cargarHasta(CANTIDAD_INICIAL);
