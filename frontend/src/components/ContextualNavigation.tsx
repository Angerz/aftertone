export function ContextualNavigation({ onBack }: { onBack: () => void }) {
  return <nav className="contextual-navigation" aria-label="Page navigation"><button type="button" className="back" onClick={onBack}>← Back</button></nav>;
}
