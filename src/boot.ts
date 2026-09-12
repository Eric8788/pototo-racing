import {gameAudio} from './audio';
import './launch.css';
// Unlock within the user's gesture, before importing the 3D bundle.
window.addEventListener('pointerdown',()=>void gameAudio.unlock(),{passive:true});
window.addEventListener('keydown',()=>void gameAudio.unlock());
void gameAudio.unlock();
let game:Promise<typeof import('./main')>|undefined;
const status=document.getElementById('landing-status')!;
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-entry]')){
 button.onclick=async()=>{
  document.querySelectorAll<HTMLButtonElement>('[data-entry]').forEach(b=>b.disabled=true);
  status.textContent='正在打开车库…';
  try{game??=import('./main');await(await game).enterSetup(button.dataset.entry as 'single'|'online');status.textContent='';}
  catch(error){console.error(error);status.innerHTML='车库加载失败，请检查网络后 <button id="load-retry">重新加载</button>';document.getElementById('load-retry')!.onclick=()=>location.reload();}
  finally{document.querySelectorAll<HTMLButtonElement>('[data-entry]').forEach(b=>b.disabled=false);}
 };
}
if(new URLSearchParams(location.search).has('room'))status.textContent='你收到一个房间邀请，选择「多人联机」后加入。';
