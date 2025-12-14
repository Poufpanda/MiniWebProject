const socket = io();

//Initialisation de toutes les variables
//Var de la chatbox
var messages = document.getElementById('messages');
var formMsg = document.getElementById('msgForm');
var inputMsg = document.getElementById('msgInput');
messages.hidden=true;
formMsg.hidden=true;
inputMsg.hidden=true;

//Var du form pour le pseudo + autres
var getPseudo = document.getElementById("pseudoForm");
var pseudo = document.getElementById('nameInput');
var tab = document.getElementById("jConnectes");

var isMyTurn;

var test=document.getElementById("test");

var user="";
var numJ;
var books = [];
var listej = [];
var livre=[[[],[],[],[],[],[]],[[],[],[],[],[],[]],[[],[],[],[],[],[]],[[],[],[],[],[],[]]];

//J'avoue ça ça vient complètement de l'ia, ce que j'implementais avant ne marchait pas
const tooltip = d3.select("body")
  .append("div")
  .attr("id", "bookTooltip");

//Pour les messages
formMsg.addEventListener('submit', function(e) {
  e.preventDefault();
  if(inputMsg.value){
    socket.emit('chat message', (user + " : " + inputMsg.value));
    inputMsg.value = '';
  }
});

//Input du pseudo
getPseudo.addEventListener('submit',function(e){
  e.preventDefault();
  if(pseudo.value){
      user=pseudo.value;
      socket.emit('newU',pseudo.value);
      getPseudo.hidden=true;
      pseudo.hidden=true;
      messages.hidden=false;
      formMsg.hidden=false;
      inputMsg.hidden=false;
  }
});

//Nouveau message
socket.on('chat message', function(msg) {
  var item = document.createElement('li');
  item.textContent = msg;
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
});

//Message de connection ou de déconnection
socket.on('server message', function(msg) {
  var item = document.createElement('li');
  item.textContent = msg;
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
});

socket.on("updateListeJ",function(updatedListe) {
  listej=updatedListe;
  content="|";
  updatedListe.forEach((pseudo) => {
    if(pseudo==user){
      content+="{"+pseudo+"}|";
    }else{
    content+=pseudo + "|"
    }
  });
  tab.textContent=content;
});

//Quand on deux joueurs ou le nombre requis sont dans la partie, on crée les cases de la biblio et les livres random
socket.on('gameStart', (serverBooks) => {
  console.log("Le serveur lance la partie...");
  createLibrary();
  createBooks(serverBooks);
});

socket.on('turn', (playerName) => {
  isMyTurn = (playerName === user);
});

socket.on('updateGame',(data)=>{
  transfereBookToLibrary(data[3],data[1]);
  const livreSup=d3.select("#conveyorOverlay").selectAll("rect-book")
  .filter(function(){return d3.select(this).attr("info")===data[4]});
  const livreASup=livreSup.node()
  livreASup.remove();
  console.log("Le jeu a été mis a jour");
});

socket.on("set gagnant",function(data){
  let caseId=data[0];
  let pseudo=data[1];
  const caseASuppr=d3.select("#boxArea").selectAll(`rect.book-in-case[id="${caseId[0]}${caseId[1]}"]`)
  caseASuppr.remove();
});

socket.on("nouveauSet",function(data){
  console.log("de nouveau livres sont arrivés");
  createBooks(data);
});

socket.on("clock",function(){
  const distance=100;
  const selection=d3.selectAll("#conveyorOverlay rect.book").each(function(){
    const r=d3.select(this);
    const x=+r.attr("x"); //on met un + pour forcer le cast en int (r.attr => str)
    r.interrupt().transition().duration(200)
    .attr("x",x+distance);
  });
});

function howManyBooksInCase(caseId){
  return livre[caseId[1]][caseId[0]].length;
}

function createCase(i, j){
  const width=220;
  const height=150;
  const baseMargin=20;
  const marginBtwC=10;
  const svg=d3.select("#boxArea");
  svg.append("rect")
    .attr("x", baseMargin+marginBtwC+i*width) 
    .attr("y", baseMargin+j*height)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "white")
    .attr("stroke", "brown")
    .attr("id",`${i}${j}`)
    .attr("stroke-width", 15)
    .attr("class", "library-case")
    .on('mouseover', function(event){
      const selected = d3.select('#conveyorOverlay').select('.book.selected');
      if(selected.empty()) return;
      d3.select(this)
        .attr('fill', '#ddd');
    })
    .on('mouseout', function(event){
      d3.select(this)
        .attr('fill', 'white');
    })
    .on('click', function(event){
      const selected = d3.select('#conveyorOverlay').select('.book.selected');
      if(selected.empty()) return; 
      if(isMyTurn){
        const caseRect = d3.select(this);

        let bookId=selected.attr("id");
        let bookInfo=selected.attr("info");
        let Cid=this.id;

        const caseX = parseFloat(caseRect.attr('x'));
        const caseY = parseFloat(caseRect.attr('y'));
        const caseW = parseFloat(caseRect.attr('width'));
        const caseH = parseFloat(caseRect.attr('height'));

        const bookW = parseFloat(selected.attr('width'));
        const bookH = parseFloat(selected.attr('height'));

        const newX = caseX + 40 * howManyBooksInCase(Cid) + 10; //40: taille max d'un livre, 10: base margin, caseX: coordonnée X de la case 
        const newY = caseY + caseH - bookH - 8; //caseY bon bah voila, caseH - bookH: sans ça les livres c'est batman (j'arrive plus a expliquer dsl)

        let memory=[newX,newY,bookW,bookH,bookInfo,bookId];//tout ce qu'on va envoyer au serveur, on devrait pouvoir réutiliser selected parce que tous les clients doivent être exactement pareils avant cette update (dcp on devrait pouvoir faire selected.remove() pour enlever le livre des autres clients)
        selected.remove();
        transfereBookToLibrary(memory,Cid);
        socket.emit("livreAjouté",[livre,Cid,user,memory]);
      }
      else{
        socket.emit("server message","Ce n'est pas votre tour");
      }
    });
}

function createLibrary(){
  for (let i = 0; i<6; i++){
    for(let j = 0; j<4; j++){
      createCase(i,j);
    }
  }
}

function transfereBookToLibrary(data,id){
  let newX = data[0],newY = data[1],bookW = data[2],bookH = data[3],bookInfo = data[4],bookId=data[5];
  const nvLire = d3.select("#boxArea").append("rect")
    .attr("id",bookId)
    .attr("x", newX)
    .attr("y", newY)
    .attr("width", bookW)
    .attr("height", bookH)
    .attr("fill", "white")
    .attr("stroke", "blue")
    .attr("stroke-width", 2)
    .attr("class", "book-in-case")
    .attr("info", bookInfo);

    let bookInfoSplit=bookInfo.split(",");
    nvLire.on("mouseover", function(event) {
    const mouseOvered = d3.select(this);
    if(!mouseOvered.classed('selected')) mouseOvered.attr("fill", "#ffebc2");
    tooltip.style("display", "block").html(`<strong>${bookInfoSplit[0]}</strong><br>${bookInfoSplit[1]}<br>${bookInfoSplit[2]}`);
  })
    .on("mousemove", function(event) {
    tooltip.style("left", (event.pageX + 10) + "px")
      .style("top",  (event.pageY + 10) + "px");
  })
  .on("mouseout", function() {
    const mouseOut = d3.select(this);
    if(!mouseOut.classed('selected')) mouseOut.attr("fill", "white");
    tooltip.style("display", "none");
  });

  livre[id[1]][id[0]].push(bookInfo);
  const livreP=d3.select(`#conveyorOverlay rect.book[id="${bookId}"]`);
  if(livreP!=null){
    livreP.remove();
  }
}

function createBooks(bookList){
  console.log("creating the books...");
  formatInv=0;
  let id=0
  formatInv+=createBook(bookList[0],0,formatInv,id);
  id++;
  formatInv+=createBook(bookList[1],1,formatInv,id);
  id++;
  formatInv+=createBook(bookList[2],2,formatInv,id);
  id++;
  formatInv+=createBook(bookList[3],3,formatInv,id);
  id++;
  createBook(bookList[4],4,formatInv,id);
}

function createBook(livre,i,formatInv,id){
  let heightbook={"poche":50,"medium":70,"grand":100,"maxi":130};
  let widthbook={"poche":10,"medium":17,"grand":25,"maxi":40};
  const svg=d3.select("#conveyorOverlay");

  const format = livre.format;
  const w = widthbook[format];
  const h = heightbook[format];
  const startX = formatInv + 3;
  const startY = 142 - h;

  const rect = svg.append("rect")
    .attr("id", id)
    .attr("x", startX)
    .attr("y", startY)
    .attr("width", w)
    .attr("height", h)
    .attr("fill", "white")
    .attr("stroke", "blue")
    .attr("stroke-width", 2)
    .attr("class", "book")
    .attr("info", [livre.titre, livre.auteur, livre.genre, livre.littérature || "non défini"]);

  rect.on("mouseover", function(event) {
      const mouseOvered = d3.select(this);
      if(!mouseOvered.classed('selected')) mouseOvered.attr("fill", "#ffebc2");
      tooltip.style("display", "block").html(`<strong>${livre.titre}</strong><br>${livre.auteur}<br>${livre.genre}`);
    })
    .on("mousemove", function(event) {
      tooltip.style("left", (event.pageX + 10) + "px")
        .style("top",  (event.pageY + 10) + "px");
    })
    .on("mouseout", function() {
      const mouseOut = d3.select(this);
      if(!mouseOut.classed('selected')) mouseOut.attr("fill", "white");
      tooltip.style("display", "none");
    });

  rect.on('click', function(event){
    const clicked = d3.select(this);
    const selected = clicked.classed('selected');
    if(!selected){
      d3.selectAll('#conveyorOverlay .book')
        .classed('selected', false)
        .attr('fill', 'white');
      clicked.classed('selected', true)
        .attr('fill', 'red');
    } else {
      clicked.classed('selected', false)
        .attr('fill', 'white');
    }
  });
  return w + 3;
}

