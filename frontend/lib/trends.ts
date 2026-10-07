export type Trend={title:string;published:string;traffic:string;links:{title:string;url:string;source:string}[]};
export function parseTrendFeed(xml:string):Trend[]{
 if(typeof xml!=='string'||xml.length>1000000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Feed tren tidak valid.');
 const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='rss')throw new Error('Feed tren tidak valid.');
 const text=(node:Element,name:string,max=300)=>node.getElementsByTagNameNS('*',name)[0]?.textContent?.trim().slice(0,max)||'';
 const trends=Array.from(doc.getElementsByTagName('item')).slice(0,20).map(item=>({title:text(item,'title'),published:text(item,'pubDate'),traffic:text(item,'approx_traffic'),links:Array.from(item.getElementsByTagNameNS('*','news_item')).slice(0,3).flatMap(news=>{const url=text(news,'news_item_url',2000);try{const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password)return [];}catch{return [];}return [{title:text(news,'news_item_title'),url,source:text(news,'news_item_source')}];})})).filter(t=>t.title);
 if(!trends.length)throw new Error('Tidak ada tren live pada feed saat ini. Coba lagi nanti.');return trends;
}
export function trendSources(trends:Trend[],fetchedAt:string){return '\n\nSumber tren: Google Trends Indonesia (tren penelusuran Google, bukan peringkat viral TikTok/Instagram).\nDiambil: '+fetchedAt+'\nhttps://trends.google.com/trending?geo=ID\n'+trends.slice(0,6).map(t=>'- '+t.title+' · '+t.traffic+' · '+t.published+(t.links[0]?'\n  '+t.links[0].url:'')).join('\n');}
