import express from 'express';
import { createServer } from 'http';
import{ Server } from 'socket.io';
import cors from 'cors'
import { simulateSingleMatch } from './simulate.js';

const app = express();

app.use(cors());

const httpServer = createServer(app);


const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173" 
  }
});


// --- NEW: DUMMY PLAYER POOL ---
const PLAYER_POOL = [
  // Batters (BAT)
  { id: 'p1', name: 'V. Kohli', role: 'BAT', avg: 52.7, sr: 137.9 },
  { id: 'p2', name: 'R. Sharma', role: 'BAT', avg: 31.3, sr: 139.2 },
  { id: 'p3', name: 'K. Williamson', role: 'BAT', avg: 33.3, sr: 123.0 },
  { id: 'p4', name: 'S. Smith', role: 'BAT', avg: 25.2, sr: 125.4 },
  { id: 'p5', name: 'B. Azam', role: 'BAT', avg: 41.5, sr: 128.4 },
  { id: 'p6', name: 'D. Warner', role: 'BAT', avg: 32.8, sr: 141.3 },
  { id: 'p7', name: 'S. Yadav', role: 'BAT', avg: 43.3, sr: 171.5 },
  
  // Wicket-Keepers (WK)
  { id: 'p8', name: 'M. Dhoni', role: 'WK', avg: 37.6, sr: 126.1 },
  { id: 'p9', name: 'J. Buttler', role: 'WK', avg: 34.8, sr: 144.6 },
  { id: 'p10', name: 'Q. de Kock', role: 'WK', avg: 32.5, sr: 137.3 },
  { id: 'p11', name: 'M. Rizwan', role: 'WK', avg: 49.0, sr: 127.3 },
  { id: 'p12', name: 'K. Rahul', role: 'WK', avg: 37.7, sr: 139.1 },

  // All-Rounders (ALL)
  { id: 'p13', name: 'B. Stokes', role: 'ALL', avg: 28.3, sr: 128.0 },
  { id: 'p14', name: 'R. Jadeja', role: 'ALL', avg: 24.5, sr: 125.1 },
  { id: 'p15', name: 'S. Al Hasan', role: 'ALL', avg: 23.8, sr: 122.4 },
  { id: 'p16', name: 'H. Pandya', role: 'ALL', avg: 25.4, sr: 139.8 },
  { id: 'p17', name: 'G. Maxwell', role: 'ALL', avg: 28.5, sr: 153.1 },
  { id: 'p18', name: 'M. Ali', role: 'ALL', avg: 22.3, sr: 143.5 },

  // Bowlers (BOWL)
  { id: 'p19', name: 'J. Bumrah', role: 'BOWL', avg: 19.6, sr: 17.5 }, // For bowlers, lower avg is better
  { id: 'p20', name: 'R. Khan', role: 'BOWL', avg: 14.8, sr: 14.3 },
  { id: 'p21', name: 'T. Boult', role: 'BOWL', avg: 22.2, sr: 16.9 },
  { id: 'p22', name: 'M. Starc', role: 'BOWL', avg: 22.9, sr: 18.2 },
  { id: 'p23', name: 'K. Rabada', role: 'BOWL', avg: 29.8, sr: 21.0 },
  { id: 'p24', name: 'S. Afridi', role: 'BOWL', avg: 22.7, sr: 17.7 }
];

const rooms = {};

io.on('connection', (socket) => {
  console.log(`🟢 User connected! Socket ID: ${socket.id}`);

  socket.on('create_room', () => {
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    rooms[roomCode] = { 
      players: [socket.id],
      turn: 0, // Index of the player whose turn it is (0 or 1)
      pool: [...PLAYER_POOL], // Copy the master list
      picks: { [socket.id]: [] } // Track this player's picks
    };
    
    socket.join(roomCode);
    socket.emit('room_created', roomCode);

    console.log(`🏠 Room ${roomCode} created by ${socket.id}`);
  });

  socket.on('join_room', (roomCode) => {
    // Bouncer Check
    if (!rooms[roomCode]) {
      return socket.emit('room_error', 'Room does not exist!');
    }
    if (rooms[roomCode].players.length >= 2) {
      return socket.emit('room_error', 'Room is full!');
    }

    // Pass: Add them to the room
    rooms[roomCode].players.push(socket.id);
    rooms[roomCode].picks[socket.id] = [];
    socket.join(roomCode);
    
    socket.emit('room_joined', roomCode);
    console.log(`👋 User ${socket.id} joined Room ${roomCode}`);

    // Announce to BOTH players in the room that the game can start
    io.to(roomCode).emit('game_ready', rooms[roomCode]);
  });


  socket.on('pick_player', ({ roomCode, playerId }) => {
    const room = rooms[roomCode];
    if (!room) return;

    // Validation 1: Is it this user's turn?
    const myIndex = room.players.indexOf(socket.id);
    if (myIndex !== room.turn) {
      return socket.emit('room_error', 'Not your turn!');
    }

    // Validation 2: Is the player still in the pool?
    const playerIndex = room.pool.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return socket.emit('room_error', 'Player already taken!');
    }

    // The Pick: Remove from pool, add to user's picks
    const [draftedPlayer] = room.pool.splice(playerIndex, 1);
    room.picks[socket.id].push(draftedPlayer);
    room.turn = room.turn === 0 ? 1 : 0;

    io.to(roomCode).emit('gameState_update', room);

    const SQUAD_SIZE = 7;
    const bothDone = room.players.every(id => room.picks[id].length >= SQUAD_SIZE);
    
    if (bothDone) {
      room.status = 'simulating';
      io.to(roomCode).emit('draft_complete'); // Tell the frontend to switch to the Live UI
      
      console.log(`🏟️ Draft complete in Room ${roomCode}. Starting live broadcast...`);

      const player1Id = room.players[0];
      const player2Id = room.players[1];

      // 1. Calculate the entire match instantly in memory
      const p1Match = simulateSingleMatch(room.picks[player1Id]);
      const p2Match = simulateSingleMatch(room.picks[player2Id]);

      // 2. Play back the tape using an async interval
      let currentStep = 0;
      const maxSteps = Math.max(p1Match.timeline.length, p2Match.timeline.length);

      const liveInterval = setInterval(() => {
        // Get the current snapshot (or the final snapshot if this team finished batting early)
        const p1Current = p1Match.timeline[Math.min(currentStep, p1Match.timeline.length - 1)];
        const p2Current = p2Match.timeline[Math.min(currentStep, p2Match.timeline.length - 1)];

        io.to(roomCode).emit('live_score_update', {
          [player1Id]: p1Current,
          [player2Id]: p2Current
        });

        currentStep++;

        // 3. End the match when the tape is fully played
        if (currentStep >= maxSteps) {
          clearInterval(liveInterval); // Stop the loop
          
          let winner = 'Tie';
          if (p1Match.finalRuns > p2Match.finalRuns) winner = player1Id;
          if (p2Match.finalRuns > p1Match.finalRuns) winner = player2Id;

          io.to(roomCode).emit('match_finished', {
            winner: winner,
            [player1Id]: p1Match,
            [player2Id]: p2Match
          });
          
          room.status = 'done';
        }
      }, 1000); // 1000ms = 1 second delay between each over

      return;
    }
    
    io.to(roomCode).emit('gameState_update', room);
  });

  // Listen for the goodbye
  socket.on('disconnect', () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
      for (const [code, room] of Object.entries(rooms)) {
      if (room.players.includes(socket.id)) {
        io.to(code).emit('opponent_left');
        delete rooms[code]; // simplest fix for now — just kill the room
      }
  }
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Server is running and listening on http://localhost:${PORT}`);

});