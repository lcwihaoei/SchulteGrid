import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Trophy, Share2, RotateCcw, Play, Pause } from "lucide-react";

type GameState = 'ready' | 'playing' | 'paused' | 'completed';

interface GameStats {
  completionTime: number;
  performance: string;
}

export default function SchulteGame() {
  const { toast } = useToast();
  
  // Game state
  const [gameState, setGameState] = useState<GameState>('ready');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentTarget, setCurrentTarget] = useState('A');
  const [progress, setProgress] = useState(0);
  const [gridLetters, setGridLetters] = useState<string[]>([]);
  const [clickedLetters, setClickedLetters] = useState<Set<string>>(new Set());
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Generate random grid
  const generateGrid = useCallback(() => {
    const letters = Array.from({ length: 25 }, (_, i) => String.fromCharCode(65 + i)); // A-Y
    const shuffled = [...letters].sort(() => Math.random() - 0.5);
    setGridLetters(shuffled);
  }, []);

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

  // Initialize grid on mount
  useEffect(() => {
    generateGrid();
  }, [generateGrid]);

  // Save game result mutation
  const saveGameResult = useMutation({
    mutationFn: async (completionTime: number) => {
      return apiRequest('POST', '/api/game-results', { completionTime });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/game-results/best'] });
    },
  });

  // Get best times query
  const { data: bestTimes } = useQuery({
    queryKey: ['/api/game-results/best'],
    enabled: gameState === 'completed',
  });

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const ms = Math.floor((milliseconds % 1000) / 10);
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const calculatePerformance = (time: number): string => {
    if (time < 30000) return "Outstanding";
    if (time < 60000) return "Excellent";
    if (time < 90000) return "Good";
    if (time < 120000) return "Average";
    return "Keep Practicing";
  };

  const startGame = () => {
    setGameState('playing');
    setStartTime(Date.now());
    setCurrentTime(0);
    setCurrentTarget('A');
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
    setCurrentTarget('A');
    setProgress(0);
    setClickedLetters(new Set());
    setShowCompletionModal(false);
    generateGrid();
  };

  const handleCellClick = (letter: string) => {
    if (gameState !== 'playing') return;

    const expectedLetter = String.fromCharCode(65 + progress);
    
    if (letter === expectedLetter) {
      // Correct click
      const newClickedLetters = new Set(clickedLetters);
      newClickedLetters.add(letter);
      setClickedLetters(newClickedLetters);
      
      const newProgress = progress + 1;
      setProgress(newProgress);
      
      if (newProgress === 25) {
        // Game completed
        const completionTime = currentTime;
        setGameState('completed');
        setGameStats({
          completionTime,
          performance: calculatePerformance(completionTime)
        });
        setShowCompletionModal(true);
        
        // Save result
        saveGameResult.mutate(completionTime);
        
        toast({
          title: "Congratulations!",
          description: `You completed the challenge in ${formatTime(completionTime)}!`,
        });
      } else {
        setCurrentTarget(String.fromCharCode(65 + newProgress));
      }
    } else {
      // Incorrect click
      toast({
        title: "Wrong letter!",
        description: `Click on "${expectedLetter}" next.`,
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

  const progressPercentage = (progress / 25) * 100;

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
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Schulte Grid Training</h1>
                  <p className="text-muted-foreground">Click letters A through Y in alphabetical order</p>
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
                      {progress}/25
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
              <div className="grid grid-cols-5 gap-2 md:gap-3 max-w-2xl mx-auto">
                {gridLetters.map((letter, index) => {
                  const isClicked = clickedLetters.has(letter);
                  const isTarget = letter === currentTarget;
                  
                  return (
                    <Button
                      key={index}
                      variant="outline"
                      className={`aspect-square text-2xl md:text-3xl font-bold transition-all duration-150 hover:scale-105 ${
                        isClicked
                          ? 'bg-success text-success-foreground hover:bg-success/90'
                          : isTarget && gameState === 'playing'
                          ? 'ring-2 ring-warning ring-offset-2 animate-pulse'
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
                    Click the letters in alphabetical order from A to Y.{' '}
                    <span className="text-warning font-semibold">Current target: {currentTarget}</span>
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
                    <span className="text-muted-foreground">Letters Clicked</span>
                    <span className="text-lg font-semibold text-foreground">25/25</span>
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
      </div>
    </div>
  );
}
