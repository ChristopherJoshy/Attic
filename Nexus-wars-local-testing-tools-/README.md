# Nexus Wars Local Testing

A standalone CLI tool for testing Nexus Wars bots locally. Includes the complete game engine, example bots, and tournament runner.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run a quick match (random vs starter bot)
python main.py --agents random starter

# Run your bot against the starter bot
python main.py --agents "python bots/my_bot.py" starter

# Run a tournament with all bots in the bots/ folder
python main.py --tournament bots --rounds 5
```

## Project Structure

```
nexuswars-local-testing/
├── main.py                    # CLI entry point
├── requirements.txt           # Python dependencies
├── nexus_wars/                # Game engine (complete copy)
│   ├── __init__.py
│   ├── nexus_wars.py          # Core interpreter & game logic
│   └── run_match.py           # Match runner & CLI
├── bots/                      # Your bots go here
│   ├── viper.py               # Aggressive expansion bot
│   ├── fortress.py            # Economic powerhouse bot
│   └── simple_bot.py          # Template for new bots
└── replays/                   # Match replays saved here
```

## CLI Usage

```bash
python main.py [OPTIONS]
```

### Options

| Option | Description |
|--------|-------------|
| `--agents A1 A2` | Two agents to pit against each other (default: random starter) |
| `--tournament DIR` | Run round-robin tournament on all `.py` bots in directory |
| `--rounds N` | Rounds per pair in tournament (default: 3) |
| `--seed N` | Random seed for reproducibility (default: random) |
| `--episodeSteps N` | Max steps per match (default: 500) |
| `--actTimeout N` | Seconds per turn for subprocess bots (default: 0.15) |
| `--out FILE` | Save replay JSON to file (default: replay.json) |
| `--render` | Print visual board state after match |
| `--verbose` | Verbose tournament output |

### Agent Specifiers

Agents can be specified as:

1. **Built-in bots**: `random`, `starter`
2. **Python scripts**: `python bots/my_bot.py`
3. **JSON spec** (for subprocess runner with custom options):
   ```json
   {"command": ["python", "bots/my_bot.py"], "actTimeout": 0.2, "sandbox": ["nsjail", "--config", "config.cfg"]}
   ```

## Example Bots

### Viper (Aggressive)
- Rapid expansion to neutral planets
- Multi-fleet coordinated strikes
- Dynamic threat assessment

### Fortress (Economic)
- Builds overwhelming economy first
- Consolidates forces for devastating strikes
- Requires 2x defender ships to attack

### Simple Bot (Template)
- Clean, commented template
- Basic orbital position prediction
- Threat assessment & defense
- Easy to extend

## Creating Your Own Bot

1. Copy `bots/simple_bot.py` to `bots/my_bot.py`
2. Modify the `act(observation)` function
3. Test: `python main.py --agents "python bots/my_bot.py" starter`

### Observation Format

```json
{
  "planets": [
    [id, owner, x, y, radius, ships, production, energy, energyCap, energyRegen]
  ],
  "fleets": [
    [id, owner, x, y, angle, from_planet_id, ships, launchedStep]
  ],
  "player": 0,
  "angular_velocity": 0.035,
  "initial_planets": [...],
  "next_fleet_id": 42,
  "step": 10
}
```

- `owner`: -1 = neutral, 0 = you, 1 = opponent
- `angle`: radians, 0 = +X (right), π/2 = +Y (down)
- `energy`: launching costs `launchEnergyCost` (default 20)

### Action Format

Return a JSON array of launch commands:
```json
[[from_planet_id, angle_radians, num_ships], ...]
```

## Running Tournaments

```bash
# Round-robin with 5 rounds per pair
python main.py --tournament bots --rounds 5

# With specific seed for reproducibility
python main.py --tournament bots --rounds 3 --seed 42
```

Outputs standings table with scores (Win=3, Draw=1, Loss=0).

## Replay Analysis

Replays are saved as JSON with full step-by-step state:

```json
{
  "version": "1.0",
  "engine": "nexus_wars",
  "seed": 12345,
  "configuration": {...},
  "players": [{"playerId": 0}, {"playerId": 1}],
  "steps": [
    {"observation": {...}, "action": [...], "reward": [0,0], "status": ["ACTIVE","ACTIVE"]}
  ],
  "info": {
    "winner": 0,
    "reason": "elimination",
    "scores": [1250, 340],
    "durationMs": 1200,
    "steps": 247
  }
}
```

## Engine Details

This is a **complete copy** of the Nexus Wars engine from the main project, including:

- Deterministic 1v1 interpreter
- Continuous collision detection (swept-pair)
- 4-fold symmetric map generation
- Orbital mechanics (planets rotate around center)
- Energy system (launch costs, regen, caps)
- Fleet speed scaling with size
- Off-by-one termination fix (runs all 500 steps)
- Canonical coordinates (angle 0 = +X/right)
- No comets (removed race condition)

## Requirements

- Python 3.10+
- No external dependencies (stdlib only)

## License

Apache-2.0 (same as upstream Orbit Wars)