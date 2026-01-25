import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Verificar se é admin
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, eh_admin')
      .eq('auth_user_id', user.id)
      .eq('ativo', true)
      .maybeSingle()

    if (usuario?.eh_admin) {
      redirect('/admin')
    } else {
      redirect('/loja')
    }
  }

  return (
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-4xl font-bold mb-4">Loja Escola</h1>
      <p className="text-muted-foreground mb-8">
        Faça login para acessar a loja
      </p>
      <Link href="/login">
        <Button>Ir para Login</Button>
      </Link>
    </div>
  )
}
