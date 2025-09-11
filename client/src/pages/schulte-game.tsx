import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Trophy, Share2, RotateCcw, Play, Pause, Settings, Medal, Volume2, VolumeX, GraduationCap } from "lucide-react";
import { type GameResult } from "@shared/schema";

type GameState = 'ready' | 'playing' | 'paused' | 'completed';
type GameMode = 'normal' | 'practice';
type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

interface DifficultyConfig {
  name: string;
  gridSize: number;
  letterCount: number;
  description: string;
}

interface GameStats {
  completionTime: number;
  performance: string;
  difficulty: DifficultyLevel;
  gridSize: number;
}

export default function SchulteGame() {
  const { toast } = useToast();
  
  // Difficulty configurations
  const difficultyConfigs: Record<DifficultyLevel, DifficultyConfig> = {
    beginner: { name: 'Beginner', gridSize: 5, letterCount: 25, description: '5×5 grid with letters A-Y' },
    intermediate: { name: 'Intermediate', gridSize: 10, letterCount: 100, description: '10×10 grid with A-Z, 0-9, a-z + more' },
    advanced: { name: 'Advanced', gridSize: 15, letterCount: 225, description: '15×15 grid with extended character set' },
    expert: { name: 'Expert', gridSize: 25, letterCount: 625, description: '25×25 grid - Ultimate challenge' }
  };

  // Game state
  const [gameState, setGameState] = useState<GameState>('ready');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('beginner');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentTarget, setCurrentTarget] = useState('A');
  const [progress, setProgress] = useState(0);
  const [gridLetters, setGridLetters] = useState<string[]>([]);
  const [clickedLetters, setClickedLetters] = useState<Set<string>>(new Set());
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('normal');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('schulte-sound-enabled') !== 'false';
    }
    return true;
  });

  // Shared audio context
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  // Initialize audio context lazily
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
    }
    
    // Resume context if suspended (required by some browsers)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    return audioContextRef.current;
  }, []);

  // Update master gain when sound setting changes
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.setValueAtTime(
        soundEnabled ? 1 : 0,
        masterGainRef.current.context.currentTime
      );
    }
    // Save to localStorage
    localStorage.setItem('schulte-sound-enabled', soundEnabled.toString());
  }, [soundEnabled]);

  // Clean up audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Sound effects system
  const playSound = useCallback((type: 'correct' | 'incorrect' | 'complete') => {
    if (!soundEnabled) return;
    
    try {
      const audioContext = getAudioContext();
      if (!masterGainRef.current) return;
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(masterGainRef.current);
      
      // Configure sound based on type
      switch (type) {
        case 'correct':
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          oscillator.type = 'sine';
          break;
        case 'incorrect':
          oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.2);
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          oscillator.type = 'sawtooth';
          break;
        case 'complete':
          // Victory fanfare with smoother transitions
          oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
          oscillator.frequency.linearRampToValueAtTime(659, audioContext.currentTime + 0.2); // E5
          oscillator.frequency.linearRampToValueAtTime(784, audioContext.currentTime + 0.4); // G5
          oscillator.frequency.linearRampToValueAtTime(1047, audioContext.currentTime + 0.6); // C6
          gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
          oscillator.type = 'triangle';
          break;
      }
      
      const duration = type === 'complete' ? 0.8 : type === 'incorrect' ? 0.2 : 0.1;
      
      // Clean up nodes after sound finishes
      oscillator.onended = () => {
        gainNode.disconnect();
        oscillator.disconnect();
      };
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Audio playback failed:', error);
    }
  }, [soundEnabled, getAudioContext]);

  // Generate characters for grid based on difficulty
  const generateCharacters = useCallback((count: number): string[] => {
    const characters: string[] = [];
    
    // Add letters A-Z first
    for (let i = 0; i < Math.min(count, 26); i++) {
      characters.push(String.fromCharCode(65 + i));
    }
    
    // If we need more characters, add numbers
    if (count > 26) {
      for (let i = 0; i < Math.min(count - 26, 10); i++) {
        characters.push(i.toString());
      }
    }
    
    // If still need more, add lowercase letters
    if (count > 36) {
      for (let i = 0; i < Math.min(count - 36, 26); i++) {
        characters.push(String.fromCharCode(97 + i));
      }
    }
    
    // If still need more, add symbols
    const symbols = ['!', '@', '#', '$', '%', '^', '&', '*', '+', '-', '='];
    if (count > 62) {
      for (let i = 0; i < Math.min(count - 62, symbols.length); i++) {
        characters.push(symbols[i]);
      }
    }
    
    // Fill remaining with combinations
    while (characters.length < count) {
      const base = characters.length % 26;
      const suffix = Math.floor(characters.length / 26);
      characters.push(`${String.fromCharCode(65 + base)}${suffix}`);
    }
    
    return characters.slice(0, count);
  }, []);

  // Generate random grid function
  const generateGrid = useCallback(() => {
    const config = difficultyConfigs[difficulty];
    const characters = generateCharacters(config.letterCount);
    const shuffled = [...characters].sort(() => Math.random() - 0.5);
    setGridLetters(shuffled);
  }, [difficulty, generateCharacters]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (gameState === 'playing' && startTime) {
      interval = setInterval(() => {
        setCurrentTime(Date.now() - startTime);
      }, 100);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState, startTime]);

  // Initialize grid when difficulty changes
  useEffect(() => {
    const config = difficultyConfigs[difficulty];
    const characters = generateCharacters(config.letterCount);
    const shuffled = [...characters].sort(() => Math.random() - 0.5);
    setGridLetters(shuffled);
  }, [difficulty, generateCharacters]);

  // Save game result mutation
  const saveGameResult = useMutation({
    mutationFn: async (data: { completionTime: number; difficulty: string; gridSize: number }) => {
      return apiRequest('POST', '/api/game-results', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/game-results/best'] });
      queryClient.invalidateQueries({ queryKey: ['/api/game-results/best', difficulty] });
    },
  });

  // Get best times query
  const { data: bestTimes } = useQuery({
    queryKey: ['/api/game-results/best'],
    enabled: gameState === 'completed',
  });

  // Get best times for current difficulty
  const { data: bestTimesByDifficulty = [] } = useQuery<GameResult[]>({
    queryKey: ['/api/game-results/best', difficulty],
    queryFn: () => fetch(`/api/game-results/best/${difficulty}`).then(res => res.json()),
    enabled: showLeaderboardModal,
  });

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const ms = Math.floor((milliseconds % 1000) / 10);
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const calculatePerformance = (time: number, difficulty: DifficultyLevel): string => {
    const config = difficultyConfigs[difficulty];
    const baseTime = config.letterCount * 1000; // 1 second per character as baseline
    
    if (time < baseTime * 0.3) return "Outstanding";
    if (time < baseTime * 0.6) return "Excellent";
    if (time < baseTime * 0.9) return "Good";
    if (time < baseTime * 1.2) return "Average";
    return "Keep Practicing";
  };

  const startGame = () => {
    setGameState('playing');
    setStartTime(Date.now());
    setCurrentTime(0);
    const config = difficultyConfigs[difficulty];
    const firstChar = generateCharacters(config.letterCount)[0];
    setCurrentTarget(firstChar);
    setProgress(0);
    setClickedLetters(new Set());
    generateGrid();
    setShowCompletionModal(false);
  };

  const pauseGame = () => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setStartTime(Date.now() - currentTime);
      setGameState('playing');
    }
  };

  const resetGame = () => {
    setGameState('ready');
    setStartTime(null);
    setCurrentTime(0);
    const config = difficultyConfigs[difficulty];
    const firstChar = generateCharacters(config.letterCount)[0];
    setCurrentTarget(firstChar);
    setProgress(0);
    setClickedLetters(new Set());
    setShowCompletionModal(false);
    generateGrid();
  };

  const handleCellClick = (character: string) => {
    if (gameState !== 'playing') return;

    const config = difficultyConfigs[difficulty];
    const allCharacters = generateCharacters(config.letterCount);
    const expectedCharacter = allCharacters[progress];
    
    if (character === expectedCharacter) {
      // Correct click
      playSound('correct');
      const newClickedLetters = new Set(clickedLetters);
      newClickedLetters.add(character);
      setClickedLetters(newClickedLetters);
      
      const newProgress = progress + 1;
      setProgress(newProgress);
      
      if (newProgress === config.letterCount) {
        // Game completed
        const completionTime = currentTime;
        setGameState('completed');
        setGameStats({
          completionTime,
          performance: calculatePerformance(completionTime, difficulty),
          difficulty,
          gridSize: config.gridSize
        });
        setShowCompletionModal(true);
        
        // Play completion sound
        playSound('complete');
        
        // Save result only in normal mode
        if (gameMode === 'normal') {
          saveGameResult.mutate({ 
            completionTime, 
            difficulty, 
            gridSize: config.gridSize 
          });
        }
        
        toast({
          title: gameMode === 'practice' ? "Practice Complete!" : "Congratulations!",
          description: gameMode === 'practice' 
            ? `Great practice session! You completed in ${formatTime(completionTime)}. Ready for normal mode?`
            : `You completed the ${config.name} challenge in ${formatTime(completionTime)}!`,
        });
      } else {
        setCurrentTarget(allCharacters[newProgress]);
      }
    } else {
      // Incorrect click
      playSound('incorrect');
      toast({
        title: "Wrong character!",
        description: `Click on "${expectedCharacter}" next.`,
        variant: "destructive",
      });
    }
  };

  const shareResults = () => {
    if (gameStats) {
      const text = `I just completed the Schulte Grid challenge in ${formatTime(gameStats.completionTime)}! Performance: ${gameStats.performance}`;
      if (navigator.share) {
        navigator.share({ text });
      } else {
        navigator.clipboard.writeText(text);
        toast({
          title: "Results copied!",
          description: "Share your achievement with others.",
        });
      }
    }
  };

  const config = difficultyConfigs[difficulty];
  const progressPercentage = (progress / config.letterCount) * 100;

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        
        {/* Game Header */}
        <div className="w-full max-w-4xl mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                
                {/* Game Title & Status */}
                <div className="text-center md:text-left">
                  <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">Schulte Grid Training</h1>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDifficultyModal(true)}
                        disabled={gameState === 'playing'}
                        data-testid="button-difficulty"
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        {config.name}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        data-testid="button-sound-toggle"
                        title={soundEnabled ? "Disable sound" : "Enable sound"}
                      >
                        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </Button>
                      
                      <Button
                        variant={gameMode === 'practice' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setGameMode(gameMode === 'practice' ? 'normal' : 'practice')}
                        disabled={gameState === 'playing'}
                        data-testid="button-practice-toggle"
                        title={gameMode === 'practice' ? "Switch to normal mode" : "Switch to practice mode"}
                      >
                        <GraduationCap className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-muted-foreground">
                    {config.description}
                    {gameMode === 'practice' && <span className="ml-2 text-primary font-semibold">• Practice Mode</span>}
                  </p>
                </div>
                
                {/* Timer & Stats */}
                <div className="flex items-center justify-center md:justify-end gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-mono font-bold text-primary" data-testid="game-timer">
                      {formatTime(currentTime)}
                    </div>
                    <div className="text-sm text-muted-foreground">Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-warning" data-testid="current-target">
                      {currentTarget}
                    </div>
                    <div className="text-sm text-muted-foreground">Next</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-success" data-testid="progress">
                      {progress}/{config.letterCount}
                    </div>
                    <div className="text-sm text-muted-foreground">Progress</div>
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-4">
                <Progress value={progressPercentage} className="w-full" data-testid="progress-bar" />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Game Grid */}
        <div className="w-full max-w-4xl mb-6">
          <Card>
            <CardContent className="p-6">
              <div className={`grid gap-1 md:gap-2 mx-auto`} style={{ gridTemplateColumns: `repeat(${config.gridSize}, minmax(0, 1fr))`, maxWidth: `${Math.min(config.gridSize * 60, 800)}px` }}>
                {gridLetters.map((letter, index) => {
                  const isClicked = clickedLetters.has(letter);
                  const isTarget = letter === currentTarget;
                  
                  return (
                    <Button
                      key={index}
                      variant="outline"
                      className={`aspect-square ${config.gridSize > 10 ? 'text-sm md:text-base' : config.gridSize > 5 ? 'text-lg md:text-xl' : 'text-2xl md:text-3xl'} font-bold transition-all duration-150 hover:scale-105 ${
                        isClicked
                          ? 'bg-success text-success-foreground hover:bg-success/90'
                          : isTarget && gameState === 'playing' && gameMode === 'practice'
                          ? 'bg-warning text-warning-foreground ring-2 ring-warning ring-offset-2 animate-pulse'
                          : 'bg-secondary hover:bg-accent'
                      }`}
                      onClick={() => handleCellClick(letter)}
                      disabled={gameState !== 'playing' || isClicked}
                      data-testid={`grid-cell-${letter}`}
                    >
                      {letter}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Game Controls */}
        <div className="w-full max-w-4xl">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                
                {/* Game Instructions */}
                <div className="text-center md:text-left">
                  <p className="text-muted-foreground text-sm md:text-base">
                    {gameMode === 'practice' 
                      ? 'Practice mode: Target character is highlighted. Take your time to learn the sequence!' 
                      : 'Click the characters in order as they appear.'}{' '}
                    <span className="text-warning font-semibold">Current target: {currentTarget}</span>
                    {gameMode === 'practice' && (
                      <span className="block text-xs text-muted-foreground mt-1">
                        💡 Tip: In practice mode, the target character is highlighted in yellow to help you learn.
                      </span>
                    )}
                  </p>
                </div>
                
                {/* Control Buttons */}
                <div className="flex gap-3">
                  {gameState === 'ready' || gameState === 'completed' ? (
                    <Button onClick={startGame} data-testid="button-start">
                      <Play className="w-4 h-4 mr-2" />
                      Start Game
                    </Button>
                  ) : (
                    <Button onClick={pauseGame} variant="outline" data-testid="button-pause">
                      <Pause className="w-4 h-4 mr-2" />
                      {gameState === 'paused' ? 'Resume' : 'Pause'}
                    </Button>
                  )}
                  
                  <Button onClick={resetGame} variant="outline" data-testid="button-reset">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                  
                  <Button onClick={() => setShowLeaderboardModal(true)} variant="outline" data-testid="button-leaderboard">
                    <Medal className="w-4 h-4 mr-2" />
                    Leaderboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Completion Modal */}
        <Dialog open={showCompletionModal} onOpenChange={setShowCompletionModal}>
          <DialogContent className="w-full max-w-md" data-testid="completion-modal">
            <DialogHeader>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
                <DialogTitle className="text-2xl font-bold text-foreground mb-2">
                  Congratulations!
                </DialogTitle>
                <p className="text-muted-foreground">You completed the Schulte Grid challenge</p>
              </div>
            </DialogHeader>
            
            {gameStats && (
              <>
                {/* Results */}
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <span className="text-muted-foreground">Completion Time</span>
                    <span className="text-2xl font-bold text-primary" data-testid="final-time">
                      {formatTime(gameStats.completionTime)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <span className="text-muted-foreground">Characters Clicked</span>
                    <span className="text-lg font-semibold text-foreground">{config.letterCount}/{config.letterCount}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <span className="text-muted-foreground">Difficulty Level</span>
                    <span className="text-lg font-semibold text-primary">{gameStats.difficulty}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <span className="text-muted-foreground">Performance</span>
                    <span className="text-lg font-semibold text-success" data-testid="performance">
                      {gameStats.performance}
                    </span>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex gap-3">
                  <Button className="flex-1" onClick={startGame} data-testid="button-play-again">
                    <Trophy className="w-4 h-4 mr-2" />
                    Play Again
                  </Button>
                  
                  <Button variant="outline" onClick={shareResults} data-testid="button-share">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Difficulty Selection Modal */}
        <Dialog open={showDifficultyModal} onOpenChange={setShowDifficultyModal}>
          <DialogContent className="w-full max-w-2xl" data-testid="difficulty-modal">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center mb-4">
                Select Difficulty Level
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {Object.entries(difficultyConfigs).map(([key, config]) => (
                <Button
                  key={key}
                  variant={difficulty === key ? "default" : "outline"}
                  className="h-auto p-4 text-left justify-start"
                  onClick={() => {
                    const newDifficulty = key as DifficultyLevel;
                    setDifficulty(newDifficulty);
                    setShowDifficultyModal(false);
                    // Reset game state for new difficulty
                    setGameState('ready');
                    setStartTime(null);
                    setCurrentTime(0);
                    const newConfig = difficultyConfigs[newDifficulty];
                    const firstChar = generateCharacters(newConfig.letterCount)[0];
                    setCurrentTarget(firstChar);
                    setProgress(0);
                    setClickedLetters(new Set());
                    setShowCompletionModal(false);
                  }}
                  data-testid={`difficulty-${key}`}
                >
                  <div className="flex flex-col gap-1">
                    <div className="font-bold text-lg">{config.name}</div>
                    <div className="text-sm text-muted-foreground">{config.description}</div>
                    <div className="text-xs text-primary">
                      {config.gridSize}×{config.gridSize} grid • {config.letterCount} characters
                    </div>
                  </div>
                </Button>
              ))}
            </div>
            
            <div className="text-center text-sm text-muted-foreground">
              You can change difficulty anytime when the game is not in progress.
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Leaderboard Modal */}
        <Dialog open={showLeaderboardModal} onOpenChange={setShowLeaderboardModal}>
          <DialogContent className="w-full max-w-2xl" data-testid="leaderboard-modal">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center mb-4">
                <Medal className="inline w-6 h-6 mr-2 text-yellow-500" />
                Leaderboard - {difficultyConfigs[difficulty].name}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {bestTimesByDifficulty && bestTimesByDifficulty.length > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-sm font-bold text-muted-foreground border-b pb-2">
                    <div className="col-span-1">#</div>
                    <div className="col-span-6">Time</div>
                    <div className="col-span-3">Grid</div>
                    <div className="col-span-2">Date</div>
                  </div>
                  {bestTimesByDifficulty.map((result: any, index: number) => (
                    <div key={result.id} className="grid grid-cols-12 gap-2 text-sm items-center py-2 hover:bg-muted/50 rounded">
                      <div className="col-span-1 font-bold">
                        {index === 0 && <span className="text-yellow-500">🥇</span>}
                        {index === 1 && <span className="text-gray-400">🥈</span>}
                        {index === 2 && <span className="text-amber-600">🥉</span>}
                        {index > 2 && <span className="text-muted-foreground">{index + 1}</span>}
                      </div>
                      <div className="col-span-6 font-mono font-bold text-primary" data-testid={`leaderboard-time-${index}`}>
                        {formatTime(result.completionTime)}
                      </div>
                      <div className="col-span-3 text-muted-foreground">
                        {result.gridSize}×{result.gridSize}
                      </div>
                      <div className="col-span-2 text-xs text-muted-foreground">
                        {result.createdAt ? new Date(result.createdAt).toLocaleDateString() : 'Today'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No records yet for {difficultyConfigs[difficulty].name} difficulty.</p>
                  <p className="text-sm text-muted-foreground mt-2">Complete a game to set your first record!</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing top {bestTimesByDifficulty?.length || 0} results
              </div>
              <Button onClick={() => setShowLeaderboardModal(false)} data-testid="button-close-leaderboard">
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
