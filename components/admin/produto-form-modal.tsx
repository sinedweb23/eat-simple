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
import { criarVariacao, criarVariacaoValor, criarGrupoOpcional, criarOpcional } from '@/app/actions/produtos-admin'
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
  })

  // Variações
  const [variacoes, setVariacoes] = useState<any[]>([])
  const [novaVariacao, setNovaVariacao] = useState({ nome: '', tipo: 'TEXTO' as 'TEXTO' | 'NUMERO' | 'COR', obrigatorio: false })
  const [valoresVariacao, setValoresVariacao] = useState<Record<string, any[]>>({})

  // Opcionais
  const [gruposOpcionais, setGruposOpcionais] = useState<any[]>([])
  const [novoGrupoOpcional, setNovoGrupoOpcional] = useState({ nome: '', obrigatorio: false, min_selecoes: 0, max_selecoes: null as number | null })
  const [opcionais, setOpcionais] = useState<Record<string, any[]>>({})

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
      }

      let produtoId = produto?.id

      // Criar ou atualizar produto
      const produtoSalvo = await onSave(dados)
      produtoId = produtoSalvo.id

      // Criar variações e valores (apenas novas, não existentes)
      for (const variacao of variacoes) {
        if (!variacao.id && produtoId) {
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
                preco_adicional: valor.preco_adicional || 0,
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="variacoes">Variações</TabsTrigger>
              <TabsTrigger value="opcionais">Opcionais</TabsTrigger>
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
                              value={valor.preco_adicional || 0}
                              onChange={(e) => {
                                const novosValores = [...(valoresVariacao[variacao.id || variacao.tempId] || [])]
                                novosValores[valIdx].preco_adicional = parseFloat(e.target.value) || 0
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
