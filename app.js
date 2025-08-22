const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'clave-secreta-super-compleja',
  resave: false,
  saveUninitialized: false,
}));

app.use(expressLayouts);
app.set('layout', 'layout'); // no se usa, pero no molesta

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

app.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const userId = req.session.user.id;
  db.all('SELECT * FROM medicines WHERE user_id = ?', [userId], (err, rows) => {
    if (err) return res.status(500).send('Error al obtener medicamentos');
    res.render('index', { medicines: rows });
  });
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('register', { error: 'Todos los campos son obligatorios' });
  }
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.status(500).send('Error en la base de datos');
    if (row) return res.render('register', { error: 'El usuario ya existe' });
    const hashed = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed], function (err) {
      if (err) return res.status(500).send('Error al registrar');
      req.session.user = { id: this.lastID, username };
      res.redirect('/');
    });
  });
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'Todos los campos son obligatorios' });
  }
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).send('Error en la base de datos');
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.render('login', { error: 'Usuario o contraseña incorrectos' });
    }
    req.session.user = { id: user.id, username: user.username };
    res.redirect('/');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/add', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('form', { medicine: null, action: '/add' });
});
app.post('/add', (req, res) => {
  const { name, dose, frequency } = req.body;
  if (!name || !dose || !frequency) {
    return res.status(400).send('Todos los campos son obligatorios');
  }
  const userId = req.session.user.id;
  db.run('INSERT INTO medicines (user_id, name, dose, frequency) VALUES (?, ?, ?, ?)',
    [userId, name, dose, frequency],
    (err) => {
      if (err) return res.status(500).send('Error al guardar medicamento');
      res.redirect('/');
    });
});

app.get('/edit/:id', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const id = req.params.id;
  db.get('SELECT * FROM medicines WHERE id = ? AND user_id = ?', [id, req.session.user.id], (err, row) => {
    if (err) return res.status(500).send('Error al obtener medicamento');
    if (!row) return res.status(404).send('Medicamento no encontrado');
    res.render('form', { medicine: row, action: '/edit/' + id });
  });
});
app.post('/edit/:id', (req, res) => {
  const { name, dose, frequency } = req.body;
  const id = req.params.id;
  db.run('UPDATE medicines SET name = ?, dose = ?, frequency = ? WHERE id = ? AND user_id = ?',
    [name, dose, frequency, id, req.session.user.id],
    (err) => {
      if (err) return res.status(500).send('Error al actualizar');
      res.redirect('/');
    });
});

app.post('/delete/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM medicines WHERE id = ? AND user_id = ?', [id, req.session.user.id], (err) => {
    if (err) return res.status(500).send('Error al eliminar');
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log('Servidor iniciado en http://localhost:' + PORT);
});
