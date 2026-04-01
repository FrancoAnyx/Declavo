'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { Plus, Upload, Search, LayoutGrid, List, Pencil, Trash2, Pause, Play, Loader2, X, Check } from 'lucide-react'
import type { Product } from '@/types/database'
import clsx from 'clsx'

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

type ImportRow = {
  sku: string; description: string; brand: string
  category?: string | null; stock_quantity: number
  price?: number | null; contact_whatsapp?: string; contact_email?: string
}

// ── Minimal XLSX parser — zero npm dependencies ───────────────────────────────
// .xlsx = ZIP file. We parse the ZIP using only native browser APIs.

/** Read a 4-byte little-endian uint from a Uint8Array at offset */
function u32(buf: Uint8Array, off: number) {
  return buf[off] | (buf[off+1] << 8) | (buf[off+2] << 16) | (buf[off+3] << 24)
}

/** Extract all files from a ZIP archive (no compression or deflate-only) */
async function unzip(buffer: ArrayBuffer): Promise<Record<string, Uint8Array>> {
  const buf = new Uint8Array(buffer)
  const files: Record<string, Uint8Array> = {}

  // Find End of Central Directory signature: 0x06054b50
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf[i] === 0x50 && buf[i+1] === 0x4b && buf[i+2] === 0x05 && buf[i+3] === 0x06) {
      eocd = i; break
    }
  }
  if (eocd < 0) throw new Error('Archivo ZIP inválido')

  const cdOffset = u32(buf, eocd + 16)
  const cdCount  = buf[eocd + 8] | (buf[eocd + 9] << 8)

  let pos = cdOffset
  for (let i = 0; i < cdCount; i++) {
    if (u32(buf, pos) !== 0x02014b50) break  // Central directory signature

    const compression = buf[pos + 10] | (buf[pos + 11] << 8)
    const compSize    = u32(buf, pos + 20)
    const uncompSize  = u32(buf, pos + 24)
    const fnLen       = buf[pos + 28] | (buf[pos + 29] << 8)
    const extraLen    = buf[pos + 30] | (buf[pos + 31] << 8)
    const commentLen  = buf[pos + 32] | (buf[pos + 33] << 8)
    const localOffset = u32(buf, pos + 42)
    const filename    = new TextDecoder().decode(buf.slice(pos + 46, pos + 46 + fnLen))

    pos += 46 + fnLen + extraLen + commentLen

    // Read local file header to find actual data offset
    const lfhExtraLen = buf[localOffset + 28] | (buf[localOffset + 29] << 8)
    const lfhFnLen    = buf[localOffset + 26] | (buf[localOffset + 27] << 8)
    const dataStart   = localOffset + 30 + lfhFnLen + lfhExtraLen
    const compData    = buf.slice(dataStart, dataStart + compSize)

    if (compression === 0) {
      // Stored (no compression)
      files[filename] = compData
    } else if (compression === 8) {
      // Deflate — use DecompressionStream (native browser API, no deps)
      const ds = new DecompressionStream('deflate-raw')
      const writer = ds.writable.getWriter()
      const reader = ds.readable.getReader()
      writer.write(compData)
      writer.close()

      const chunks: Uint8Array[] = []
      let totalLen = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value); totalLen += value.length
      }
      const out = new Uint8Array(uncompSize || totalLen)
      let off = 0
      for (const chunk of chunks) { out.set(chunk, off); off += chunk.length }
      files[filename] = out
    }
  }
  return files
}

/** Parse an .xlsx buffer into a 2D array of rows */
async function parseXlsx(buffer: ArrayBuffer): Promise<(string | number | null)[][]> {
  const files = await unzip(buffer)

  const dec = new TextDecoder()
  const getText = (name: string) => {
    const key = Object.keys(files).find(k => k === name || k.endsWith('/' + name.split('/').pop()!))
    return key ? dec.decode(files[key]) : ''
  }

  // Parse shared strings
  const sharedStrings: string[] = []
  const ssXml = getText('xl/sharedStrings.xml')
  if (ssXml) {
    for (const m of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      const texts = [...m[1].matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map(t => t[1])
      sharedStrings.push(
        texts.join('')
          .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
          .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#xD;/g,'')
      )
    }
  }

  // Find sheet — prefer one named "Productos", else first sheet
  const wbXml = getText('xl/workbook.xml')
  const relXml = getText('xl/_rels/workbook.xml.rels')

  const rels: Record<string, string> = {}
  for (const m of relXml.matchAll(/Id="([^"]+)"[^>]+Target="([^"]+)"/g)) {
    rels[m[1]] = m[2]
  }

  const sheetDefs = [...wbXml.matchAll(/<sheet\s[^>]*name="([^"]*)"[^>]*r:id="([^"]+)"/g)]
  const chosen = sheetDefs.find(s => s[1].toLowerCase().includes('producto')) ?? sheetDefs[0]
  if (!chosen) throw new Error('No se encontró ninguna hoja en el archivo.')

  const relTarget = rels[chosen[2]] ?? ''
  const sheetPath = relTarget.startsWith('xl/') ? relTarget : 'xl/' + relTarget
  const sheetXml = getText(sheetPath)
  if (!sheetXml) throw new Error('No se pudo leer la hoja de datos.')

  // Parse rows and cells
  const result: (string | number | null)[][] = []

  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cellMap: Record<number, string | number | null> = {}
    for (const cm of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cm[1], inner = cm[2]
      const rAttr = attrs.match(/r="([A-Z]+)(\d+)"/)
      if (!rAttr) continue

      // Column letters → 0-based index
      let colIdx = 0
      for (const ch of rAttr[1]) colIdx = colIdx * 26 + ch.charCodeAt(0) - 64
      colIdx -= 1

      const cellType = (attrs.match(/t="([^"]+)"/) ?? [])[1] ?? ''
      const vMatch   = inner.match(/<v>([^<]*)<\/v>/)
      const rawVal   = vMatch ? vMatch[1] : null

      let value: string | number | null = null
      if (rawVal !== null && rawVal !== '') {
        if (cellType === 's') {
          value = sharedStrings[parseInt(rawVal, 10)] ?? ''
        } else if (cellType === 'inlineStr') {
          value = (inner.match(/<t>([^<]*)<\/t>/) ?? [])[1] ?? ''
        } else if (cellType === 'b') {
          value = rawVal === '1' ? 'TRUE' : 'FALSE'
        } else {
          const n = parseFloat(rawVal)
          value = isNaN(n) ? rawVal : n
        }
      }
      cellMap[colIdx] = value
    }

    if (Object.keys(cellMap).length === 0) continue
    const maxCol = Math.max(...Object.keys(cellMap).map(Number))
    const row: (string | number | null)[] = []
    for (let c = 0; c <= maxCol; c++) row.push(cellMap[c] ?? null)
    result.push(row)
  }

  return result
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MisProductosPage() {
  const supabase = createClient()
  const { user, loading: profileLoading } = useProfile()

  const [products, setProducts]   = useState<Product[]>([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState<'list' | 'grid'>('list')
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [form, setForm]           = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState('')
  const [selected, setSelected]   = useState<Set<string>>(new Set())

  const [importRows, setImportRows]       = useState<ImportRow[]>([])
  const [importErrors, setImportErrors]   = useState<string[]>([])
  const [importing, setImporting]         = useState(false)
  const [importDone, setImportDone]       = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const orgId = user?.profile?.organization_id

  const fetchProducts = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    let query = supabase.from('products').select('*').eq('organization_id', orgId).order('created_at', { ascending: false })
    if (search) query = query.or(`description.ilike.%${search}%,sku.ilike.%${search}%,brand.ilike.%${search}%`)
    const { data } = await query
    setProducts(data ?? []); setLoading(false)
  }, [orgId, search])

  useEffect(() => { if (!profileLoading) fetchProducts() }, [fetchProducts, profileLoading])

  function openAdd() { setForm(EMPTY_FORM); setEditId(null); setFormError(''); setShowModal(true) }
  function openEdit(p: Product) {
    setForm({
      sku: p.sku, description: p.description, brand: p.brand,
      category: p.category ?? '', stock_quantity: String(p.stock_quantity),
      price: p.price != null ? String(p.price) : '', status: p.status as 'active' | 'paused',
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
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return
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
    return String(h ?? '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, '')
  }

  function parseMatrix(rawRows: (string | number | null | undefined)[][]): void {
    if (rawRows.length < 2) { setImportErrors(['El archivo está vacío o no tiene datos.']); return }

    const headers = rawRows[0].map(h => normalizeHeader(String(h ?? '')))
    const idx = (...candidates: string[]) =>
      candidates.reduce<number>((f, c) => f >= 0 ? f : headers.findIndex(h => h.includes(c)), -1)

    const skuIdx = idx('sku'), descIdx = idx('desc','nombre','descripcion','description')
    const brandIdx = idx('marca','brand'), stockIdx = idx('stock','cant','cantidad','quantity')
    const priceIdx = idx('precio','price'), catIdx = idx('cat','categoria','category')
    const waIdx = idx('whatsapp','contacto_w','wa','celular'), emailIdx = idx('email','contacto_e','correo')

    if (skuIdx < 0 || descIdx < 0 || brandIdx < 0) {
      setImportErrors([
        'No se encontraron las columnas requeridas.',
        `Columnas detectadas: ${headers.join(', ')}`,
        'El archivo debe tener: SKU, Descripcion, Marca',
      ]); return
    }

    const validRows: ImportRow[] = []
    const errs: string[] = []

    rawRows.slice(1).forEach((cols, i) => {
      const lineNum = i + 2
      const sku = String(cols[skuIdx] ?? '').trim()
      const desc = String(cols[descIdx] ?? '').trim()
      const brand = String(cols[brandIdx] ?? '').trim()
      if (!sku && !desc && !brand) return
      if (!sku || !desc || !brand) { errs.push(`Fila ${lineNum}: SKU, descripción o marca vacíos — omitida`); return }

      const stock = parseInt(String(stockIdx >= 0 ? cols[stockIdx] ?? 0 : 0), 10)
      const priceStr = String(priceIdx >= 0 ? cols[priceIdx] ?? '' : '').replace(/\./g,'').replace(',','.')
      const price = priceStr !== '' ? parseFloat(priceStr) : null

      validRows.push({
        sku, description: desc, brand,
        category: catIdx >= 0 && cols[catIdx] ? String(cols[catIdx]).trim() : null,
        stock_quantity: isNaN(stock) ? 0 : Math.max(0, stock),
        price: price && !isNaN(price) ? price : null,
        contact_whatsapp: waIdx >= 0 ? String(cols[waIdx] ?? '').trim() : '',
        contact_email: emailIdx >= 0 ? String(cols[emailIdx] ?? '').trim() : '',
      })
    })

    setImportRows(validRows); setImportErrors(errs)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportRows([]); setImportErrors([]); setImportLoading(true)
    try {
      if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
        const matrix = await parseXlsx(await file.arrayBuffer())
        parseMatrix(matrix)
      } else {
        const text = await file.text()
        const matrix = text.split('\n').filter(l => l.trim()).map(line => {
          const result: string[] = []; let cur = '', inQuote = false
          for (const ch of line) {
            if (ch === '"') { inQuote = !inQuote }
            else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = '' }
            else { cur += ch }
          }
          result.push(cur.trim()); return result
        })
        parseMatrix(matrix)
      }
    } catch (err) {
      setImportErrors([`Error al leer el archivo: ${err instanceof Error ? err.message : 'formato no reconocido'}`])
    } finally {
      setImportLoading(false); e.target.value = ''
    }
  }

  async function handleImportConfirm() {
    if (!orgId || importRows.length === 0) return
    setImporting(true)
    await supabase.from('products').upsert(
      importRows.map(r => ({
        organization_id: orgId, sku: r.sku, description: r.description, brand: r.brand,
        category: r.category ?? null, stock_quantity: r.stock_quantity, price: r.price ?? null,
        status: 'active' as const,
        extra_attributes: { contact_email: r.contact_email ?? '', contact_whatsapp: r.contact_whatsapp ?? '' },
      })),
      { onConflict: 'organization_id,sku' }
    )
    setImporting(false); setImportDone(true)
    setTimeout(() => { setShowImport(false); setImportRows([]); setImportErrors([]); setImportDone(false); fetchProducts() }, 1500)
  }

  const stats = {
    total: products.length,
    active: products.filter(p => p.status === 'active').length,
    paused: products.filter(p => p.status === 'paused').length,
    units: products.reduce((s, p) => s + Number(p.stock_quantity), 0),
  }

  if (profileLoading) return <div className="flex items-center justify-center h-64"><Loader2 size={20} className="animate-spin text-brand-400" /></div>

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium">Mis productos</h1>
          <p className="text-sm text-brand-400 mt-0.5">{user?.organization?.name} · Gestioná tu stock en Declavo</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setImportRows([]); setImportErrors([]); setImportDone(false); setShowImport(true) }} className="btn">
            <Upload size={13} />Importar planilla
          </button>
          <button onClick={openAdd} className="btn btn-primary"><Plus size={13} />Agregar producto</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {[
          { label: 'Total publicados', value: stats.total },
          { label: 'Activos',          value: stats.active },
          { label: 'Pausados',         value: stats.paused },
          { label: 'Unidades en stock',value: stats.units.toLocaleString('es-AR') },
        ].map(s => (
          <div key={s.label} className="bg-brand-100 rounded-lg p-3">
            <div className="text-2xl font-medium font-mono">{s.value}</div>
            <div className="text-xs text-brand-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative max-w-xs flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input type="text" className="input pl-8" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} />
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
          {(['list', 'grid'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={clsx('w-7 h-7 rounded-md flex items-center justify-center transition-colors', view === v ? 'bg-white text-brand-900' : 'text-brand-400')}>
              {v === 'grid' ? <LayoutGrid size={14} /> : <List size={14} />}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={20} className="animate-spin text-brand-400" /></div>
      ) : products.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-brand-400 mb-3">No hay productos aún.</p>
          <button onClick={openAdd} className="btn btn-primary"><Plus size={13} />Agregar el primero</button>
        </div>
      ) : view === 'list' ? (
        <div className="card overflow-hidden">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead><tr>
              <th className="table-th" style={{ width: 36 }}><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(products.map(p => p.id)) : new Set())} /></th>
              <th className="table-th" style={{ width: 130 }}>SKU</th>
              <th className="table-th">Descripción</th>
              <th className="table-th" style={{ width: 90 }}>Marca</th>
              <th className="table-th" style={{ width: 70 }}>Stock</th>
              <th className="table-th" style={{ width: 80 }}>Estado</th>
              <th className="table-th" style={{ width: 96, textAlign: 'right' }}>Acciones</th>
            </tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="table-tr">
                  <td className="table-td"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                  <td className="table-td font-mono text-[11px] text-brand-400 truncate">{p.sku}</td>
                  <td className="table-td font-medium truncate">{p.description}</td>
                  <td className="table-td text-brand-500">{p.brand}</td>
                  <td className={clsx('table-td font-mono font-medium', p.stock_quantity <= 5 ? 'text-amber-700' : 'text-green-700')}>{p.stock_quantity}</td>
                  <td className="table-td"><span className={clsx('badge', p.status === 'active' ? 'badge-green' : 'badge-amber')}>{p.status === 'active' ? 'Activo' : 'Pausado'}</span></td>
                  <td className="table-td"><div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(p)} className="icon-btn"><Pencil size={12} /></button>
                    <button onClick={() => handleToggleStatus(p)} className="icon-btn" title={p.status === 'active' ? 'Pausar' : 'Activar'}>
                      {p.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="icon-btn icon-btn-danger"><Trash2 size={12} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {products.map(p => (
            <div key={p.id} className="card p-3 hover:border-brand-300 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <span className={clsx('badge', p.status === 'active' ? 'badge-green' : 'badge-amber')}>{p.status === 'active' ? 'Activo' : 'Pausado'}</span>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="icon-btn"><Pencil size={12} /></button>
                  <button onClick={() => handleDelete(p.id)} className="icon-btn icon-btn-danger"><Trash2 size={12} /></button>
                </div>
              </div>
              <p className="font-mono text-[10px] text-brand-400 mb-1">{p.sku}</p>
              <p className="text-sm font-medium leading-snug line-clamp-2 mb-1">{p.description}</p>
              <p className="text-xs text-brand-400">{p.brand}</p>
              <p className={clsx('text-xs font-medium mt-2', p.stock_quantity <= 5 ? 'text-amber-700' : 'text-green-700')}>{p.stock_quantity} unidades</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-brand-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-brand-200">
              <h2 className="text-base font-medium">{editId ? 'Editar producto' : 'Agregar producto'}</h2>
              <button onClick={() => setShowModal(false)} className="icon-btn"><X size={14} /></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div><label className="label">SKU *</label><input className="input" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU-HP-NB-001" /></div>
              <div><label className="label">Marca *</label>
                <select className="input" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}>
                  <option value="">Seleccionar…</option>{BRANDS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className="label">Descripción *</label><input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Nombre completo del producto" /></div>
              <div><label className="label">Categoría</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="">Sin categoría</option>{CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">Estado</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'paused' }))}>
                  <option value="active">Activo</option><option value="paused">Pausado</option>
                </select>
              </div>
              <div><label className="label">Cantidad en stock *</label><input type="number" min="0" className="input" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} /></div>
              <div><label className="label">Precio sugerido (ARS)</label><input type="number" min="0" className="input" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="Opcional" /></div>
              <div className="col-span-2 border-t border-brand-100 pt-3">
                <p className="text-xs font-medium text-brand-400 mb-3">Datos de contacto para este producto</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">WhatsApp</label><input className="input" value={form.contact_whatsapp} onChange={e => setForm(f => ({ ...f, contact_whatsapp: e.target.value }))} placeholder="+549 11 0000-0000" /></div>
                  <div><label className="label">Email de contacto</label><input type="email" className="input" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="ventas@empresa.com" /></div>
                </div>
              </div>
              {formError && <p className="col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-brand-200">
              <button onClick={() => setShowModal(false)} className="btn">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {editId ? 'Guardar cambios' : 'Publicar producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-brand-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-brand-200">
              <h2 className="text-base font-medium">Importar productos</h2>
              <button onClick={() => setShowImport(false)} className="icon-btn"><X size={14} /></button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {importDone && (
                <div className="text-center py-6">
                  <Check size={36} className="mx-auto mb-3 text-green-600" />
                  <p className="font-medium">¡Importación completada!</p>
                  <p className="text-sm text-brand-400 mt-1">{importRows.length} productos procesados.</p>
                </div>
              )}
              {!importDone && importRows.length === 0 && (
                <>
                  <p className="text-sm text-brand-500">
                    Subí la planilla en formato <strong>.xlsx</strong> (Excel) o <strong>.csv</strong>.
                    Usá la plantilla oficial de Declavo para evitar errores.
                  </p>
                  <div
                    onClick={() => !importLoading && fileRef.current?.click()}
                    className={clsx('border-2 border-dashed rounded-xl p-8 text-center transition-colors',
                      importLoading ? 'border-brand-200 bg-brand-50 cursor-wait' : 'border-brand-200 cursor-pointer hover:border-brand-400 hover:bg-brand-50'
                    )}
                  >
                    {importLoading ? <Loader2 size={24} className="mx-auto mb-2 text-brand-400 animate-spin" /> : <Upload size={24} className="mx-auto mb-2 text-brand-300" />}
                    <p className="text-sm font-medium text-brand-900">{importLoading ? 'Leyendo archivo…' : 'Arrastrá o hacé clic para subir'}</p>
                    <p className="text-xs text-brand-400 mt-1">.xlsx · .xls · .csv · máx 10 MB</p>
                  </div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={handleFileChange} />
                  {importErrors.length > 0 && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                      {importErrors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </>
              )}
              {!importDone && importRows.length > 0 && (
                <>
                  <div className="text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-800 font-medium">
                    ✓ {importRows.length} filas válidas{importErrors.length > 0 ? ` · ${importErrors.length} con advertencias` : ''}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-brand-200">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-brand-50">
                        {['SKU','Descripción','Marca','Stock'].map(h => <th key={h} className="table-th text-[10px]">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {importRows.slice(0, 6).map((r, i) => (
                          <tr key={i} className="table-tr">
                            <td className="table-td font-mono">{r.sku}</td>
                            <td className="table-td truncate max-w-[140px]">{r.description}</td>
                            <td className="table-td">{r.brand}</td>
                            <td className="table-td text-center">{r.stock_quantity}</td>
                          </tr>
                        ))}
                        {importRows.length > 6 && <tr><td colSpan={4} className="table-td text-center text-brand-400">…y {importRows.length - 6} más</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {importErrors.length > 0 && (
                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                      {importErrors.slice(0, 4).map((e, i) => <p key={i}>{e}</p>)}
                      {importErrors.length > 4 && <p>…y {importErrors.length - 4} advertencias más</p>}
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2 border-t border-brand-200">
                    <button onClick={() => { setImportRows([]); setImportErrors([]) }} className="btn">Atrás</button>
                    <button onClick={handleImportConfirm} disabled={importing} className="btn btn-primary">
                      {importing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Confirmar ({importRows.length} productos)
                    </button>
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
