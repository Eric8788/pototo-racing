export const TRACKS = [
 {id:'potato',name:'土豆环岛',english:'POTATO ISLAND',tag:'晴天 · 宽弯热身',description:'熟悉的小岛，大弯里也有小脾气。',sky:0xc1dcdb,colors:{} as Record<number,number>,points:[[0,31],[27,30],[44,14],[39,-12],[25,-29],[-1,-30],[-19,-25],[-38,-12],[-41,10],[-25,28]]},
 {id:'sunset',name:'落日文具湾',english:'SUNSET STATIONERY',tag:'落日 · 长直道',description:'把烦恼甩进海里，把油门踩到下课。',sky:0xeabf9e,colors:{[0xc1dcdb]:0xeabf9e,[0xc5cc91]:0xd9ba85,[0x85a877]:0xc98564,[0xa9bf88]:0xe3aa71,[0x566f75]:0x796373},points:[[0,33],[27,32],[45,18],[47,-4],[33,-27],[6,-34],[-27,-32],[-45,-14],[-44,15],[-27,32]]},
 {id:'moon',name:'迷航月牙岛',english:'MOONLIGHT DETOUR',tag:'月夜 · 连续弯',description:'导航说到了。外星人说，再绕三圈。',sky:0x687aab,colors:{[0xc1dcdb]:0x687aab,[0xc5cc91]:0xaaa6c9,[0xf3ddad]:0xc1b4cd,[0x85a877]:0x8c88bd,[0xa9bf88]:0xb6aad1,[0x566f75]:0x4a536f,[0xf48368]:0x9d87c6},points:[[0,32],[22,31],[39,23],[45,4],[35,-16],[21,-31],[-4,-32],[-28,-26],[-44,-8],[-39,15],[-22,29]]},
] as const;
export type TrackId=typeof TRACKS[number]['id'];
export const isTrackId=(id:unknown):id is TrackId=>TRACKS.some(t=>t.id===id);
export const trackSpec=(id:TrackId)=>TRACKS.find(t=>t.id===id)!;
