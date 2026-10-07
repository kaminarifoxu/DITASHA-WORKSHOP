export type Point={x:number;y:number};
export type Desk={x:number;y:number;index:number};
export let nodes:Point[]=[],deskNodes:number[]=[],idleNodes:number[]=[],boardNode=0;
let links:number[][]=[];
export function officeLayout(count:number){
 const rows=Math.max(1,Math.ceil((count-1)/3)),height=340+rows*220;
 const desks:Desk[]=[{x:500,y:70,index:0}];
 for(let i=1;i<count;i++)desks.push({x:170+((i-1)%3)*330,y:290+Math.floor((i-1)/3)*220,index:i});
 return {width:1000,height,desks};
}
export function configureOffice(count:number){
 const layout=officeLayout(count);nodes=[];deskNodes=[];idleNodes=[];links=[];
 const add=(x:number,y:number)=>{nodes.push({x:x/10,y:y/layout.height*100});return nodes.length-1;};
 for(const d of layout.desks)deskNodes.push(add(d.x,d.y+95));
 boardNode=add(170,185);
 let previousSpine=-1;
 for(let row=0;row<=Math.ceil((count-1)/3);row++){
  const y=row===0?230:450+(row-1)*220;
  const hall=[170,335,500,830].map(x=>add(x,y));idleNodes.push(...hall);
  for(let i=1;i<hall.length;i++)links.push([hall[i-1],hall[i]]);
  if(previousSpine>=0)links.push([previousSpine,hall[1]]);previousSpine=hall[1];
  if(row===0)links.push([deskNodes[0],hall[2]],[boardNode,hall[0]]);
  else for(let col=0;col<3;col++){const desk=1+(row-1)*3+col;if(desk<count)links.push([deskNodes[desk],hall[[0,2,3][col]]]);}
 }
 return layout;
}
configureOffice(7);
export function route(from:number,to:number):number[]{const queue:number[][]=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift()!,last=path[path.length-1];if(last===to)return path.slice(1);for(const edge of links){const next=edge[0]===last?edge[1]:edge[1]===last?edge[0]:-1;if(next!==-1&&!seen.has(next)){seen.add(next);queue.push([...path,next]);}}}return [];}
export function advance(point:Point,target:Point,seconds:number,speed=13){const distance=Math.hypot(target.x-point.x,target.y-point.y);const step=speed*seconds;if(distance<=step)return {point:{...target},arrived:true};return {point:{x:point.x+(target.x-point.x)/distance*step,y:point.y+(target.y-point.y)/distance*step},arrived:false};}
