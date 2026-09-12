export const TRACKS = [
 {id:'potato',name:'土豆环岛',english:'POTATO ISLAND',tag:'晴天 · 宽弯热身',description:'熟悉的小岛，大弯里也有小脾气。',sky:0xc1dcdb,colors:{} as Record<number,number>,points:[[0,31],[27,30],[44,14],[39,-12],[25,-29],[-1,-30],[-19,-25],[-38,-12],[-41,10],[-25,28]]},
 {id:'sunset',name:'落日文具湾',english:'SUNSET STATIONERY',tag:'落日 · 直道与连续弯',description:'一条长长的作业本直道，尽头突然拐进橡皮湾。',sky:0xeabf9e,colors:{[0xc1dcdb]:0xeabf9e,[0xc5cc91]:0xd9ba85,[0x85a877]:0xc98564,[0xa9bf88]:0xe3aa71,[0x566f75]:0x796373},points:[[0,32],[31,31],[45,16],[43,-19],[28,-31],[13,-25],[9,-4],[-9,2],[-28,-12],[-43,-7],[-43,15],[-27,30]]},
 {id:'moon',name:'迷航月牙岛',english:'MOONLIGHT DETOUR',tag:'月夜 · 月牙回头弯',description:'沿外环冲上月面，再折回内湾。导航：你怎么又回来了？',sky:0x687aab,colors:{[0xc1dcdb]:0x687aab,[0xc5cc91]:0xaaa6c9,[0xf3ddad]:0xc1b4cd,[0x85a877]:0x8c88bd,[0xa9bf88]:0xb6aad1,[0x566f75]:0x4a536f,[0xf48368]:0x9d87c6},points:[[0,36],[-28,28],[-44,6],[-38,-18],[-12,-34],[18,-31],[40,-17],[36,-1],[20,1],[3,-12],[-14,-13],[-25,0],[-16,16],[0,20],[18,15],[34,16],[42,28],[25,36]]},
] as const;
export type TrackId=typeof TRACKS[number]['id'];
export const isTrackId=(id:unknown):id is TrackId=>TRACKS.some(t=>t.id===id);
export const trackSpec=(id:TrackId)=>TRACKS.find(t=>t.id===id)!;
