'use client'

import { useState } from 'react'
import { useProfile } from '@/context/ProfileContext'
import ProductChat from '@/components/ProductChat'

export interface CatalogProduct {
  id: string
  sku: string
  description: string
  brand: string
  category: string | null
  stock_quantity: number
  status: string
  contact_email?: string | null
  contact_whatsapp?: string | null
  // catalog_view devuelve org_name (NO organization_name)
  org_name?: string | null
  organization_id?: string | null
}

function AvailBadge({ qty }: { qty: number }) {
  const q = Number(qty)
  if (q > 5)  return <span className="badge-success">● Disponible</span>
  if (q > 0)  return <span className="badge-warning">● Stock bajo</span>
  return             <span className="badge-danger">● Sin stock</span>
}

function WAIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.556 4.118 1.528 5.845L.057 23.743a.5.5 0 0 0 .623.623l5.898-1.471A11.948 11.948 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.884 0-3.648-.52-5.15-1.42l-.37-.22-3.499.872.887-3.5-.24-.38A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  )
}
function MailIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>
    </svg>
  )
}
function ChatIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

const CAT_GRADIENT: Record<string, string> = {
  Networking:     'linear-gradient(140deg, #1a2040 0%, #111528 100%)',
  Cómputo:        'linear-gradient(140deg, #1a2840 0%, #0f1a28 100%)',
  Notebooks:      'linear-gradient(140deg, #1a2840 0%, #0f1a28 100%)',
  Periféricos:    'linear-gradient(140deg, #1e1a40 0%, #130f28 100%)',
  Seguridad:      'linear-gradient(140deg, #221a40 0%, #160f28 100%)',
  Almacenamiento: 'linear-gradient(140deg, #1a3040 0%, #0f1e28 100%)',
  Monitores:      'linear-gradient(140deg, #1a2533 0%, #0e1820 100%)',
  Impresoras:     'linear-gradient(140deg, #251a1a 0%, #180f0f 100%)',
  Servidores:     'linear-gradient(140deg, #1a2a1a 0%, #0f1c0f 100%)',
  Tablets:        'linear-gradient(140deg, #20201a 0%, #14140f 100%)',
}
const CAT_EMOJI: Record<string, string> = {
  Networking: '🌐', Cómputo: '🖥', Notebooks: '💻', Periféricos: '🖱',
  Seguridad: '🔒', Almacenamiento: '💾', Monitores: '🖥', Impresoras: '🖨',
  Servidores: '🗄', Tablets: '📱',
}

interface ProductCardProps {
  product: CatalogProduct
  showOrg?: boolean
}

export default function ProductCard({ product, showOrg }: ProductCardProps) {
  const { user }         = useProfile()
  const isLoggedIn       = !!user?.profile
  const [chatOpen, setChatOpen] = useState(false)

  const handleWA = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isLoggedIn || !product.contact_whatsapp) return
    const num = product.contact_whatsapp.replace(/\D/g, '')
    const msg = encodeURIComponent(`Hola, vi "${product.description}" en Declavo y me interesa. ¿Podemos hablar?`)
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank')
  }

  const handleEmail = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isLoggedIn || !product.contact_email) return
    window.location.href = `mailto:${product.contact_email}?subject=Consulta Declavo: ${product.sku}&body=Hola, vi "${product.description}" en Declavo y me interesa.`
  }

  const cat      = product.category ?? ''
  const gradient = CAT_GRADIENT[cat] ?? 'linear-gradient(140deg, #1a1d35 0%, #0f1120 100%)'
  const emoji    = CAT_EMOJI[cat]    ?? '📦'

  return (
    <>
      <div className="card card-hover animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Visual header */}
        <div style={{ position: 'relative', height: 108, background: gradient, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 72, height: 72, borderRadius: '50%', background: 'var(--accent-glow)', filter: 'blur(20px)' }} />
          <span style={{ fontSize: 38, position: 'relative', filter: 'drop-shadow(0 0 12px rgba(99,102,241,.5))' }}>{emoji}</span>
          {cat && (
            <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)' }}>
              {cat}
            </span>
          )}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, background: 'linear-gradient(transparent, var(--bg-card))' }} />
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {product.sku}
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, lineHeight: 1.35, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {product.description}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="badge-accent">{product.brand}</span>
            {/* showOrg solo para super_admin — usa org_name que es el campo real de catalog_view */}
            {showOrg && product.org_name && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {product.org_name}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Stock: <strong style={{ color: 'var(--text-secondary)' }}>{product.stock_quantity}</strong>
            </span>
            <AvailBadge qty={Number(product.stock_quantity)} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.12)' }}>
          {isLoggedIn ? (
            <>
              <button className="btn-wa" onClick={handleWA} disabled={!product.contact_whatsapp} title={product.contact_whatsapp ? 'WhatsApp' : 'Sin WhatsApp'}>
                <WAIcon /> WA
              </button>
              <button className="btn-email" onClick={handleEmail} disabled={!product.contact_email} title={product.contact_email ? 'Email' : 'Sin email'}>
                <MailIcon /> Email
              </button>
              <button
                onClick={() => setChatOpen(true)}
                title="Chat interno"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', transition: 'all 0.2s', flexShrink: 0 }}
              >
                <ChatIcon /> Chat
              </button>
            </>
          ) : (
            <p style={{ width: '100%', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              <a href="/login">Iniciá sesión</a> para ver contacto
            </p>
          )}
        </div>
      </div>

      {chatOpen && (
        <ProductChat productId={product.id} productName={product.description} onClose={() => setChatOpen(false)} />
      )}
    </>
  )
}
