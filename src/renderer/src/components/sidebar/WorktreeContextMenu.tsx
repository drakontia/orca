import React, { useCallback } from 'react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import {
  FolderOpen,
  Copy,
  Eye,
  EyeOff,
  Link,
  MessageSquare,
  XCircle,
  Archive,
  Trash2
} from 'lucide-react'
import { useAppStore } from '@/store'
import type { Worktree } from '../../../../shared/types'

interface Props {
  worktree: Worktree
  children: React.ReactNode
}

const WorktreeContextMenu = React.memo(function WorktreeContextMenu({ worktree, children }: Props) {
  const updateWorktreeMeta = useAppStore((s) => s.updateWorktreeMeta)
  const removeWorktree = useAppStore((s) => s.removeWorktree)
  const openModal = useAppStore((s) => s.openModal)
  const closeTab = useAppStore((s) => s.closeTab)

  const handleOpenInFinder = useCallback(() => {
    window.api.shell.openPath(worktree.path)
  }, [worktree.path])

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(worktree.path)
  }, [worktree.path])

  const handleToggleRead = useCallback(() => {
    updateWorktreeMeta(worktree.id, { isUnread: !worktree.isUnread })
  }, [worktree.id, worktree.isUnread, updateWorktreeMeta])

  const handleLinkIssue = useCallback(() => {
    openModal('link-issue', { worktreeId: worktree.id, currentIssue: worktree.linkedIssue })
  }, [worktree.id, worktree.linkedIssue, openModal])

  const handleComment = useCallback(() => {
    openModal('edit-comment', { worktreeId: worktree.id, currentComment: worktree.comment })
  }, [worktree.id, worktree.comment, openModal])

  const handleCloseTerminals = useCallback(() => {
    const tabs = useAppStore.getState().tabsByWorktree[worktree.id] ?? []
    for (const tab of tabs) {
      if (tab.ptyId) {
        window.api.pty.kill(tab.ptyId)
      }
      closeTab(tab.id)
    }
  }, [worktree.id, closeTab])

  const handleArchive = useCallback(() => {
    updateWorktreeMeta(worktree.id, { isArchived: true })
  }, [worktree.id, updateWorktreeMeta])

  const handleDelete = useCallback(() => {
    removeWorktree(worktree.id)
  }, [worktree.id, removeWorktree])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={handleOpenInFinder}>
          <FolderOpen className="size-3.5" />
          Open in Finder
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyPath}>
          <Copy className="size-3.5" />
          Copy Path
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleToggleRead}>
          {worktree.isUnread ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {worktree.isUnread ? 'Mark Read' : 'Mark Unread'}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleLinkIssue}>
          <Link className="size-3.5" />
          {worktree.linkedIssue ? 'Edit GH Issue' : 'Link GH Issue'}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleComment}>
          <MessageSquare className="size-3.5" />
          {worktree.comment ? 'Edit Comment' : 'Add Comment'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCloseTerminals}>
          <XCircle className="size-3.5" />
          Close Terminals
        </ContextMenuItem>
        <ContextMenuItem onClick={handleArchive}>
          <Archive className="size-3.5" />
          Archive
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={handleDelete}>
          <Trash2 className="size-3.5" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

export default WorktreeContextMenu
