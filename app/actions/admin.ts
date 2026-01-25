'use server'

import { createClient } from '@/lib/supabase/server'

export async function verificarSeEhAdmin(): Promise<boolean> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return false
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, eh_admin, super_admin, ativo')
    .eq('auth_user_id', user.id)
    .eq('eh_admin', true)
    .eq('ativo', true)
    .maybeSingle()

  return !!usuario
}

export async function verificarSeEhSuperAdmin(): Promise<boolean> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return false
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, super_admin, ativo')
    .eq('auth_user_id', user.id)
    .eq('super_admin', true)
    .eq('ativo', true)
    .maybeSingle()

  return !!usuario
}

export async function getAdminData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Não autenticado')
  }

  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select(`
      *,
      empresas(id, nome),
      unidades(id, nome)
    `)
    .eq('auth_user_id', user.id)
    .eq('eh_admin', true)
    .eq('ativo', true)
    .single()

  if (error || !usuario) {
    throw new Error('Admin não encontrado ou inativo')
  }

  return usuario
}
