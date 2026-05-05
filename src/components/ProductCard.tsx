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
  created_at?: string | null
  org_name?: string | null
  organization_id?: string | null
}

function AvailBadge({ qty }: { qty: number }) {
  const q = Number(qty)
  if (q > 5)  return <span className="badge-success">● Disponible</span>
  if (q > 0)  return <span className="badge-warning">● Stock bajo</span>
  return             <span className="badge-danger">● Sin stock</span>
}

function ChatIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

function formatCreatedAt(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7)  return `Hace ${diffDays} días`
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem.`
  if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} mes${Math.floor(diffDays / 30) > 1 ? 'es' : ''}`
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ProductCard({ product, showOrg }: ProductCardProps) {
  const { user }         = useProfile()
  const isLoggedIn       = !!user?.profile
  const [chatOpen, setChatOpen] = useState(false)

  const cat      = product.category ?? ''
  const gradient = CAT_GRADIENT[cat] ?? 'linear-gradient(140deg, #1a1d35 0%, #0f1120 100%)'
  const emoji    = CAT_EMOJI[cat]    ?? '📦'
  const dateLabel = formatCreatedAt(product.created_at)

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
          {dateLabel && (
            <span style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)' }}>
              📅 {dateLabel}
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

        {/* Footer — solo Chat */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.12)' }}>
          {isLoggedIn ? (
            <button
              onClick={() => setChatOpen(true)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '9px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
                color: 'var(--accent)', transition: 'all 0.2s',
              }}
            >
              <ChatIcon /> Consultar por chat
            </button>
          ) : (
            <p style={{ width: '100%', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              <a href="/login">Iniciá sesión</a> para consultar
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
