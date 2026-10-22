import { type FormEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { getArtist, updateArtist } from "../../api/artists";
import { ApiError } from "../../api/client";
import type { ArtistDetail, ArtistType } from "../../api/types";
import { ArtistImage } from "./ArtistImage";
import { ArtistImageControls } from "./ArtistImageControls";
import { ArtistBiographyFields } from "./ArtistBiographyFields";
import { MusicBrainzArtistImport } from "./MusicBrainzArtistImport";
import { artistEditErrorField, validateArtistEdit, type ArtistEditField } from "./artistEditValidation";
import { useUnsavedNavigation } from "../../components/useUnsavedNavigation";
import "./editArtistMobile.css";

export function EditArtistPage({ artistId, onCancel, onSaved }: { artistId: number; onCancel: () => void; onSaved: () => void }) {
  const [artist, setArtist] = useState<ArtistDetail | null>(null); const [name, setName] = useState(""); const [type, setType] = useState<ArtistType>("unknown"); const [countryCode, setCountryCode] = useState(""); const [birthDate, setBirthDate] = useState(""); const [deathDate, setDeathDate] = useState(""); const [formedYear, setFormedYear] = useState(""); const [dissolvedYear, setDissolvedYear] = useState(""); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  const [biographyOpen, setBiographyOpen] = useState(false);
  const [invalidField, setInvalidField] = useState<ArtistEditField | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ field: ArtistEditField } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const errorId = useId();
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useLayoutEffect(() => {
    if (!focusTarget) return;
    form.current?.querySelector<HTMLElement>(`[name="${focusTarget.field}"]`)?.focus();
    setFocusTarget(null);
  }, [focusTarget]);
  useEffect(() => { setBiographyOpen(false); setInvalidField(null); getArtist(artistId).then((loaded) => { setArtist(loaded); setName(loaded.name); setType(loaded.artist_type ?? "unknown"); setCountryCode(loaded.country_code ?? ""); setBirthDate(loaded.birth_date ?? ""); setDeathDate(loaded.death_date ?? ""); setFormedYear(loaded.formed_year?.toString() ?? ""); setDissolvedYear(loaded.dissolved_year?.toString() ?? ""); }).catch((cause: Error) => setError(cause.message)); }, [artistId]);
  const dirty = artist !== null && (name !== artist.name || type !== (artist.artist_type ?? "unknown") || countryCode !== (artist.country_code ?? "") || birthDate !== (artist.birth_date ?? "") || deathDate !== (artist.death_date ?? "") || formedYear !== (artist.formed_year?.toString() ?? "") || dissolvedYear !== (artist.dissolved_year?.toString() ?? ""));
  useUnsavedNavigation(dirty, "Discard unsaved artist changes?");
  const cancel = () => { if (!dirty || window.confirm("Discard unsaved artist changes?")) onCancel(); };
  const fields = { name, type, countryCode, birthDate, deathDate, formedYear, dissolvedYear };
  const fieldProps = (field: ArtistEditField) => ({ name: field, "aria-invalid": mobile && invalidField === field || undefined, "aria-describedby": mobile && invalidField === field ? errorId : undefined });
  function reportError(message: string, field: ArtistEditField) {
    // A retained draft for another type still uses the existing validation rules.
    // Focus Type so that its corresponding fields can be made available again.
    const target = (["formed_year", "dissolved_year"].includes(field) && type !== "group") || (["birth_date", "death_date"].includes(field) && type !== "person") ? "artist_type" : field;
    setError(message); setInvalidField(target);
    if (mobile) { setBiographyOpen(true); setFocusTarget({ field: target }); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null); setInvalidField(null);
    const issue = validateArtistEdit(fields);
    if (issue) { reportError(issue.message, issue.field); return; }
    const parseYear = (value: string) => value ? Number(value) : null;
    setSaving(true);
    try {
      await updateArtist(artistId, { name: name.trim(), artist_type: type, country_code: countryCode.trim().toUpperCase() || null, birth_date: type === "person" ? birthDate || null : null, death_date: type === "person" ? deathDate || null : null, formed_year: type === "group" ? parseYear(formedYear) : null, dissolved_year: type === "group" ? parseYear(dissolvedYear) : null });
      onSaved();
    } catch (cause) {
      const target = cause instanceof ApiError ? artistEditErrorField(cause.validationPaths) : null;
      if (target) reportError((cause as Error).message, target);
      else setError((cause as Error).message);
    } finally { setSaving(false); }
  }
  if (!artist) return <main className="page narrow"><button className="back" onClick={onCancel}>← Artist</button><p>{error || "Loading artist…"}</p></main>;
  const details = <section key="details" className="artist-edit-section artist-edit-details">
    <div className="artist-edit-section-heading"><h2>Artist details</h2><MusicBrainzArtistImport inlineMobile={mobile} fields={fields} onApply={(changes) => {
      if (changes.name !== undefined) setName(changes.name); if (changes.type !== undefined) setType(changes.type); if (changes.countryCode !== undefined) setCountryCode(changes.countryCode); if (changes.birthDate !== undefined) setBirthDate(changes.birthDate); if (changes.deathDate !== undefined) setDeathDate(changes.deathDate); if (changes.formedYear !== undefined) setFormedYear(changes.formedYear); if (changes.dissolvedYear !== undefined) setDissolvedYear(changes.dissolvedYear);
    }} /></div>
    <div className="artist-edit-primary">
      <label className="artist-edit-name">Name<input {...fieldProps("name")} value={name} onChange={(event) => setName(event.target.value)} required /></label>
      <label>Type<select {...fieldProps("artist_type")} value={type} onChange={(event) => setType(event.target.value as ArtistType)}><option value="unknown">Unknown</option><option value="person">Person</option><option value="group">Group</option></select></label>
      <label className="artist-edit-country">Country / origin <small>ISO code, e.g. ES or US</small><input {...fieldProps("country_code")} value={countryCode} maxLength={2} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} placeholder="ES" /></label>
    </div>
    {type !== "unknown" && <ArtistBiographyFields open={biographyOpen} onToggle={() => setBiographyOpen((current) => !current)} summary={type === "person" ? [birthDate && `Born ${birthDate}`, deathDate && `Died ${deathDate}`].filter(Boolean).join(" · ") : [formedYear && `Formed ${formedYear}`, dissolvedYear && `Dissolved ${dissolvedYear}`].filter(Boolean).join(" · ")}>
      {type === "person" && <div className="metadata"><label>Birth date<input {...fieldProps("birth_date")} type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label><label>Death date <small>Optional</small><input {...fieldProps("death_date")} type="date" value={deathDate} onChange={(event) => setDeathDate(event.target.value)} /></label></div>}
      {type === "group" && <div className="metadata"><label>Formed<input {...fieldProps("formed_year")} type="number" min="1" max="9999" value={formedYear} onChange={(event) => setFormedYear(event.target.value)} /></label><label>Dissolved <small>Optional</small><input {...fieldProps("dissolved_year")} type="number" min="1" max="9999" value={dissolvedYear} onChange={(event) => setDissolvedYear(event.target.value)} /></label></div>}
    </ArtistBiographyFields>}
  </section>;
  const image = <section key="image" className="artist-edit-section artist-edit-photo"><h2>Artist image</h2><div className="artist-edit-image"><ArtistImage artist={artist} className="artist-hero-image" /><ArtistImageControls compactMobile={mobile} artist={artist} onUpdated={(updated) => setArtist((current) => current ? { ...current, image_url: updated.image_url } : current)} /></div></section>;
  return <main className="page narrow edit-artist-page"><button className="back" onClick={cancel}>← Artist</button><p className="eyebrow">Artist metadata</p><h1>Edit artist</h1><form ref={form} onSubmit={submit} noValidate>
    {mobile ? [image, details] : [details, image]}
    {error && <p id={errorId} className="notice error" role="alert">{error}</p>}
    <div className="edit-album-actions"><button type="button" className="text-button" onClick={cancel}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
  </form></main>;
}
