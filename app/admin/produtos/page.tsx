'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  listarProdutos, 
  criarProduto, 
  atualizarProduto, 
  deletarProduto,
  listarCategorias,
  criarCategoria,
  listarGruposProdutos,
  criarGrupoProduto,
  obterProduto
} from '@/app/actions/produtos-admin'
import { getAdminData } from '@/app/actions/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { ProdutoCompleto, Categoria, GrupoProduto } from '@/lib/types/database'
import { ProdutoFormModal } from '@/components/admin/produto-form-modal'
import { CategoriasManager } from '@/components/admin/categorias-manager'
import { GruposManager } from '@/components/admin/grupos-manager'

export default function ProdutosPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [produtos, setProdutos] = useState<ProdutoCompleto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [grupos, setGrupos] = useState<GrupoProduto[]>([])
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [showProdutoModal, setShowProdutoModal] = useState(false)
  const [produtoEditando, setProdutoEditando] = useState<ProdutoCompleto | null>(null)
  const [showCategorias, setShowCategorias] = useState(false)
  const [showGrupos, setShowGrupos] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    try {
      setLoading(true)
      setError(null)

      // Obter dados do admin para pegar empresa_id
      const adminData = await getAdminData()
      if (!adminData.empresa_id) {
        throw new Error('Admin não possui empresa vinculada')
      }

      setEmpresaId(adminData.empresa_id)

      // Carregar dados em paralelo
      const [produtosData, categoriasData, gruposData] = await Promise.all([
        listarProdutos(adminData.empresa_id),
        listarCategorias(adminData.empresa_id),
        listarGruposProdutos(adminData.empresa_id),
      ])

      setProdutos(produtosData)
      setCategorias(categoriasData)
      setGrupos(gruposData)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  async function handleSalvarProduto(dados: any): Promise<ProdutoCompleto> {
    if (!empresaId) {
      throw new Error('Empresa não encontrada')
    }

    // A empresa_id já vem nos dados, apenas garantir
    const dadosCompletos = { ...dados, empresa_id: empresaId }

    let produtoSalvo: ProdutoCompleto
    if (produtoEditando) {
      produtoSalvo = await atualizarProduto(produtoEditando.id, dadosCompletos)
    } else {
      produtoSalvo = await criarProduto(dadosCompletos)
    }

    setShowProdutoModal(false)
    setProdutoEditando(null)
    await carregarDados()
    
    return produtoSalvo
  }

  async function handleEditarProduto(produto: ProdutoCompleto) {
    try {
      const produtoCompleto = await obterProduto(produto.id)
      setProdutoEditando(produtoCompleto)
      setShowProdutoModal(true)
    } catch (err) {
      console.error('Erro ao carregar produto:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar produto')
    }
  }

  async function handleDeletarProduto(id: string) {
    if (!confirm('Tem certeza que deseja desativar este produto?')) {
      return
    }

    try {
      await deletarProduto(id)
      await carregarDados()
    } catch (err) {
      console.error('Erro ao deletar produto:', err)
      setError(err instanceof Error ? err.message : 'Erro ao deletar produto')
    }
  }

  function formatPrice(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="text-center py-8">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm">← Voltar</Button>
            </Link>
            <h1 className="text-3xl font-bold">Produtos</h1>
          </div>
          <p className="text-muted-foreground">
            Criar e editar produtos, categorias, variações e opcionais
          </p>
        </div>
      </div>

      {error && (
        <Card className="mb-4 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Botões de ação */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <Button onClick={() => {
          setProdutoEditando(null)
          setShowProdutoModal(true)
        }}>
          + Novo Produto
        </Button>
        <Button variant="outline" onClick={() => setShowCategorias(!showCategorias)}>
          {showCategorias ? 'Ocultar' : 'Gerenciar'} Categorias
        </Button>
        <Button variant="outline" onClick={() => setShowGrupos(!showGrupos)}>
          {showGrupos ? 'Ocultar' : 'Gerenciar'} Grupos
        </Button>
      </div>

      {/* Gerenciadores */}
      {showCategorias && empresaId && (
        <div className="mb-6">
          <CategoriasManager 
            empresaId={empresaId}
            categorias={categorias}
            onUpdate={carregarDados}
          />
        </div>
      )}

      {showGrupos && empresaId && (
        <div className="mb-6">
          <GruposManager 
            empresaId={empresaId}
            grupos={grupos}
            onUpdate={carregarDados}
          />
        </div>
      )}

      {/* Lista de produtos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {produtos.map((produto) => (
          <Card key={produto.id} className={!produto.ativo ? 'opacity-50' : ''}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">{produto.nome}</CardTitle>
                  <CardDescription>
                    {produto.tipo} • {produto.categoria?.nome || 'Sem categoria'}
                  </CardDescription>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${produto.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {produto.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Preço:</span>
                  <span className="font-bold">{formatPrice(Number(produto.preco))}</span>
                </div>
                {produto.tipo !== 'SERVICO' && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Estoque:</span>
                    <span>{produto.estoque}</span>
                  </div>
                )}
                {produto.sku && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">SKU:</span>
                    <span className="text-sm">{produto.sku}</span>
                  </div>
                )}
                {produto.variacoes && produto.variacoes.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {produto.variacoes.length} variação(ões)
                  </div>
                )}
                {produto.grupos_opcionais && produto.grupos_opcionais.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {produto.grupos_opcionais.length} grupo(s) de opcionais
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => handleEditarProduto(produto)}
                  >
                    Editar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleDeletarProduto(produto.id)}
                  >
                    Desativar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {produtos.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Nenhum produto cadastrado. Clique em "Novo Produto" para começar.
          </CardContent>
        </Card>
      )}

      {/* Modal de produto */}
      {showProdutoModal && empresaId && (
        <ProdutoFormModal
          produto={produtoEditando}
          empresaId={empresaId}
          categorias={categorias}
          grupos={grupos}
          onSave={handleSalvarProduto}
          onClose={() => {
            setShowProdutoModal(false)
            setProdutoEditando(null)
          }}
        />
      )}
    </div>
  )
}
