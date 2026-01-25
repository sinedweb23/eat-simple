'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { carregarCarrinho, salvarCarrinho, type ItemCarrinho } from '@/lib/carrinho'
import { LojaHeader } from '@/components/loja/header'
import Link from 'next/link'

export default function CarrinhoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)

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
      setCheckingAuth(false)
      const carrinhoCarregado = carregarCarrinho()
      setCarrinho(carrinhoCarregado)
      setLoading(false)
    } catch (err) {
      console.error('Erro ao verificar autenticação:', err)
      router.push('/login')
    }
  }

  function atualizarQuantidade(produtoId: string, alunoId: string, quantidade: number) {
    if (quantidade <= 0) {
      removerItem(produtoId, alunoId)
      return
    }

    const novoCarrinho = carrinho.map(item =>
      item.produto.id === produtoId && item.alunoId === alunoId
        ? { ...item, quantidade }
        : item
    )
    setCarrinho(novoCarrinho)
    salvarCarrinho(novoCarrinho)
  }

  function removerItem(produtoId: string, alunoId: string) {
    const novoCarrinho = carrinho.filter(
      item => !(item.produto.id === produtoId && item.alunoId === alunoId)
    )
    setCarrinho(novoCarrinho)
    salvarCarrinho(novoCarrinho)
  }

  function calcularTotal() {
    return carrinho.reduce((total, item) => {
      return total + (Number(item.produto.preco) * item.quantidade)
    }, 0)
  }

  function formatPrice(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  function agruparPorAluno() {
    const agrupado: Record<string, ItemCarrinho[]> = {}
    carrinho.forEach(item => {
      if (!agrupado[item.alunoId]) {
        agrupado[item.alunoId] = []
      }
      agrupado[item.alunoId].push(item)
    })
    return agrupado
  }

  if (checkingAuth || loading) {
    return (
      <>
        <LojaHeader />
        <div className="container mx-auto p-6 max-w-6xl">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Carregando carrinho...</p>
          </div>
        </div>
      </>
    )
  }

  if (carrinho.length === 0) {
    return (
      <>
        <LojaHeader />
        <div className="container mx-auto p-6 max-w-6xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Carrinho de Compras</h1>
            <p className="text-muted-foreground">
              Seu carrinho está vazio
            </p>
          </div>

          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <div className="text-6xl mb-4">🛒</div>
              <h2 className="text-2xl font-semibold mb-2">Seu carrinho está vazio</h2>
              <p className="text-muted-foreground mb-6">
                Adicione produtos ao carrinho para continuar
              </p>
              <Link href="/loja">
                <Button size="lg">Ver Produtos</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  const agrupadoPorAluno = agruparPorAluno()

  return (
    <>
      <LojaHeader />
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Carrinho de Compras</h1>
            <p className="text-muted-foreground">
              {carrinho.length} {carrinho.length === 1 ? 'item' : 'itens'} no carrinho
            </p>
          </div>
          <Link href="/loja">
            <Button variant="outline">Continuar Comprando</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de itens */}
          <div className="lg:col-span-2 space-y-4">
            {Object.entries(agrupadoPorAluno).map(([alunoId, itens]) => {
              const primeiroItem = itens[0]
              return (
                <Card key={alunoId}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Para: {primeiroItem.alunoNome}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {itens.map((item, index) => (
                      <div
                        key={`${item.produto.id}-${item.alunoId}-${index}`}
                        className="flex items-start gap-4 pb-4 border-b last:border-0"
                      >
                        <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                          {item.produto.imagem_url ? (
                            <img
                              src={item.produto.imagem_url}
                              alt={item.produto.nome}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.currentTarget
                                target.style.display = 'none'
                                const placeholder = target.parentElement?.querySelector('.placeholder-carrinho') as HTMLElement
                                if (placeholder) {
                                  placeholder.style.display = 'flex'
                                }
                              }}
                            />
                          ) : null}
                          <div className={`placeholder-carrinho absolute inset-0 flex items-center justify-center ${item.produto.imagem_url ? 'hidden' : ''}`}>
                            <span className="text-2xl">
                              {item.produto.tipo === 'PRODUTO' ? '📦' : item.produto.tipo === 'SERVICO' ? '🔧' : '🎁'}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg mb-1">{item.produto.nome}</h3>
                          {item.produto.descricao && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {item.produto.descricao}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-3">
                            <div className="flex items-center gap-2 border rounded-md">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => atualizarQuantidade(item.produto.id, item.alunoId, item.quantidade - 1)}
                              >
                                −
                              </Button>
                              <span className="w-12 text-center font-medium">{item.quantidade}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => atualizarQuantidade(item.produto.id, item.alunoId, item.quantidade + 1)}
                              >
                                +
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removerItem(item.produto.id, item.alunoId)}
                              className="text-destructive hover:text-destructive"
                            >
                              Remover
                            </Button>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-lg font-bold">
                            {formatPrice(Number(item.produto.preco) * item.quantidade)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatPrice(Number(item.produto.preco))} cada
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Resumo do pedido */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(calcularTotal())}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Frete</span>
                    <span className="text-green-600">Grátis</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Total</span>
                      <span className="text-2xl font-bold">{formatPrice(calcularTotal())}</span>
                    </div>
                  </div>
                </div>

                <Button className="w-full" size="lg" onClick={() => {
                  // TODO: Implementar checkout
                  alert('Checkout em desenvolvimento')
                }}>
                  Finalizar Compra
                </Button>

                <Link href="/loja" className="block">
                  <Button variant="outline" className="w-full">
                    Continuar Comprando
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
