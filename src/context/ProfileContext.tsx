'use client'
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Organization } from '@/types/database'

export interface AuthUser {
  id: string
  email: string
  profile: Profile | null
  organization: Organization | null
}

interface ProfileContextValue {
  user: AuthUser | null
  loading: boolean
  refresh: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
})

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      setUser(null)
      setLoading(false)
      return
    }

    // Single query joining profile + org
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, organizations(*)')
      .eq('id', authUser.id)
      .single()

    if (!profile) {
      setUser({ id: authUser.id, email: authUser.email!, profile: null, organization: null })
      setLoading(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizations, ...profileData } = profile as any
    setUser({
      id: authUser.id,
      email: authUser.email!,
      profile: profileData as Profile,
      organization: organizations ?? null,
    })
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        load()
      }
    })
    return () => subscription.unsubscribe()
  }, [load]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ProfileContext.Provider value={{ user, loading, refresh: load }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
