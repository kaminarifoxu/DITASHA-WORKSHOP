export type Point={x:number;y:number};
// Corridors follow open floor areas. Desk branches are used only when working.
export const nodes:Point[]=[{x:16,y:50},{x:29,y:50},{x:50,y:50},{x:71,y:50},{x:84,y:50},{x:50,y:27},{x:50,y:69},{x:50,y:88},{x:27,y:88},{x:72,y:88},{x:29,y:36},{x:71,y:36},{x:27,y:76},{x:72,y:76}];
const links=[[0,1],[1,2],[2,3],[3,4],[2,5],[2,6],[6,7],[7,8],[7,9],[1,10],[3,11],[8,12],[9,13]];
export const deskNodes=[10,11,12,13];
export const idleNodes=[0,1,2,3,4,5,6,7,8,9];
export function route(from:number,to:number):number[]{const queue:number[][]=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift()!,last=path[path.length-1];if(last===to)return path.slice(1);for(const edge of links){const next=edge[0]===last?edge[1]:edge[1]===last?edge[0]:-1;if(next!==-1&&!seen.has(next)){seen.add(next);queue.push([...path,next]);}}}return [];}
export function advance(point:Point,target:Point,seconds:number,speed=13){const distance=Math.hypot(target.x-point.x,target.y-point.y);const step=speed*seconds;if(distance<=step)return {point:{...target},arrived:true};return {point:{x:point.x+(target.x-point.x)/distance*step,y:point.y+(target.y-point.y)/distance*step},arrived:false};}
