'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function EscolherModoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [ehAdmin, setEhAdmin] = useState(false)
  const [ehResponsavel, setEhResponsavel] = useState(false)

  useEffect(() => {
    verificarPermissoes()
  }, [])

  async function verificarPermissoes() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Verificar usuário
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, eh_admin')
        .eq('auth_user_id', user.id)
        .eq('ativo', true)
        .maybeSingle()

      const admin = usuario?.eh_admin === true
      const responsavel = !!usuario && !usuario.eh_admin

      setEhAdmin(admin)
      setEhResponsavel(responsavel)
      setLoading(false)

      // Se for apenas um dos dois, redirecionar automaticamente
      if (admin && !responsavel) {
        router.push('/admin')
      } else if (!admin && responsavel) {
        router.push('/loja')
      } else if (!admin && !responsavel) {
        router.push('/login')
      }
    } catch (err) {
      console.error('Erro ao verificar permissões:', err)
      router.push('/login')
    }
  }

  function escolherModo(modo: 'admin' | 'responsavel') {
    if (modo === 'admin') {
      router.push('/admin')
    } else {
      router.push('/loja')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
        <div className="text-center">Carregando...</div>
      </div>
    )
  }

  // Se não for ambos, não deveria chegar aqui (já redirecionou)
  if (!ehAdmin || !ehResponsavel) {
    return null
  }

  return (
    <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center">Escolher Modo de Acesso</h1>
        <p className="text-muted-foreground mb-8 text-center">
          Você pode acessar como administrador ou como responsável. Escolha como deseja continuar:
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => escolherModo('admin')}>
            <CardHeader>
              <CardTitle>Painel Administrativo</CardTitle>
              <CardDescription>
                Acesse o painel para gerenciar pedidos, produtos, empresas e mais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Acessar como Admin</Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => escolherModo('responsavel')}>
            <CardHeader>
              <CardTitle>Loja</CardTitle>
              <CardDescription>
                Acesse a loja para comprar produtos e serviços para seus filhos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">Acessar como Responsável</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
