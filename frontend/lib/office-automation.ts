import {api,native} from './desktop';
import {officeEngine} from './office-engine';

// Windows queues scheduled scans while this office is alive. The scan is claimed
// through the same desk-controlled native path as the manual button.
export function startOfficeAutomation(onError:(message:string)=>void){
 let stopped=false,running=false;
 async function poll(){
  if(stopped||running)return;
  running=true;
  try{
   const state=await native('assistantTools',JSON.stringify({action:'mailOfficePulse'}),210000);
   if(!stopped&&state.due&&!officeEngine.chatBusy){
    await native('assistantTools',JSON.stringify({action:'mailScan'}),210000);
    await api('/api/money/sync-mail',{});
    window.dispatchEvent(new Event('ditasha-mail-updated'));
   }
  }catch(error){if(!stopped)onError((error as Error).message);}
  finally{running=false;}
 }
 const timer=setInterval(()=>void poll(),15000);
 void poll();
 return ()=>{stopped=true;clearInterval(timer);};
}
