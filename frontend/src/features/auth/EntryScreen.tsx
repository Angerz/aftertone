export function EntryScreen({ preparing = false, owner = false, onExplore, onSignIn }: { preparing?: boolean; owner?: boolean; onExplore: () => void; onSignIn: () => void }) {
  return <main className="entry-screen" aria-labelledby="entry-title">
    <div className="entry-screen-content">
      <p className="eyebrow">Aftertone</p>
      <h1 id="entry-title">Library<span aria-hidden="true">.</span></h1>
      <p className="entry-screen-description">Your private journal of albums, tracks, and listening sessions.</p>
      <div className="entry-screen-actions">
        <button type="button" onClick={onExplore}>{owner ? "Open Library" : "Explore as guest"}</button>
        {!owner && <button type="button" className="text-button" onClick={onSignIn}>Owner sign in</button>}
      </div>
      {preparing && <div className="entry-screen-status" role="status">
        <span className="entry-loading-line" aria-hidden="true" />
        <p>Preparing your catalogue…</p>
      </div>}
    </div>
    <footer className="entry-screen-footer">
      <span>A listening journal</span>
      <span>Albums · Tracks · Listening sessions</span>
    </footer>
  </main>;
}
