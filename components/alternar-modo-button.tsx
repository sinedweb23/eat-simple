'use client'

import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export function AlternarModoButton() {
  const pathname = usePathname()
  const supabase = createClient()
  const [ehAdmin, setEhAdmin] = useState(false)
  const [ehResponsavel, setEhResponsavel] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    verificarPermissoes()
  }, [])

  async function verificarPermissoes() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Verificar se é admin
      const { data: admin } = await supabase
        .from('admins')
        .select('id')
        .eq('auth_user_id', user.id)
        .eq('ativo', true)
        .maybeSingle()

      // Verificar se é responsável
      const { data: responsavel } = await supabase
        .from('responsaveis')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      setEhAdmin(!!admin)
      setEhResponsavel(!!responsavel)
    } catch (err) {
      console.error('Erro ao verificar permissões:', err)
    } finally {
      setLoading(false)
    }
  }

  // Só mostrar se for ambos
  if (loading || !ehAdmin || !ehResponsavel) {
    return null
  }

  // Verificar qual página está ativa
  const isAdminPage = pathname.startsWith('/admin')
  const isLojaPage = pathname.startsWith('/loja')

  if (isAdminPage) {
    return (
      <Link href="/loja">
        <Button variant="outline">Acessar como Responsável</Button>
      </Link>
    )
  } else if (isLojaPage) {
    return (
      <Link href="/admin">
        <Button variant="outline">Acessar como Admin</Button>
      </Link>
    )
  }

  return null
}
