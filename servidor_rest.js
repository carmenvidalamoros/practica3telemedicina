const path = require('path');

var conexion = require("./conexion_mysql.js")
var express = require("express");
var app = express();

app.use(express.json()); 

// JWT
var jwt = require('jwt-simple');
var clave = 'miSecretoMasOscuro'; // clave para codificar / decodificar el token
//

// DEJAR EL PATH?
app.use('/cliente_rest', express.static(path.join(__dirname, 'cliente_rest')));
app.use('/cliente_rpc', express.static(path.join(__dirname, 'cliente_rpc')));

// Ruta principal
app.get('/', (req, res) => {
    res.send('¡Servidor REST funcionando!');
});


// 1. Gestión de Gestores
// Login del gestor 
// PRÁCTICA 3 --> debe devolver el token, solo el login y registro usan ruta publica y las demás a que privatizarlas con verificarToken

app.post("/api/gestores/login", function(req,res){
  var usuario = req.body.usuario;
  var password = req.body.password;
  //Cargar la base de datos para comprobar gestor existe
  var sql = "SELECT * FROM gestores ";
  conexion.query(sql, function (err, gestores) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            // Recorrer la base de datos y buscar si usuario y contraseña coincide
            for(let i = 0; i<gestores.length; i++ ){
              if (gestores[i].usuario == usuario && gestores[i].password == password){
                var contenido = {
                    usuario: gestores[i].id,
                    expira: Date.now() + 60 * 60 * 1000   // 1 hora
                };
                var token = jwt.encode(contenido, clave);
                return res.status(200).json({ id: gestores[i].id, token: token });
                }
            }
            res.status(403).json("Usuario o contraseña erroneos");
        }
    });

})

// Crea un nuevo gestor 

app.post('/api/gestores', function(req, res){
  var usuario = req.body.usuario;
  var existe = false;
  var sql = "SELECT * FROM gestores";
  conexion.query(sql, function (err, gestores) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            // Recorrer la base de datos y buscar si usuario y contraseña coincide
            for(let i = 0; i<gestores.length; i++ ){
              if (gestores[i].usuario == usuario){
                console.log("Login debe ser único");
                existe = true;
                return res.status(400).json("Usuario ya existe");
              }
            }
            if (existe == false){
              var sqlInsert = "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES (?, ?, ?, ?)";
              conexion.query(sqlInsert, [req.body.nombre, req.body.apellidos, req.body.usuario, req.body.password], function (err, resultado) {
              if (err) {
                console.log("Error al realizar el insert", err);
                res.status(500).json("Error al realizar la insercion");
              } else {
                  console.log("Gestor insertado:", resultado);
                  res.status(201).json(resultado.insertId);
              }
              });
            }
          }
        });
})

function verificarToken(req, res, next) {
  var token = req.query.token;
  if (!token) {
    return res.status(401).json("No se ha encontrado token");
  }

  var contenidoToken;
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

// ---------- A PARTIR DE AQUÍ, PRIVADAS ----------
app.use("/api", verificarToken);

// Obtener datos del gestor sin contraseña 

app.get("/api/gestores/:id", function (req, res) {
    var idGestor = req.params.id;
    var sql = "SELECT * FROM gestores WHERE id = ?";
    conexion.query(sql, [idGestor], function (err, gestores) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (gestores.length === 1) {
                var datosSinPass = {id: gestores[0].id, nombre: gestores[0].nombre, apellidos: gestores[0].apellidos, usuario: gestores[0].usuario};
                console.log("Gestor:", datosSinPass);
                res.status(200).json(datosSinPass);
            } else {
                console.log("No se ha encontrado el gestor con id:", idGestor);
                res.status(404).json("No se ha encontrado el gestor");
            }
        }
    });
});

// Actualiza datos del gestor (excepto id)

app.put("/api/gestores/:id", function(req, res){
  var idGestor = req.params.id;
  var nuevoUsuario = req.body.usuario;

  // 1. Comprobar si otro gestor (con id distinto) ya tiene ese usuario
  var sqlComprobar = "SELECT * FROM gestores WHERE usuario = ? AND id != ?";

  conexion.query(sqlComprobar, [nuevoUsuario, idGestor], function (err, existentes) {
    if (err) {
      console.log("Error al comprobar el usuario", err);
      return res.status(500).json("Error al realizar la consulta");
    }

    if (existentes.length > 0) {
      console.log("Login debe ser único");
      return res.status(400).json("El usuario ya existe");
    }

    // 2. Si no hay conflicto, hacer el update
    var sql = "UPDATE gestores SET nombre = ?, apellidos = ?, usuario = ?, password = ? WHERE id = ?";

    conexion.query(sql, [req.body.nombre, req.body.apellidos, req.body.usuario, req.body.password, idGestor], function (err2, resultado) {
      if (err2) {
        console.log("Error al realizar el update", err2);
        return res.status(500).json("Error al realizar la actualización");
      }
      return res.status(200).send();
    });
  });
});

// 2. Ubicaciones, Categorías y Modelos (obtención de arrays)

app.get("/api/ubicaciones", function(req, res){
  var sql = "SELECT * FROM ubicaciones";
  conexion.query(sql, function (err, ubicaciones) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            console.log("Ubicaciones:", ubicaciones);
            res.status(200).json(ubicaciones);
        }
    });
});

app.get("/api/categorias", function(req, res){
  var sql = "SELECT * FROM categorias";
  conexion.query(sql, function (err, categorias) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            console.log("Categorias:", categorias);
            res.status(200).json(categorias);
        }
    });
});

app.get("/api/modelos", function(req, res){
  var sql = "SELECT * FROM modelos";
  conexion.query(sql, function (err, modelos) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            console.log("Modelos:", modelos);
            res.status(200).json(modelos);
        }
    });
});

app.get("/api/sanitarios", function(req, res){
  var sql = "SELECT * FROM sanitarios";
  conexion.query(sql, function (err, sanitarios) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            console.log("Sanitarios:", sanitarios);
            res.status(200).json(sanitarios);
        }
    });
});

// 3. Sanitarios 
// Obtiene objeto con datos sanitario sin codigo acceso
app.get("/api/sanitarios/:id", function(req,res){
  var idSanitario = req.params.id;
    var sql = "SELECT * FROM sanitarios WHERE id = ?";
    conexion.query(sql, [idSanitario], function (err, sanitarios) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (sanitarios.length === 1) {
                console.log("Sanitario:", sanitarios[0]);
                var datosSinPass = {id: idSanitario, nombre: sanitarios[0].nombre, apellidos: sanitarios[0].apellidos, usuario: sanitarios[0].usuario};
                res.status(200).json(datosSinPass); 
            } else {
                console.log("No se ha encontrado el sanitario con id:", idSanitario);
                res.status(404).json("No se ha encontrado el sanitario");
            }
        }
    });
})



// 4. Gestión de Recursos
// Obtener todos los recursos: cat, mod, ubi, estado
app.get("/api/recursos", function (req, res) {
    var sql = "SELECT * FROM recursos WHERE 1=1";
    var params = [];

    if (req.query.modelo && req.query.modelo !== "Todos") {
        sql += " AND modelo = ?";
        params.push(req.query.modelo);
    }
    if (req.query.categoria && req.query.categoria !== "Todos") {
        sql += " AND modelo IN (SELECT id FROM modelos WHERE categoria = ?)";
        params.push(req.query.categoria);
    }
    if (req.query.ubicacion && req.query.ubicacion !== "Todos") {
        sql += " AND ubicacion = ?";
        params.push(req.query.ubicacion);
    }
    if (req.query.estado && req.query.estado !== "Todos") {
        sql += " AND estado = ?";
        params.push(req.query.estado);
    }

    conexion.query(sql, params, function (err, recursos) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            console.log("Recursos:", recursos);
            res.status(200).json(recursos);
        }
    });
});

// Obtiene datos de un recurso 
app.get("/api/recursos/:id", function (req, res) {
    var idRecursos = req.params.id;
    var sql = "SELECT * FROM recursos WHERE id = ?";
    conexion.query(sql, [idRecursos], function (err, recursos) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (recursos.length === 1) {
                console.log("Recursos:", recursos[0]);
                res.status(200).json(recursos[0]);
            } else {
                console.log("No se ha encontrado el recurso con id:", idRecursos);
                res.status(404).json("No se ha encontrado el recurso");
            }
        }
    });
});

// Crea un recurso 
app.post("/api/recursos", function (req, res){
  var sql = "INSERT INTO recursos (modelo, ubicacion, numero_serie, estado) VALUES (?, ?, ?, ?)";
  conexion.query(sql, [req.body.modelo, req.body.ubicacion, req.body.numero_serie, req.body.estado], function (err, resultado) {
        if (err) {
            console.log("Error al realizar el insert", err);
            res.status(500).json("Error al realizar la insercion");
        } else {
            // Queremos que devuelva el recurso entero junto con el nuevo id
            var sqlId = "SELECT * FROM recursos WHERE id = ?";
            conexion.query(sqlId, [resultado.insertId], function (error, recursoCreado) {
              if (error) {
                  console.log("Error al realizar la select", error);
                  res.status(500).json("Error al realizar la consulta");
              } else {
                  console.log("Recursos:", recursoCreado[0]);
                  res.status(201).json(recursoCreado[0]);
              }
          });
        }
    });
})

// Actualizar

app.put("/api/recursos/:id", function (req, res) {
    var sql = "UPDATE recursos SET modelo = ?, ubicacion = ?, numero_serie = ?, estado = ? WHERE id = ?";
    conexion.query(sql, [req.body.modelo, req.body.ubicacion, req.body.numero_serie, req.body.estado, req.params.id], function (err, resultado) {
        if (err) {
            console.log("Error al realizar el update", err);
            res.status(500).json("Error al realizar la actualización");
        } else {
            console.log("Recurso actualizado:", resultado);
            res.status(200).json("Recurso actualizado");
        }
    });
});

// Borra un recurso

app.delete("/api/recursos/:id", function (req, res) {
    var sql = "DELETE FROM recursos WHERE id = ?";
    conexion.query(sql, [req.params.id], function (err, resultado) {
        if (err) {
            console.log("Error al realizar el delete", err);
            res.status(500).json("Error al realizar el borrado");
        } else {
            console.log("Recurso borrado:", resultado);
            res.status(200).json("Recurso eliminado");
        }
    });
});


// 5. Reservas y Reseñas 
// Obtiene las RESERVAS de un recurso
app.get("/api/recursos/:id/reservas", function (req, res) {
    var idRecurso = req.params.id;
    var sql = "SELECT * FROM reservas WHERE recurso = ?";
    conexion.query(sql, [idRecurso], function (err, reservas) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al obtener las reservas");
        } else {
            console.log("Reservas:", reservas);
            res.status(200).json(reservas);
        }
    });
});

// Obtiene las RESEÑAS de un recurso
app.get("/api/recursos/:id/resenyas", function(req, res){
  var idRecurso = req.params.id;
    var sql = "SELECT * FROM resenyas WHERE recurso = ?";
    conexion.query(sql, [idRecurso], function (err, resenyas) {
        if (err) {
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        } else {
            if (resenyas.length > 0) {
                console.log("Reseñas:", resenyas);
                res.status(200).json(resenyas); 
            } else {
                console.log("No se han encontrado reseñas para el recurso con id:", idRecurso);
                res.status(404).json("No se han encontrado reseñas para el recurso");
            }
        }
    });
})



const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor de Gestión Hospitalaria ejecutándose en http://localhost:${PORT}`);
});