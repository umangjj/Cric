// 1. A Dummy XI (A mix of roles)
const TEAM = [
  { id: 'p1', name: 'V. Kohli', avg: 52.7, sr: 137.9 },
  { id: 'p2', name: 'R. Sharma', avg: 31.3, sr: 139.2 },
  { id: 'p3', name: 'S. Yadav', avg: 43.3, sr: 171.5 },
  { id: 'p4', name: 'M. Dhoni', avg: 37.6, sr: 126.1 },
  { id: 'p5', name: 'H. Pandya', avg: 25.4, sr: 139.8 },
  { id: 'p6', name: 'R. Jadeja', avg: 24.5, sr: 125.1 },
  { id: 'p7', name: 'R. Khan', avg: 14.8, sr: 114.3 },
  { id: 'p8', name: 'T. Boult', avg: 12.2, sr: 96.9 },
  { id: 'p9', name: 'J. Bumrah', avg: 9.6, sr: 87.5 },
  { id: 'p10', name: 'K. Rabada', avg: 14.8, sr: 101.0 },
  { id: 'p11', name: 'M. Starc', avg: 12.9, sr: 98.2 }
];

// 2. The Core Algorithm: What happens on one ball?
function simulateBall(batter) {
  const erpb = batter.sr / 100;
  const ebf = batter.avg / erpb;
  const pOut = 1 / ebf;

  // Roll the dice for a wicket
  if (Math.random() < pOut) {
    return 'W';
  }

  // If not out, roll the dice for runs based on aggressiveness (SR)
  const runRoll = Math.random();
  if (batter.sr > 145) {
    // Aggressive: High boundary chance
    if (runRoll < 0.35) return 0;
    if (runRoll < 0.60) return 1;
    if (runRoll < 0.70) return 2;
    if (runRoll < 0.85) return 4;
    return 6;
  } else if (batter.sr > 120) {
    // Standard
    if (runRoll < 0.40) return 0;
    if (runRoll < 0.75) return 1;
    if (runRoll < 0.85) return 2;
    if (runRoll < 0.95) return 4;
    return 6;
  } else {
    // Bowler/Anchor: Lots of dots and singles
    if (runRoll < 0.50) return 0;
    if (runRoll < 0.85) return 1;
    if (runRoll < 0.95) return 2;
    if (runRoll < 0.99) return 4;
    return 6;
  }
}

// 3. The Match Engine
// Keep your simulateBall function exactly as it is!

 function simulateSingleMatch(xi) {
  let totalRuns = 0;
  let wickets = 0;
  let balls = 0;
  const timeline = []; // We will save the score at the end of every over
  
  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let nextBatterIdx = 2;
  const scorecard = xi.map(p => ({ ...p, runs: 0, ballsFaced: 0, out: false }));

  while (balls < 120 && wickets < 10) {
    balls++;
    const striker = scorecard[strikerIdx];
    striker.ballsFaced++;
    
    const outcome = simulateBall(striker);
    
    if (outcome === 'W') {
      wickets++;
      striker.out = true;
      if (wickets < 10) {
        strikerIdx = nextBatterIdx;
        nextBatterIdx++;
      }
    } else {
      totalRuns += outcome;
      striker.runs += outcome;
      if (outcome === 1 || outcome === 3) {
        [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
      }
    }

    // Snapshot the score every 6 balls (1 over) OR if they get all out
   // Snapshot the score AND the players every 6 balls (1 over) OR if they get all out
    if (balls % 6 === 0 || wickets === 10 || balls === 120) {
      // Create a deep copy of the scorecard exactly as it looks right now
      const currentScorecard = scorecard.map(p => ({ ...p }));
      
      timeline.push({ 
        balls, 
        runs: totalRuns, 
        wickets, 
        scorecard: currentScorecard // NEW: Save the players!
      });
    }
    
    // Rotate strike at the end of the over
    if (balls % 6 === 0) {
      [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
    }
  }

  return { finalRuns: totalRuns, finalWickets: wickets, timeline };
}

export { simulateSingleMatch };
