import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { verificarSeEhAdmin } from '@/app/actions/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function PedidosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const ehAdmin = await verificarSeEhAdmin()
  if (!ehAdmin) {
    redirect('/loja')
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm">← Voltar</Button>
            </Link>
            <h1 className="text-3xl font-bold">Pedidos</h1>
          </div>
          <p className="text-muted-foreground">
            Gerencie pedidos, cancelamentos e status
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
          <CardDescription>
            Em breve: visualização e gerenciamento de pedidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Funcionalidade em desenvolvimento...</p>
        </CardContent>
      </Card>
    </div>
  )
}
