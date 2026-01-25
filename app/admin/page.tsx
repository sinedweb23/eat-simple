import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { verificarSeEhAdmin } from '@/app/actions/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar o painel administrativo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/loja">
              <Button>Voltar para Loja</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Gerencie pedidos, produtos, categorias e mais
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Pedidos</CardTitle>
            <CardDescription>
              Gerenciar pedidos, cancelamentos e status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/pedidos">
              <Button className="w-full">Acessar</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
            <CardDescription>
              Criar e editar produtos, categorias e disponibilidade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/produtos">
              <Button className="w-full">Acessar</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Empresas/Unidades</CardTitle>
            <CardDescription>
              Gerenciar empresas e unidades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/empresas">
              <Button className="w-full">Acessar</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Turmas</CardTitle>
            <CardDescription>
              Gerenciar turmas e segmentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/turmas">
              <Button className="w-full">Acessar</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usuários Admin</CardTitle>
            <CardDescription>
              Gerenciar administradores e permissões
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/usuarios">
              <Button className="w-full">Acessar</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alunos</CardTitle>
            <CardDescription>
              Visualizar alunos, turmas e responsáveis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/alunos">
              <Button className="w-full">Acessar</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Importação</CardTitle>
            <CardDescription>
              Importar dados de alunos, responsáveis e turmas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/importacao">
              <Button className="w-full">Acessar</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
            <CardDescription>
              Configurar SMTP e outras opções do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/configuracoes">
              <Button className="w-full">Acessar</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
