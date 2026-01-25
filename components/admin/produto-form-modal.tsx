'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProdutoCompleto, Categoria, GrupoProduto } from '@/lib/types/database'
import { criarVariacao, criarVariacaoValor, atualizarVariacaoValor, criarGrupoOpcional, criarOpcional, criarKitItem, listarKitItens, deletarKitItem, listarProdutos } from '@/app/actions/produtos-admin'
import { DisponibilidadeManager } from './disponibilidade-manager'
import { uploadImagem, deletarImagem, garantirBucketExiste } from '@/lib/storage'

interface ProdutoFormModalProps {
  produto: ProdutoCompleto | null
  empresaId: string
  categorias: Categoria[]
  grupos: GrupoProduto[]
  onSave: (dados: any) => Promise<ProdutoCompleto>
  onClose: () => void
}

export function ProdutoFormModal({ produto, empresaId, categorias, grupos, onSave, onClose }: ProdutoFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    tipo: produto?.tipo || 'PRODUTO',
    nome: produto?.nome || '',
    descricao: produto?.descricao || '',
    preco: produto?.preco ? String(produto.preco) : '0',
    estoque: produto?.estoque || 0,
    compra_unica: produto?.compra_unica || false,
    limite_max_compra_unica: produto?.limite_max_compra_unica || 1,
    permitir_pix: produto?.permitir_pix ?? true,
    permitir_cartao: produto?.permitir_cartao ?? true,
    ativo: produto?.ativo ?? true,
    categoria_id: produto?.categoria_id || 'none',
    grupo_id: produto?.grupo_id || 'none',
    sku: produto?.sku || '',
    imagem_url: produto?.imagem_url || '',
    ordem: produto?.ordem || 0,
    // Campos fiscais
    ncm: produto?.ncm || '',
    cfop: produto?.cfop || '5102',
    unidade_comercial: produto?.unidade_comercial || 'UN',
    cst_icms: produto?.cst_icms || '',
    csosn: produto?.csosn || '',
    icms_origem: produto?.icms_origem || '0',
    aliq_icms: produto?.aliq_icms ? String(produto.aliq_icms) : '0.00',
    cst_pis: produto?.cst_pis || '',
    aliq_pis: produto?.aliq_pis ? String(produto.aliq_pis) : '0.00',
    cst_cofins: produto?.cst_cofins || '',
    aliq_cofins: produto?.aliq_cofins ? String(produto.aliq_cofins) : '0.00',
    cbenef: produto?.cbenef || '',
  })

  // Variações
  const [variacoes, setVariacoes] = useState<any[]>([])
  const [novaVariacao, setNovaVariacao] = useState({ nome: '', tipo: 'TEXTO' as 'TEXTO' | 'NUMERO' | 'COR', obrigatorio: false })
  const [valoresVariacao, setValoresVariacao] = useState<Record<string, any[]>>({})

  // Opcionais
  const [gruposOpcionais, setGruposOpcionais] = useState<any[]>([])
  const [novoGrupoOpcional, setNovoGrupoOpcional] = useState({ nome: '', obrigatorio: false, min_selecoes: 0, max_selecoes: null as number | null })
  const [opcionais, setOpcionais] = useState<Record<string, any[]>>({})

  // Itens do Kit
  const [kitsItens, setKitsItens] = useState<any[]>([])
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<any[]>([])
  const [novoKitItem, setNovoKitItem] = useState({ produto_id: '', quantidade: 1 })

  // Atualizar preview quando imagem_url mudar
  useEffect(() => {
    if (formData.imagem_url) {
      setImagePreview(formData.imagem_url)
    } else {
      setImagePreview(null)
    }
  }, [formData.imagem_url])

  useEffect(() => {
    if (produto) {
      setVariacoes(produto.variacoes || [])
      setGruposOpcionais(produto.grupos_opcionais || [])
      setKitsItens(produto.kits_itens || [])
      
      // Carregar valores das variações
      const valores: Record<string, any[]> = {}
      produto.variacoes?.forEach(v => {
        valores[v.id] = v.valores || []
      })
      setValoresVariacao(valores)

      // Carregar opcionais dos grupos
      const opcs: Record<string, any[]> = {}
      produto.grupos_opcionais?.forEach(g => {
        opcs[g.id] = g.opcionais || []
      })
      setOpcionais(opcs)
    }
  }, [produto])

  // Carregar produtos disponíveis quando tipo for KIT
  useEffect(() => {
    if (formData.tipo === 'KIT' && produto?.id) {
      carregarProdutosDisponiveis()
      carregarKitItens()
    }
  }, [formData.tipo, produto?.id])

  async function carregarProdutosDisponiveis() {
    try {
      const produtos = await listarProdutos(empresaId)
      // Filtrar produtos que não são kits e não são o próprio produto
      const produtosFiltrados = produtos.filter(p => 
        p.tipo !== 'KIT' && p.id !== produto?.id && p.ativo
      )
      setProdutosDisponiveis(produtosFiltrados)
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
    }
  }

  async function carregarKitItens() {
    if (!produto?.id) return
    try {
      const itens = await listarKitItens(produto.id)
      setKitsItens(itens)
    } catch (error) {
      console.error('Erro ao carregar itens do kit:', error)
    }
  }

  async function adicionarKitItem() {
    if (!produto?.id) {
      alert('Erro: Produto não encontrado. Salve o produto primeiro.')
      return
    }
    
    if (!novoKitItem.produto_id) {
      alert('Por favor, selecione um produto')
      return
    }
    
    try {
      console.log('[adicionarKitItem] Adicionando item ao kit:', {
        kitProdutoId: produto.id,
        produtoId: novoKitItem.produto_id,
        quantidade: novoKitItem.quantidade
      })
      
      const item = await criarKitItem(produto.id, novoKitItem.produto_id, novoKitItem.quantidade, kitsItens.length)
      console.log('[adicionarKitItem] Item adicionado com sucesso:', item)
      
      setKitsItens([...kitsItens, item])
      setNovoKitItem({ produto_id: '', quantidade: 1 })
    } catch (error: any) {
      console.error('[adicionarKitItem] Erro completo:', error)
      console.error('[adicionarKitItem] Tipo do erro:', typeof error)
      console.error('[adicionarKitItem] Erro stringificado:', JSON.stringify(error, null, 2))
      
      let errorMessage = 'Erro desconhecido ao adicionar item ao kit'
      if (error?.message) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error?.toString) {
        errorMessage = error.toString()
      } else if (error) {
        try {
          errorMessage = JSON.stringify(error)
        } catch {
          errorMessage = String(error)
        }
      }
      
      alert(errorMessage)
    }
  }

  async function removerKitItem(itemId: string) {
    try {
      await deletarKitItem(itemId)
      setKitsItens(kitsItens.filter(item => item.id !== itemId))
    } catch (error) {
      console.error('Erro ao remover item do kit:', error)
      alert(error instanceof Error ? error.message : 'Erro ao remover item do kit')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const dados = {
        ...formData,
        preco: parseFloat(formData.preco),
        categoria_id: formData.categoria_id === 'none' ? null : (formData.categoria_id || null),
        grupo_id: formData.grupo_id === 'none' ? null : (formData.grupo_id || null),
        sku: formData.sku || null,
        imagem_url: formData.imagem_url || null,
        // Campos fiscais
        ncm: formData.ncm || null,
        cfop: formData.cfop || null,
        unidade_comercial: formData.unidade_comercial || null,
        cst_icms: formData.cst_icms || null,
        csosn: formData.csosn || null,
        icms_origem: formData.icms_origem || null,
        aliq_icms: formData.aliq_icms ? parseFloat(formData.aliq_icms) : null,
        cst_pis: formData.cst_pis || null,
        aliq_pis: formData.aliq_pis ? parseFloat(formData.aliq_pis) : null,
        cst_cofins: formData.cst_cofins || null,
        aliq_cofins: formData.aliq_cofins ? parseFloat(formData.aliq_cofins) : null,
        cbenef: formData.cbenef || null,
      }

      let produtoId = produto?.id

      // Criar ou atualizar produto
      const produtoSalvo = await onSave(dados)
      produtoId = produtoSalvo.id

      // Criar/atualizar variações e valores
      for (const variacao of variacoes) {
        if (!variacao.id && produtoId) {
          // Criar nova variação
          const novaVar = await criarVariacao(produtoId, {
            nome: variacao.nome,
            tipo: variacao.tipo,
            obrigatorio: variacao.obrigatorio,
            ordem: variacao.ordem || 0,
          })
          const valores = valoresVariacao[variacao.tempId || ''] || []
          for (const valor of valores) {
            if (!valor.id) {
              await criarVariacaoValor(novaVar.id, {
                valor: valor.valor,
                label: valor.label,
                preco_adicional: valor.preco_adicional ?? 0,
                estoque: valor.estoque,
                ordem: valor.ordem || 0,
              })
            }
          }
        } else if (variacao.id && produtoId) {
          // Atualizar valores existentes da variação
          const valores = valoresVariacao[variacao.id] || []
          for (const valor of valores) {
            if (valor.id) {
              // Atualizar valor existente
              await atualizarVariacaoValor(valor.id, {
                valor: valor.valor,
                label: valor.label,
                preco_adicional: valor.preco_adicional ?? 0,
                estoque: valor.estoque,
                ordem: valor.ordem || 0,
              })
            } else {
              // Criar novo valor para variação existente
              await criarVariacaoValor(variacao.id, {
                valor: valor.valor,
                label: valor.label,
                preco_adicional: valor.preco_adicional ?? 0,
                estoque: valor.estoque,
                ordem: valor.ordem || 0,
              })
            }
          }
        }
      }

      // Criar grupos de opcionais e opcionais (apenas novos)
      for (const grupo of gruposOpcionais) {
        if (!grupo.id && produtoId) {
          const novoGrupo = await criarGrupoOpcional(produtoId, {
            nome: grupo.nome,
            descricao: grupo.descricao,
            obrigatorio: grupo.obrigatorio,
            min_selecoes: grupo.min_selecoes || 0,
            max_selecoes: grupo.max_selecoes,
            ordem: grupo.ordem || 0,
          })
          const opcs = opcionais[grupo.tempId || ''] || []
          for (const opc of opcs) {
            if (!opc.id) {
              await criarOpcional(produtoId, {
                nome: opc.nome,
                descricao: opc.descricao,
                preco: opc.preco || 0,
                estoque: opc.estoque,
                grupo_id: novoGrupo.id,
                obrigatorio: opc.obrigatorio,
                max_selecoes: opc.max_selecoes,
                ordem: opc.ordem || 0,
              })
            }
          }
        }
      }

      onClose()
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert(err instanceof Error ? err.message : 'Erro ao salvar produto')
    } finally {
      setLoading(false)
    }
  }

  function adicionarVariacao() {
    const tempId = `temp-${Date.now()}`
    setVariacoes([...variacoes, { ...novaVariacao, tempId }])
    setValoresVariacao({ ...valoresVariacao, [tempId]: [] })
    setNovaVariacao({ nome: '', tipo: 'TEXTO', obrigatorio: false })
  }

  function adicionarValorVariacao(variacaoId: string) {
    const valores = valoresVariacao[variacaoId] || []
    setValoresVariacao({
      ...valoresVariacao,
      [variacaoId]: [...valores, { valor: '', label: '', preco_adicional: 0, estoque: null, tempId: `temp-val-${Date.now()}` }]
    })
  }

  function adicionarGrupoOpcional() {
    const tempId = `temp-grupo-${Date.now()}`
    setGruposOpcionais([...gruposOpcionais, { ...novoGrupoOpcional, tempId }])
    setOpcionais({ ...opcionais, [tempId]: [] })
    setNovoGrupoOpcional({ nome: '', obrigatorio: false, min_selecoes: 0, max_selecoes: null })
  }

  function adicionarOpcional(grupoId: string) {
    const opcs = opcionais[grupoId] || []
    setOpcionais({
      ...opcionais,
      [grupoId]: [...opcs, { nome: '', preco: 0, estoque: null, tempId: `temp-opc-${Date.now()}` }]
    })
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{produto ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          <DialogDescription>
            Preencha os dados do produto. Você pode adicionar variações e opcionais depois.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="tributacao">Tributação</TabsTrigger>
              <TabsTrigger value="variacoes">Variações</TabsTrigger>
              <TabsTrigger value="opcionais">Opcionais</TabsTrigger>
              {formData.tipo === 'KIT' && (
                <TabsTrigger value="kit">Itens do Kit</TabsTrigger>
              )}
              <TabsTrigger value="disponibilidade">Disponibilidade</TabsTrigger>
            </TabsList>

            {/* Aba Básico */}
            <TabsContent value="basico" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRODUTO">Produto</SelectItem>
                      <SelectItem value="SERVICO">Serviço</SelectItem>
                      <SelectItem value="KIT">Kit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select 
                    value={formData.categoria_id || 'none'} 
                    onValueChange={(v) => setFormData({ ...formData, categoria_id: v === 'none' ? 'none' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categorias.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="preco">Preço *</Label>
                  <Input
                    id="preco"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.preco}
                    onChange={(e) => setFormData({ ...formData, preco: e.target.value })}
                    required
                  />
                </div>

                {formData.tipo !== 'SERVICO' && (
                  <div>
                    <Label htmlFor="estoque">Estoque</Label>
                    <Input
                      id="estoque"
                      type="number"
                      min="0"
                      value={formData.estoque}
                      onChange={(e) => setFormData({ ...formData, estoque: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>
              </div>

              {/* Upload de Imagem */}
              <div>
                <Label htmlFor="imagem">Imagem do Produto</Label>
                <div className="space-y-3">
                  {imagePreview && (
                    <div className="relative w-full max-w-xs">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg border"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={async () => {
                          if (formData.imagem_url && formData.imagem_url.includes('supabase.co/storage')) {
                            try {
                              await deletarImagem(formData.imagem_url)
                            } catch (err) {
                              console.error('Erro ao deletar imagem:', err)
                            }
                          }
                          setFormData({ ...formData, imagem_url: '' })
                          setImagePreview(null)
                          if (fileInputRef.current) {
                            fileInputRef.current.value = ''
                          }
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      id="imagem"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return

                        // Validar tamanho (máx 5MB)
                        if (file.size > 5 * 1024 * 1024) {
                          alert('Imagem muito grande. Tamanho máximo: 5MB')
                          return
                        }

                        // Validar tipo
                        if (!file.type.startsWith('image/')) {
                          alert('Por favor, selecione uma imagem válida')
                          return
                        }

                        try {
                          setUploadingImage(true)
                          
                          // Garantir que o bucket existe
                          await garantirBucketExiste('produtos')
                          
                          // Fazer upload
                          const url = await uploadImagem(file, 'produtos', `empresa-${empresaId}`)
                          
                          // Se havia imagem anterior, deletar
                          if (formData.imagem_url && formData.imagem_url.includes('supabase.co/storage')) {
                            try {
                              await deletarImagem(formData.imagem_url)
                            } catch (err) {
                              console.error('Erro ao deletar imagem antiga:', err)
                            }
                          }
                          
                          setFormData({ ...formData, imagem_url: url })
                          setImagePreview(url)
                        } catch (err) {
                          console.error('Erro ao fazer upload:', err)
                          alert('Erro ao fazer upload da imagem. Tente novamente.')
                        } finally {
                          setUploadingImage(false)
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? 'Enviando...' : imagePreview ? 'Alterar Imagem' : 'Selecionar Imagem'}
                    </Button>
                    {!imagePreview && (
                      <div className="flex-1">
                        <Input
                          type="url"
                          placeholder="Ou cole a URL da imagem"
                          value={formData.imagem_url}
                          onChange={(e) => {
                            setFormData({ ...formData, imagem_url: e.target.value })
                            setImagePreview(e.target.value || null)
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: JPG, PNG, WebP, GIF. Tamanho máximo: 5MB
                  </p>
                </div>
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="grupo">Grupo</Label>
                  <Select 
                    value={formData.grupo_id || 'none'} 
                    onValueChange={(v) => setFormData({ ...formData, grupo_id: v === 'none' ? 'none' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem grupo</SelectItem>
                      {grupos.map(grupo => (
                        <SelectItem key={grupo.id} value={grupo.id}>{grupo.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="ordem">Ordem</Label>
                  <Input
                    id="ordem"
                    type="number"
                    value={formData.ordem}
                    onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="compra_unica"
                    checked={formData.compra_unica}
                    onChange={(e) => setFormData({ ...formData, compra_unica: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="compra_unica">Compra única</Label>
                </div>

                {formData.compra_unica && (
                  <div>
                    <Label htmlFor="limite_max">Limite máximo de compra única</Label>
                    <Input
                      id="limite_max"
                      type="number"
                      min="1"
                      value={formData.limite_max_compra_unica}
                      onChange={(e) => setFormData({ ...formData, limite_max_compra_unica: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="permitir_pix"
                    checked={formData.permitir_pix}
                    onChange={(e) => setFormData({ ...formData, permitir_pix: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="permitir_pix">Permitir PIX</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="permitir_cartao"
                    checked={formData.permitir_cartao}
                    onChange={(e) => setFormData({ ...formData, permitir_cartao: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="permitir_cartao">Permitir Cartão</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="ativo">Ativo</Label>
                </div>
              </div>
            </TabsContent>

            {/* Aba Tributação */}
            <TabsContent value="tributacao" className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 text-lg">ℹ️</span>
                  <div className="flex-1">
                    <p className="text-sm text-blue-900">
                      <strong>Dados Tributários (NF-e):</strong> Estes campos são usados na emissão de notas fiscais de produtos. 
                      Se não preenchidos, serão usados valores padrão (isento/zero para MEI).
                    </p>
                  </div>
                </div>
              </div>

              {/* Campos obrigatórios para NF-e */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Campos Obrigatórios para NF-e</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="ncm">
                      NCM <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="ncm"
                      value={formData.ncm}
                      onChange={(e) => setFormData({ ...formData, ncm: e.target.value })}
                      placeholder="49019900"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Código NCM - Classificação fiscal do produto
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="cfop">
                      CFOP <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="cfop"
                      value={formData.cfop}
                      onChange={(e) => setFormData({ ...formData, cfop: e.target.value })}
                      placeholder="5102"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Código Fiscal de Operações - Padrão: 5102 (venda no mesmo estado)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="unidade_comercial">
                      Unidade Comercial <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="unidade_comercial"
                      value={formData.unidade_comercial}
                      onChange={(e) => setFormData({ ...formData, unidade_comercial: e.target.value })}
                      placeholder="UN"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Unidade de medida para NFe - Padrão: UN
                    </p>
                  </div>
                </div>
              </div>

              {/* Dados Tributários */}
              <div className="space-y-4 mt-6">
                <h3 className="text-lg font-semibold">Dados Tributários (NF-e)</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Coluna Esquerda */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="cst_icms">CST ICMS</Label>
                      <Select
                        value={formData.cst_icms}
                        onValueChange={(v) => setFormData({ ...formData, cst_icms: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o CST ICMS" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="00">00 - Tributada integralmente</SelectItem>
                          <SelectItem value="10">10 - Tributada e com cobrança do ICMS por substituição tributária</SelectItem>
                          <SelectItem value="20">20 - Com redução de base de cálculo</SelectItem>
                          <SelectItem value="30">30 - Isenta ou não tributada e com cobrança do ICMS por substituição tributária</SelectItem>
                          <SelectItem value="40">40 - Isenta</SelectItem>
                          <SelectItem value="41">41 - Não tributada</SelectItem>
                          <SelectItem value="50">50 - Suspensa</SelectItem>
                          <SelectItem value="51">51 - Diferimento</SelectItem>
                          <SelectItem value="60">60 - ICMS cobrado anteriormente por substituição tributária</SelectItem>
                          <SelectItem value="70">70 - Com redução de base de cálculo e cobrança do ICMS por substituição tributária</SelectItem>
                          <SelectItem value="90">90 - Outras</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Código de Situação Tributária do ICMS (Regime Normal)
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="cst_pis">CST Pis</Label>
                      <Select
                        value={formData.cst_pis}
                        onValueChange={(v) => setFormData({ ...formData, cst_pis: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o CST PIS" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="01">01 - Operação Tributável (base de cálculo = valor da operação alíquota normal)</SelectItem>
                          <SelectItem value="02">02 - Operação Tributável (base de cálculo = valor da operação alíquota diferenciada)</SelectItem>
                          <SelectItem value="03">03 - Operação Tributável (base de cálculo = quantidade vendida x alíquota por unidade)</SelectItem>
                          <SelectItem value="04">04 - Operação Tributável (tributação monofásica alíquota zero)</SelectItem>
                          <SelectItem value="05">05 - Operação Tributável (Substituição Tributária)</SelectItem>
                          <SelectItem value="06">06 - Operação Tributável a Alíquota Zero</SelectItem>
                          <SelectItem value="07">07 - Operação Isenta da Contribuição</SelectItem>
                          <SelectItem value="08">08 - Operação Sem Incidência da Contribuição</SelectItem>
                          <SelectItem value="09">09 - Operação com Suspensão da Contribuição</SelectItem>
                          <SelectItem value="49">49 - Outras Operações de Saída</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Código de Situação Tributária do PIS
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="cst_cofins">CST Cofins</Label>
                      <Select
                        value={formData.cst_cofins}
                        onValueChange={(v) => setFormData({ ...formData, cst_cofins: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o CST COFINS" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="01">01 - Operação Tributável (base de cálculo = valor da operação alíquota normal)</SelectItem>
                          <SelectItem value="02">02 - Operação Tributável (base de cálculo = valor da operação alíquota diferenciada)</SelectItem>
                          <SelectItem value="03">03 - Operação Tributável (base de cálculo = quantidade vendida x alíquota por unidade)</SelectItem>
                          <SelectItem value="04">04 - Operação Tributável (tributação monofásica alíquota zero)</SelectItem>
                          <SelectItem value="05">05 - Operação Tributável (Substituição Tributária)</SelectItem>
                          <SelectItem value="06">06 - Operação Tributável a Alíquota Zero</SelectItem>
                          <SelectItem value="07">07 - Operação Isenta da Contribuição</SelectItem>
                          <SelectItem value="08">08 - Operação Sem Incidência da Contribuição</SelectItem>
                          <SelectItem value="09">09 - Operação com Suspensão da Contribuição</SelectItem>
                          <SelectItem value="49">49 - Outras Operações de Saída</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Código de Situação Tributária do COFINS
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="cbenef">Código de Benefício Fiscal (cBenef)</Label>
                      <Input
                        id="cbenef"
                        value={formData.cbenef}
                        onChange={(e) => setFormData({ ...formData, cbenef: e.target.value })}
                        placeholder="SP070130"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Obrigatório quando ICMS situação tributária for 400 (Isenta/Imune) ou 40 (Isenta) ou 41 (Não Incidência). 
                        Exemplo: SP070130 para livros em São Paulo. Consulte a tabela de códigos de benefício fiscal da SEFAZ do seu estado.
                      </p>
                    </div>
                  </div>

                  {/* Coluna Direita */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="csosn">CSOSN</Label>
                      <Select
                        value={formData.csosn}
                        onValueChange={(v) => setFormData({ ...formData, csosn: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o CSOSN" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="101">101 - Tributada pelo Simples Nacional com permissão de crédito</SelectItem>
                          <SelectItem value="102">102 - Tributada pelo Simples Nacional sem permissão de crédito</SelectItem>
                          <SelectItem value="103">103 - Isenção do ICMS no Simples Nacional para faixa de receita bruta</SelectItem>
                          <SelectItem value="201">201 - Tributada pelo Simples Nacional com permissão de crédito e com cobrança do ICMS por substituição tributária</SelectItem>
                          <SelectItem value="202">202 - Tributada pelo Simples Nacional sem permissão de crédito e com cobrança do ICMS por substituição tributária</SelectItem>
                          <SelectItem value="203">203 - Isenção do ICMS no Simples Nacional para faixa de receita bruta e com cobrança do ICMS por substituição tributária</SelectItem>
                          <SelectItem value="300">300 - Imune</SelectItem>
                          <SelectItem value="400">400 - Não tributada pelo Simples Nacional</SelectItem>
                          <SelectItem value="500">500 - ICMS cobrado anteriormente por substituição tributária (substituído) ou por antecipação</SelectItem>
                          <SelectItem value="900">900 - Outros</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Código de Situação da Operação no Simples Nacional
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="icms_origem">ICMS - Origem</Label>
                      <Select
                        value={formData.icms_origem}
                        onValueChange={(v) => setFormData({ ...formData, icms_origem: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a origem" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 - Nacional</SelectItem>
                          <SelectItem value="1">1 - Estrangeira - Importação direta</SelectItem>
                          <SelectItem value="2">2 - Estrangeira - Adquirida no mercado interno</SelectItem>
                          <SelectItem value="3">3 - Nacional - Mercadoria ou bem com conteúdo de importação superior a 40%</SelectItem>
                          <SelectItem value="4">4 - Nacional - Produção em conformidade com processos produtivos básicos</SelectItem>
                          <SelectItem value="5">5 - Nacional - Mercadoria ou bem com conteúdo de importação inferior ou igual a 40%</SelectItem>
                          <SelectItem value="6">6 - Estrangeira - Importação direta, sem similar nacional</SelectItem>
                          <SelectItem value="7">7 - Estrangeira - Adquirida no mercado interno, sem similar nacional</SelectItem>
                          <SelectItem value="8">8 - Nacional - Mercadoria ou bem com conteúdo de importação superior a 70%</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Origem da mercadoria
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="aliq_icms">Alíq. ICMS (%)</Label>
                      <Input
                        id="aliq_icms"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.aliq_icms}
                        onChange={(e) => setFormData({ ...formData, aliq_icms: e.target.value })}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Alíquota do ICMS (%)
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="aliq_pis">Alíq. Pis (%)</Label>
                      <Input
                        id="aliq_pis"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.aliq_pis}
                        onChange={(e) => setFormData({ ...formData, aliq_pis: e.target.value })}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Alíquota do PIS (%)
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="aliq_cofins">Alíq. Cofins (%)</Label>
                      <Input
                        id="aliq_cofins"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.aliq_cofins}
                        onChange={(e) => setFormData({ ...formData, aliq_cofins: e.target.value })}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Alíquota do COFINS (%)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Aba Variações */}
            <TabsContent value="variacoes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Nova Variação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Nome da Variação</Label>
                      <Input
                        value={novaVariacao.nome}
                        onChange={(e) => setNovaVariacao({ ...novaVariacao, nome: e.target.value })}
                        placeholder="ex: Tamanho, Cor"
                      />
                    </div>
                    <div>
                      <Label>Tipo</Label>
                      <Select value={novaVariacao.tipo} onValueChange={(v: any) => setNovaVariacao({ ...novaVariacao, tipo: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TEXTO">Texto</SelectItem>
                          <SelectItem value="NUMERO">Número</SelectItem>
                          <SelectItem value="COR">Cor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button type="button" onClick={adicionarVariacao} disabled={!novaVariacao.nome}>
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {variacoes.map((variacao, idx) => (
                <Card key={variacao.id || variacao.tempId}>
                  <CardHeader>
                    <CardTitle>{variacao.nome} ({variacao.tipo})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {(valoresVariacao[variacao.id || variacao.tempId] || []).map((valor, valIdx) => (
                        <div key={valor.id || valor.tempId} className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Label>Valor</Label>
                            <Input
                              value={valor.valor}
                              onChange={(e) => {
                                const novosValores = [...(valoresVariacao[variacao.id || variacao.tempId] || [])]
                                novosValores[valIdx].valor = e.target.value
                                setValoresVariacao({ ...valoresVariacao, [variacao.id || variacao.tempId]: novosValores })
                              }}
                              placeholder="ex: P, M, G"
                            />
                          </div>
                          <div className="flex-1">
                            <Label>Label</Label>
                            <Input
                              value={valor.label || ''}
                              onChange={(e) => {
                                const novosValores = [...(valoresVariacao[variacao.id || variacao.tempId] || [])]
                                novosValores[valIdx].label = e.target.value
                                setValoresVariacao({ ...valoresVariacao, [variacao.id || variacao.tempId]: novosValores })
                              }}
                              placeholder="ex: Pequeno, Médio, Grande"
                            />
                          </div>
                          <div className="w-32">
                            <Label>Preço Adicional</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={valor.preco_adicional ?? 0}
                              onChange={(e) => {
                                const novosValores = [...(valoresVariacao[variacao.id || variacao.tempId] || [])]
                                const novoValor = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                novosValores[valIdx].preco_adicional = isNaN(novoValor) ? 0 : novoValor
                                setValoresVariacao({ ...valoresVariacao, [variacao.id || variacao.tempId]: novosValores })
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              const novosValores = (valoresVariacao[variacao.id || variacao.tempId] || []).filter((_, i) => i !== valIdx)
                              setValoresVariacao({ ...valoresVariacao, [variacao.id || variacao.tempId]: novosValores })
                            }}
                          >
                            Remover
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => adicionarValorVariacao(variacao.id || variacao.tempId)}
                      >
                        + Adicionar Valor
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setVariacoes(variacoes.filter((_, i) => i !== idx))
                        const novosValores = { ...valoresVariacao }
                        delete novosValores[variacao.id || variacao.tempId]
                        setValoresVariacao(novosValores)
                      }}
                    >
                      Remover Variação
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Aba Opcionais */}
            <TabsContent value="opcionais" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Novo Grupo de Opcionais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label>Nome do Grupo</Label>
                      <Input
                        value={novoGrupoOpcional.nome}
                        onChange={(e) => setNovoGrupoOpcional({ ...novoGrupoOpcional, nome: e.target.value })}
                        placeholder="ex: Adicionais, Bebidas"
                      />
                    </div>
                    <div>
                      <Label>Min Seleções</Label>
                      <Input
                        type="number"
                        min="0"
                        value={novoGrupoOpcional.min_selecoes}
                        onChange={(e) => setNovoGrupoOpcional({ ...novoGrupoOpcional, min_selecoes: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>Max Seleções</Label>
                      <Input
                        type="number"
                        min="1"
                        value={novoGrupoOpcional.max_selecoes || ''}
                        onChange={(e) => setNovoGrupoOpcional({ ...novoGrupoOpcional, max_selecoes: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Ilimitado"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" onClick={adicionarGrupoOpcional} disabled={!novoGrupoOpcional.nome}>
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {gruposOpcionais.map((grupo, idx) => (
                <Card key={grupo.id || grupo.tempId}>
                  <CardHeader>
                    <CardTitle>{grupo.nome}</CardTitle>
                    <CardDescription>
                      Min: {grupo.min_selecoes} | Max: {grupo.max_selecoes || 'Ilimitado'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {(opcionais[grupo.id || grupo.tempId] || []).map((opc, opcIdx) => (
                        <div key={opc.id || opc.tempId} className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Label>Nome</Label>
                            <Input
                              value={opc.nome}
                              onChange={(e) => {
                                const novosOpcionais = [...(opcionais[grupo.id || grupo.tempId] || [])]
                                novosOpcionais[opcIdx].nome = e.target.value
                                setOpcionais({ ...opcionais, [grupo.id || grupo.tempId]: novosOpcionais })
                              }}
                              placeholder="ex: Queijo Extra"
                            />
                          </div>
                          <div className="w-32">
                            <Label>Preço</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={opc.preco || 0}
                              onChange={(e) => {
                                const novosOpcionais = [...(opcionais[grupo.id || grupo.tempId] || [])]
                                novosOpcionais[opcIdx].preco = parseFloat(e.target.value) || 0
                                setOpcionais({ ...opcionais, [grupo.id || grupo.tempId]: novosOpcionais })
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              const novosOpcionais = (opcionais[grupo.id || grupo.tempId] || []).filter((_, i) => i !== opcIdx)
                              setOpcionais({ ...opcionais, [grupo.id || grupo.tempId]: novosOpcionais })
                            }}
                          >
                            Remover
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => adicionarOpcional(grupo.id || grupo.tempId)}
                      >
                        + Adicionar Opcional
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setGruposOpcionais(gruposOpcionais.filter((_, i) => i !== idx))
                        const novosOpcionais = { ...opcionais }
                        delete novosOpcionais[grupo.id || grupo.tempId]
                        setOpcionais(novosOpcionais)
                      }}
                    >
                      Remover Grupo
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Aba Itens do Kit */}
            {formData.tipo === 'KIT' && (
              <TabsContent value="kit" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Produtos que compõem o Kit</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Adicione os produtos que fazem parte deste kit. Na emissão da nota fiscal, o kit será expandido para os produtos individuais.
                    </p>
                    
                    {/* Formulário para adicionar item */}
                    {produto?.id ? (
                      <Card className="p-4 mb-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="col-span-2">
                            <Label>Produto</Label>
                            <Select
                              value={novoKitItem.produto_id}
                              onValueChange={(v) => setNovoKitItem({ ...novoKitItem, produto_id: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um produto" />
                              </SelectTrigger>
                              <SelectContent>
                                {produtosDisponiveis
                                  .filter(p => !kitsItens.some(ki => ki.produto_id === p.id))
                                  .map(prod => (
                                    <SelectItem key={prod.id} value={prod.id}>
                                      {prod.nome} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(prod.preco))}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Quantidade</Label>
                            <Input
                              type="number"
                              min="1"
                              value={novoKitItem.quantidade}
                              onChange={(e) => setNovoKitItem({ ...novoKitItem, quantidade: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={adicionarKitItem}
                          disabled={!novoKitItem.produto_id}
                          className="mt-4"
                        >
                          Adicionar ao Kit
                        </Button>
                      </Card>
                    ) : (
                      <Card className="p-4 mb-4 bg-muted">
                        <p className="text-sm text-muted-foreground">
                          Salve o produto primeiro para adicionar itens ao kit.
                        </p>
                      </Card>
                    )}

                    {/* Lista de itens do kit */}
                    {kitsItens.length === 0 ? (
                      <Card className="p-8 text-center">
                        <p className="text-muted-foreground">Nenhum produto adicionado ao kit ainda.</p>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {kitsItens.map((item) => (
                          <Card key={item.id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold">
                                  {(item.produto as any)?.nome || 'Produto não encontrado'}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  Quantidade: {item.quantidade} | 
                                  Preço unitário: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number((item.produto as any)?.preco || 0))}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removerKitItem(item.id)}
                              >
                                Remover
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            )}

            {/* Aba Disponibilidade */}
            <TabsContent value="disponibilidade" className="space-y-4">
              <DisponibilidadeManager 
                produtoId={produto?.id}
                empresaId={empresaId}
                disponibilidades={produto?.disponibilidades || []}
              />
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
