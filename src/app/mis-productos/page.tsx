'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import {
  Plus, Upload, Search, LayoutGrid, List, Pencil, Trash2,
  Pause, Play, Loader2, X, Check, History, Download, ChevronDown, ChevronUp, Lock
} from 'lucide-react'
import type { Product, ImportHistory, ImportRow } from '@/types/database'
import clsx from 'clsx'

/* ─── tipos formulario ── */
type FormData = {
  sku: string; description: string; brand: string; category: string
  stock_quantity: string; price: string; status: 'active' | 'paused'
  contact_email: string; contact_whatsapp: string
}
const EMPTY_FORM: FormData = {
  sku: '', description: '', brand: '', category: '',
  stock_quantity: '0', price: '', status: 'active',
  contact_email: '', contact_whatsapp: '',
}
const BRANDS = ['HP', 'Lenovo', 'Samsung', 'Cisco', 'TP-Link', 'Epson', 'Dell', 'Asus', 'Acer', 'Apple', 'Otra']
const CATS   = ['Notebooks', 'Desktops', 'Monitores', 'Impresoras', 'Networking', 'Tablets', 'Servidores', 'Periféricos', 'Otro']

/* ─── Generador plantilla XLSX nativo ── */
function generateTemplateXlsx(): Blob {
  const headers = ['SKU', 'Descripcion', 'Marca', 'Categoria', 'Stock', 'Precio', 'WhatsApp', 'Email']
  const example = ['SKU-HP-001', 'HP EliteBook 840 G9 Core i7', 'HP', 'Notebooks', '5', '1500000', '+549 11 0000-0000', 'ventas@empresa.com']

  const xmlWorkbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Productos" sheetId="1" r:id="rId1"/></sheets></workbook>`
  const xmlSheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${headers.map((h,i)=>`<c r="${String.fromCharCode(65+i)}1" t="inlineStr"><is><t>${h}</t></is></c>`).join('')}</row><row r="2">${example.map((v,i)=>`<c r="${String.fromCharCode(65+i)}2" t="inlineStr"><is><t>${v}</t></is></c>`).join('')}</row></sheetData></worksheet>`
  const xmlRelWorkbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
  const xmlRelRoot     = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  const xmlContentTypes= `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`

  function strToBytes(s: string) { return new TextEncoder().encode(s) }
  function u16le(n: number) { return new Uint8Array([n&0xff,(n>>8)&0xff]) }
  function u32le(n: number) { return new Uint8Array([n&0xff,(n>>8)&0xff,(n>>16)&0xff,(n>>24)&0xff]) }
  function crc32(data: Uint8Array) {
    const table = new Uint32Array(256)
    for(let i=0;i<256;i++){let k=i;for(let j=0;j<8;j++)k=k&1?(k>>>1)^0xedb88320:k>>>1;table[i]=k>>>0}
    let c=0xffffffff;for(const b of data)c=(c>>>8)^table[(c^b)&0xff];return(~c)>>>0
  }
  function concat(arrs: Uint8Array[]) {
    const total=arrs.reduce((s,a)=>s+a.length,0);const out=new Uint8Array(total);let pos=0
    for(const a of arrs){out.set(a,pos);pos+=a.length};return out
  }

  const files=[
    {name:'[Content_Types].xml',data:strToBytes(xmlContentTypes)},
    {name:'_rels/.rels',        data:strToBytes(xmlRelRoot)},
    {name:'xl/workbook.xml',    data:strToBytes(xmlWorkbook)},
    {name:'xl/_rels/workbook.xml.rels',data:strToBytes(xmlRelWorkbook)},
    {name:'xl/worksheets/sheet1.xml',  data:strToBytes(xmlSheet)},
  ]
  const parts:Uint8Array[]=[],cdEntries:Uint8Array[]=[];let offset=0
  for(const f of files){
    const nb=strToBytes(f.name),crc=crc32(f.data)
    const lh=new Uint8Array([0x50,0x4b,0x03,0x04,0x14,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,...u32le(crc),...u32le(f.data.length),...u32le(f.data.length),...u16le(nb.length),0x00,0x00,...nb])
    const cd=new Uint8Array([0x50,0x4b,0x01,0x02,0x14,0x00,0x14,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,...u32le(crc),...u32le(f.data.length),...u32le(f.data.length),...u16le(nb.length),0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,...u32le(offset),...nb])
    parts.push(lh,f.data);cdEntries.push(cd);offset+=lh.length+f.data.length
  }
  const cdData=concat(cdEntries)
  const eocd=new Uint8Array([0x50,0x4b,0x05,0x06,0x00,0x00,0x00,0x00,...u16le(files.length),...u16le(files.length),...u32le(cdData.length),...u32le(offset),0x00,0x00])
  return new Blob([concat([...parts,cdData,eocd])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
}

function downloadTemplate() {
  const blob=generateTemplateXlsx(),url=URL.createObjectURL(blob),a=document.createElement('a')
  a.href=url;a.download='plantilla-declavo.xlsx';a.click();URL.revokeObjectURL(url)
}

/* ─── Parser XLSX nativo ── */
function u32b(buf:Uint8Array,off:number){return buf[off]|(buf[off+1]<<8)|(buf[off+2]<<16)|(buf[off+3]<<24)}
async function unzip(buffer:ArrayBuffer):Promise<Record<string,Uint8Array>>{
  const buf=new Uint8Array(buffer),files:Record<string,Uint8Array>={}
  let eocd=-1;for(let i=buf.length-22;i>=0;i--){if(buf[i]===0x50&&buf[i+1]===0x4b&&buf[i+2]===0x05&&buf[i+3]===0x06){eocd=i;break}}
  if(eocd<0)throw new Error('ZIP inválido')
  const cdOffset=u32b(buf,eocd+16),cdCount=buf[eocd+8]|(buf[eocd+9]<<8);let pos=cdOffset
  for(let i=0;i<cdCount;i++){
    if(u32b(buf,pos)!==0x02014b50)break
    const comp=buf[pos+10]|(buf[pos+11]<<8),cs=u32b(buf,pos+20),us=u32b(buf,pos+24)
    const fnl=buf[pos+28]|(buf[pos+29]<<8),el=buf[pos+30]|(buf[pos+31]<<8),cl=buf[pos+32]|(buf[pos+33]<<8)
    const lo=u32b(buf,pos+42),fn=new TextDecoder().decode(buf.slice(pos+46,pos+46+fnl))
    pos+=46+fnl+el+cl
    const lfhEl=buf[lo+28]|(buf[lo+29]<<8),lfhFl=buf[lo+26]|(buf[lo+27]<<8)
    const ds=lo+30+lfhFl+lfhEl,cd2=buf.slice(ds,ds+cs)
    if(comp===0){files[fn]=cd2}else if(comp===8){
      const stream=new DecompressionStream('deflate-raw'),w=stream.writable.getWriter(),r=stream.readable.getReader()
      w.write(cd2);w.close()
      const chunks:Uint8Array[]=[]; let tl=0
      while(true){const{done,value}=await r.read();if(done)break;chunks.push(value);tl+=value.length}
      const out=new Uint8Array(us||tl);let off2=0;for(const c of chunks){out.set(c,off2);off2+=c.length}
      files[fn]=out
    }
  }
  return files
}

async function parseXlsx(buffer:ArrayBuffer):Promise<(string|number|null)[][]>{
  const files=await unzip(buffer),dec=new TextDecoder()
  const getText=(name:string)=>{const key=Object.keys(files).find(k=>k===name||k.endsWith('/'+name.split('/').pop()!));return key?dec.decode(files[key]):''}
  const ss:string[]=[],ssXml=getText('xl/sharedStrings.xml')
  if(ssXml){for(const m of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)){const texts=[...m[1].matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map(t=>t[1]);ss.push(texts.join('').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#xD;/g,''))}}
  const wbXml=getText('xl/workbook.xml'),relXml=getText('xl/_rels/workbook.xml.rels')
  const rels:Record<string,string>={};for(const m of relXml.matchAll(/Id="([^"]+)"[^>]+Target="([^"]+)"/g))rels[m[1]]=m[2]
  const sheetDefs=[...wbXml.matchAll(/<sheet\s[^>]*name="([^"]*)"[^>]*r:id="([^"]+)"/g)]
  const chosen=sheetDefs.find(s=>s[1].toLowerCase().includes('producto'))??sheetDefs[0]
  if(!chosen)throw new Error('No se encontró ninguna hoja.')
  const rt=rels[chosen[2]]??'',sp=rt.startsWith('xl/')?rt:'xl/'+rt,shXml=getText(sp)
  if(!shXml)throw new Error('No se pudo leer la hoja.')
  const result:(string|number|null)[][]=[]; for(const rowM of shXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
    const cm:Record<number,string|number|null>={}
    for(const c of rowM[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
      const a=c[1],inn=c[2],rA=a.match(/r="([A-Z]+)(\d+)"/)
      if(!rA)continue;let ci=0;for(const ch of rA[1])ci=ci*26+ch.charCodeAt(0)-64;ci-=1
      const ct=(a.match(/t="([^"]+)"/)??[])[1]??'',vm=inn.match(/<v>([^<]*)<\/v>/),rv=vm?vm[1]:null
      let val:string|number|null=null
      if(rv!==null&&rv!==''){if(ct==='s')val=ss[parseInt(rv,10)]??'';else if(ct==='inlineStr')val=(inn.match(/<t>([^<]*)<\/t>/)??[])[1]??'';else if(ct==='b')val=rv==='1'?'TRUE':'FALSE';else{const n=parseFloat(rv);val=isNaN(n)?rv:n}}
      cm[ci]=val
    }
    if(Object.keys(cm).length===0)continue
    const mx=Math.max(...Object.keys(cm).map(Number)),row:(string|number|null)[]=[]; for(let c=0;c<=mx;c++)row.push(cm[c]??null);result.push(row)
  }
  return result
}

/* ─── Historial ── */
function ImportHistoryPanel({ orgId }: { orgId: string }) {
  const supabase = createClient()
  const [history, setHistory]   = useState<ImportHistory[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('import_history').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { setHistory((data as ImportHistory[]) ?? []); setLoading(false) })
  }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex items-center justify-center h-20"><Loader2 size={16} className="animate-spin text-brand-400" /></div>
  if (history.length === 0) return <p className="text-sm text-brand-400 text-center py-8">Sin historial aún.</p>

  return (
    <div className="flex flex-col gap-2">
      {history.map(h => (
        <div key={h.id} className="border border-brand-200 rounded-xl overflow-hidden">
          <button onClick={() => setExpanded(expanded === h.id ? null : h.id)} className="w-full flex items-center justify-between p-4 text-left hover:bg-brand-50 transition-colors">
            <div className="flex items-center gap-3">
              <History size={14} className="text-brand-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium truncate max-w-[200px]">{h.filename}</p>
                <p className="text-xs text-brand-400">{new Date(h.created_at).toLocaleString('es-AR')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-green">{h.ok_rows} OK</span>
              {h.error_rows > 0 && <span className="badge badge-amber">{h.error_rows} err</span>}
              {expanded === h.id ? <ChevronUp size={13} className="text-brand-400" /> : <ChevronDown size={13} className="text-brand-400" />}
            </div>
          </button>
          {expanded === h.id && (
            <div className="border-t border-brand-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-brand-50">
                  {['SKU','Descripción','Marca','Stock'].map(col => <th key={col} className="table-th text-[10px]">{col}</th>)}
                </tr></thead>
                <tbody>
                  {(h.snapshot ?? []).slice(0, 8).map((r: ImportRow, i: number) => (
                    <tr key={i} className="table-tr">
                      <td className="table-td font-mono text-[10px]">{r.sku}</td>
                      <td className="table-td truncate max-w-[180px] text-[11px]">{r.description}</td>
                      <td className="table-td text-[11px]">{r.brand}</td>
                      <td className="table-td text-center text-[11px]">{r.stock_quantity}</td>
                    </tr>
                  ))}
                  {(h.snapshot?.length ?? 0) > 8 && <tr><td colSpan={4} className="table-td text-center text-brand-400 text-[11px]">…y {(h.snapshot?.length ?? 0) - 8} más</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Vista de solo lectura para member ── */
function MemberView({ orgId, orgName }: { orgId: string; orgName: string }) {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('products').select('*').eq('organization_id', orgId).eq('status', 'active').order('created_at', { ascending: false })
    if (search) q = q.or(`description.ilike.%${search}%,sku.ilike.%${search}%`)
    const { data } = await q
    setProducts(data ?? []); setLoading(false)
  }, [orgId, search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch() }, [fetch])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-900">Productos de mi empresa</h1>
          <p className="text-sm text-brand-400 mt-0.5">{orgName}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
          <Lock size={13} />
          <span className="text-xs font-medium">Solo lectura — contactá a tu admin para publicar</span>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
        <input type="text" className="input pl-8" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 size={18} className="animate-spin text-brand-400" /></div>
      ) : products.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-brand-400">Sin productos activos aún.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead><tr>
              <th className="table-th" style={{ width: 130 }}>SKU</th>
              <th className="table-th">Descripción</th>
              <th className="table-th" style={{ width: 90 }}>Marca</th>
              <th className="table-th" style={{ width: 70 }}>Stock</th>
            </tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="table-tr">
                  <td className="table-td font-mono text-[11px] text-brand-400 truncate">{p.sku}</td>
                  <td className="table-td font-medium truncate">{p.description}</td>
                  <td className="table-td text-brand-500">{p.brand}</td>
                  <td className={clsx('table-td font-mono font-medium', p.stock_quantity <= 5 ? 'text-amber-700' : 'text-green-700')}>{p.stock_quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ─── Componente principal ── */
export default function MisProductosPage() {
  const supabase = createClient()
  const { user, loading: profileLoading } = useProfile()

  const role   = user?.profile?.role ?? null
  const orgId  = user?.profile?.organization_id
  const orgName = user?.organization?.name ?? '—'

  // member: solo lectura
  // org_admin: gestión completa de su empresa
  // super_admin: gestión global (ya tiene /admin para eso, aquí ve lo suyo)
  const canEdit = role === 'org_admin' || role === 'super_admin'

  const [products, setProducts]       = useState<Product[]>([])
  const [loading, setLoading]         = useState(true)
  const [view, setView]               = useState<'list' | 'grid'>('list')
  const [search, setSearch]           = useState('')
  const [showModal, setShowModal]     = useState(false)
  const [showImport, setShowImport]   = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [editId, setEditId]           = useState<string | null>(null)
  const [form, setForm]               = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState('')
  const [selected, setSelected]       = useState<Set<string>>(new Set())

  const [importRows, setImportRows]         = useState<ImportRow[]>([])
  const [importErrors, setImportErrors]     = useState<string[]>([])
  const [importing, setImporting]           = useState(false)
  const [importDone, setImportDone]         = useState(false)
  const [importLoading, setImportLoading]   = useState(false)
  const [importFilename, setImportFilename] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchProducts = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    let q = supabase.from('products').select('*').eq('organization_id', orgId).order('created_at', { ascending: false })
    if (search) q = q.or(`description.ilike.%${search}%,sku.ilike.%${search}%,brand.ilike.%${search}%`)
    const { data } = await q
    setProducts(data ?? []); setLoading(false)
  }, [orgId, search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!profileLoading) fetchProducts() }, [fetchProducts, profileLoading])

  function openAdd() { setForm(EMPTY_FORM); setEditId(null); setFormError(''); setShowModal(true) }
  function openEdit(p: Product) {
    setForm({
      sku: p.sku, description: p.description, brand: p.brand, category: p.category ?? '',
      stock_quantity: String(p.stock_quantity), price: p.price != null ? String(p.price) : '',
      status: p.status as 'active' | 'paused',
      contact_email: (p.extra_attributes as Record<string,string>)?.contact_email ?? '',
      contact_whatsapp: (p.extra_attributes as Record<string,string>)?.contact_whatsapp ?? '',
    })
    setEditId(p.id); setFormError(''); setShowModal(true)
  }

  async function handleSave() {
    if (!orgId) return
    setFormError('')
    if (!form.sku || !form.description || !form.brand) { setFormError('SKU, descripción y marca son obligatorios.'); return }
    setSaving(true)
    const payload = {
      organization_id: orgId, sku: form.sku.trim(), description: form.description.trim(),
      brand: form.brand, category: form.category || null,
      stock_quantity: Number(form.stock_quantity) || 0,
      price: form.price ? Number(form.price) : null, status: form.status,
      extra_attributes: { contact_email: form.contact_email, contact_whatsapp: form.contact_whatsapp },
    }
    const { error } = editId
      ? await supabase.from('products').update(payload).eq('id', editId)
      : await supabase.from('products').insert(payload)
    setSaving(false)
    if (error) { setFormError(error.message); return }
    setShowModal(false); fetchProducts()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este producto?')) return
    await supabase.from('products').delete().eq('id', id); fetchProducts()
  }

  async function handleToggleStatus(p: Product) {
    await supabase.from('products').update({ status: p.status === 'active' ? 'paused' : 'active' }).eq('id', p.id)
    fetchProducts()
  }

  async function handleBulkDelete() {
    if (!confirm(`¿Eliminar ${selected.size} productos?`)) return
    await supabase.from('products').delete().in('id', [...selected])
    setSelected(new Set()); fetchProducts()
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function normalizeHeader(h: string) {
    return String(h ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]/g,'')
  }

  function parseMatrix(rawRows: (string|number|null|undefined)[][], filename: string) {
    setImportFilename(filename)
    if (rawRows.length < 2) { setImportErrors(['El archivo está vacío.']); return }
    let hIdx = -1
    for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
      if (rawRows[i].map(h => normalizeHeader(String(h ?? ''))).some(h => h === 'sku')) { hIdx = i; break }
    }
    if (hIdx < 0) { setImportErrors(['No se encontró la columna SKU.']); return }
    const headers = rawRows[hIdx].map(h => normalizeHeader(String(h ?? '')))
    const idx = (...candidates: string[]) => candidates.reduce<number>((f,c) => f>=0?f:headers.findIndex(h=>h.includes(c)), -1)
    const skuIdx=idx('sku'), descIdx=idx('desc','nombre','descripcion'), brandIdx=idx('marca','brand')
    const stockIdx=idx('stock','cant'), priceIdx=idx('precio','price'), catIdx=idx('cat','categoria')
    const waIdx=idx('whatsapp','wa','celular'), emailIdx=idx('email','correo')
    if (skuIdx<0||descIdx<0||brandIdx<0) { setImportErrors(['Faltan columnas requeridas: SKU, Descripcion, Marca']); return }
    const validRows:ImportRow=[]; const errs:string[]=[]; // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawRows.slice(hIdx+1).forEach((cols: any[], i) => {
      const ln=hIdx+i+2,sku=String(cols[skuIdx]??'').trim(),desc=String(cols[descIdx]??'').trim(),brand=String(cols[brandIdx]??'').trim()
      if(!sku&&!desc&&!brand)return
      if(sku.startsWith('*')||sku.toLowerCase().includes('obligatorio')||sku.startsWith('▶'))return
      if(!sku||!desc||!brand){errs.push(`Fila ${ln}: faltan datos`);return}
      const stock=parseInt(String(stockIdx>=0?cols[stockIdx]??0:0),10)
      const ps=String(priceIdx>=0?cols[priceIdx]??'':'').replace(/\./g,'').replace(',','.')
      const price=ps!==''?parseFloat(ps):null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(validRows as any[]).push({sku,description:desc,brand,category:catIdx>=0&&cols[catIdx]?String(cols[catIdx]).trim():null,stock_quantity:isNaN(stock)?0:Math.max(0,stock),price:price&&!isNaN(price)?price:null,contact_whatsapp:waIdx>=0?String(cols[waIdx]??'').trim():'',contact_email:emailIdx>=0?String(cols[emailIdx]??'').trim():''})
    })
    setImportRows(validRows as unknown as ImportRow[]); setImportErrors(errs)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if(!file)return
    setImportRows([]); setImportErrors([]); setImportLoading(true)
    try {
      if(file.name.toLowerCase().endsWith('.xlsx')||file.name.toLowerCase().endsWith('.xls')){
        parseMatrix(await parseXlsx(await file.arrayBuffer()), file.name)
      } else {
        const text=await file.text()
        parseMatrix(text.split('\n').filter(l=>l.trim()).map(line=>{const r:string[]=[]; let cur='',q=false;for(const ch of line){if(ch==='"')q=!q;else if(ch===','&&!q){r.push(cur.trim());cur=''}else cur+=ch};r.push(cur.trim());return r}), file.name)
      }
    } catch(err){setImportErrors([`Error: ${err instanceof Error?err.message:'formato no reconocido'}`])}
    finally{setImportLoading(false);e.target.value=''}
  }

  async function handleImportConfirm() {
    if(!importRows.length||!orgId)return
    setImporting(true)
    const BATCH=100; let lastError:string|null=null
    for(let i=0;i<importRows.length;i+=BATCH){
      const batch=importRows.slice(i,i+BATCH)
      const{error}=await supabase.from('products').upsert(
        batch.map(r=>({organization_id:orgId,sku:r.sku,description:r.description,brand:r.brand,category:r.category??null,stock_quantity:r.stock_quantity,price:r.price??null,status:'active' as const,extra_attributes:{contact_email:r.contact_email??'',contact_whatsapp:r.contact_whatsapp??''}})),
        {onConflict:'organization_id,sku'}
      )
      if(error){lastError=error.message;break}
    }
    if(!lastError){
      await supabase.from('import_history').insert({organization_id:orgId,uploaded_by:user?.id??null,filename:importFilename||'importación',total_rows:importRows.length,ok_rows:importRows.length,error_rows:importErrors.length,snapshot:importRows as unknown as Record<string,unknown>[]})
    }
    setImporting(false)
    if(lastError){setImportErrors([`Error: ${lastError}`]);return}
    setImportDone(true)
    setTimeout(()=>{setShowImport(false);setImportRows([]);setImportErrors([]);setImportDone(false);fetchProducts()},1500)
  }

  const stats = { total:products.length, active:products.filter(p=>p.status==='active').length, paused:products.filter(p=>p.status==='paused').length, units:products.reduce((s,p)=>s+Number(p.stock_quantity),0) }

  if (profileLoading) return <div className="flex items-center justify-center h-64"><Loader2 size={20} className="animate-spin text-brand-400" /></div>

  // Usuario sin organización
  if (!orgId) return (
    <div className="p-8 text-center">
      <p className="text-brand-400">Tu usuario no tiene empresa asignada. Contactá al administrador.</p>
    </div>
  )

  // member: solo lectura
  if (role === 'member') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <MemberView orgId={orgId} orgName={orgName} />
      </div>
    )
  }

  // org_admin / super_admin: gestión completa
  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-900">Mis productos</h1>
          <p className="text-sm text-brand-400 mt-0.5">{orgName} · Gestioná tu stock en Declavo</p>
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowHistory(v=>!v)} className={clsx('btn', showHistory && 'ring-2 ring-brand-300')}>
              <History size={13} />Historial
            </button>
            <button onClick={downloadTemplate} className="btn">
              <Download size={13} />Plantilla Excel
            </button>
            <button onClick={() => { setImportRows([]); setImportErrors([]); setImportDone(false); setShowImport(true) }} className="btn">
              <Upload size={13} />Importar planilla
            </button>
            <button onClick={openAdd} className="btn btn-primary"><Plus size={13} />Agregar producto</button>
          </div>
        )}
      </div>

      {/* Historial */}
      {showHistory && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Historial de importaciones</h2>
            <button onClick={() => setShowHistory(false)} className="icon-btn"><X size={13} /></button>
          </div>
          <ImportHistoryPanel orgId={orgId} />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[{label:'Total',value:stats.total},{label:'Activos',value:stats.active},{label:'Pausados',value:stats.paused},{label:'Unidades',value:stats.units.toLocaleString('es-AR')}].map(s=>(
          <div key={s.label} className="bg-brand-100 rounded-xl p-4">
            <div className="text-2xl font-semibold font-mono text-brand-900">{s.value}</div>
            <div className="text-xs text-brand-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative max-w-xs flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input type="text" className="input pl-8" placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              <span className="text-xs font-medium text-blue-800">{selected.size} seleccionados</span>
              <button onClick={handleBulkDelete} className="btn btn-sm btn-danger">Eliminar</button>
              <button onClick={() => setSelected(new Set())} className="icon-btn"><X size={12} /></button>
            </div>
          )}
        </div>
        <div className="flex bg-brand-100 border border-brand-200 rounded-lg p-0.5 gap-0.5">
          {(['list','grid'] as const).map(v=>(
            <button key={v} onClick={()=>setView(v)} className={clsx('w-7 h-7 rounded-md flex items-center justify-center transition-colors', view===v?'bg-white text-brand-900':'text-brand-400')}>
              {v==='grid'?<LayoutGrid size={14}/>:<List size={14}/>}
            </button>
          ))}
        </div>
      </div>

      {/* Lista/Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={20} className="animate-spin text-brand-400" /></div>
      ) : products.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-brand-400 mb-3">No hay productos aún.</p>
          <button onClick={openAdd} className="btn btn-primary"><Plus size={13} />Agregar el primero</button>
        </div>
      ) : view === 'list' ? (
        <div className="card overflow-hidden">
          <table className="w-full" style={{ tableLayout:'fixed' }}>
            <thead><tr>
              <th className="table-th" style={{width:36}}><input type="checkbox" onChange={e=>setSelected(e.target.checked?new Set(products.map(p=>p.id)):new Set())} /></th>
              <th className="table-th" style={{width:130}}>SKU</th>
              <th className="table-th">Descripción</th>
              <th className="table-th" style={{width:90}}>Marca</th>
              <th className="table-th" style={{width:70}}>Stock</th>
              <th className="table-th" style={{width:80}}>Estado</th>
              <th className="table-th" style={{width:96,textAlign:'right'}}>Acciones</th>
            </tr></thead>
            <tbody>
              {products.map(p=>(
                <tr key={p.id} className="table-tr">
                  <td className="table-td"><input type="checkbox" checked={selected.has(p.id)} onChange={()=>toggleSelect(p.id)} /></td>
                  <td className="table-td font-mono text-[11px] text-brand-400 truncate">{p.sku}</td>
                  <td className="table-td font-medium truncate">{p.description}</td>
                  <td className="table-td text-brand-500">{p.brand}</td>
                  <td className={clsx('table-td font-mono font-medium', p.stock_quantity<=5?'text-amber-700':'text-green-700')}>{p.stock_quantity}</td>
                  <td className="table-td"><span className={clsx('badge',p.status==='active'?'badge-green':'badge-amber')}>{p.status==='active'?'Activo':'Pausado'}</span></td>
                  <td className="table-td"><div className="flex justify-end gap-1">
                    <button onClick={()=>openEdit(p)} className="icon-btn"><Pencil size={12}/></button>
                    <button onClick={()=>handleToggleStatus(p)} className="icon-btn" title={p.status==='active'?'Pausar':'Activar'}>{p.status==='active'?<Pause size={12}/>:<Play size={12}/>}</button>
                    <button onClick={()=>handleDelete(p.id)} className="icon-btn icon-btn-danger"><Trash2 size={12}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {products.map(p=>(
            <div key={p.id} className="card p-3 hover:border-brand-300 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <span className={clsx('badge',p.status==='active'?'badge-green':'badge-amber')}>{p.status==='active'?'Activo':'Pausado'}</span>
                <div className="flex gap-1">
                  <button onClick={()=>openEdit(p)} className="icon-btn"><Pencil size={12}/></button>
                  <button onClick={()=>handleDelete(p.id)} className="icon-btn icon-btn-danger"><Trash2 size={12}/></button>
                </div>
              </div>
              <p className="font-mono text-[10px] text-brand-400 mb-1">{p.sku}</p>
              <p className="text-sm font-medium leading-snug line-clamp-2 mb-1">{p.description}</p>
              <p className="text-xs text-brand-400">{p.brand}</p>
              <p className={clsx('text-xs font-medium mt-2',p.stock_quantity<=5?'text-amber-700':'text-green-700')}>{p.stock_quantity} unidades</p>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-brand-200 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-brand-200">
              <h2 className="text-base font-semibold">{editId?'Editar producto':'Agregar producto'}</h2>
              <button onClick={()=>setShowModal(false)} className="icon-btn"><X size={14}/></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div><label className="label">SKU *</label><input className="input" value={form.sku} onChange={e=>setForm(f=>({...f,sku:e.target.value}))} placeholder="SKU-HP-NB-001" /></div>
              <div><label className="label">Marca *</label><select className="input" value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))}><option value="">Seleccionar…</option>{BRANDS.map(b=><option key={b}>{b}</option>)}</select></div>
              <div className="col-span-2"><label className="label">Descripción *</label><input className="input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Nombre completo del producto" /></div>
              <div><label className="label">Categoría</label><select className="input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}><option value="">Sin categoría</option>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
              <div><label className="label">Estado</label><select className="input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value as 'active'|'paused'}))}><option value="active">Activo</option><option value="paused">Pausado</option></select></div>
              <div><label className="label">Stock *</label><input type="number" min="0" className="input" value={form.stock_quantity} onChange={e=>setForm(f=>({...f,stock_quantity:e.target.value}))} /></div>
              <div><label className="label">Precio (ARS)</label><input type="number" min="0" className="input" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} placeholder="Opcional" /></div>
              <div className="col-span-2 border-t border-brand-100 pt-3">
                <p className="text-xs font-semibold text-brand-400 mb-3 uppercase tracking-wide">Contacto para este producto</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">WhatsApp</label><input className="input" value={form.contact_whatsapp} onChange={e=>setForm(f=>({...f,contact_whatsapp:e.target.value}))} placeholder="+549 11 0000-0000" /></div>
                  <div><label className="label">Email</label><input type="email" className="input" value={form.contact_email} onChange={e=>setForm(f=>({...f,contact_email:e.target.value}))} placeholder="ventas@empresa.com" /></div>
                </div>
              </div>
              {formError && <p className="col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-brand-200">
              <button onClick={()=>setShowModal(false)} className="btn">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">{saving?<Loader2 size={13} className="animate-spin"/>:<Check size={13}/>}{editId?'Guardar cambios':'Publicar producto'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-brand-200 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-brand-200">
              <h2 className="text-base font-semibold">Importar productos</h2>
              <button onClick={()=>setShowImport(false)} className="icon-btn"><X size={14}/></button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {importDone ? (
                <div className="text-center py-8">
                  <Check size={36} className="mx-auto mb-3 text-green-600"/>
                  <p className="font-semibold text-brand-900">¡Importación completada!</p>
                  <p className="text-sm text-brand-400 mt-1">{importRows.length} productos procesados.</p>
                </div>
              ) : importRows.length === 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-brand-500">Subí tu planilla en <strong>.xlsx</strong> o <strong>.csv</strong>.</p>
                    <button onClick={downloadTemplate} className="btn btn-sm flex items-center gap-1.5 text-xs"><Download size={11}/>Descargar plantilla</button>
                  </div>
                  <div onClick={()=>!importLoading&&fileRef.current?.click()} className={clsx('border-2 border-dashed rounded-xl p-8 text-center transition-colors', importLoading?'border-brand-200 bg-brand-50 cursor-wait':'border-brand-200 cursor-pointer hover:border-brand-400 hover:bg-brand-50')}>
                    {importLoading?<Loader2 size={24} className="mx-auto mb-2 text-brand-400 animate-spin"/>:<Upload size={24} className="mx-auto mb-2 text-brand-300"/>}
                    <p className="text-sm font-medium text-brand-900">{importLoading?'Leyendo archivo…':'Hacé clic o arrastrá tu planilla aquí'}</p>
                    <p className="text-xs text-brand-400 mt-1">.xlsx · .xls · .csv</p>
                  </div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange}/>
                  {importErrors.length>0&&<div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">{importErrors.map((e,i)=><p key={i}>{e}</p>)}</div>}
                </>
              ) : (
                <>
                  <div className="text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-800 font-medium">✓ {importRows.length} filas válidas{importErrors.length>0?` · ${importErrors.length} con advertencias`:''}</div>
                  <div className="overflow-x-auto rounded-lg border border-brand-200">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-brand-50">{['SKU','Descripción','Marca','Stock'].map(h=><th key={h} className="table-th text-[10px]">{h}</th>)}</tr></thead>
                      <tbody>
                        {importRows.slice(0,6).map((r,i)=><tr key={i} className="table-tr"><td className="table-td font-mono">{r.sku}</td><td className="table-td truncate max-w-[140px]">{r.description}</td><td className="table-td">{r.brand}</td><td className="table-td text-center">{r.stock_quantity}</td></tr>)}
                        {importRows.length>6&&<tr><td colSpan={4} className="table-td text-center text-brand-400">…y {importRows.length-6} más</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {importErrors.length>0&&<div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">{importErrors.slice(0,4).map((e,i)=><p key={i}>{e}</p>)}{importErrors.length>4&&<p>…y {importErrors.length-4} más</p>}</div>}
                  <div className="flex justify-end gap-2 pt-2 border-t border-brand-200">
                    <button onClick={()=>{setImportRows([]);setImportErrors([])}} className="btn">Atrás</button>
                    <button onClick={handleImportConfirm} disabled={importing} className="btn btn-primary">{importing?<Loader2 size={13} className="animate-spin"/>:<Check size={13}/>}Confirmar ({importRows.length} productos)</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
