const express = require("express");
const app = express();
const server = require('http').createServer(app);
const port = process.env.PORT || process.env.NODE_PORT || 3000;

app.use(express.static("public"));

app.get('/', (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

server.listen(port, () => {
  console.log(`Listening on ${port}`);
});