'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { obterConfiguracaoAparencia } from '@/app/actions/configuracoes'
import { contarItensCarrinho } from '@/lib/carrinho'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, ShoppingCart, LogOut, Package, User } from 'lucide-react'
import Link from 'next/link'

type Aparencia = {
  loja_nome: string
  loja_logo_url: string
  loja_favicon_url: string
}

function normalizarAparencia(raw: any): Aparencia {
  return {
    loja_nome: String(raw?.loja_nome ?? ''),
    loja_logo_url: String(raw?.loja_logo_url ?? ''),
    loja_favicon_url: String(raw?.loja_favicon_url ?? ''),
  }
}

export function LojaHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [config, setConfig] = useState<Aparencia>({
    loja_nome: '',
    loja_logo_url: '',
    loja_favicon_url: '',
  })
  const [totalItens, setTotalItens] = useState(0)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoFalhou, setLogoFalhou] = useState(false)

  useEffect(() => {
    carregarConfig()
    setTotalItens(contarItensCarrinho())

    const interval = setInterval(() => {
      setTotalItens(contarItensCarrinho())
    }, 1000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const href = (config.loja_favicon_url || '').trim()
    if (!href) return

    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
    if (link) {
      link.href = href
      return
    }

    const newLink = document.createElement('link')
    newLink.rel = 'icon'
    newLink.href = href
    document.head.appendChild(newLink)
  }, [config.loja_favicon_url])

  async function carregarConfig() {
    try {
      const aparencia = await obterConfiguracaoAparencia()
      setConfig(normalizarAparencia(aparencia))
    } catch (err) {
      console.error('Erro ao carregar configurações:', err)
    } finally {
      setLoading(false)
    }
  }

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
    { href: '/loja', label: 'Produtos' },
    { href: '/loja/pedidos', label: 'Meus Pedidos' },
    { href: '/loja/perfil', label: 'Meu Perfil' },
  ]

  const nomeLoja = (config.loja_nome || '').trim() || 'Loja Online'
  const logoUrl = (config.loja_logo_url || '').trim()
  const mostrarLogo = !!logoUrl && !logoFalhou
  const mostrarNome = !mostrarLogo

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/loja" className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0">
            {mostrarLogo ? (
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

          <nav className="hidden md:flex items-center gap-1">
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

          <div className="hidden md:flex items-center gap-2">
            <Link href="/loja/carrinho">
              <Button variant="outline" size="sm" className="relative">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Carrinho
                {totalItens > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {totalItens}
                  </span>
                )}
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>

          <div className="flex md:hidden items-center gap-2">
            <Link href="/loja/carrinho">
              <Button variant="ghost" size="sm" className="p-2 relative" aria-label="Carrinho">
                <ShoppingCart className="h-5 w-5" />
                {totalItens > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {totalItens}
                  </span>
                )}
              </Button>
            </Link>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>

              <SheetContent side="right" className="w-80">
                <div className="flex flex-col h-full">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold mb-1">Menu</h2>
                    <p className="text-sm text-muted-foreground">Navegação da loja</p>
                  </div>

                  <nav className="flex-1 space-y-1">
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                          pathname === item.href
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        }`}
                      >
                        {item.href === '/loja' && <Package className="h-4 w-4" />}
                        {item.href === '/loja/pedidos' && <Package className="h-4 w-4" />}
                        {item.href === '/loja/perfil' && <User className="h-4 w-4" />}
                        {item.label}
                      </Link>
                    ))}
                  </nav>

                  <div className="mt-auto pt-4 border-t">
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
