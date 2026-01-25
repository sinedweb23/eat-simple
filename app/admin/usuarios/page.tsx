'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listarTodosUsuarios, tornarAdmin, removerAdmin } from '@/app/actions/usuarios-admin'
import { listarEmpresas } from '@/app/actions/empresas'
import { listarUnidades } from '@/app/actions/empresas'
import Link from 'next/link'

interface Usuario {
  id: string
  nome: string
  email: string
  email_financeiro: string | null
  email_pedagogico: string | null
  ativo: boolean
  empresa_id: string | null
  unidade_id: string | null
  auth_user_id: string | null
  eh_admin: boolean
  super_admin?: boolean
  ja_logou: boolean
  empresas?: { id: string; nome: string }
  unidades?: { id: string; nome: string }
}

export default function UsuariosAdminPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [unidades, setUnidades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'admins' | 'nao_admins'>('todos')
  
  // Modal para configurar admin
  const [showModal, setShowModal] = useState(false)
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null)
  const [adminForm, setAdminForm] = useState({
    super_admin: false,
    empresa_id: 'none' as string,
    unidade_id: 'none' as string,
  })

  useEffect(() => {
    carregarDados()
  }, [])

  useEffect(() => {
    if (adminForm.empresa_id && adminForm.empresa_id !== 'none') {
      carregarUnidades(adminForm.empresa_id)
    } else {
      setUnidades([])
      setAdminForm({ ...adminForm, unidade_id: 'none' })
    }
  }, [adminForm.empresa_id])

  async function carregarDados() {
    try {
      setLoading(true)
      setError(null)
      const [usuariosData, empresasData] = await Promise.all([
        listarTodosUsuarios(),
        listarEmpresas(),
      ])
      setUsuarios(usuariosData)
      setEmpresas(empresasData)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  async function carregarUnidades(empresaId: string) {
    try {
      const dados = await listarUnidades(empresaId)
      setUnidades(dados)
    } catch (err) {
      console.error('Erro ao carregar unidades:', err)
    }
  }

  function handleTornarAdmin(usuario: Usuario) {
    setUsuarioSelecionado(usuario)
    setAdminForm({
      super_admin: usuario.super_admin || false,
      empresa_id: usuario.empresa_id || 'none',
      unidade_id: usuario.unidade_id || 'none',
    })
    if (usuario.empresa_id) {
      carregarUnidades(usuario.empresa_id)
    }
    setShowModal(true)
  }

  async function handleSalvarPermissoes() {
    if (!usuarioSelecionado) return

    try {
      setError(null)
      await tornarAdmin(usuarioSelecionado.id, {
        superAdmin: adminForm.super_admin,
        empresa_id: adminForm.empresa_id === 'none' ? null : adminForm.empresa_id,
        unidade_id: adminForm.unidade_id === 'none' ? null : adminForm.unidade_id,
      })
      setShowModal(false)
      carregarDados()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar permissões')
    }
  }

  async function handleRemoverAdmin(usuarioId: string) {
    if (!confirm('Tem certeza que deseja remover as permissões de admin deste usuário?')) return
    try {
      await removerAdmin(usuarioId)
      carregarDados()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover permissões de admin')
    }
  }

  const usuariosFiltrados = usuarios.filter(usuario => {
    if (filtro === 'admins') return usuario.eh_admin
    if (filtro === 'nao_admins') return !usuario.eh_admin
    return true
  })

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Carregando...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie todos os usuários do sistema e configure permissões de admin
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin">
            <Button variant="outline">Voltar</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex gap-2">
        <Button
          variant={filtro === 'todos' ? 'default' : 'outline'}
          onClick={() => setFiltro('todos')}
        >
          Todos ({usuarios.length})
        </Button>
        <Button
          variant={filtro === 'admins' ? 'default' : 'outline'}
          onClick={() => setFiltro('admins')}
        >
          Admins ({usuarios.filter(u => u.eh_admin).length})
        </Button>
        <Button
          variant={filtro === 'nao_admins' ? 'default' : 'outline'}
          onClick={() => setFiltro('nao_admins')}
        >
          Não Admins ({usuarios.filter(u => !u.eh_admin).length})
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {usuariosFiltrados.map((usuario) => (
          <Card key={usuario.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{usuario.nome}</span>
                {!usuario.ja_logou && (
                  <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                    Nunca logou
                  </span>
                )}
              </CardTitle>
              <CardDescription>{usuario.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">Status: </span>
                <span className={`text-sm font-medium ${
                  usuario.ja_logou ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {usuario.ja_logou ? 'Já fez login' : 'Nunca fez login'}
                </span>
              </div>
              {usuario.eh_admin && (
                <>
                  <div>
                    <span className="text-sm text-muted-foreground">Empresa: </span>
                    <span className="text-sm font-medium">
                      {usuario.empresas?.nome || 'Todas'}
                    </span>
                  </div>
                  {usuario.unidades && (
                    <div>
                      <span className="text-sm text-muted-foreground">Unidade: </span>
                      <span className="text-sm font-medium">{usuario.unidades.nome}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-2 flex-wrap">
                <span className={`text-xs px-2 py-1 rounded ${
                  usuario.ativo 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {usuario.ativo ? 'Ativo' : 'Inativo'}
                </span>
                {usuario.eh_admin && (
                  <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                    Admin
                  </span>
                )}
                {usuario.super_admin && (
                  <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 font-semibold">
                    Super Admin
                  </span>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                {usuario.eh_admin ? (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleTornarAdmin(usuario)} 
                      className="flex-1"
                    >
                      Editar Permissões
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => handleRemoverAdmin(usuario.id)}
                    >
                      Remover Admin
                    </Button>
                  </>
                ) : (
                  <Button 
                    size="sm" 
                    variant="default" 
                    onClick={() => handleTornarAdmin(usuario)} 
                    className="w-full"
                  >
                    Tornar Admin
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {usuariosFiltrados.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Nenhum usuário encontrado.
          </CardContent>
        </Card>
      )}

      {/* Modal para configurar admin */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {usuarioSelecionado?.eh_admin ? 'Editar Permissões de Admin' : 'Tornar Usuário Admin'}
            </DialogTitle>
            <DialogDescription>
              {usuarioSelecionado && (
                <>
                  Configurar permissões para: <strong>{usuarioSelecionado.nome}</strong> ({usuarioSelecionado.email})
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="super_admin"
                checked={adminForm.super_admin}
                onChange={(e) => setAdminForm({ ...adminForm, super_admin: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="super_admin" className="cursor-pointer">
                Super Administrador (acesso total)
              </Label>
            </div>
            <div>
              <Label htmlFor="empresa">Empresa (opcional)</Label>
              <Select
                value={adminForm.empresa_id}
                onValueChange={(value) => setAdminForm({ ...adminForm, empresa_id: value, unidade_id: 'none' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todas as empresas</SelectItem>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {adminForm.empresa_id && adminForm.empresa_id !== 'none' && (
              <div>
                <Label htmlFor="unidade">Unidade (opcional)</Label>
                <Select
                  value={adminForm.unidade_id}
                  onValueChange={(value) => setAdminForm({ ...adminForm, unidade_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todas as unidades</SelectItem>
                    {unidades.map((unidade) => (
                      <SelectItem key={unidade.id} value={unidade.id}>
                        {unidade.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {usuarioSelecionado && !usuarioSelecionado.ja_logou && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200 rounded-md text-sm">
                ⚠️ Este usuário nunca fez login. Ao torná-lo admin, será criada uma conta de acesso e ele precisará fazer o primeiro acesso para criar a senha.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarPermissoes}>
              {usuarioSelecionado?.eh_admin ? 'Salvar Alterações' : 'Tornar Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
