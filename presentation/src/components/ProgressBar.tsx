export default function ProgressBar({ current, total }: { current: number; total: number }) {
  return <div className="progress-track" aria-hidden="true"><span style={{ width: `${((current + 1) / total) * 100}%` }}/></div>;
}
