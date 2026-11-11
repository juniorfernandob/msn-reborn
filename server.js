const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Simulação de banco de dados em memória
const usersDB = [];
const connectedUsers = new Map(); // socket.id -> dados do usuário

io.on('connection', (socket) => {
  console.log('Novo usuário conectado:', socket.id);

  // Cadastro de nova conta
  socket.on('register', (data) => {
    const { name, email, password } = data;
    const exists = usersDB.find(u => u.email === email);
    if (exists) {
      socket.emit('register_response', { success: false, message: 'Este e-mail já está cadastrado!' });
    } else {
      usersDB.push({ name, email, password });
      socket.emit('register_response', { success: true });
    }
  });

  // Login
  socket.on('login', (data) => {
    const { email, password, status } = data;
    const user = usersDB.find(u => u.email === email && u.password === password);
    if (user) {
      const userData = {
        name: user.name,
        email: user.email,
        status: status || 'online',
        subnick: '',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
      };

      connectedUsers.set(socket.id, userData);
      socket.join(email); // Entra na sua própria sala privada

      socket.emit('login_response', { success: true, user: userData });

      // Atualiza a lista para todos
      io.emit('update_contact_list', Array.from(connectedUsers.values()));
    } else {
      socket.emit('login_response', { success: false, message: 'E-mail ou senha incorretos!' });
    }
  });

  // Atualização de Perfil (Status, Nome, Subnick, Avatar) em tempo real
  socket.on('update_profile', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      user.name = data.name !== undefined ? data.name : user.name;
      user.status = data.status !== undefined ? data.status : user.status;
      user.subnick = data.subnick !== undefined ? data.subnick : user.subnick;
      user.avatar = data.avatar !== undefined ? data.avatar : user.avatar;

      // Envia a lista atualizada para absolutamente todos os conectados instantaneamente
      io.emit('update_contact_list', Array.from(connectedUsers.values()));
    }
  });

  // Envio de mensagens em tempo real entre salas/usuários
  socket.on('send_message', (data) => {
    const { senderEmail, receiverEmail, text, time, style, isNudge } = data;

    const messagePayload = {
      senderEmail,
      senderName: data.senderName,
      receiverEmail,
      text,
      time,
      style,
      isNudge
    };

    // Envia para a sala do destinatário e para a sala do remetente (para sincronizar as janelas)
    io.to(receiverEmail).to(senderEmail).emit('receive_message', messagePayload);
  });

  // Desconexão
  socket.on('disconnect', () => {
    console.log('Usuário desconectado:', socket.id);
    connectedUsers.delete(socket.id);
    io.emit('update_contact_list', Array.from(connectedUsers.values()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});