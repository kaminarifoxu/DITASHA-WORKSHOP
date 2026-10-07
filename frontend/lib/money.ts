export type Transaction={id:string;date:string;kind:'income'|'expense';amount:number;category:string;note:string};
export type Money={transactions:Transaction[];budgets:Record<string,number>};
export const emptyMoney=():Money=>({transactions:[],budgets:{}});
export function validateMoney(input:unknown):Money{
 if(input===undefined)return emptyMoney();const m=input as Money;
 if(!m||!Array.isArray(m.transactions)||m.transactions.length>10000||!m.budgets||typeof m.budgets!=='object'||Array.isArray(m.budgets)||Object.keys(m.budgets).length>600)throw new Error('Catatan keuangan tidak valid.');
 const ids=new Set<string>();for(const t of m.transactions){if(!t||typeof t.id!=='string'||!t.id||t.id.length>100||ids.has(t.id)||typeof t.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||new Date(t.date+'T00:00:00Z').toISOString().slice(0,10)!==t.date||!['income','expense'].includes(t.kind)||!Number.isSafeInteger(t.amount)||t.amount<=0||t.amount>1e12||typeof t.category!=='string'||!t.category.trim()||t.category.length>80||typeof t.note!=='string'||t.note.length>500)throw new Error('Transaksi tidak valid.');ids.add(t.id);}
 for(const [month,amount] of Object.entries(m.budgets))if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!Number.isSafeInteger(amount)||amount<0||amount>1e12)throw new Error('Anggaran tidak valid.');
 if(!Number.isSafeInteger(m.transactions.reduce((sum,t)=>sum+t.amount,0)))throw new Error('Jumlah catatan melampaui batas perhitungan aman.');
 return structuredClone(m);
}
export function totals(m:Money,month?:string){const selected=m.transactions.filter(t=>!month||t.date.startsWith(month));const income=selected.filter(t=>t.kind==='income').reduce((s,t)=>s+t.amount,0),expense=selected.filter(t=>t.kind==='expense').reduce((s,t)=>s+t.amount,0);return {income,expense,balance:income-expense,count:selected.length,budget:month?m.budgets[month]||0:0};}
export function moneyCSV(m:Money){const quote=(v:string|number)=>'"'+String(v).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';return '\ufeff'+[['Tanggal','Jenis','Jumlah IDR','Kategori','Catatan'],...m.transactions.map(t=>[t.date,t.kind,t.amount,t.category,t.note])].map(row=>row.map(quote).join(',')).join('\r\n');}
