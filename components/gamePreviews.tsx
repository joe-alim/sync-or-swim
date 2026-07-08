// Hub-side registry of "preview" modals a game offers from its card: a rules
// how-to-play, and optionally a card gallery. Keyed by registry slug. Games
// absent from this map simply show no preview buttons.
import { SmokeSignalsRules } from './SmokeSignalsRules';
import { SmokeSignalsCardReference } from './SmokeSignalsCardReference';
import { SyncOrSwimRules } from './SyncOrSwimRules';
import { TwoTracksRules } from './TwoTracksRules';
import { CampfireBluffRules } from './CampfireBluffRules';

interface GamePreview {
  /** How-to-play modal. */
  rules: (props: { onClose: () => void }) => React.ReactNode;
  /** Optional card-gallery modal (only games with a deck). */
  cards?: (props: { onClose: () => void }) => React.ReactNode;
}

export const GAME_PREVIEWS: Record<string, GamePreview> = {
  'smoke-signals': {
    // playerCount 0 = no active game; the modal highlights the 2-player target row.
    rules: ({ onClose }) => <SmokeSignalsRules version="regular" playerCount={0} onClose={onClose} />,
    cards: ({ onClose }) => <SmokeSignalsCardReference version="all" onClose={onClose} />,
  },
  'sync-or-swim': {
    rules: ({ onClose }) => <SyncOrSwimRules onClose={onClose} />,
  },
  'two-tracks-and-a-trick': {
    rules: ({ onClose }) => <TwoTracksRules onClose={onClose} />,
  },
  'campfire-bluff': {
    rules: ({ onClose }) => <CampfireBluffRules onClose={onClose} />,
  },
};
