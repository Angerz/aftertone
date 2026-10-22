import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { Accessibility, Feedback, KeyboardSensor, PointerActivationConstraints, PointerSensor, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/dom";
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { albumTrackDrafts, reorderDiscTracks, type AlbumTrackDraft } from "./albumTrackDraft";

const sensors = [PointerSensor.configure({
  activationConstraints: (event) => event.pointerType === "touch"
    ? [new PointerActivationConstraints.Delay({ value: 200, tolerance: 6 })]
    : [new PointerActivationConstraints.Distance({ value: 5 })],
}), KeyboardSensor];

const accessibility = Accessibility.configure({
  screenReaderInstructions: { draggable: "Press Space or Enter to pick up a track. Use the up and down arrows to move within its disc, Space or Enter to drop, or Escape to cancel." },
  announcements: {
    dragstart: ({ operation: { source } }: DragStartEvent) => `Picked up ${source?.data.title || "untitled track"}.`,
    dragover: ({ operation: { source } }: DragOverEvent) => isSortable(source) ? `Position ${source.index + 1} in this disc.` : undefined,
    dragend: ({ canceled, operation: { source } }: DragEndEvent) => canceled ? "Reordering canceled." : isSortable(source) ? `${source.data.title || "Untitled track"} moved to position ${source.index + 1}.` : "Track dropped.",
  },
});
const feedbackRoot = () => document.querySelector(".edit-album-page") ?? document.body;

function MobileTrackTitle({ title, label, onChange, onEdit }: { title: string; label: string; onChange: (value: string) => void; onEdit: () => void }) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (!editing) return;
    const resize = () => {
      if (!ref.current) return;
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight + 2}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [editing, title]);
  if (!editing) return <button ref={buttonRef} type="button" className="mobile-track-title" aria-label={`Edit ${label}: ${title || "Untitled track"}`} onClick={() => { onEdit(); setEditing(true); }}>{title || <span>Untitled track</span>}</button>;
  return <textarea ref={ref} className="mobile-track-title-input" rows={1} aria-label={label} value={title} autoFocus onChange={(event) => onChange(event.target.value.replace(/[\r\n]+/g, " "))} onBlur={() => setEditing(false)} onKeyDown={(event) => { if (event.key === "Escape" || event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); requestAnimationFrame(() => buttonRef.current?.focus()); } }} />;
}

function SortableTrack({ track, index, discTracks, discCount, onTitle, onDisc, onPosition, onRemove, reducedMotion }: {
  track: AlbumTrackDraft; index: number; discTracks: AlbumTrackDraft[]; discCount: number; reducedMotion: boolean;
  onTitle: (value: string) => void; onDisc: (disc: number) => void; onPosition: (index: number) => void; onRemove: () => void;
}) {
  const { ref, handleRef, isDragSource, isDropTarget } = useSortable({ id: track.editorKey, index, data: { title: track.title }, transition: reducedMotion ? null : { duration: 180, easing: "ease", idle: false } });
  const [revealed, setRevealed] = useState(false);
  const [offset, setOffset] = useState<number | null>(null);
  const gesture = useRef<{ x: number; y: number; horizontal: boolean; initial: boolean } | null>(null);
  const suppressClick = useRef(false);
  const optionsId = useId();
  const numberRef = useRef<HTMLButtonElement>(null);
  const label = `Disc ${track.disc_number} track ${index + 1}`;
  function startSwipe(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest(".track-drag-handle, textarea, input, select, .mobile-track-options, .swipe-remove")) return;
    gesture.current = { x: event.clientX, y: event.clientY, horizontal: false, initial: revealed };
  }
  function moveSwipe(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (!start.horizontal) {
      if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) { gesture.current = null; return; }
      if (Math.abs(dx) < 18 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      start.horizontal = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    suppressClick.current = true;
    setOffset(Math.max(0, Math.min(76, (start.initial ? 76 : 0) + dx)));
  }
  function endSwipe(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (start?.horizontal) {
      const dx = event.clientX - start.x;
      setRevealed(start.initial ? dx > -40 : dx > 48);
    }
    gesture.current = null;
    setOffset(null);
  }
  function remove() {
    if (window.confirm(`Remove “${track.title || "Untitled track"}” from the tracklist? Save changes to apply.`)) onRemove();
  }
  return <div ref={ref} data-track-key={track.editorKey} className={`mobile-track-item${isDragSource ? " dragging" : ""}${isDropTarget ? " insertion-target" : ""}`}>
    <div className="mobile-track-swipe" onPointerDown={startSwipe} onPointerMove={moveSwipe} onPointerUp={endSwipe} onPointerCancel={() => { gesture.current = null; setOffset(null); }} onClickCapture={(event) => { if (suppressClick.current && event.detail > 0) { event.preventDefault(); event.stopPropagation(); } }}>
      {revealed && <button type="button" className="swipe-remove" aria-label={`Remove ${label.toLowerCase()}`} onClick={remove}>Remove</button>}
      <div className={`mobile-track-line${offset !== null ? " swiping" : ""}`} style={{ transform: `translateX(${offset ?? (revealed ? 76 : 0)}px)` }}>
        <button ref={numberRef} type="button" className="mobile-track-number" aria-label={`Actions for ${label.toLowerCase()}`} title="Track actions" aria-expanded={revealed} aria-controls={optionsId} onClick={() => setRevealed((current) => !current)}>{String(index + 1).padStart(2, "0")}</button>
        <MobileTrackTitle title={track.title} label={`${label} title`} onChange={onTitle} onEdit={() => { setRevealed(false); setOffset(null); }} />
        <button ref={handleRef} type="button" className="track-drag-handle" tabIndex={revealed ? -1 : 0} aria-label={`Reorder ${label.toLowerCase()}`} title="Drag to reorder; Space then arrow keys with keyboard">
          <svg width="18" height="20" viewBox="0 0 18 20" fill="currentColor" aria-hidden="true">{[5, 10, 15].flatMap((y) => [6, 12].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" />))}</svg>
        </button>
      </div>
    </div>
    <div id={optionsId} className="mobile-track-options" hidden={!revealed} onKeyDown={(event) => { if (event.key === "Escape") { setRevealed(false); numberRef.current?.focus(); } }}>
      <label>Position<select aria-label={`Position for ${label.toLowerCase()}`} value={index} onChange={(event) => onPosition(Number(event.target.value))}>{discTracks.map((item, itemIndex) => <option key={item.editorKey} value={itemIndex}>{itemIndex + 1}</option>)}</select></label>
      {discCount > 1 && <label>Disc<select aria-label={`Move ${track.title || "track"} to disc`} value={track.disc_number} onChange={(event) => onDisc(Number(event.target.value))}>{Array.from({ length: discCount }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>}
      <button type="button" className="text-button" onClick={() => { setRevealed(false); numberRef.current?.focus(); }}>Close actions</button>
    </div>
  </div>;
}
export function MobileAlbumTracklist({ tracks, discCount, onChange }: { tracks: AlbumTrackDraft[]; discCount: number; onChange: (tracks: AlbumTrackDraft[]) => void }) {
  const [announcement, setAnnouncement] = useState("");
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const feedback = useMemo(() => Feedback.configure({ rootElement: feedbackRoot, dropAnimation: reducedMotion ? null : { duration: 180 }, keyboardTransition: reducedMotion ? null : { duration: 120 } }), [reducedMotion]);
  return <div className="mobile-album-tracklist">
    <p className="mobile-track-help">Tap titles to edit. Drag handles to reorder. Swipe right or tap a number for actions.</p>
    <span className="visually-hidden" role="status">{announcement}</span>
    {Array.from({ length: discCount }, (_, i) => i + 1).map((disc) => {
      const members = tracks.filter((track) => track.disc_number === disc);
      return <section className="track-disc-editor" key={disc}>
        {discCount > 1 && <h3>Disc {disc}</h3>}
        <DragDropProvider sensors={sensors} modifiers={[RestrictToVerticalAxis]} plugins={(defaults) => [...defaults.filter((plugin) => plugin !== Accessibility && plugin !== Feedback), accessibility, feedback]} onDragEnd={(event) => {
          const { source } = event.operation;
          if (event.canceled || !isSortable(source)) return;
          onChange(reorderDiscTracks(tracks, disc, source.initialIndex, source.index));
          setAnnouncement(`Disc ${disc}: ${members[source.initialIndex]?.title || "Track"} moved to position ${source.index + 1}.`);
        }}>
          {members.map((track, index) => <SortableTrack key={track.editorKey} track={track} index={index} discTracks={members} discCount={discCount} reducedMotion={reducedMotion}
            onTitle={(title) => onChange(tracks.map((item) => item.editorKey === track.editorKey ? { ...item, title } : item))}
            onDisc={(disc_number) => onChange(tracks.map((item) => item.editorKey === track.editorKey ? { ...item, disc_number } : item))}
            onPosition={(to) => { onChange(reorderDiscTracks(tracks, disc, index, to)); setAnnouncement(`Disc ${disc}: ${track.title || "Track"} moved to position ${to + 1}.`); }}
            onRemove={() => {
              const nextKey = (members[index + 1] ?? members[index - 1])?.editorKey;
              onChange(tracks.filter((item) => item.editorKey !== track.editorKey));
              setAnnouncement(`Removed ${track.title || "untitled track"} from the draft.`);
              requestAnimationFrame(() => {
                if (nextKey) document.querySelector<HTMLButtonElement>(`[data-track-key="${nextKey}"] .mobile-track-number`)?.focus();
              });
            }} />)}
        </DragDropProvider>
        <button type="button" className="text-button" onClick={() => onChange([...tracks, ...albumTrackDrafts([{ title: "", disc_number: disc }])])}>+ Add track</button>
      </section>;
    })}
  </div>;
}
