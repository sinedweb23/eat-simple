'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAlunosDoResponsavel } from '@/app/actions/responsavel'
import { getProdutosDisponiveisParaResponsavel } from '@/app/actions/produtos'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LojaHeader } from '@/components/loja/header'
import { salvarCarrinho, carregarCarrinho, contarItensCarrinho, type ItemCarrinho } from '@/lib/carrinho'
import Link from 'next/link'
import type { Aluno } from '@/lib/types/database'
import type { ProdutoComDisponibilidade } from '@/lib/types/database'

export default function LojaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [produtos, setProdutos] = useState<ProdutoComDisponibilidade[]>([])
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [showModalAdicionado, setShowModalAdicionado] = useState(false)
  const [produtoAdicionado, setProdutoAdicionado] = useState<{ nome: string; alunoNome: string } | null>(null)

  useEffect(() => {
    checkAuth()
    // Carregar carrinho do localStorage
    const carrinhoCarregado = carregarCarrinho()
    setCarrinho(carrinhoCarregado)
  }, [])

  async function checkAuth() {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('[Loja] Sessão:', session ? 'existe' : 'não existe', sessionError)
      
      if (!session) {
        console.log('[Loja] Sem sessão, redirecionando para login')
        router.push('/login')
        return
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('[Loja] User:', user ? user.id : 'não encontrado', userError)
      
      if (!user) {
        console.log('[Loja] Sem usuário, redirecionando para login')
        router.push('/login')
        return
      }
      
      setCheckingAuth(false)
      loadData()
    } catch (err) {
      console.error('[Loja] Erro ao verificar autenticação:', err)
      setError(err instanceof Error ? err.message : 'Erro ao verificar autenticação')
      setCheckingAuth(false)
      setLoading(false)
      router.push('/login')
    }
  }

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      let alunosData: Aluno[] = []
      try {
        alunosData = await getAlunosDoResponsavel()
        setAlunos(alunosData)
      } catch (err) {
        console.error('Erro ao carregar alunos:', err)
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar alunos'
        if (errorMessage.includes('Não autenticado') || errorMessage.includes('Responsável não encontrado')) {
          router.push('/login')
          return
        }
        setError(errorMessage)
      }

      try {
        const produtosData = await getProdutosDisponiveisParaResponsavel()
        setProdutos(produtosData)
      } catch (err) {
        console.error('[Loja] Erro ao carregar produtos:', err)
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar produtos'
        setError(errorMessage)
        
        if (errorMessage.includes('Responsável não encontrado') || errorMessage.includes('não vinculado')) {
          setTimeout(() => {
            router.push('/primeiro-acesso')
          }, 2000)
        }
      }
    } catch (err) {
      console.error('Erro geral ao carregar dados:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  function adicionarAoCarrinho(produto: ProdutoComDisponibilidade, alunoId: string) {
    const aluno = alunos.find(a => a.id === alunoId)
    if (!aluno) return

    const itemExistente = carrinho.find(
      item => item.produto.id === produto.id && item.alunoId === alunoId
    )

    let novoCarrinho: ItemCarrinho[]
    if (itemExistente) {
      novoCarrinho = carrinho.map(item =>
        item.produto.id === produto.id && item.alunoId === alunoId
          ? { ...item, quantidade: item.quantidade + 1 }
          : item
      )
    } else {
      novoCarrinho = [...carrinho, {
        produto: {
          id: produto.id,
          nome: produto.nome,
          preco: Number(produto.preco),
          tipo: produto.tipo,
          descricao: produto.descricao,
          imagem_url: produto.imagem_url || null,
        },
        alunoId,
        alunoNome: aluno.nome,
        quantidade: 1
      }]
    }

    setCarrinho(novoCarrinho)
    salvarCarrinho(novoCarrinho)
    
    // Mostrar modal de confirmação
    setProdutoAdicionado({
      nome: produto.nome,
      alunoNome: aluno.nome
    })
    setShowModalAdicionado(true)
  }

  function formatPrice(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }


  if (checkingAuth) {
    return (
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="text-center py-8">Verificando autenticação...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <LojaHeader />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Carregando produtos...</p>
          </div>
        )}

        {!loading && produtos.length === 0 && !error && (
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-6xl mb-4">📦</div>
              <h2 className="text-2xl font-semibold mb-2">Nenhum produto disponível</h2>
              <p className="text-muted-foreground">
                Não há produtos disponíveis no momento.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && produtos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {produtos.map((produto) => (
              <Card key={produto.id} className="group hover:shadow-lg transition-shadow duration-200 overflow-hidden flex flex-col">
                <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
                  {produto.imagem_url ? (
                    <>
                      <img
                        src={produto.imagem_url}
                        alt={produto.nome}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          // Se a imagem falhar, mostrar placeholder
                          const target = e.currentTarget
                          target.style.display = 'none'
                          const placeholder = target.parentElement?.querySelector('.placeholder-imagem') as HTMLElement
                          if (placeholder) {
                            placeholder.style.display = 'flex'
                          }
                        }}
                      />
                      <div className="placeholder-imagem absolute inset-0 flex items-center justify-center hidden">
                        <div className="text-center">
                          <div className="text-5xl mb-2 opacity-50">
                            {produto.tipo === 'PRODUTO' ? '📦' : produto.tipo === 'SERVICO' ? '🔧' : '🎁'}
                          </div>
                          <p className="text-xs text-muted-foreground">Erro ao carregar</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-5xl mb-2 opacity-50">
                          {produto.tipo === 'PRODUTO' ? '📦' : produto.tipo === 'SERVICO' ? '🔧' : '🎁'}
                        </div>
                        <p className="text-xs text-muted-foreground">Sem imagem</p>
                      </div>
                    </div>
                  )}
                </div>
                <CardHeader>
                  <CardTitle className="line-clamp-2">{produto.nome}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {produto.descricao || 'Sem descrição'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-bold text-primary">
                      {formatPrice(Number(produto.preco))}
                    </span>
                    {produto.estoque > 0 && (
                      <span className="text-xs text-muted-foreground bg-green-50 px-2 py-1 rounded">
                        Em estoque
                      </span>
                    )}
                  </div>
                  
                  {produto.compra_unica && (
                    <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                      ⚠️ Compra única (máx. {produto.limite_max_compra_unica})
                    </div>
                  )}
                  
                  {alunos.length > 0 ? (
                    <Select
                      onValueChange={(alunoId) => adicionarAoCarrinho(produto, alunoId)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o aluno" />
                      </SelectTrigger>
                      <SelectContent>
                        {alunos.map((aluno) => (
                          <SelectItem key={aluno.id} value={aluno.id}>
                            {aluno.nome} ({aluno.prontuario})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Button className="w-full" disabled>
                      Nenhum aluno vinculado
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Modal de confirmação ao adicionar ao carrinho */}
      <Dialog open={showModalAdicionado} onOpenChange={setShowModalAdicionado}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✅ Produto Adicionado!</DialogTitle>
            <DialogDescription>
              {produtoAdicionado && (
                <>
                  <strong>{produtoAdicionado.nome}</strong> foi adicionado ao carrinho para <strong>{produtoAdicionado.alunoNome}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setShowModalAdicionado(false)}
            >
              Continuar Comprando
            </Button>
            <Link href="/loja/carrinho" className="w-full sm:w-auto">
              <Button className="w-full" onClick={() => setShowModalAdicionado(false)}>
                Ir para o Carrinho
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
