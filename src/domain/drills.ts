import type { Drill } from './types';

export const DRILLS: Drill[] = [
  {
    id: 'tee-fairway-gate', name: 'Fairway Gate', category: 'tee', minutes: 20, needs: 'range',
    goal: 'Start the driver on your intended line.',
    steps: ['Pick a target and imagine a 30-yard-wide fairway.', 'Hit 10 drivers with a full pre-shot routine.', 'Count balls that finish inside the corridor.'],
    successRule: 'Ball finishes inside the 30-yard corridor',
  },
  {
    id: 'tee-shape-control', name: 'Shape Control', category: 'tee', minutes: 20, needs: 'range',
    goal: 'Own your stock shot and your miss.',
    steps: ['Hit 5 stock shots, then 5 aiming to start the ball on the other side of your target.', 'Note where the miss goes.'],
    successRule: 'Ball starts on intended line',
  },
  {
    id: 'app-distance-ladder', name: 'Distance Control Ladder', category: 'approach', minutes: 15, needs: 'range',
    goal: 'Know your carry numbers.',
    steps: ['Pick 3 targets, e.g. 90, 110, 130 yards.', 'Hit 5 balls to each, changing clubs as needed.', 'Success = carry within 5 yards of the target.'],
    successRule: 'Carry within 5 yards of target',
  },
  {
    id: 'app-random-targets', name: 'Random Target Practice', category: 'approach', minutes: 20, needs: 'range',
    goal: 'Practice like you play: new target, new club every ball.',
    steps: ['Randomize distances between 90 and 160 yards.', 'Full routine every ball. Never hit the same target twice in a row.'],
    successRule: 'Ball finishes inside a 15-yard radius of the target',
  },
  {
    id: 'app-pressure-ten', name: 'Pressure Ten', category: 'approach', minutes: 15, needs: 'range',
    goal: 'Hit shots with something on the line.',
    steps: ['Choose one target and a tight radius.', 'Hit 10 balls. If you miss 3 in a row, start the count again.'],
    successRule: 'Ball finishes inside the chosen radius',
  },
  {
    id: 'short-landing-spot', name: 'Landing Spot Pitching', category: 'short', minutes: 20, needs: 'short',
    goal: 'Control where the ball lands.',
    steps: ['Place a towel 15 yards away as a landing spot.', 'Hit 10 pitches with each of two clubs.', 'Count balls that land on the towel.'],
    successRule: 'Ball lands on or within 1 yard of the landing spot',
  },
  {
    id: 'short-updown-game', name: 'Up-and-Down Challenge', category: 'short', minutes: 25, needs: 'short',
    goal: 'Practice scrambling from varied lies.',
    steps: ['Drop 9 balls around the green: rough, fairway, tight lies.', 'Play each out to holing out.', 'Record how many you get up and down.'],
    successRule: 'Up and down in 2 strokes',
  },
  {
    id: 'putt-gate-3ft', name: 'Gate Drill (3 ft)', category: 'putting', minutes: 10, needs: 'putting',
    goal: 'Start the ball on line.',
    steps: ['Set two tees just wider than the ball, 1 ft in front of the ball.', 'Roll 10 putts through the gate.', 'Then repeat from 6 ft.'],
    successRule: 'Putt rolls through the gate and holes out',
  },
  {
    id: 'putt-lag-ladder', name: 'Lag Putting Ladder', category: 'putting', minutes: 15, needs: 'putting',
    goal: 'Avoid three-putts.',
    steps: ['Putt from 20, 30 and 40 feet, five balls each.', 'Success = finishes within a putter-grip length (about 3 ft) of the hole.'],
    successRule: 'Finishes within 3 feet of the hole',
  },
  {
    id: 'putt-clock-5ft', name: 'Five-Foot Clock', category: 'putting', minutes: 15, needs: 'putting',
    goal: 'Hole the putts that save pars.',
    steps: ['Place 6 balls around the hole at 5 feet like a clock face.', 'Holing all 6 resets the round.'],
    successRule: 'Ball holed',
  },
];

export const DRILL_BY_ID: Record<string, Drill> = Object.fromEntries(DRILLS.map((d) => [d.id, d]));
