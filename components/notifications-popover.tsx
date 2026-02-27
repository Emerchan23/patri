"use client"

import * as React from "react"
import { Bell, Check, Trash2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface Notificacao {
  id: string
  titulo: string
  mensagem: string
  tipo: "info" | "warning" | "success" | "error"
  lida: boolean
  link?: string
  criadoEm: string
}

export function NotificationsPopover() {
  const [open, setOpen] = React.useState(false)
  const [notificacoes, setNotificacoes] = React.useState<Notificacao[]>([])
  const [loading, setLoading] = React.useState(false)
  const router = useRouter()

  const fetchNotificacoes = React.useCallback(async () => {
    try {
      // Don't set loading on poll to avoid flickering
      if (notificacoes.length === 0) setLoading(true)
      const data = await api.getNotificacoes()
      setNotificacoes(data)
    } catch (error) {
      console.error("Erro ao carregar notificacoes:", error)
    } finally {
      setLoading(false)
    }
  }, [notificacoes.length])

  // Initial fetch and polling
  React.useEffect(() => {
    fetchNotificacoes()
    const interval = setInterval(fetchNotificacoes, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, []) // Empty dependency array to only run on mount

  const unreadCount = notificacoes.filter((n) => !n.lida).length

  const handleMarkAsRead = async (id: string) => {
    try {
      // Optimistic update
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
      )
      await api.marcarNotificacaoLida(id)
    } catch (error) {
      console.error("Erro ao marcar como lida:", error)
      fetchNotificacoes() // Revert on error
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      // Optimistic update
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
      await api.marcarTodasLidas()
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error)
      fetchNotificacoes() // Revert on error
    }
  }

  const getNotificationLink = (link: string) => {
    // Map legacy or simple links to actual routes
    const linkMap: Record<string, string> = {
      'admin-usuarios': '/usuarios',
      'bens': '/bens',
      'emprestimos': '/emprestimos',
      'relatorios': '/relatorios',
      'pendencias': '/pendencias',
      'movimentacoes': '/movimentacoes',
      'veiculos': '/veiculos',
    }

    if (linkMap[link]) {
      return linkMap[link]
    }

    // If it starts with http or /, return as is
    if (link.startsWith('http') || link.startsWith('/')) {
      return link
    }

    // Default: try to prepend /
    return `/${link}`
  }

  const handleNotificationClick = async (notificacao: Notificacao) => {
    if (!notificacao.lida) {
      handleMarkAsRead(notificacao.id)
    }
    setOpen(false)
    if (notificacao.link) {
      router.push(getNotificationLink(notificacao.link))
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-in zoom-in">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notificacoes</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 text-xs text-muted-foreground hover:text-primary"
              onClick={handleMarkAllAsRead}
            >
              <Check className="mr-1 h-3 w-3" />
              Ler todas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {loading && notificacoes.length === 0 ? (
            <div className="flex h-full items-center justify-center p-4">
              <span className="text-xs text-muted-foreground">Carregando...</span>
            </div>
          ) : notificacoes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-20" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notificacoes.map((notificacao) => (
                <button
                  key={notificacao.id}
                  className={cn(
                    "relative flex w-full flex-col gap-1 border-b p-4 text-left transition-colors hover:bg-muted/50",
                    !notificacao.lida ? "bg-muted/20" : "bg-transparent"
                  )}
                  onClick={() => handleNotificationClick(notificacao)}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className={cn("text-sm font-medium leading-none", !notificacao.lida && "text-foreground")}>
                      {notificacao.titulo}
                    </span>
                    {!notificacao.lida && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notificacao.mensagem}
                  </p>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notificacao.criadoEm), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
