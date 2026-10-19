// Servidor WebSocket para el sistema de avisos en tiempo real
const { WebSocketServer } = require('ws');
var conexionBD = require('./conexion_mysql.js'); // conexión a la base de datos

// Crear el servidor WebSocket en el puerto 3502
const wss = new WebSocketServer({ port: 3502 });

// Cada cliente conectado tendrá guardado:
// ws.tipo -> tipo del mensaje
// ws.rol -> "sanitario" o "gestor"
// ws.id -> id del usuario logueado

wss.on('connection', function(ws) {
    console.log('Nuevo cliente WebSocket conectado');

    // Cuando llega un mensaje de un cliente
    ws.on('message', function(mensaje) {
        // Los mensajes viajan como texto JSON, hay que parsearlos
        var datos_msg = JSON.parse(mensaje);
        var tipo = datos_msg.tipo;

        // ── REGISTRO ──────────────────────────────────────────────────
        // El cliente se identifica nada más conectarse (tras el login)
        // Ejemplo de mensaje: { tipo: "registro", rol: "sanitario", id: 1 }
        if (tipo === 'registro') {
            ws.rol = datos_msg.rol;  // "sanitario" o "gestor"
            ws.id  = datos_msg.id;
            console.log('Cliente registrado:', ws.rol, ws.id);
        }

        // ── AVISO ROJO: reserva iniciada o finalizada ─────────────────
        // Lo envía el SANITARIO cuando inicia o finaliza una reserva
        // Destinatarios: sanitarios que tengan reserva activa del mismo recurso
        else if (tipo === 'aviso_reserva') {
            var idRecurso = datos_msg.idRecurso;
            var texto = 'SE HA ' + datos_msg.accion + ' LA RESERVA DEL ' +
                        datos_msg.nombreCategoria.toUpperCase() + ' MODELO ' +
                        datos_msg.nombreModelo.toUpperCase() + ' CON CÓDIGO ' +
                        datos_msg.numSerie;

            // Buscar qué sanitarios tienen reserva activa (no finalizada) de ese recurso
            conexionBD.query("SELECT sanitario FROM reservas WHERE fecha_inicio IS NOT NULL AND fecha_fin IS NULL AND recurso = " + idRecurso, function(err, reservas){
                if (err){
                    console.log("Error al consultar reservas activas en BD:", err);
                    return;
                }

                // Extraer los IDs de los sanitarios afectados
                var sanitariosAfectados = [];
                for (var i = 0; i < reservas.length; i++) {
                    sanitariosAfectados.push(reservas[i].sanitario);
                }

                // Preparar el aviso en formato JSON
                var avisoRojo = JSON.stringify({
                    color:  'rojo',
                    fecha:  new Date().toLocaleString('es-ES'),
                    origen: datos_msg.origen,
                    texto:  texto
                });

                // Enviar el aviso SOLO a los sanitarios conectados afectados
                wss.clients.forEach(function(cliente) {
                    if (cliente.rol === 'sanitario' &&
                        cliente.id != datos_msg.idSanitario &&
                        sanitariosAfectados.includes(cliente.id) &&
                        cliente.readyState === 1) {  // 1 = OPEN
                        cliente.send(avisoRojo);
                    }
                });
            });
        }

        // ── AVISO AZUL: nuevo recurso creado ──────────────────────────
        // Lo envía el GESTOR cuando crea un recurso nuevo
        // Destinatarios: TODOS los sanitarios conectados
        else if (tipo === 'aviso_recurso') {
            var texto = 'SE HA CREADO UN NUEVO RECURSO ' +
                        datos_msg.nombreCategoria.toUpperCase() + ' MODELO ' +
                        datos_msg.nombreModelo.toUpperCase() + ' CON CÓDIGO ' +
                        datos_msg.numSerie;

            var avisoAzul = JSON.stringify({
                color:  'azul',
                fecha:  new Date().toLocaleString('es-ES'),
                origen: datos_msg.origen,
                texto:  texto
            });

            // Enviar a TODOS los sanitarios conectados
            wss.clients.forEach(function(cliente) {
                if (cliente.rol === 'sanitario' && cliente.readyState === 1) {
                    cliente.send(avisoAzul);
                }
            });
        }

        // ── AVISO VERDE: nueva reseña creada ──────────────────────────
        // Lo envía el SANITARIO cuando escribe una reseña
        // Destinatarios: TODOS los gestores conectados
        else if (tipo === 'aviso_resenya') {
            var texto = 'SE HA CREADO UNA RESEÑA PARA EL ' +
                        datos_msg.nombreCategoria.toUpperCase() + ' MODELO ' +
                        datos_msg.nombreModelo.toUpperCase() + ' CON CÓDIGO ' +
                        datos_msg.numSerie + ' Y PUNTUACIÓN ' + datos_msg.puntuacion;

            var avisoVerde = JSON.stringify({
                color:  'verde',
                fecha:  new Date().toLocaleString('es-ES'),
                origen: datos_msg.origen,
                texto:  texto
            });

            // Enviar a TODOS los gestores conectados
            wss.clients.forEach(function(cliente) {
                if (cliente.rol === 'gestor' && cliente.readyState === 1) {
                    cliente.send(avisoVerde);
                }
            });
        }
    });

    ws.on('close', function() {
        console.log('Cliente WebSocket desconectado:', ws.rol, ws.id);
    });

    ws.on('error', function(error) {
        console.error('Error en WebSocket:', error);
    });
});

console.log('Servidor WebSocket escuchando en ws://localhost:3502');

module.exports = wss;
