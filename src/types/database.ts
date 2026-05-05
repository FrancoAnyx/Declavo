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

export interface ImportHistory {
  id: string
  organization_id: string
  uploaded_by: string | null
  filename: string
  total_rows: number
  ok_rows: number
  error_rows: number
  snapshot: ImportRow[]
  created_at: string
}

export interface ImportRow {
  sku: string
  description: string
  brand: string
  category?: string | null
  stock_quantity: number
  price?: number | null
  contact_whatsapp?: string
  contact_email?: string
}

export interface ProductMessage {
  id: string
  product_id: string
  sender_id: string
  sender_org_id: string | null
  body: string
  created_at: string
  // joined fields
  sender_name?: string | null
  sender_org_name?: string | null
}

export interface CatalogProduct extends Product {
  org_name: string
  org_logo_url: string | null
  contact_email: string | null
  contact_whatsapp: string | null
}

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected'

export interface AccessRequest {
  id: string
  name: string
  email: string
  company: string | null
  message: string | null
  status: AccessRequestStatus
  created_at: string
  processed_at: string | null
  processed_by: string | null
}

export type Database = {
  public: {
    Tables: {
      organizations:    { Row: Organization;    Insert: Partial<Organization>;    Update: Partial<Organization> }
      profiles:         { Row: Profile;         Insert: Partial<Profile>;         Update: Partial<Profile> }
      products:         { Row: Product;         Insert: Partial<Product>;         Update: Partial<Product> }
      invitations:      { Row: Invitation;      Insert: Partial<Invitation>;      Update: Partial<Invitation> }
      contact_requests: { Row: ContactRequest;  Insert: Partial<ContactRequest>;  Update: Partial<ContactRequest> }
      import_history:   { Row: ImportHistory;   Insert: Partial<ImportHistory>;   Update: Partial<ImportHistory> }
      product_messages: { Row: ProductMessage;  Insert: Partial<ProductMessage>;  Update: Partial<ProductMessage> }
      access_requests:  { Row: AccessRequest;   Insert: Partial<AccessRequest>;   Update: Partial<AccessRequest> }
    }
    Views: {
      catalog_view: { Row: CatalogProduct }
    }
    Functions: {
      search_catalog: { Args: { query: string }; Returns: CatalogProduct[] }
    }
  }
}
