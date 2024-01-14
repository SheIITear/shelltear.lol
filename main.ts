import { createServer, IncomingMessage, ServerResponse } from "http";
import { WebSocket, Socket } from "./websocket";
import { readFileSync } from "fs";
import * as crypto from "crypto";

// yes im reading them into memory, you read that correct
const cat = readFileSync("./ui/cat").toString();
const options = readFileSync("./ui/options").toString();
const sleepy = readFileSync("./ui/sleepy").toString();
const leaving = readFileSync("./ui/leaving").toString();
const homepage = readFileSync("./ui/index.html");

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.write(homepage);
  res.end(); // otherwise the site will keep loading
});

server.on("upgrade", (req: IncomingMessage, socket: Socket) => {
  if (req.headers["upgrade"] !== "websocket") {
    socket.end("HTTP/1.1 400 Bad Request");
    return;
  }

  const key = req.headers["sec-websocket-key"] as string;
  const acceptKey = crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11", "binary")
    .digest("base64");

  socket.write("HTTP/1.1 101 Switching Protocols\r\n");
  socket.write("Upgrade: websocket\r\n");
  socket.write("Connection: Upgrade\r\n");
  socket.write(`Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`);

  const webSocket = new WebSocket(socket);

  webSocket.send(cat);
  webSocket.send(options);

  webSocket.on("message", (message: any) => {
    let resp;
    if (message.length > 10) {
      return webSocket.send(sleepy); // message too long, as we only expect a number. more longer messages are
                                     // handled in websocket implementation
    }
    const selection = parseInt(message);
    // yes im also using a switch case to handle then
    switch (selection) {
      case 1:
        resp =
          "Hello, my name is ShellTear. I am 20 yo guy from Finland.\n" +
          "I can speak Finnish, English and Japanese.\n" +
          "You can find more about me by choosing 2.\n";
        break;
      case 2:
        resp =
          "\nThis is a websocket server written mostly from scratch using nodejs.\n" +
          "I am not good at UI/UX so please bear with me.\n";
        break;
      case 3:
        resp =
          "\nI am self-taught 'developer' who mostly uses go and nodejs.\n" +
          "My strong suits are backend stuff and cybersecurity.\n" +
          "I have mostly focused on reversing and finding vulnerabilities on open source code " +
          "and writing small stuff like this server.\n" +
          "I am currently pursuing BEng ICT degree and my goal is to move to Japan after " +
          "graduation to pursue a career in cybersecurity, ideally as a red teamer.\n";
        break;
      case 4:
        resp =
          "\nYou can contact me at:\n" +
          "  * Whatsapp -> https://wa.me/358417540210\n" +
          "  * Discord -> @sheiitear\n" +
          "  * Github -> https://github.com/SheIITear\n";
        break;
      case 5:
        webSocket.send(leaving);
        socket.end(); // maybe add a message that says disconnected?
        return;
      default:
        resp = "\nYou shouldn't be here.\n"; // just a placeholder
    }
    webSocket.send(resp);
    webSocket.send(options);
  });

  webSocket.on("close", () => {
    console.log("Client disconnected");
  });

  socket.on("error", () => null);
});

server.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
