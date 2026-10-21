// VARIABLES GLOBALES DE ESTADO
let idGestorActual = null;
let ws = null;
let recursoSeleccionadoId = null;
let categoriasById = {};
let modelosById = {};
let ubicacionesById = {};
let tokenGestor = null; // variable global del token

//funcion api para añadir el token                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  
function api(metodo, url, body, callback) {
  var separador = url.includes("?") ? "&" : "?";
  rest(metodo, url + separador + "token=" + tokenGestor, body, function (status, datos) {
    if (status === 401) {
      alert("Sesión caducada, vuelve a iniciar sesión");
      salirDeInicio();
      return;
    }
    callback(status, datos);
  });
}

// INICIALIZACIÓN AL CARGAR LA PÁGINA
window.onload = function() {
  navegar("vista-login");
  configurarEventos();
};

// NAVEGACIÓN SPA
function navegar(idVista) {
  var vistas = document.querySelectorAll(".vista");

  for (var i = 0; i < vistas.length; i++) {
    vistas[i].classList.add("oculto");
  }

  document.getElementById(idVista).classList.remove("oculto");
}


// LÓGICA DE GESTORES
function login() {
  var user = document.getElementById("login-usuario").value;
  var pass = document.getElementById("login-password").value;

  rest("POST", "/api/gestores/login", { usuario: user, password: pass }, function(status, r) {
    if (status < 200 || status >= 300) {
      alert("Acceso denegado");
      return;
    }

    idGestorActual = r.id;
    tokenGestor = r.token;

    api("GET", "/api/gestores/" + idGestorActual, null, function(status2, datos) {
      if (status2 < 200 || status2 >= 300) {
        alert("Error cargando gestor");
        return;
      }
    
      document.getElementById("nombre-usuario-saludo").innerText = datos.nombre;
    
      //Si el login es correcto, habrá que cargar los avisos
      ws = new WebSocket("ws://localhost:3502"); //abrir la conexión webSocket
      //Cuando la  conexion está lista, registrarse como gestor
      ws.onopen = function() {
        ws.send(JSON.stringify({
          tipo : "registro",
          rol: "gestor",
          id : idGestorActual
        }));
      };

      // Cuando llega un aviso verde del servidor, mostrarlo en la tabla de gestores
      ws.onmessage = function(evento) {
        var aviso = JSON.parse(evento.data);
        anyadirAviso(aviso);
      };

      cargarDatosDesplegables();
    });
  });
}

function cancelarRegistro(){
    if (idGestorActual) {
      navegar("vista-inicio");
    } else {
      navegar("vista-login");
    }
}

function salirDeInicio(){
    idGestorActual = null;
    if (ws) ws.close();
    navegar("vista-login");
}

function prepararRegistro(esNuevo) {
  var titulo = document.getElementById("titulo-registro");

  if (esNuevo) {
    titulo.innerText = "REGISTRO NUEVO GESTOR";
    document.getElementById("reg-nombre").value = "";
    document.getElementById("reg-apellidos").value = "";
    document.getElementById("reg-login").value = "";
    document.getElementById("reg-password").value = "";
  } else {
    titulo.innerText = "EDITAR MI PERFIL";

    api("GET", "/api/gestores/" + idGestorActual, null, function(status, datos) {
      if (status < 200 || status >= 300) {
        alert("Error cargando gestor");
        return;
      }

      document.getElementById("reg-nombre").value = datos.nombre;
      document.getElementById("reg-apellidos").value = datos.apellidos;
      document.getElementById("reg-login").value = datos.usuario;
      document.getElementById("reg-password").value = "";
    });
  }
}

function guardarGestor() {
  var datos = {
    nombre: document.getElementById("reg-nombre").value,
    apellidos: document.getElementById("reg-apellidos").value,
    usuario: document.getElementById("reg-login").value,
    password: document.getElementById("reg-password").value
  };

  var titulo = document.getElementById("titulo-registro").innerText;

  if (idGestorActual && titulo.includes("EDITAR")) {
    api("PUT", "/api/gestores/" + idGestorActual, datos, function(status, r) {
      if (status < 200 || status >= 300) {
        alert("Error actualizando gestor: " + r.message);
        return;
      }

      alert("Gestor actualizado");
      document.getElementById("nombre-usuario-saludo").innerText = datos.nombre;
      navegar("vista-inicio");
    });
  } else {
    rest("POST", "/api/gestores", datos, function(status, r) {
      if (status < 200 || status >= 300) {
        alert("Error registrando gestor: " + r.message);
        return;
      }

      alert("Gestor registrado");
      navegar("vista-login");
    });
  }
}

// CARGAR DATOS DE LOS DESPLEGABLES
function cargarDatosDesplegables() {
  api("GET", "/api/categorias", null, function(status1, cats) {
    if (status1 < 200 || status1 >= 300) {
      alert("Error cargando categorías");
      return;
    }

    api("GET", "/api/modelos", null, function(status2, mods) {
      if (status2 < 200 || status2 >= 300) {
        alert("Error cargando modelos");
        return;
      }

      api("GET", "/api/ubicaciones", null, function(status3, ubis) {
        if (status3 < 200 || status3 >= 300) {
          alert("Error cargando ubicaciones");
          return;
        }

        categoriasById = {};
        for (var i = 0; i < cats.length; i++) {
          categoriasById[cats[i].id] = cats[i];
        }

        modelosById = {};
        for (var j = 0; j < mods.length; j++) {
          modelosById[mods[j].id] = mods[j];
        }

        ubicacionesById = {};
        for (var k = 0; k < ubis.length; k++) {
          ubicacionesById[ubis[k].id] = ubis[k];
        }

        rellenarDesplegables(cats, mods, ubis);
        cargarListadoRecursos();
        cargarReservasMinisterio();
        navegar("vista-inicio");
      });
    });
  });
}

// LÓGICA DE RECURSOS
function rellenarDesplegables(cats, mods, ubis) {
  llenarSelect("filtro-categoria", cats, true);
  llenarSelect("filtro-modelo", mods, true);
  llenarSelect("filtro-ubicacion", ubis, true);

  llenarSelect("rec-categoria", cats, false);
  llenarSelect("rec-modelo", mods, false);
  llenarSelect("rec-ubicacion", ubis, false);
}

function llenarSelect(id, lista, incluirTodos) {
  var sel = document.getElementById(id);

  if (incluirTodos) {
    sel.innerHTML = "<option value='Todos'>Todos</option>";
  } else {
    sel.innerHTML = "";
  }

  for (var i = 0; i < lista.length; i++) {
    sel.innerHTML += "<option value='" + lista[i].id + "'>" + lista[i].nombre + "</option>";
  }
}

function cargarListadoRecursos() {
  var categoria = document.getElementById("filtro-categoria").value;
  var modelo = document.getElementById("filtro-modelo").value;
  var ubicacion = document.getElementById("filtro-ubicacion").value;
  var estado = document.getElementById("filtro-estado").value;

  var url = "/api/recursos?categoria=" + categoria +
            "&modelo=" + modelo +
            "&ubicacion=" + ubicacion +
            "&estado=" + estado;

  api("GET", url, null, function(status, recursos) {
    if (status < 200 || status >= 300) {
      alert("Error cargando recursos");
      return;
    }

    var tbody = document.querySelector("#tabla-recursos tbody");
    tbody.innerHTML = "";

    for (var i = 0; i < recursos.length; i++) {
      var r = recursos[i];
      var mod = modelosById[String(r.modelo)];
      var cat = null;
      var ubi = ubicacionesById[String(r.ubicacion)];

      if (mod) {
        cat = categoriasById[String(mod.categoria)];
      }

      var nombreModelo = "-";
      if (mod) {
        nombreModelo = mod.nombre;
      }

      var nombreCategoria = "-";
      if (cat) {
        nombreCategoria = cat.nombre;
      }

      var nombreUbicacion = "-";
      if (ubi) {
        nombreUbicacion = ubi.nombre;
      }

      tbody.innerHTML +=
        "<tr>" +
          "<td>" + r.numero_serie + "</td>" +
          "<td>" + nombreCategoria + "</td>" +
          "<td>" + nombreModelo + "</td>" +
          "<td>" + nombreUbicacion + "</td>" +
          "<td>" + interpretarEstado(r.estado) + "</td>" +
          "<td>" +
            "<button onclick='prepararFichaRecurso(" + r.id + ")'>Ver ficha</button>" +
            "<button onclick='eliminarRecurso(" + r.id + ")' style='color: red; margin-left: 5px; font-weight: bold;'>X</button>" +
          "</td>" +
        "</tr>";
    }
  });
}

function eliminarRecurso(id) {
  if (confirm("¿Seguro que deseas eliminar este recurso?")) {
    api("DELETE", "/api/recursos/" + id, null, function(status, response) {
      if (status < 200 || status >= 300) {
        alert("Error eliminando recurso: " + response.message);
        return;
      }

      alert("Recurso eliminado");
      cargarListadoRecursos();
    });
  }
}

function interpretarEstado(e) {
  var estados = ["Operativo", "Baja/Defectuoso", "Mantenimiento"];

  if (estados[e]) {
    return estados[e];
  }

  return "Desconocido";
}

// FICHA DE RECURSO Y DETALLES
function prepararFichaRecurso(id) {
  recursoSeleccionadoId = id;

  if (id) {
    api("GET", "/api/recursos/" + id, null, function(status, r) {
      if (status < 200 || status >= 300) {
        alert("Error cargando recurso");
        return;
      }

      var mod = modelosById[String(r.modelo)];
      var categoria = "";

      if (mod) {
        categoria = mod.categoria;
      }

      document.getElementById("rec-serie").value = r.numero_serie;
      document.getElementById("rec-categoria").value = categoria;
      document.getElementById("rec-modelo").value = r.modelo;
      document.getElementById("rec-ubicacion").value = r.ubicacion;
      document.getElementById("rec-estado").value = r.estado;

      cargarDetallesRecurso(id);
      navegar("vista-recurso");
    });
  } else {
    document.getElementById("rec-serie").value = "";
    document.getElementById("rec-categoria").value = "";
    document.getElementById("rec-modelo").value = "";
    document.getElementById("rec-ubicacion").value = "";
    document.getElementById("rec-estado").value = "";

    document.querySelector("#tabla-reservas tbody").innerHTML = "";
    document.querySelector("#tabla-resenyas tbody").innerHTML = "";

    navegar("vista-recurso");
  }
}

function cargarDetallesRecurso(id) {
  api("GET", "/api/recursos/" + id + "/reservas", null, function(status, reservas) {
    if (status < 200 || status >= 300) {
      alert("Error cargando reservas");
      return;
    }

    api("GET", "/api/recursos/" + id + "/resenyas", null, function(status2, resenyas) {
      if (status2 < 200 || status2 >= 300) {
        alert("Error cargando reseñas");
        return;
      }

      var tablaReservas = document.querySelector("#tabla-reservas tbody");
      var tablaResenyas = document.querySelector("#tabla-resenyas tbody");

      tablaReservas.innerHTML = "";
      tablaResenyas.innerHTML = "";

      for (let i = 0; i < reservas.length; i++) {
        let reserva = reservas[i];

        api("GET", "/api/sanitarios/" + reserva.sanitario, null, function(status3, sanitario) {
          var nombreCompleto = "---";

          if (status3 >= 200 && status3 < 300) {
            nombreCompleto = sanitario.nombre + " " + sanitario.apellidos;
          }

          var claseColor = calcularClaseReserva(reserva);

          tablaReservas.innerHTML +=
            "<tr class='" + claseColor + "'>" +
              "<td>" + nombreCompleto + "</td>" +
              "<td>" + reserva.horas_estimadas + "h</td>" +
              "<td>" + formatearFechaHora(reserva.fecha_peticion) + "</td>" +
              "<td>" + formatearFechaHora(reserva.fecha_inicio) + "</td>" +
              "<td>" + formatearFechaHora(reserva.fecha_fin) + "</td>" +
            "</tr>";
        });
      }

      for (let j = 0; j < resenyas.length; j++) {
        let resenya = resenyas[j];

        api("GET", "/api/sanitarios/" + resenya.sanitario, null, function(status4, sanitario) {
          var nombreCompleto = "---";

          if (status4 >= 200 && status4 < 300) {
            nombreCompleto = sanitario.nombre + " " + sanitario.apellidos;
          }

          tablaResenyas.innerHTML +=
            "<tr>" +
              "<td>" + formatearFechaHora(resenya.fecha) + "</td>" +
              "<td>" + nombreCompleto + "</td>" +
              "<td>" + resenya.valor + "/5</td>" +
              "<td>" + resenya.descripcion + "</td>" +
            "</tr>";
        });
      }
    });
  });
}

function calcularClaseReserva(r) {
  if (r.fecha_fin) {
    return "reserva-finalizada";
  }

  if (!r.fecha_inicio) {
    return "reserva-pendiente";
  }

  var inicio = new Date(r.fecha_inicio).getTime();
  var ahora = new Date().getTime();
  var horasTranscurridas = (ahora - inicio) / (1000 * 60 * 60);

  if (horasTranscurridas > r.horas_estimadas) {
    return "reserva-retraso";
  }

  return "reserva-en-uso";
}

function formatearFechaHora(fecha) {
  if (!fecha) {
    return "---";
  }

  return new Date(fecha).toLocaleString("es-ES");
}

function guardarRecurso() {
  var datos = {
    modelo: document.getElementById("rec-modelo").value,
    numero_serie: document.getElementById("rec-serie").value,
    ubicacion: document.getElementById("rec-ubicacion").value,
    estado: document.getElementById("rec-estado").value
  };

  if (recursoSeleccionadoId) {
    api("PUT", "/api/recursos/" + recursoSeleccionadoId, datos, function(status, respuesta) {
      if (status < 200 || status >= 300) {
        alert("Error guardando recurso");
        return;
      }

      alert("Recurso actualizado");
      cargarListadoRecursos();
      navegar("vista-inicio");
    });
  } else {
    api("POST", "/api/recursos", datos, function(status, respuesta) {
    if (status < 200 || status >= 300) {
        alert("Error guardando recurso");
        return;
    }

    alert("Recurso creado");

    // Obtener nombre del modelo y categoría para el aviso
    var mod = modelosById[String(datos.modelo)];
    var cat = mod ? categoriasById[String(mod.categoria)] : null;
    var nombreModelo = mod ? mod.nombre : "";
    var nombreCategoria = cat ? cat.nombre : "";

    // Enviar aviso azul a todos los sanitarios conectados
    api("GET", "/api/gestores/" + idGestorActual, null, function(status3, gestor) {
        ws.send(JSON.stringify({
            tipo:            "aviso_recurso",
            numSerie:        datos.numero_serie,
            nombreModelo:    nombreModelo,
            nombreCategoria: nombreCategoria,
            origen:          gestor.nombre + " " + gestor.apellidos
        }));
    });

    cargarListadoRecursos();
    navegar("vista-inicio");
    });
  }
}

// rellenar tabla de avisos en el gestor
function anyadirAviso(aviso){
  var tbody = document.querySelector("#tabla-avisos tbody");
  
  var fila = document.createElement("tr");
  fila.style.backgroundColor = aviso.color === "verde" ? "#b6ee90" : "";
  
  fila.innerHTML = 
    "<td>" + aviso.fecha + "</td>" +
    "<td>" + aviso.origen + "</td>" +
    "<td>" + aviso.texto + "</td>";
  
  tbody.appendChild(fila);
}

// PRÁCTICA 3
// Cargar y mostrar el ranking en la tabla

const AREAS_MEDICAS = {
    1: "Alergología", 2: "Anestesiología", 3: "Cardiología", 4: "Cirugía General",
    5: "Dermatología", 6: "Aparato Digestivo", 7: "Endocrinología", 8: "Ginecología",
    9: "Hematología", 10: "Medicina Interna", 11: "Neumología", 12: "Neurología",
    13: "Oftalmología", 14: "Oncología", 15: "Pediatría", 16: "Psiquiatría",
    17: "Traumatología", 18: "Urología"
};


/////////////////////////////////////////////////
// GET
/////////////////////////////////////////////////

function comprobarReservaValida(datos, id_area){
  var valida = false;
  // comprueba el area primero y si es correcta comprobará los datos
  if (id_area && id_area>0 && id_area<19){
    if (datos &&
        typeof datos.nombre == "string" && datos.nombre.trim() != "" &&
        typeof datos.apellidos == "string" && datos.apellidos.trim() != "" &&
        typeof datos.categoría == "string" && datos.categoría.trim() != "" &&
        typeof datos.fec_pet == "string" && datos.fec_pet.trim() != "" &&
        !Number.isNaN(Date.parse(datos.fec_pet)) &&
        datos.horas_estimadas != null &&
        Number.isFinite(Number(datos.horas_estimadas)) &&
        Number(datos.horas_estimadas) > 0){
    valida = true;
  }
  } 
  return valida
}

// EJERCICIO 1 EXAMEN
function consultarRegistrosMinisterio(){
  var areaId = document.getElementById("numero-area").value;
  var contador = 0;
  var nombreArea = null;

  // nombre del área metida (si el rango es correcto)
  if (areaId < 0 || areaId > 18) {
    alert("Debe introducir un número de área válido (1-18)");
    return;

  } else {
    nombreArea = AREAS_MEDICAS[areaId];
  }

  fetch("https://undefined.ua.es/telemedicina/api/datos")
    .then(function (respuesta) {
      return respuesta.json();
    })
    .then(function (datosMinisterio) {
      if (datosMinisterio && datosMinisterio.length){ //si no está vacío, recorro las diferentes reservas y 
        // recorre todas las reservas
        for (var i = 0; i < datosMinisterio.length; i++){
          var id_area = datosMinisterio[i].id_area; 
      
          if (id_area == areaId){
            contador ++;
          }            
        }

        alert("Existen " + contador + " registros del área de " + nombreArea);

      } else {
        alert("No se han obtenido los datos del servidor");
      }
    })
    .catch(function (error) {
      console.log("Error al conectar con el Ministerio:", error);
    });
}

// GET para obtener los datos del ministerio, limpiarlos y enseñarlos en la tabla
function cargarReservasMinisterio() {
  // se hace un array con cada area de la 1 a la 18 y se le asigna un contador a 0: {1:0, 2:0, ...}
  var conteoPorArea = {};
    for (var id = 1; id <= 18; id++) {
        conteoPorArea[id] = 0;
    }
  // hacemos una petición get al ministerio con fecth
  // devuelve un json con los datos y si no lo consigue lanza un error
  fetch("https://undefined.ua.es/telemedicina/api/datos")
        .then(function (respuesta) {
            return respuesta.json();
        })
        .then(function (datosMinisterio) {
            console.log("Datos recibidos del Ministerio:", datosMinisterio);
            if (datosMinisterio && datosMinisterio.length){ //si no está vacío, recorro las diferentes reservas y 
              // recorre todas las reservas
              for (var i = 0; i < datosMinisterio.length; i++){
                // dividir los bloques del array: id_area, fecha y datos (nombre,apellidos...)
                var id_area = datosMinisterio[i].id_area;
                var todasLasReservas =  datosMinisterio[i].datos;

                for (var j = 0; j < todasLasReservas.length; j++){
                  // para cada reserva comprobar si sus parámetros son válidos.Si valida = true, aumenta ya el contador del área correspondiente
                  if (comprobarReservaValida(todasLasReservas[j], id_area)){
                    conteoPorArea[id_area] ++;
                  }
                }          
              }
            }
            rellenarTabla(conteoPorArea)
        })
        .catch(function (error) {
            console.log("Error al conectar con el Ministerio:", error);
        });
}

function rellenarTabla(conteoPorArea){
  // 1. Transformar el objeto en un array de especialidades con sus nombres
  var listaRanking = [];
  var posicion = 0;

  // Recorremos directamente los números de área del 1 al 18
  for (var i = 1; i <= 18; i++) {
      listaRanking.push({
          nombre_area: AREAS_MEDICAS[i], // Sacamos el nombre directamente
          total: conteoPorArea[i]        // Sacamos el total de ese número
      });
  }

  // 2. Ordenar de mayor a menor según el número total de reservas
  listaRanking.sort(function (a, b) {
      return b.total - a.total;
  });

  // 3. Buscar la tabla en el HTML y añadir las filas
  var tbody = document.getElementById("tabla-ranking");
    
  if (tbody) {
    tbody.innerHTML = ""; // Limpiar contenido antiguo si lo hubiera

    for (var i = 0; i < listaRanking.length; i++) {
      posicion ++;
      var fila = "<tr>" +
        "<td>" + posicion + "</td>" +
        "<td>" + listaRanking[i].nombre_area + "</td>" +
        "<td>" + listaRanking[i].total + "</td>" +
        "</tr>";

      tbody.innerHTML += fila;
    }
  }
}

/////////////////////////////////////////////////
// POST
/////////////////////////////////////////////////

/* ESTRUCTURA A ENVIAR
{
  "id_area": 16,
  "fecha": "2026-10-15T19:30:00.000Z",
  "datos": [
    {
      "nombre": "Laura",
      "apellidos": "Gómez",
      "categoría": "Estetoscopios",
      "horas_estimadas": 3,
      "fec_pet": "2026-10-01",
      "fec_ini": "2026-10-05",
      "fecha_fin": null
    }
  ]
}
*/

function enviarDatosAlMinisterio() {
  let reservasValidas = [];
  let peticionesPendientes = 0; // 1. Declarar aquí para que comprobarYEnviar la detecte

  api("GET", "/api/recursos", null, function(status, recursos) {
    if (status != 200 || !recursos) {
      console.log("Error cargando recursos locales");
      return;
    }

    for (let i = 0; i < recursos.length; i++) {
      // Búsqueda segura para evitar errores si mod es undefined
      let mod = modelosById[String(recursos[i].modelo)];
      let cat = mod ? categoriasById[mod.categoria] : null;
      let nombreCategoria = cat ? cat.nombre : "";

      peticionesPendientes++; // Incrementamos por la petición de reservas

      // 2. Pedir las reservas del recurso
      api("GET", "/api/recursos/" + recursos[i].id + "/reservas", null, function(status2, reservas) {
        if (status2 >= 200 && status2 < 300 && reservas && reservas.length > 0) {
          for (let j = 0; j < reservas.length; j++) {
            let r = reservas[j];

            peticionesPendientes++; // Incrementamos por la petición del sanitario

            // 3. Pedir los datos del sanitario
            api("GET", "/api/sanitarios/" + r.sanitario, null, function(status3, sanitario) {
              if (status3 == 200 && sanitario) {
                var reservaMinisterio = {
                  nombre: sanitario.nombre,
                  apellidos: sanitario.apellidos,
                  categoría: nombreCategoria,
                  horas_estimadas: Number(r.horas_estimadas),
                  fec_pet: r.fecha_peticion,                 
                  fec_ini: r.fecha_inicio || null,           
                  fecha_fin: r.fecha_fin || null
                };

                if (comprobarReservaValida(reservaMinisterio, 16)) {
                  reservasValidas.push(reservaMinisterio);
                }
              }

              peticionesPendientes--; // Descuenta la petición del sanitario
              comprobarYEnviar();
            });
          }
        }

        peticionesPendientes--; // Descuenta la petición de reservas que acaba de finalizar
        comprobarYEnviar();
      });
    }
  });

  // Comprueba si ya han respondido todas las peticiones asíncronas
  function comprobarYEnviar() {
    if (peticionesPendientes > 0) return;

    if (reservasValidas.length === 0) {
      alert("No hay reservas válidas de Psiquiatría para enviar.");
      return;
    }

    fetch("https://undefined.ua.es/telemedicina/api/datos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_area: 16,
        fecha: new Date().toISOString().substring(0, 10),
        datos: reservasValidas
      })
    })
    .then(function (respuesta) {
      if (respuesta.ok) {
        alert("¡Envío realizado con éxito al Ministerio!");
        cargarReservasMinisterio(); // Refresca la tabla del ranking
      } else {
        respuesta.text().then(function (texto) {
          console.log("Estado:", respuesta.status, "Cuerpo:", texto);
        });
        alert("El Ministerio ha rechazado el envío.");
      }
    })
    .catch(function (error) {
      console.log("Error en el envío:", error);
    });
  }
}
