const socketIo = require("socket.io");
const moment = require("moment");
const { v5: uuidv5 } = require("uuid");
let io;

socketUsers = {};

const MY_NAMESPACE = uuidv5("https://ticklab.io/", uuidv5.DNS);

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected");
    socket.on("login-user", async (userId) => {
      if (socketUsers[userId]) {
        console.log("This user already login to our platform!");
      } else {
        socket.join(userId);
        socketUsers[userId] = socket.id;
        console.log(socketUsers);
        const myDate = new Date();
        const formattedDate = myDate.toISOString();
        const my_secret_name = JSON.stringify({
          time: moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A"),
          type: "login",
          user_id: userId,
        });
        const uniqueId = uuidv5(my_secret_name, MY_NAMESPACE);
        const message =
          "You logined to our server! " +
          moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A");
        io.to(userId).emit("notification", {
          id: uniqueId,
          message: message,
          time: formattedDate,
          read: false,
          receiver_id: userId,
          type: "login",
        });
        console.log("-----------> user login " + userId);
      }
    });

    socket.on("disconnect", () => {
      console.log("disconnect", socketUsers);
      for (const userId in socketUsers) {
        if (socketUsers[userId] === socket.id) {
          console.log("----------> ", userId, " disconnected");
          delete socketUsers[userId]; // Remove the user from tracking
          break;
        }
      }
    });
  });
};

const getSocketInstance = () => {
  if (!io) {
    throw new Error("Socket not initialized!");
  }
  return io;
};

module.exports = { initSocket, getSocketInstance, socketUsers };
