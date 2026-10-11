import front from '@/assets/ditasha-office/team-front.png';
import rear from '@/assets/ditasha-office/team-rear.png';
import atlas from '@/assets/ditasha-office/atlas.json';

/** Atlas windows preserve original art without stretching heads or bodies. */
export function AssistantPerson({index,working,frame,facing,className,back=false,animate=true}:{index:number;working:boolean;frame:number|null;facing:number;className:string;back?:boolean;animate?:boolean}){
 const id=Math.max(0,Math.min(9,Math.floor(index))),sheet=back?atlas.rear:atlas.front;
 const [x,y,w,h]=sheet.frames[id],pad=0;
 return <span aria-hidden="true" className={'pixel-person assistant-person adult-person ditasha-person '+(working?'working ':'')+(frame!==null&&animate?'stepping ':'')+className} data-avatar={id} data-pose={back?'rear':'front'} style={{'--facing':facing,'--step':frame??0} as React.CSSProperties}>
  <svg className="ditasha-sprite" viewBox={`${x-pad} ${y-pad} ${w+pad*2} ${h+pad*2}`} preserveAspectRatio="xMidYMax meet"><image href={back?rear:front} width={sheet.width} height={sheet.height}/></svg>
 </span>;
}
