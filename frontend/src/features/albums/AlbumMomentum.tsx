import { useState } from "react";
import type { RatingRevisionDetail } from "../../api/types";
import { buildAlbumMomentumData, type MomentumPoint } from "./albumMomentum";

const width = 720;
const left = 38;
const right = 14;
const top = 26;
const bottom = 34;

export function AlbumMomentum({ revision }: { revision: RatingRevisionDetail }) {
  const data = buildAlbumMomentumData(revision.tracks, revision.pre_rating);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!data.points.length || !data.points.some((point) => point.score !== null)) {
    return <section className="album-momentum empty"><p>No rated tracks yet.</p></section>;
  }

  const height = Math.min(440, Math.max(280, data.points.length * 40 + 100));
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (index: number) => data.points.length === 1 ? left + plotWidth / 2 : left + index / (data.points.length - 1) * plotWidth;
  const y = (score: number) => top + (data.yMax - score) / (data.yMax - data.yMin) * plotHeight;
  const indexOf = (point: MomentumPoint) => data.points.indexOf(point);
  const labelEvery = Math.max(1, Math.ceil(data.points.length / 12));
  const active = activeIndex === null ? null : data.points[activeIndex];
  const band = data.points.length === 1 ? plotWidth : plotWidth / (data.points.length - 1);
  const ticks = Array.from({ length: data.yMax - data.yMin + 1 }, (_, index) => data.yMax - index);
  const ratedIndexes = data.points.flatMap((point, index) => point.score === null ? [] : [index]);
  const unratedSpans = ratedIndexes.slice(1).flatMap((end) => {
    const start = ratedIndexes[ratedIndexes.indexOf(end) - 1];
    return end - start > 1 ? [[start, end] as const] : [];
  });
  const visualPoints = data.points.flatMap((point, index) => point.score === null ? [] : [{ index, score: point.score }]);
  const areaPath = visualPoints.length
    ? [
      `M ${x(visualPoints[0].index)} ${y(visualPoints[0].score)}`,
      ...visualPoints.slice(1).map((point) => `L ${x(point.index)} ${y(point.score)}`),
      `L ${x(visualPoints[visualPoints.length - 1].index)} ${y(data.yMin)}`,
      `L ${x(visualPoints[0].index)} ${y(data.yMin)}`,
      "Z",
    ].join(" ")
    : null;
  const preLabelY = data.preRating !== null && y(data.preRating) < top + 22 ? y(data.preRating) + 15 : data.preRating !== null ? y(data.preRating) - 7 : 0;
  const tooltipTop = active ? Math.min(74, Math.max(4, (active.score === null ? y(data.yMin) : y(active.score)) / height * 100 - 12)) : 0;
  const tooltipLeft = activeIndex === null ? 0 : Math.min(73, Math.max(2, x(activeIndex) / width * 100 - 12));

  return <section className="album-momentum" onMouseLeave={() => setActiveIndex(null)}>
    <div className="momentum-heading">{data.preRating !== null && <strong>PRE {data.preRating.toFixed(3)}</strong>}</div>
    <div className="momentum-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Album momentum track score chart">
        <line x1={left} x2={width - right} y1={y(data.yMin)} y2={y(data.yMin)} className="momentum-axis" />
        <line x1={left} x2={left} y1={top} y2={y(data.yMin)} className="momentum-axis" />
        {ticks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className="momentum-grid" /><text x={left - 7} y={y(tick) + 4} textAnchor="end" className="momentum-label">{tick}</text></g>)}
        {areaPath && <path d={areaPath} className="momentum-area" pointerEvents="none" />}
        {data.segments.map((segment, segmentIndex) => segment.length > 1 && <polyline key={segmentIndex} points={segment.map((point) => `${x(indexOf(point))},${y(point.score as number)}`).join(" ")} className="momentum-line" />)}
        {unratedSpans.map(([start, end]) => <line key={`${start}-${end}`} x1={x(start)} x2={x(end)} y1={y(data.points[start].score as number)} y2={y(data.points[end].score as number)} className="momentum-unrated-span" />)}
        {data.points.map((point, index) => point.score === null ? <g key={`${point.discNumber}-${point.position}`} className={activeIndex === index ? "momentum-active" : ""}><line x1={x(index)} x2={x(index)} y1={top} y2={y(data.yMin)} className="momentum-unrated-guide" /><path d={`M ${x(index)} ${y(data.yMin) - 9} l 6 6 l -6 6 l -6 -6 z`} className="momentum-unrated" /></g> : <circle key={`${point.discNumber}-${point.position}`} cx={x(index)} cy={y(point.score)} r={activeIndex === index ? "6.5" : "5"} className={`momentum-point${activeIndex === index ? " active" : ""}`} />)}
        {data.preRating !== null && <g><line x1={left} x2={width - right} y1={y(data.preRating)} y2={y(data.preRating)} className="momentum-pre" /><rect x={left + 4} y={preLabelY - 10} width="82" height="14" className="momentum-pre-backdrop" /><text x={left + 8} y={preLabelY} className="momentum-pre-label">PRE {data.preRating.toFixed(3)}</text></g>}
        {activeIndex !== null && <line x1={x(activeIndex)} x2={x(activeIndex)} y1={top} y2={y(data.yMin)} className="momentum-active-guide" />}
        {data.points.map((point, index) => <rect key={`hit-${point.discNumber}-${point.position}`} x={Math.max(left, x(index) - band / 2)} y={top} width={Math.min(band, width - right - Math.max(left, x(index) - band / 2))} height={plotHeight + bottom} className="momentum-hit-area" aria-label={`Disc ${point.discNumber}, ${String(point.position).padStart(2, "0")} · ${point.title}: ${point.score === null ? "Unrated" : point.score.toFixed(1)}`} tabIndex={0} onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} />)}
        {data.points.map((point, index) => (index % labelEvery === 0 || index === data.points.length - 1) && <text key={`${point.discNumber}-${point.position}`} x={x(index)} y={height - 10} textAnchor="middle" className={`momentum-label momentum-x-label${activeIndex === index ? " active" : ""}`}>{String(point.position).padStart(2, "0")}</text>)}
      </svg>
      {active && <div className="momentum-tooltip" style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}><strong>Disc {active.discNumber} · {String(active.position).padStart(2, "0")}</strong><span>{active.title}</span><b>{active.score === null ? "Unrated" : active.score.toFixed(1)}</b></div>}
    </div>
    {data.points.some((point) => point.score === null) && <p className="momentum-key"><span className="momentum-key-unrated">◇</span> Unrated <span className="momentum-key-rated">━</span> Rated path <span className="momentum-key-dotted">┄</span> Unrated span</p>}
  </section>;
}
