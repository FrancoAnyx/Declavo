export type UserRole = 'super_admin' | 'org_admin' | 'member'
export type ProductStatus = 'active' | 'paused' | 'sold'
export type ContactChannel = 'email' | 'whatsapp'

export interface Organization {
  id: string
  name: string
  legal_names: string[]
  contact_email: string
  contact_whatsapp: string | null
  api_key_hash: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string | null
  role: UserRole
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  organization_id: string
  sku: string
  description: string
  brand: string
  category: string | null
  stock_quantity: number
  price: number | null
  status: ProductStatus
  extra_attributes: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Invitation {
  id: string
  organization_id: string
  email: string
  role: UserRole
  token: string
  invited_by: string | null
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export interface ContactRequest {
  id: string
  product_id: string
  organization_id: string
  requester_email: string
  requester_name: string | null
  message: string | null
  channel: ContactChannel
  is_read: boolean
  created_at: string
}

export interface CatalogProduct extends Product {
  org_name: string
  org_logo_url: string | null
  contact_email: string | null
  contact_whatsapp: string | null
}

export type Database = {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Partial<Organization>; Update: Partial<Organization> }
      profiles:       { Row: Profile;      Insert: Partial<Profile>;      Update: Partial<Profile> }
      products:       { Row: Product;      Insert: Partial<Product>;      Update: Partial<Product> }
      invitations:    { Row: Invitation;   Insert: Partial<Invitation>;   Update: Partial<Invitation> }
      contact_requests: { Row: ContactRequest; Insert: Partial<ContactRequest>; Update: Partial<ContactRequest> }
    }
    Views: {
      catalog_view: { Row: CatalogProduct }
    }
    Functions: {
      search_catalog: { Args: { search_term: string }; Returns: CatalogProduct[] }
    }
  }
}
