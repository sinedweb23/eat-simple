'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { listarMeusPedidos, type PedidoCompleto } from '@/app/actions/pedidos'
import { LojaHeader } from '@/components/loja/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function PedidosPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<PedidoCompleto[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      carregarPedidos()
    } catch (err) {
      console.error('Erro ao verificar autenticação:', err)
      router.push('/login')
    }
  }

  async function carregarPedidos() {
    try {
      setLoading(true)
      setError(null)
      const dados = await listarMeusPedidos()
      setPedidos(dados)
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos')
    } finally {
      setLoading(false)
    }
  }

  function formatPrice(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getStatusBadge(status: string) {
    const statusMap: Record<string, { label: string; className: string }> = {
      PENDENTE: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
      PAGO: { label: 'Pago', className: 'bg-green-100 text-green-800' },
      CANCELADO: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
      ESTORNADO: { label: 'Estornado', className: 'bg-gray-100 text-gray-800' },
      ENTREGUE: { label: 'Entregue', className: 'bg-blue-100 text-blue-800' },
    }
    const statusInfo = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' }
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    )
  }

  if (loading) {
    return (
      <>
        <LojaHeader />
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Carregando pedidos...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <LojaHeader />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Meus Pedidos</h1>
          <p className="text-muted-foreground">
            Histórico completo dos seus pedidos
          </p>
        </div>

        {error && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={carregarPedidos}>Tentar Novamente</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && pedidos.length === 0 && (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <div className="text-6xl mb-4">📦</div>
              <h2 className="text-2xl font-semibold mb-2">Nenhum pedido encontrado</h2>
              <p className="text-muted-foreground mb-6">
                Você ainda não realizou nenhum pedido
              </p>
              <Button onClick={() => router.push('/loja')}>Ver Produtos</Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && pedidos.length > 0 && (
          <div className="space-y-4">
            {pedidos.map((pedido) => (
              <Card key={pedido.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Pedido #{pedido.id.slice(0, 8).toUpperCase()}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Para: {pedido.aluno.nome} ({pedido.aluno.prontuario})
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(pedido.status)}
                      <p className="text-sm text-muted-foreground mt-2">
                        {formatDate(pedido.created_at)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pedido.itens.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.produto_nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantidade}x {formatPrice(item.preco_unitario)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatPrice(item.subtotal)}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="text-lg font-semibold">Total</span>
                      <span className="text-2xl font-bold text-primary">
                        {formatPrice(pedido.total)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
