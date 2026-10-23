import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SpaceObject {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  type: 'player' | 'enemy' | 'bullet';
}

const SpaceWars: React.FC<{ onGameEnd: () => void }> = ({ onGameEnd }) => {
  const [player, setPlayer] = useState<SpaceObject>({
    id: 0,
    x: window.innerWidth / 2,
    y: window.innerHeight - 100,
    dx: 0,
    dy: 0,
    type: 'player'
  });
  const [enemies, setEnemies] = useState<SpaceObject[]>([]);
  const [bullets, setBullets] = useState<SpaceObject[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const gameLoopRef = useRef<number>();
  const keysPressed = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key);
      if (e.code === 'Escape') {
        setIsPaused(prev => !prev);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const spawnEnemy = () => {
      if (enemies.length < 5 && !isPaused && !gameOver) {
        const newEnemy: SpaceObject = {
          id: Math.random(),
          x: Math.random() * (window.innerWidth - 40),
          y: 0,
          dx: (Math.random() - 0.5) * 4,
          dy: Math.random() * 2 + 1,
          type: 'enemy'
        };
        setEnemies(prev => [...prev, newEnemy]);
      }
    };

    const enemyInterval = setInterval(spawnEnemy, 2000);
    return () => clearInterval(enemyInterval);
  }, [enemies.length, isPaused, gameOver]);

  useEffect(() => {
    const gameLoop = () => {
      if (!isPaused && !gameOver) {
        // Player movement
        setPlayer(prev => {
          let dx = 0;
          let dy = 0;
          if (keysPressed.current.has('ArrowLeft')) dx -= 7;
          if (keysPressed.current.has('ArrowRight')) dx += 7;
          if (keysPressed.current.has('ArrowUp')) dy -= 7;
          if (keysPressed.current.has('ArrowDown')) dy += 7;

          const newX = Math.max(0, Math.min(window.innerWidth - 40, prev.x + dx));
          const newY = Math.max(0, Math.min(window.innerHeight - 40, prev.y + dy));

          return { ...prev, x: newX, y: newY };
        });

        // Bullet movement
        setBullets(prev => prev.map(bullet => ({
          ...bullet,
          y: bullet.y - 12
        })).filter(bullet => bullet.y > 0));

        // Enemy movement
        setEnemies(prev => prev.map(enemy => ({
          ...enemy,
          x: enemy.x + enemy.dx,
          y: enemy.y + enemy.dy
        })).filter(enemy => enemy.y < window.innerHeight));

        // Collision detection
        bullets.forEach(bullet => {
          enemies.forEach(enemy => {
            const dx = bullet.x - enemy.x;
            const dy = bullet.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 25) {
              setEnemies(prev => prev.filter(e => e.id !== enemy.id));
              setBullets(prev => prev.filter(b => b.id !== bullet.id));
              setScore(prev => prev + 100);
            }
          });
        });

        enemies.forEach(enemy => {
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 35) {
            setGameOver(true);
          }
        });
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [bullets, enemies, gameOver, isPaused, player]);

  const handleShoot = () => {
    if (!isPaused && !gameOver) {
      const newBullet: SpaceObject = {
        id: Math.random(),
        x: player.x + 20,
        y: player.y,
        dx: 0,
        dy: -5,
        type: 'bullet'
      };
      setBullets(prev => [...prev, newBullet]);
    }
  };

  useEffect(() => {
    const handleSpacebar = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !gameOver && !isPaused) {
        handleShoot();
      }
    };

    window.addEventListener('keydown', handleSpacebar);
    return () => window.removeEventListener('keydown', handleSpacebar);
  }, [gameOver, isPaused]);

  if (gameOver || isPaused) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75">
        <motion.div 
          className="medieval-card p-8 text-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
        >
          <h2 className="medieval-text text-3xl mb-4">
            {gameOver ? 'Game Over!' : 'Paused'}
          </h2>
          <p className="medieval-text text-xl mb-6">Score: {score}</p>
          <div className="space-x-4">
            {gameOver ? (
              <button 
                className="medieval-button"
                onClick={onGameEnd}
              >
                Return to Lobby
              </button>
            ) : (
              <button 
                className="medieval-button"
                onClick={() => setIsPaused(false)}
              >
                Resume Game
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-purple-900 to-black">
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 100 }).map((_, i) => (
          <div
            key={i}
            className="absolute bg-white rounded-full"
            style={{
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animation: `twinkle ${Math.random() * 3 + 2}s infinite`
            }}
          />
        ))}
      </div>

      {/* Score */}
      <motion.div
        className="absolute top-4 left-4 medieval-text text-yellow-400 text-2xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Score: {score}
      </motion.div>

      {/* Controls hint */}
      <motion.div
        className="absolute top-4 right-4 medieval-text text-yellow-400 text-sm text-right"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p>Arrow keys to move</p>
        <p>Space to shoot</p>
        <p>ESC to pause</p>
      </motion.div>

      {/* Player */}
      <motion.div
        className="absolute transform -translate-x-1/2 -translate-y-1/2"
        style={{
          left: player.x,
          top: player.y,
          width: 40,
          height: 40,
        }}
        animate={{
          scale: [1, 1.1, 1],
          transition: { duration: 1, repeat: Infinity }
        }}
      >
        <div className="text-4xl">🚀</div>
        {/* Thruster effect */}
        <motion.div
          className="absolute top-full left-1/2 transform -translate-x-1/2"
          animate={{
            opacity: [0.5, 1, 0.5],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          🔥
        </motion.div>
      </motion.div>

      {/* Enemies and Bullets */}
      <AnimatePresence>
        {enemies.map(enemy => (
          <motion.div
            key={enemy.id}
            className="absolute"
            style={{
              left: enemy.x,
              top: enemy.y,
              width: 40,
              height: 40,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1, rotate: 360 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-4xl">👾</div>
          </motion.div>
        ))}
        {bullets.map(bullet => (
          <motion.div
            key={bullet.id}
            className="absolute"
            style={{
              left: bullet.x,
              top: bullet.y,
              width: 4,
              height: 12,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-full h-full bg-yellow-400 rounded-full shadow-lg shadow-yellow-400/50" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default SpaceWars; 