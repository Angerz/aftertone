export function ContextualNavigation({ onBack, onLibrary, onArtists }: { onBack: () => void; onLibrary: () => void; onArtists: () => void }) {
  return <nav className="contextual-navigation" aria-label="Page navigation"><button type="button" className="back" onClick={onBack}>← Back</button><span aria-hidden="true">·</span><button type="button" className="text-button" onClick={onLibrary}>Library</button><span aria-hidden="true">·</span><button type="button" className="text-button" onClick={onArtists}>Artists</button></nav>;
}
