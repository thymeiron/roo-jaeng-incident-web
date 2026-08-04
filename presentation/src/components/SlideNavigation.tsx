import { Icon } from "./Icons";

export default function SlideNavigation({ current, total, onPrevious, onNext }: { current: number; total: number; onPrevious: () => void; onNext: () => void }) {
  return <footer className="slide-navigation"><button type="button" onClick={onPrevious} disabled={current===0} aria-label="สไลด์ก่อนหน้า"><Icon name="arrow-left"/><span>ก่อนหน้า</span></button><div className="slide-counter" aria-live="polite"><b>{String(current+1).padStart(2,"0")}</b><i/> <span>{String(total).padStart(2,"0")}</span></div><button type="button" className="next-button" onClick={onNext} disabled={current===total-1} aria-label="สไลด์ถัดไป"><span>ถัดไป</span><Icon name="arrow-right"/></button></footer>;
}
