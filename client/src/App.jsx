import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('https://best-seven.onrender.com');

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  
  // New state variables for the lobby
  const [roomCode, setRoomCode] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [gameStatus, setGameStatus] = useState('lobby'); // lobby -> waiting -> ready
  const [errorMessage, setErrorMessage] = useState('');
  const [gameState, setGameState] = useState(null);
  const [liveScore, setLiveScore] = useState(null); // Tracks the interval updates
  const [matchResult, setMatchResult] = useState(null); // Tracks the final winner
  const [timeLeft, setTimeLeft] = useState(20);
  

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // --- NEW: LISTEN FOR ROOM EVENTS ---
    
    socket.on('room_created', (code) => {
      setRoomCode(code);
      setGameStatus('waiting');
      setErrorMessage('');
    });

    socket.on('room_joined', (code) => {
      setRoomCode(code);
      setErrorMessage('');
    });

    socket.on('game_ready', (initialState) => {
      setGameState(initialState);
      setGameStatus('drafting');
    });

    socket.on('gameState_update', (newState) => {
      setGameState(newState);
      setErrorMessage('');
    });

    socket.on('timer_update', (time) => {
      setTimeLeft(time);
    });

    socket.on('room_error', (msg) => {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 3000);
    });

    socket.on('draft_complete', () => {
      setGameStatus('simulating');
    });

    socket.on('opponent_left', () => {
      setErrorMessage("Opponent disconnected. The room was closed."); 
      setGameStatus('lobby'); 
      setGameState(null);
    });
    socket.on('live_score_update', (scores) => {
      setLiveScore(scores);
    });

    socket.on('match_finished', (finalData) => {
      setMatchResult(finalData);
      setGameStatus('finished');
    });

  

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('game_ready');
      socket.off('room_error');
      socket.off('timer_update');
      socket.off('draft_complete');
      socket.off('opponent_left');
      socket.off('live_score_update');
      socket.off('match_finished');
    };
  }, []);

  // Action functions
  const handleCreateRoom = () => {
    socket.emit('create_room');
  };

  const handleJoinRoom = () => {
    if (joinInput.length > 0) {
      socket.emit('join_room', joinInput);
    }
  };

  const handlePickPlayer = (playerId) => {
    socket.emit('pick_player', { roomCode, playerId });
  };


  // Determine if it is currently this client's turn
  const myIndex = gameState?.players.indexOf(socket.id);
  const isMyTurn = gameState && myIndex === gameState.turn;
  const myTeam = gameState?.picks[socket.id] || [];
  const opponentId = gameState?.players.find(id => id !== socket.id);
  const opponentTeam = opponentId && gameState ? gameState.picks[opponentId] : [];

  return (
      <div className="app-shell">
      <h1 className="app-title">BE&T SEVEN</h1>
      <p className="app-subtitle">
        {isConnected ? 'Draft your SEVEN, then watch it play out live' : 'Connecting…'}
      </p>

      <div className="app-content">
        
        {/* --- LOBBY VIEW --- */}
        {gameStatus === 'lobby' && (
          <div className="card lobby-card">
            <button className="btn btn-primary" onClick={handleCreateRoom}>
              Create room
            </button>
            <div className="divider-label">or</div>
            <div className="join-row">
              <input
                className="text-input"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="Enter 4-digit code"
              />
              <button className="btn btn-secondary" onClick={handleJoinRoom}>
                Join
              </button>
            </div>
            {errorMessage && <p className="error-banner">{errorMessage}</p>}
          </div>
        )}

        {/* --- WAITING VIEW --- */}
        {gameStatus === 'waiting' && (
          <div className="card waiting-card">
            <p className="waiting-hint">Room created</p>
            <div className="room-code">{roomCode}</div>
            <p className="waiting-hint">
              Share this code with a friend
              <br />
              Waiting for player 2
              <span style={{ marginLeft: 8 }}>
                <span className="spinner-dot" />
                <span className="spinner-dot" />
                <span className="spinner-dot" />
              </span>
            </p>
          </div>
        )}

      {/* --- NEW: THE DRAFT BOARD --- */}
        {gameStatus === 'drafting' && gameState && (
          <div className="card">
            <div className="draft-header">
              <h3>Room: {roomCode}</h3>
              <div className={`turn-indicator ${isMyTurn ? 'my-turn' : 'their-turn'}`}>
                {isMyTurn ? "🚨 YOUR TURN" : "Opponent's Turn..."}
                <span className={`timer ${timeLeft <= 3 ? 'urgent' : ''}`}>
                  ⏳ {timeLeft}s
                </span>
              </div>
            </div>

            {errorMessage && <p className="error-banner">{errorMessage}</p>}

            <p className="section-label">Available Pool</p>
            <div className="pool-grid">
              {gameState.pool.map((player) => (
                <button
                  key={player.id}
                  onClick={() => handlePickPlayer(player.id)}
                  disabled={!isMyTurn}
                  className="player-chip"
                >
                  {player.name}
                  <span className="chip-sr">SR {player.sr}</span>
                </button>
              ))}
            </div>

            <hr className="divider" />

            <div className="teams-row">
              <div className="team-column">
                <h4>Your Team ({myTeam.length}/7)</h4>
                <ul className="team-list">
                  {myTeam.map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
              </div>
              <div className="team-column">
                <h4>Opponent ({opponentTeam.length}/7)</h4>
                <ul className="team-list">
                  {opponentTeam.map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

{/* --- THE LIVE SCOREBOARD --- */}
        {gameStatus === 'simulating' && liveScore && gameState && (
          <div className="card live-card">
            <div className="live-badge">
              <span className="live-dot" />
              Live Match
            </div>

            <div className="live-columns">
              
              {/* --- YOUR SCORE --- */}
              <div className="live-column">
                <h4>Your Score</h4>
                <p className="live-score">
                  {liveScore[socket.id]?.runs} / {liveScore[socket.id]?.wickets}
                </p>
                <p className="live-overs">
                  Overs {((liveScore[socket.id]?.balls || 0) / 6).toFixed(1)}
                </p>
                <ul className="scorecard-list">
                  {/* Added an extra ?. before map just in case the array is slow to load! */}
                  {liveScore[socket.id]?.scorecard?.map((p) => (
                    <li
                      key={p.id}
                      className={p.out ? 'out' : p.ballsFaced > 0 ? 'batting' : ''}
                    >
                      {p.name}: {p.runs} ({p.ballsFaced}) {p.out ? 'W' : p.ballsFaced > 0 ? '*' : ''}
                    </li>
                  ))}
                </ul>
              </div>

              {/* --- OPPONENT'S SCORE --- */}
              <div className="live-column">
                <h4>Opponent's Score</h4>
                <p className="live-score">
                  {liveScore[opponentId]?.runs} / {liveScore[opponentId]?.wickets}
                </p>
                <p className="live-overs">
                  Overs {((liveScore[opponentId]?.balls || 0) / 6).toFixed(1)}
                </p>
                <ul className="scorecard-list">
                  {liveScore[opponentId]?.scorecard?.map((p) => (
                    <li
                      key={p.id}
                      className={p.out ? 'out' : p.ballsFaced > 0 ? 'batting' : ''}
                    >
                      {p.name}: {p.runs} ({p.ballsFaced}) {p.out ? 'W' : p.ballsFaced > 0 ? '*' : ''}
                    </li>
                  ))}
                </ul>
              </div>
              
            </div>
          </div>
        )}

        {/* --- THE FINAL SCOREBOARD --- */}
        {gameStatus === 'finished' && matchResult && (
          <div className="card result-card">
            <p className="result-trophy">🏆 Final Result</p>
            <div className="result-columns">
              <div>
                <h3>Your Team</h3>
                <p className="result-score">
                  {matchResult[socket.id].finalRuns} / {matchResult[socket.id].finalWickets}
                </p>
              </div>
              <div>
                <h3>Opponent</h3>
                <p className="result-score">
                  {matchResult[opponentId].finalRuns} / {matchResult[opponentId].finalWickets}
                </p>
              </div>
            </div>
            <hr className="divider" />
            <p
              className={`result-banner ${
                matchResult.winner === 'Tie'
                  ? 'tie'
                  : matchResult.winner === socket.id
                  ? 'win'
                  : 'lose'
              }`}
            >
              {matchResult.winner === 'Tie'
                ? "It's a Tie!"
                : matchResult.winner === socket.id
                ? '🎉 You Won!'
                : '💀 You Lost!'}
            </p>
          </div>
        )}

      </div> 
    </div>
  );
}