'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { criarGrupoProduto } from '@/app/actions/produtos-admin'
import type { GrupoProduto } from '@/lib/types/database'

interface GruposManagerProps {
  empresaId: string
  grupos: GrupoProduto[]
  onUpdate: () => void
}

export function GruposManager({ empresaId, grupos, onUpdate }: GruposManagerProps) {
  const [novoGrupo, setNovoGrupo] = useState({ nome: '', descricao: '', ordem: 0 })
  const [loading, setLoading] = useState(false)

  async function handleCriar() {
    if (!novoGrupo.nome.trim()) return

    setLoading(true)
    try {
      await criarGrupoProduto(empresaId, novoGrupo)
      setNovoGrupo({ nome: '', descricao: '', ordem: 0 })
      onUpdate()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar grupo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grupos de Produtos</CardTitle>
        <CardDescription>Agrupe produtos relacionados</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formulário de novo grupo */}
        <div className="grid grid-cols-4 gap-4 p-4 border rounded-lg">
          <div>
            <Label>Nome *</Label>
            <Input
              value={novoGrupo.nome}
              onChange={(e) => setNovoGrupo({ ...novoGrupo, nome: e.target.value })}
              placeholder="Nome do grupo"
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input
              value={novoGrupo.descricao}
              onChange={(e) => setNovoGrupo({ ...novoGrupo, descricao: e.target.value })}
              placeholder="Descrição"
            />
          </div>
          <div>
            <Label>Ordem</Label>
            <Input
              type="number"
              value={novoGrupo.ordem}
              onChange={(e) => setNovoGrupo({ ...novoGrupo, ordem: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleCriar} disabled={loading || !novoGrupo.nome.trim()}>
              Adicionar
            </Button>
          </div>
        </div>

        {/* Lista de grupos */}
        <div className="space-y-2">
          {grupos.map((grupo) => (
            <div key={grupo.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium">{grupo.nome}</div>
                {grupo.descricao && <div className="text-sm text-muted-foreground">{grupo.descricao}</div>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
