const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Banco de Dados SQLite em arquivo local
const dbPath = path.resolve(__dirname, 'msn_database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Erro ao conectar ao SQLite:', err.message);
  else console.log('📦 Conectado ao banco de dados SQLite com sucesso!');
});

// Criar tabela de usuários
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT,
  status TEXT DEFAULT 'online'
)`);

// Armazenar usuários conectados por socket.id
const onlineUsers = {};

io.on('connection', (socket) => {
  console.log('🔌 Novo usuário conectado:', socket.id);

  // Cadastro de Conta
  socket.on('register', (data) => {
    const { name, email, password } = data;
    const query = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;
    db.run(query, [name, email, password], function(err) {
      if (err) {
        socket.emit('register_response', { success: false, message: 'Este e-mail já está cadastrado no banco de dados!' });
      } else {
        socket.emit('register_response', { success: true, userId: this.lastID });
      }
    });
  });

  // Login de Usuário
  socket.on('login', (data) => {
    const { email, password, status } = data;
    const query = `SELECT * FROM users WHERE email = ? AND password = ?`;
    db.get(query, [email, password], (err, row) => {
      if (row) {
        onlineUsers[socket.id] = { id: row.id, name: row.name, email: row.email, status: status || 'online' };
        socket.emit('login_response', { success: true, user: row });
        io.emit('update_contact_list', Object.values(onlineUsers));
      } else {
        socket.emit('login_response', { success: false, message: 'E-mail ou senha incorretos!' });
      }
    });
  });

  // Envio de Mensagem em Tempo Real para um contato específico
  socket.on('send_message', (data) => {
    // data: { senderEmail, receiverEmail, text, time, style }
    // Envia a mensagem para todos os sockets conectados (o cliente filtra se é para ele)
    io.emit('receive_message', data);
  });

  // Desconexão
  socket.on('disconnect', () => {
    delete onlineUsers[socket.id];
    io.emit('update_contact_list', Object.values(onlineUsers));
    console.log('❌ Usuário desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor MSN rodando na porta ${PORT}`);
});