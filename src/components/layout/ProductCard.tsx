'use client'

import { useProfile } from '@/context/ProfileContext'

export interface CatalogProduct {
  id: string
  sku: string
  description: string
  brand: string
  category: string | null
  stock_quantity: number
  // Viene de catalog_view / search_catalog()
  contact_email?: string | null
  contact_whatsapp?: string | null
  // Solo visible para super_admin
  organization_name?: string | null
}

function AvailBadge({ qty }: { qty: number }) {
  if (qty > 5)  return <span className="badge-success"><span>●</span> Disponible</span>
  if (qty > 0)  return <span className="badge-warning"><span>●</span> Stock bajo</span>
  return             <span className="badge-danger"><span>●</span> Sin stock</span>
}

// Ícono WhatsApp
function WAIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.556 4.118 1.528 5.845L.057 23.743a.5.5 0 0 0 .623.623l5.898-1.471A11.948 11.948 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.884 0-3.648-.52-5.15-1.42l-.37-.22-3.499.872.887-3.5-.24-.38A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  )
}

// Ícono Email
function MailIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <polyline points="2,4 12,13 22,4"/>
    </svg>
  )
}

// Gradiente de imagen por categoría
const CATEGORY_GRADIENTS: Record<string, string> = {
  Networking:     'linear-gradient(135deg, #1a1d35, #0f1525)',
  Cómputo:        'linear-gradient(135deg, #1a2535, #0f1520)',
  Periféricos:    'linear-gradient(135deg, #1a1a35, #100f25)',
  Seguridad:      'linear-gradient(135deg, #1d1a35, #120f25)',
  Almacenamiento: 'linear-gradient(135deg, #1a2835, #0f1828)',
}

const CATEGORY_EMOJI: Record<string, string> = {
  Networking:     '🌐',
  Cómputo:        '🖥',
  Periféricos:    '🖱',
  Seguridad:      '🔒',
  Almacenamiento: '💾',
}

interface ProductCardProps {
  product: CatalogProduct
  showOrg?: boolean // solo para super_admin
}

export default function ProductCard({ product, showOrg }: ProductCardProps) {
  const { profile } = useProfile()
  const isLoggedIn = !!profile

  const handleWA = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isLoggedIn || !product.contact_whatsapp) return
    const num = product.contact_whatsapp.replace(/\D/g, '')
    const msg = encodeURIComponent(
      `Hola, vi "${product.description}" en Declavo y me interesa. ¿Podemos hablar?`
    )
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank')
  }

  const handleEmail = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isLoggedIn || !product.contact_email) return
    window.location.href = `mailto:${product.contact_email}?subject=Consulta Declavo: ${product.sku}&body=Hola, vi "${product.description}" en Declavo y me interesa.`
  }

  const gradient = CATEGORY_GRADIENTS[product.category ?? ''] ?? 'linear-gradient(135deg, #1a1d35, #0f1120)'
  const emoji = CATEGORY_EMOJI[product.category ?? ''] ?? '📦'

  return (
    <div className="card card-hover flex flex-col animate-fade-in-up">
      {/* Header visual */}
      <div
        className="relative flex items-center justify-center"
        style={{ height: 110, background: gradient, overflow: 'hidden' }}
      >
        {/* Glow orb */}
        <div
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 80, height: 80, borderRadius: '50%',
            background: 'var(--accent-glow)',
            filter: 'blur(24px)',
          }}
        />
        <span style={{ fontSize: 40, filter: 'drop-shadow(0 0 16px rgba(99,102,241,.6))', position: 'relative' }}>
          {emoji}
        </span>
        {/* Categoría badge */}
        {product.category && (
          <span
            className="absolute top-2.5 right-2.5 text-xs font-bold px-2 py-0.5 rounded-lg"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--accent)',
            }}
          >
            {product.category}
          </span>
        )}
        {/* Fade bottom */}
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 32,
            background: 'linear-gradient(to bottom, transparent, var(--bg-card))',
          }}
        />
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        {/* SKU */}
        <div
          className="text-xs font-bold tracking-wider uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          {product.sku}
        </div>

        {/* Descripción */}
        <div
          className="font-display font-semibold text-sm leading-snug line-clamp-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {product.description}
        </div>

        {/* Marca + empresa */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge-accent">{product.brand}</span>
          {showOrg && product.organization_name && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-md"
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              {product.organization_name}
            </span>
          )}
        </div>

        {/* Stock */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Stock: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              {product.stock_quantity}
            </span>
          </span>
          <AvailBadge qty={Number(product.stock_quantity)} />
        </div>
      </div>

      {/* Footer - contacto */}
      <div
        className="flex gap-2 px-4 py-3"
        style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.08)' }}
      >
        {isLoggedIn ? (
          <>
            <button
              className="btn-wa"
              onClick={handleWA}
              disabled={!product.contact_whatsapp}
              title={!product.contact_whatsapp ? 'Sin WhatsApp configurado' : ''}
            >
              <WAIcon /> WhatsApp
            </button>
            <button
              className="btn-email"
              onClick={handleEmail}
              disabled={!product.contact_email}
              title={!product.contact_email ? 'Sin email configurado' : ''}
            >
              <MailIcon /> Email
            </button>
          </>
        ) : (
          <p className="w-full text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            <a href="/login" style={{ color: 'var(--accent)' }}>Iniciá sesión</a> para contactar
          </p>
        )}
      </div>
    </div>
  )
}
