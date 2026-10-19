// Servidor WebSocket para el sistema de avisos en tiempo real
const { WebSocketServer } = require('ws');

// 1. Importar el cliente de Supabase
const { createClient } = require('@supabase/supabase-js');

// 2. Configurar con tu URL y tu Public Key (anon key)
const supabaseUrl = 'https://peclxhvzidsmpsnbarga.supabase.co';
const supabaseKey = 'sb_publishable_lMijzYYBb4i-UmiEuvjxKQ_dZqfMwws';
const supabase = createClient(supabaseUrl, supabaseKey);

// Puerto dinámico para Render o 3502 por defecto en local
const PORT = process.env.PORT || 3502;
const wss = new WebSocketServer({ port: PORT });

// Cada cliente conectado tendrá guardado:
// ws.tipo -> tipo del mensaje
// ws.rol -> "sanitario" o "gestor"
// ws.id -> id del usuario logueado

wss.on('connection', function(ws) {
    console.log('Nuevo cliente WebSocket conectado');

    // Cuando llega un mensaje de un cliente
    ws.on('message', async function(mensaje) {
        let datos_msg;
        try {
            datos_msg = JSON.parse(mensaje);
        } catch (e) {
            console.error('Error al decodificar mensaje JSON:', e);
            return;
        }

        var tipo = datos_msg.tipo;

        // ── REGISTRO ──────────────────────────────────────────────────
        if (tipo === 'registro') {
            ws.rol = datos_msg.rol;  // "sanitario" o "gestor"
            ws.id  = datos_msg.id;
            console.log('Cliente registrado:', ws.rol, ws.id);
        }

        // ── AVISO ROJO: reserva iniciada o finalizada ─────────────────
        else if (tipo === 'aviso_reserva') {
            var idRecurso = datos_msg.idRecurso;
            var texto = 'SE HA ' + datos_msg.accion + ' LA RESERVA DEL ' +
                        datos_msg.nombreCategoria.toUpperCase() + ' MODELO ' +
                        datos_msg.nombreModelo.toUpperCase() + ' CON CÓDIGO ' +
                        datos_msg.numSerie;

            // Consultar con Supabase las reservas activas del recurso
            const { data: reservas, error: err } = await supabase
                .from('reservas')
                .select('sanitario')
                .not('fecha_inicio', 'is', null)
                .is('fecha_fin', null)
                .eq('recurso', idRecurso);

            if (err) {
                console.log("Error al consultar reservas activas en Supabase:", err);
                return;
            }

            // Extraer los IDs de los sanitarios afectados
            var sanitariosAfectados = (reservas || []).map(r => r.sanitario);

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
        }

        // ── AVISO AZUL: nuevo recurso creado ──────────────────────────
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

console.log(`Servidor WebSocket escuchando en el puerto ${PORT}`);

module.exports = wss;
