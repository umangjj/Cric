import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

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

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>7 for the Win</h1>
      
      {/* LOBBY AND WAITING VIEWS (Unchanged) */}
      {gameStatus === 'lobby' && (
        <div style={{ padding: '20px', border: '1px solid #ccc' }}>
          <button onClick={handleCreateRoom} style={{ padding: '10px', width: '100%', marginBottom: '10px' }}>Create Room</button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input value={joinInput} onChange={(e) => setJoinInput(e.target.value)} placeholder="Enter 4-digit code" style={{ flex: 1, padding: '10px' }} />
            <button onClick={handleJoinRoom} style={{ padding: '10px' }}>Join</button>
          </div>
        </div>
      )}

      {gameStatus === 'waiting' && (
        <div style={{ padding: '20px', border: '1px solid #ccc', backgroundColor: '#fff3cd' }}>
          <h3>Room Created: {roomCode}</h3><p>Waiting for Player 2...</p>
        </div>
      )}

      {/* --- NEW: THE DRAFT BOARD --- */}
      {gameStatus === 'drafting' && gameState && (
        <div style={{ border: '1px solid #ccc', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Room: {roomCode}</h3>
            <h3 style={{ color: isMyTurn ? 'green' : 'gray' }}>
              {isMyTurn ? "🚨 YOUR TURN" : "Opponent's Turn..."}
            </h3>
          </div>
          
          {errorMessage && <p style={{ color: 'red', fontWeight: 'bold' }}>{errorMessage}</p>}

          <hr style={{ margin: '20px 0' }} />

          <h4>Available Pool</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {gameState.pool.map((player) => (
              <button 
                key={player.id} 
                onClick={() => handlePickPlayer(player.id)}
                disabled={!isMyTurn}
                style={{ 
                  padding: '10px', 
                  cursor: isMyTurn ? 'pointer' : 'not-allowed',
                  opacity: isMyTurn ? 1 : 0.6
                }}
              >
                {player.name} ({player.role})
              </button>
            ))}
          </div>

          <hr style={{ margin: '20px 0' }} />

          <div style={{ display: 'flex', gap: '40px' }}>
            <div>
              <h4>Your Team</h4>
              <ul>
                {gameState.picks[socket.id]?.map(p => <li key={p.id}>{p.name}</li>)}
              </ul>
            </div>
            
            <div>
              <h4>Opponent's Team</h4>
              <ul>
                {/* Find the opponent's ID to render their picks */}
                {gameState.picks[gameState.players.find(id => id !== socket.id)]?.map(p => <li key={p.id}>{p.name}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

{/* --- THE LIVE SCOREBOARD --- */}
      {gameStatus === 'simulating' && liveScore && gameState && (
        <div style={{ border: '2px solid red', padding: '20px', textAlign: 'center' }}>
          <h2>🔴 LIVE MATCH</h2>
          
          <div style={{ display: 'flex', justifyContent: 'space-around', margin: '20px 0', textAlign: 'left' }}>
            
            {/* Player 1 (You) */}
            <div style={{ width: '45%' }}>
              <h3 style={{ textAlign: 'center' }}>Your Score</h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', textAlign: 'center' }}>
                {liveScore[socket.id]?.runs} / {liveScore[socket.id]?.wickets}
              </p>
              <p style={{ textAlign: 'center' }}>Overs: {(liveScore[socket.id]?.balls / 6).toFixed(1)}</p>
              
              <hr />
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '14px' }}>
                {liveScore[socket.id]?.scorecard.map(p => (
                  <li key={p.id} style={{ padding: '4px 0', color: p.out ? 'gray' : 'black', fontWeight: p.ballsFaced > 0 && !p.out ? 'bold' : 'normal' }}>
                    {p.name}: {p.runs} ({p.ballsFaced}) {p.out ? 'W' : (p.ballsFaced > 0 ? '*' : '')}
                  </li>
                ))}
              </ul>
            </div>

            {/* Player 2 (Opponent) */}
            <div style={{ width: '45%' }}>
              <h3 style={{ textAlign: 'center' }}>Opponent's Score</h3>
              <p style={{ fontSize: '32px', fontWeight: 'bold', textAlign: 'center' }}>
                {liveScore[gameState.players.find(id => id !== socket.id)]?.runs} / {liveScore[gameState.players.find(id => id !== socket.id)]?.wickets}
              </p>
              <p style={{ textAlign: 'center' }}>Overs: {(liveScore[gameState.players.find(id => id !== socket.id)]?.balls / 6).toFixed(1)}</p>
              
              <hr />
              <ul style={{ listStyle: 'none', padding: 0, fontSize: '14px' }}>
                {liveScore[gameState.players.find(id => id !== socket.id)]?.scorecard.map(p => (
                  <li key={p.id} style={{ padding: '4px 0', color: p.out ? 'gray' : 'black', fontWeight: p.ballsFaced > 0 && !p.out ? 'bold' : 'normal' }}>
                    {p.name}: {p.runs} ({p.ballsFaced}) {p.out ? 'W' : (p.ballsFaced > 0 ? '*' : '')}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      )}

      {/* --- THE FINAL SCOREBOARD --- */}
      {gameStatus === 'finished' && matchResult && (
        <div style={{ border: '2px solid gold', padding: '20px', backgroundColor: '#fff9e6', textAlign: 'center' }}>
          <h2>🏆 Final Result 🏆</h2>
          <div style={{ display: 'flex', justifyContent: 'space-around', margin: '20px 0' }}>
            <div>
              <h3>Your Team</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {matchResult[socket.id].finalRuns} / {matchResult[socket.id].finalWickets}
              </p>
            </div>
            <div>
              <h3>Opponent's Team</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {matchResult[gameState.players.find(id => id !== socket.id)].finalRuns} / {matchResult[gameState.players.find(id => id !== socket.id)].finalWickets}
              </p>
            </div>
          </div>
          <hr />
          <h2 style={{ color: matchResult.winner === socket.id ? 'green' : 'red' }}>
            {matchResult.winner === 'Tie' ? "It's a Tie!" : matchResult.winner === socket.id ? "🎉 YOU WON!" : "💀 YOU LOST!"}
          </h2>
        </div>
      )}
    </div>

    
  );
}