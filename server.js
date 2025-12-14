const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
// const io = new require("socket.io")(server);
const { Server } = require('socket.io');
const io = new Server(server);
const fs = require('fs');
const path = require('path');
const { countReset } = require('console');

var joueurs = {};
var listeJ=[];
var listePoint=[];
var jMax = 2;
let nbConnecte = 0;
let token = 0;
var listePoint;
var clock=0;
var isRunning = false;
var livre=[[[],[],[],[],[],[]],
           [[],[],[],[],[],[]],
           [[],[],[],[],[],[]],
           [[],[],[],[],[],[]]];

const PORT = 8080;

//servir les fichiers statiques (index.html, script.js, books.json, etc.)
app.use(express.static(__dirname));

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

app.get('/', (request, response) => {
    response.sendFile('index.html', {root: __dirname});
});

//Load books.json
const booksPath = path.join(__dirname, 'books.json');
var books = [];
try {
  books = JSON.parse(fs.readFileSync(booksPath, 'utf8'));
} catch (err) {
  console.error('Impossible de charger books.json:', err.message);
}
console.log("Books loaded.");

//Permet de d'utiliser le format du livre:

function randomBooks(books){
  let choisis=[];
  let max=books.length;
  for(let i=0;i<5;i++){
    choisis[i]=books[Math.floor(Math.random() * max)];
  }
  return choisis;
}

function countIfEnough(l){
  let v={};
  l.forEach(val=>{
    if(v[val]){
      v[val]++;
      if(v[val]==2){
        return val;
      }
    }
    else{
    	v[val]=1;
    }
  });
  return false;
}

function checkIfCollection(caseId,pseudo){
  let caseEnVerif=livre[caseId[1]][caseId[0]];
  if(caseEnVerif.length>=1){
    let genre=[];
    let auteur=[];
    caseEnVerif.forEach(l => {
      const bookInfo=l.split(",");
      genre.push(bookInfo[2]);
      auteur.push(bookInfo[1]);
    });
    let t1=countIfEnough(genre);
    let t2=countIfEnough(auteur);
    if(t1 || t2){
      listePoint[pseudo]++;
      io.emit("set gagnant",(caseId,pseudo));
      io.emit("server message", "Un set a été complété par : " + pseudo +" !");
    }
  }
}

//------------------------------------------------------------------------------------------------

io.on('connection', (socket) => {
  socket.on('newU',pseudo=>{
    joueurs[socket.id]=pseudo;
    io.emit('server message',(pseudo + " s'est connecté !"));
    listeJ.push(pseudo);
    io.emit('updateListeJ',listeJ);
    nbConnecte++;
    if(nbConnecte==jMax){
      console.log("Game starting...");
      jeton = 0;
      listeJ.forEach(pseudo => {
        listePoint[pseudo]=0;
      });
      io.emit("turn",listeJ[token]);
      io.emit("gameStart", randomBooks(books));
      isRunning=true;
      io.emit("server message","Au tour de " + listeJ[token]);
    }
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  socket.on("livreAjouté",(data)=>{
    if(isRunning && data[2]==listeJ[token]){
      socket.broadcast.emit("updateGame",data);
      livre=data[0];
      if(token<listeJ.length-1){
        token++;
      }else{
        token=0;
      }
      io.emit("clock");
      clock++;
      if((clock%3)==0){
        io.emit("nouveauSet",randomBooks(books));
      }
      checkIfCollection(data[1],data[2]);
      io.emit("turn",listeJ[token]);
      io.emit("updateGame",data);
      io.emit("server message", "Au tour de " + listeJ[token]);
    }else{
      socket.emit("server message","Ce n'est pas votre tour...");
    }
  });

  socket.on("server message",data=>{
    socket.emit("server message",data);
  });

  socket.on('updateListeJ', pseudo=>{
    joueurs[socket.id] = pseudo;
  });

    socket.on('disconnect', () => {
    const pseudo = joueurs[socket.id];
    listeJ.splice(listeJ.indexOf(pseudo),1);
    if(pseudo){
      if(isRunning){
        isRunning=false;
        io.emit("gameStop");
      }
      delete joueurs[socket.id];
      io.emit('server message', `${pseudo} s'est déconnecté.`);
      io.emit('updateListeJ',listeJ);
    }
    nbConnecte--;
    return;
  });
});
