'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { obterProdutoCompleto } from '@/app/actions/produtos'
import { getAlunosDoResponsavel } from '@/app/actions/responsavel'
import { salvarCarrinho, carregarCarrinho, type ItemCarrinho } from '@/lib/carrinho'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { LojaHeader } from '@/components/loja/header'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Link from 'next/link'
import type { ProdutoCompleto } from '@/lib/types/database'
import type { Aluno } from '@/lib/types/database'
import { ArrowLeft, ShoppingCart } from 'lucide-react'

export default function ProdutoDetalhesPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const produtoId = params.id as string

  const [produto, setProduto] = useState<ProdutoCompleto | null>(null)
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Estados para seleções
  const [variacoesSelecionadas, setVariacoesSelecionadas] = useState<Record<string, string>>({})
  const [opcionaisSelecionados, setOpcionaisSelecionados] = useState<Record<string, number>>({}) // opcional_id -> quantidade
  const [alunoSelecionado, setAlunoSelecionado] = useState<string>('')
  const [quantidade, setQuantidade] = useState(1)

  const [showModalAdicionado, setShowModalAdicionado] = useState(false)

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
      loadData()
    } catch (err) {
      console.error('Erro ao verificar autenticação:', err)
      router.push('/login')
    }
  }

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      // Carregar produto
      const produtoData = await obterProdutoCompleto(produtoId)
      if (!produtoData) {
        setError('Produto não encontrado')
        setLoading(false)
        return
      }
      setProduto(produtoData)

      // Inicializar variações obrigatórias
      const variacoesIniciais: Record<string, string> = {}
      if (produtoData.variacoes) {
        for (const variacao of produtoData.variacoes) {
          if (variacao.obrigatorio && variacao.valores && variacao.valores.length > 0) {
            variacoesIniciais[variacao.id] = variacao.valores[0].id
          }
        }
      }
      setVariacoesSelecionadas(variacoesIniciais)

      // Carregar alunos
      const alunosData = await getAlunosDoResponsavel()
      setAlunos(alunosData)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  function calcularPrecoTotal(): number {
    if (!produto) return 0

    let precoBase = Number(produto.preco) * quantidade

    // Adicionar preços das variações
    if (produto.variacoes) {
      for (const variacao of produto.variacoes) {
        const valorId = variacoesSelecionadas[variacao.id]
        if (valorId && variacao.valores) {
          const valor = variacao.valores.find(v => v.id === valorId)
          if (valor) {
            precoBase += Number(valor.preco_adicional) * quantidade
          }
        }
      }
    }

    // Adicionar preços dos opcionais
    if (produto.grupos_opcionais) {
      for (const grupo of produto.grupos_opcionais) {
        if (grupo.opcionais) {
          for (const opcional of grupo.opcionais) {
            const qtd = opcionaisSelecionados[opcional.id] || 0
            if (qtd > 0) {
              precoBase += Number(opcional.preco) * qtd
            }
          }
        }
      }
    }

    return precoBase
  }

  function validarSelecoes(): string | null {
    // Verificar variações obrigatórias
    if (produto?.variacoes) {
      for (const variacao of produto.variacoes) {
        if (variacao.obrigatorio && !variacoesSelecionadas[variacao.id]) {
          return `Por favor, selecione ${variacao.nome}`
        }
      }
    }

    // Verificar grupos de opcionais obrigatórios
    if (produto?.grupos_opcionais) {
      for (const grupo of produto.grupos_opcionais) {
        if (grupo.obrigatorio) {
          const totalSelecionado = grupo.opcionais?.reduce((sum, op) => sum + (opcionaisSelecionados[op.id] || 0), 0) || 0
          if (totalSelecionado < grupo.min_selecoes) {
            return `Por favor, selecione pelo menos ${grupo.min_selecoes} item(ns) de ${grupo.nome}`
          }
          if (grupo.max_selecoes && totalSelecionado > grupo.max_selecoes) {
            return `Você pode selecionar no máximo ${grupo.max_selecoes} item(ns) de ${grupo.nome}`
          }
        }
      }
    }

    if (!alunoSelecionado) {
      return 'Por favor, selecione um aluno'
    }

    return null
  }

  function adicionarAoCarrinho() {
    const erro = validarSelecoes()
    if (erro) {
      setError(erro)
      return
    }

    if (!produto || !alunoSelecionado) return

    const aluno = alunos.find(a => a.id === alunoSelecionado)
    if (!aluno) return

    // Preparar opcionais selecionados para o carrinho
    const opcionaisArray: Array<{ opcional_id: string; nome: string; preco: number; quantidade: number }> = []
    if (produto.grupos_opcionais) {
      for (const grupo of produto.grupos_opcionais) {
        if (grupo.opcionais) {
          for (const opcional of grupo.opcionais) {
            const qtd = opcionaisSelecionados[opcional.id] || 0
            if (qtd > 0) {
              opcionaisArray.push({
                opcional_id: opcional.id,
                nome: opcional.nome,
                preco: Number(opcional.preco),
                quantidade: qtd
              })
            }
          }
        }
      }
    }

    // Preparar variações selecionadas (nome -> valor)
    const variacoesFormatadas: Record<string, string> = {}
    if (produto.variacoes) {
      for (const variacao of produto.variacoes) {
        const valorId = variacoesSelecionadas[variacao.id]
        if (valorId && variacao.valores) {
          const valor = variacao.valores.find(v => v.id === valorId)
          if (valor) {
            variacoesFormatadas[variacao.nome] = valor.label || valor.valor
          }
        }
      }
    }

    const carrinho = carregarCarrinho()
    const novoItem: ItemCarrinho = {
      produto: {
        id: produto.id,
        nome: produto.nome,
        preco: calcularPrecoTotal() / quantidade, // Preço unitário total
        tipo: produto.tipo,
        descricao: produto.descricao || null,
        imagem_url: produto.imagem_url || null,
      },
      alunoId: alunoSelecionado,
      alunoNome: aluno.nome,
      quantidade,
      variacoesSelecionadas: Object.keys(variacoesFormatadas).length > 0 ? variacoesFormatadas : undefined,
      opcionaisSelecionados: opcionaisArray.length > 0 ? opcionaisArray : undefined,
    }

    carrinho.push(novoItem)
    salvarCarrinho(carrinho)
    setShowModalAdicionado(true)
  }

  function formatPrice(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (checkingAuth || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <LojaHeader />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Carregando produto...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !produto) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <LojaHeader />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-2xl font-semibold mb-2">Erro</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => router.push('/loja')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para a Loja
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!produto) return null

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <LojaHeader />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <Button
          variant="ghost"
          onClick={() => router.push('/loja')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para a Loja
        </Button>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Imagem do Produto */}
          <Card className="overflow-hidden">
            <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/50">
              {produto.imagem_url ? (
                <img
                  src={produto.imagem_url}
                  alt={produto.nome}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-2 opacity-50">
                      {produto.tipo === 'PRODUTO' ? '📦' : produto.tipo === 'SERVICO' ? '🔧' : '🎁'}
                    </div>
                    <p className="text-sm text-muted-foreground">Sem imagem</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Informações do Produto */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{produto.nome}</h1>
              <p className="text-2xl font-semibold text-primary mb-4">
                {formatPrice(calcularPrecoTotal())}
              </p>
              {produto.descricao && (
                <p className="text-muted-foreground">{produto.descricao}</p>
              )}
            </div>

            {/* Variações */}
            {produto.variacoes && produto.variacoes.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Variações</h2>
                {produto.variacoes.map((variacao) => (
                  <div key={variacao.id} className="space-y-2">
                    <Label>
                      {variacao.nome}
                      {variacao.obrigatorio && <span className="text-destructive"> *</span>}
                    </Label>
                    <Select
                      value={variacoesSelecionadas[variacao.id] || ''}
                      onValueChange={(value) => {
                        setVariacoesSelecionadas({
                          ...variacoesSelecionadas,
                          [variacao.id]: value
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Selecione ${variacao.nome}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {variacao.valores?.map((valor) => (
                          <SelectItem key={valor.id} value={valor.id}>
                            {valor.label || valor.valor}
                            {valor.preco_adicional > 0 && (
                              <span className="text-muted-foreground ml-2">
                                (+{formatPrice(valor.preco_adicional)})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            {/* Opcionais/Adicionais */}
            {produto.grupos_opcionais && produto.grupos_opcionais.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Adicionais</h2>
                {produto.grupos_opcionais.map((grupo) => (
                  <Card key={grupo.id} className="p-4">
                    <div className="mb-3">
                      <Label className="text-base font-medium">
                        {grupo.nome}
                        {grupo.obrigatorio && <span className="text-destructive"> *</span>}
                        {grupo.descricao && (
                          <p className="text-sm text-muted-foreground mt-1">{grupo.descricao}</p>
                        )}
                        {grupo.min_selecoes > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Mínimo: {grupo.min_selecoes} | Máximo: {grupo.max_selecoes || 'Ilimitado'}
                          </p>
                        )}
                      </Label>
                    </div>
                    <div className="space-y-2">
                      {grupo.opcionais?.map((opcional) => (
                        <div key={opcional.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1">
                            <Label className="font-normal">{opcional.nome}</Label>
                            {opcional.descricao && (
                              <p className="text-xs text-muted-foreground">{opcional.descricao}</p>
                            )}
                            <p className="text-sm font-medium text-primary">
                              {formatPrice(opcional.preco)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const atual = opcionaisSelecionados[opcional.id] || 0
                                if (atual > 0) {
                                  setOpcionaisSelecionados({
                                    ...opcionaisSelecionados,
                                    [opcional.id]: atual - 1
                                  })
                                }
                              }}
                            >
                              -
                            </Button>
                            <span className="w-8 text-center">
                              {opcionaisSelecionados[opcional.id] || 0}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const atual = opcionaisSelecionados[opcional.id] || 0
                                const max = opcional.max_selecoes || Infinity
                                if (atual < max) {
                                  setOpcionaisSelecionados({
                                    ...opcionaisSelecionados,
                                    [opcional.id]: atual + 1
                                  })
                                }
                              }}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Quantidade */}
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
                >
                  -
                </Button>
                <Input
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center"
                />
                <Button
                  variant="outline"
                  onClick={() => setQuantidade(quantidade + 1)}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Itens do Kit */}
            {produto.tipo === 'KIT' && produto.kits_itens && produto.kits_itens.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Itens do Kit</h2>
                <Card className="p-4">
                  <div className="space-y-2">
                    {produto.kits_itens.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium">
                            {(item.produto as any)?.nome || 'Produto não encontrado'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Quantidade: {item.quantidade}
                          </p>
                        </div>
                        <p className="text-sm font-medium">
                          {formatPrice(Number((item.produto as any)?.preco || 0) * item.quantidade)}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* Seleção de Aluno */}
            <div className="space-y-2">
              <Label>
                Aluno <span className="text-destructive">*</span>
              </Label>
              <Select value={alunoSelecionado} onValueChange={setAlunoSelecionado}>
                <SelectTrigger>
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
            </div>

            {/* Botão Adicionar ao Carrinho */}
            <Button
              className="w-full"
              size="lg"
              onClick={adicionarAoCarrinho}
              disabled={!alunoSelecionado}
            >
              <ShoppingCart className="mr-2 h-5 w-5" />
              Adicionar ao Carrinho - {formatPrice(calcularPrecoTotal())}
            </Button>
          </div>
        </div>
      </main>

      {/* Modal de confirmação */}
      <Dialog open={showModalAdicionado} onOpenChange={setShowModalAdicionado}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✅ Produto Adicionado!</DialogTitle>
            <DialogDescription>
              <strong>{produto.nome}</strong> foi adicionado ao carrinho
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
