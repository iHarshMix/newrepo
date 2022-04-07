const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const port = process.env.PORT || 3001

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on("new_visitor", user=>{
    socket.user = user;
    console.log("new visitor", user);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

});

server.listen(port, () => {
  console.log('listening on *:$port');
});

//192.168.29.56:3000

