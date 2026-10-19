const path = require('path');
const express = require("express");
const app = express();
app.use(express.json()); 

// 1. Importar e inicializar el cliente de Supabase
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://peclxhvzidsmpsnbarga.supabase.co';
const supabaseKey = 'sb_publishable_lMijzYYBb4i-UmiEuvjxKQ_dZqfMwws'; // Tu clave de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// JWT
const jwt = require('jwt-simple');
const clave = 'miSecretoMasOscuro';

// Servir archivos estáticos
app.use('/cliente_rest', express.static(path.join(__dirname, 'cliente_rest')));
app.use('/cliente_rpc', express.static(path.join(__dirname, 'cliente_rpc')));

// Ruta principal
app.get('/', (req, res) => {
    res.send('¡Servidor REST funcionando!');
});

// ---------------------------------------------------------
// 1. GESTIÓN DE GESTORES (Rutas públicas)
// ---------------------------------------------------------

// Login del gestor 
app.post("/api/gestores/login", async function(req, res){
    const usuario = req.body.usuario;
    const password = req.body.password;

    const { data: gestores, error } = await supabase
        .from('gestores')
        .select('*')
        .eq('usuario', usuario)
        .eq('password', password);

    if (error) {
        console.log("Error al realizar la consulta", error);
        return res.status(500).json("Error al realizar la consulta");
    }

    if (gestores && gestores.length > 0) {
        const contenido = {
            usuario: gestores[0].id,
            expira: Date.now() + 60 * 60 * 1000 // 1 hora
        };
        const token = jwt.encode(contenido, clave);
        return res.status(200).json({ id: gestores[0].id, token: token });
    }

    return res.status(403).json("Usuario o contraseña erroneos");
});

// Crear un nuevo gestor 
app.post('/api/gestores', async function(req, res){
    const usuario = req.body.usuario;

    // Comprobar si el usuario ya existe
    const { data: existentes, error: errorCheck } = await supabase
        .from('gestores')
        .select('*')
        .eq('usuario', usuario);

    if (errorCheck) {
        console.log("Error al consultar gestor", errorCheck);
        return res.status(500).json("Error al realizar la consulta");
    }

    if (existentes && existentes.length > 0) {
        console.log("Login debe ser único");
        return res.status(400).json("Usuario ya existe");
    }

    // Insertar nuevo gestor
    const { data, error } = await supabase
        .from('gestores')
        .insert([{
            nombre: req.body.nombre,
            apellidos: req.body.apellidos,
            usuario: req.body.usuario,
            password: req.body.password
        }])
        .select();

    if (error) {
        console.log("Error al insertar gestor", error);
        return res.status(500).json("Error al realizar la insercion");
    }

    console.log("Gestor insertado:", data[0]);
    return res.status(201).json(data[0].id);
});

// Middleware de verificación de token
function verificarToken(req, res, next) {
    const token = req.query.token;
    if (!token) {
        return res.status(401).json("No se ha encontrado token");
    }

    let contenidoToken;
    try {
        contenidoToken = jwt.decode(token, clave);
    } catch (error) {
        return res.status(401).json("El token es incorrecto");
    }

    if (!contenidoToken || !contenidoToken.expira || !contenidoToken.usuario) {
        return res.status(401).json("El formato del token no es adecuado");
    }

    if (contenidoToken.expira < Date.now()) {
        return res.status(401).json("El token ha expirado");
    }

    next();
}

// ---------------------------------------------------------
// RUTAS PRIVADAS (Requieren token)
// ---------------------------------------------------------
app.use("/api", verificarToken);

// Obtener datos del gestor sin contraseña 
app.get("/api/gestores/:id", async function (req, res) {
    const idGestor = req.params.id;

    const { data, error } = await supabase
        .from('gestores')
        .select('id, nombre, apellidos, usuario')
        .eq('id', idGestor)
        .maybeSingle();

    if (error) {
        console.log("Error al consultar gestor", error);
        return res.status(500).json("Error al realizar la consulta");
    }

    if (data) {
        return res.status(200).json(data);
    } else {
        return res.status(404).json("No se ha encontrado el gestor");
    }
});

// Actualiza datos del gestor (excepto id)
app.put("/api/gestores/:id", async function(req, res){
    const idGestor = req.params.id;
    const nuevoUsuario = req.body.usuario;

    // Comprobar si otro gestor ya usa ese nombre de usuario
    const { data: existentes, error: errCheck } = await supabase
        .from('gestores')
        .select('*')
        .eq('usuario', nuevoUsuario)
        .neq('id', idGestor);

    if (errCheck) {
        return res.status(500).json("Error al realizar la consulta");
    }

    if (existentes && existentes.length > 0) {
        return res.status(400).json("El usuario ya existe");
    }

    // Actualizar datos
    const { error } = await supabase
        .from('gestores')
        .update({
            nombre: req.body.nombre,
            apellidos: req.body.apellidos,
            usuario: req.body.usuario,
            password: req.body.password
        })
        .eq('id', idGestor);

    if (error) {
        return res.status(500).json("Error al realizar la actualización");
    }

    return res.status(200).send();
});

// ---------------------------------------------------------
// 2. TABLAS AUXILIARES (Ubicaciones, Categorías, Modelos, Sanitarios)
// ---------------------------------------------------------

app.get("/api/ubicaciones", async function(req, res){
    const { data, error } = await supabase.from('ubicaciones').select('*');
    if (error) return res.status(500).json("Error al realizar la consulta");
    return res.status(200).json(data);
});

app.get("/api/categorias", async function(req, res){
    const { data, error } = await supabase.from('categorias').select('*');
    if (error) return res.status(500).json("Error al realizar la consulta");
    return res.status(200).json(data);
});

app.get("/api/modelos", async function(req, res){
    const { data, error } = await supabase.from('modelos').select('*');
    if (error) return res.status(500).json("Error al realizar la consulta");
    return res.status(200).json(data);
});

app.get("/api/sanitarios", async function(req, res){
    const { data, error } = await supabase.from('sanitarios').select('*');
    if (error) return res.status(500).json("Error al realizar la consulta");
    return res.status(200).json(data);
});

app.get("/api/sanitarios/:id", async function(req, res){
    const idSanitario = req.params.id;
    const { data, error } = await supabase
        .from('sanitarios')
        .select('id, nombre, apellidos, usuario')
        .eq('id', idSanitario)
        .maybeSingle();

    if (error) return res.status(500).json("Error al realizar la consulta");
    if (!data) return res.status(404).json("No se ha encontrado el sanitario");

    return res.status(200).json(data);
});

// ---------------------------------------------------------
// 3. GESTIÓN DE RECURSOS
// ---------------------------------------------------------

app.get("/api/recursos", async function (req, res) {
    let query = supabase.from('recursos').select('*');

    if (req.query.modelo && req.query.modelo !== "Todos") {
        query = query.eq('modelo', req.query.modelo);
    }
    if (req.query.ubicacion && req.query.ubicacion !== "Todos") {
        query = query.eq('ubicacion', req.query.ubicacion);
    }
    if (req.query.estado && req.query.estado !== "Todos") {
        query = query.eq('estado', req.query.estado);
    }

    if (req.query.categoria && req.query.categoria !== "Todos") {
        const { data: modelosCat } = await supabase
            .from('modelos')
            .select('id')
            .eq('categoria', req.query.categoria);

        const idsModelos = modelosCat ? modelosCat.map(m => m.id) : [];
        query = query.in('modelo', idsModelos);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json("Error al realizar la consulta");

    return res.status(200).json(data);
});

app.get("/api/recursos/:id", async function (req, res) {
    const { data, error } = await supabase
        .from('recursos')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();

    if (error) return res.status(500).json("Error al realizar la consulta");
    if (!data) return res.status(404).json("No se ha encontrado el recurso");

    return res.status(200).json(data);
});

app.post("/api/recursos", async function (req, res){
    const { data, error } = await supabase
        .from('recursos')
        .insert([{
            modelo: req.body.modelo,
            ubicacion: req.body.ubicacion,
            numero_serie: req.body.numero_serie,
            estado: req.body.estado
        }])
        .select()
        .single();

    if (error) return res.status(500).json("Error al realizar la insercion");
    return res.status(201).json(data);
});

app.put("/api/recursos/:id", async function (req, res) {
    const { error } = await supabase
        .from('recursos')
        .update({
            modelo: req.body.modelo,
            ubicacion: req.body.ubicacion,
            numero_serie: req.body.numero_serie,
            estado: req.body.estado
        })
        .eq('id', req.params.id);

    if (error) return res.status(500).json("Error al realizar la actualización");
    return res.status(200).json("Recurso actualizado");
});

app.delete("/api/recursos/:id", async function (req, res) {
    const { error } = await supabase
        .from('recursos')
        .delete()
        .eq('id', req.params.id);

    if (error) return res.status(500).json("Error al realizar el borrado");
    return res.status(200).json("Recurso eliminado");
});

// ---------------------------------------------------------
// 4. RESERVAS Y RESEÑAS
// ---------------------------------------------------------

app.get("/api/recursos/:id/reservas", async function (req, res) {
    const { data, error } = await supabase
        .from('reservas')
        .select('*')
        .eq('recurso', req.params.id);

    if (error) return res.status(500).json("Error al obtener las reservas");
    return res.status(200).json(data);
});

app.get("/api/recursos/:id/resenyas", async function(req, res){
    const { data, error } = await supabase
        .from('resenyas')
        .select('*')
        .eq('recurso', req.params.id);

    if (error) return res.status(500).json("Error al realizar la consulta");
    if (!data || data.length === 0) return res.status(404).json("No se han encontrado reseñas para el recurso");

    return res.status(200).json(data);
});

// Puerto dinámico para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});
