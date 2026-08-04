import { slides } from "@/data/slides";
import { Icon } from "./Icons";

export default function AllScreensModal({ current, onSelect, onClose }: { current: number; onSelect: (index: number) => void; onClose: () => void }) {
  return <div className="all-screens-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="all-screens" role="dialog" aria-modal="true" aria-labelledby="all-screens-title"><header><div><span>ROO-JAENG PRESENTATION</span><h2 id="all-screens-title">All Screens</h2><p>เลือกหัวข้อที่ต้องการนำเสนอ</p></div><button type="button" onClick={onClose} aria-label="ปิด All Screens"><Icon name="close"/></button></header><div className="all-screens-grid">{slides.map((s,index)=><button type="button" key={s.id} className={current===index?"selected":""} onClick={()=>onSelect(index)}><span className="thumb-number">{String(s.id).padStart(2,"0")}</span><div className={`thumb-visual thumb-${s.id}`}><i/><i/><i/><b>RJ</b></div><small>{s.eyebrow}</small><strong>{s.shortTitle}</strong><p>{s.title}</p></button>)}</div></section></div>;
}
