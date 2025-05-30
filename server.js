const express = require('express');
const cors = require('cors');
const socketIo = require('socket.io');
const app = express();
const port = 7410;
const path = require('path');

app.get('/sitemap.xml', (req, res) => {
    res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

app.use(cors({ origin: '*' }));
app.use(express.static(__dirname + '/public'));

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server started at http://192.168.29.56:${port}`);
});

const io = socketIo(server);

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('offer', (offer) => {
        socket.broadcast.emit('offer', offer);
    });

    socket.on('answer', (answer) => {
        socket.broadcast.emit('answer', answer);
    });

    socket.on('ice-candidate', (candidate) => {
        socket.broadcast.emit('ice-candidate', candidate);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});
