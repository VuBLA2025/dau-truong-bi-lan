import { usePlinkoGame } from './game/usePlinkoGame';
import { GameStage } from './game/GameStage';
import { StageFrame } from './components/StageFrame';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const game = usePlinkoGame();
  const isStage = typeof window !== 'undefined' && window.location.search.includes('stage=1');

  if (isStage) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black overflow-hidden">
        <StageFrame>
          <GameStage game={game} />
        </StageFrame>
      </div>
    );
  }

  return <Dashboard game={game} />;
}
