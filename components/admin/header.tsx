'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { obterConfiguracaoAparencia } from '@/app/actions/configuracoes'
import { temFilhosAtivos } from '@/app/actions/responsavel'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, LogOut, Store } from 'lucide-react'
import Link from 'next/link'

type Aparencia = {
  loja_nome?: string | null
  loja_logo_url?: string | null
  loja_favicon_url?: string | null
}

export function AdminHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [config, setConfig] = useState<Aparencia>({
    loja_nome: '',
    loja_logo_url: '',
    loja_favicon_url: '',
  })
  const [temFilhos, setTemFilhos] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [aparencia, filhos] = await Promise.all([obterConfiguracaoAparencia(), temFilhosAtivos()])
        if (!mounted) return
        setConfig((aparencia || {}) as Aparencia)
        setTemFilhos(!!filhos)
      } catch (err) {
        console.error('Erro ao carregar configurações:', err)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  async function handleLogout() {
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (err) {
      console.error('Erro ao fazer logout:', err)
    }
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/pedidos', label: 'Pedidos' },
    { href: '/admin/produtos', label: 'Produtos' },
    { href: '/admin/alunos', label: 'Alunos' },
    { href: '/admin/empresas', label: 'Empresas' },
    { href: '/admin/turmas', label: 'Turmas' },
    { href: '/admin/usuarios', label: 'Usuários' },
    { href: '/admin/importacao', label: 'Importação' },
    { href: '/admin/configuracoes', label: 'Configurações' },
  ]

  const nomeLoja = (config.loja_nome || '').trim() || 'Painel Admin'
  const logoUrl = (config.loja_logo_url || '').trim()
  const mostrarLogo = !!logoUrl
  const mostrarNomeSempre = !mostrarLogo

  const [logoFalhou, setLogoFalhou] = useState(false)
  const mostrarNome = mostrarNomeSempre || logoFalhou

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0">
            {mostrarLogo && !logoFalhou ? (
              <img
                src={logoUrl}
                alt={nomeLoja}
                className="h-10 w-auto max-w-[200px] object-contain"
                onError={() => setLogoFalhou(true)}
              />
            ) : null}

            {mostrarNome ? (
              <span className="font-semibold text-lg text-foreground whitespace-nowrap">{nomeLoja}</span>
            ) : null}
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            {temFilhos && (
              <Link href="/loja">
                <Button variant="outline" size="sm">
                  <Store className="h-4 w-4 mr-2" />
                  Loja
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>

          <div className="flex lg:hidden items-center gap-2">
            {temFilhos && (
              <Link href="/loja">
                <Button variant="ghost" size="sm" className="p-2" aria-label="Ir para Loja">
                  <Store className="h-5 w-5" />
                </Button>
              </Link>
            )}

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>

              <SheetContent side="left" className="w-80">
                <div className="flex flex-col h-full">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold mb-1">Menu</h2>
                    <p className="text-sm text-muted-foreground">Navegação do painel</p>
                  </div>

                  <nav className="flex-1 space-y-1">
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                          pathname === item.href
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>

                  <div className="mt-auto pt-4 border-t space-y-2">
                    {temFilhos && (
                      <Link href="/loja" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="outline" className="w-full justify-start">
                          <Store className="h-4 w-4 mr-2" />
                          Acessar Loja
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive hover:text-destructive"
                      onClick={() => {
                        setMobileMenuOpen(false)
                        handleLogout()
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sair
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
