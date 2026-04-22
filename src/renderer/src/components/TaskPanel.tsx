import { useState, useEffect, useCallback } from 'react'
import type { Task } from '../../../../shared/types'

const PX = "'Press Start 2P', monospace"

const PRIORITY_COLORS = {
  high: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', dot: '#ef4444', label: 'URGENT' },
  mid:  { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.25)', dot: '#eab308', label: 'NORMAL' },
  low:  { bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.2)', dot: '#22c55e', label: 'LOW' },
}

export default function TaskPanel() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newText, setNewText] = useState('')
  const [newPriority, setNewPriority] = useState<'low' | 'mid' | 'high'>('mid')
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set())
  const [addingSubFor, setAddingSubFor] = useState<number | null>(null)
  const [subText, setSubText] = useState('')

  const loadTasks = useCallback(async () => {
    const t = await window.aura.tasks.list()
    setTasks(t)
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  const parentTasks = tasks.filter(t => !t.parent_id)
  const getSubtasks = (parentId: number) => tasks.filter(t => t.parent_id === parentId)

  const addTask = async () => {
    if (!newText.trim()) return
    await window.aura.tasks.add(newText.trim(), newPriority)
    setNewText('')
    setNewPriority('mid')
    loadTasks()
  }

  const addSubtask = async (parentId: number) => {
    if (!subText.trim()) return
    await window.aura.tasks.add(subText.trim(), 'mid', parentId)
    setSubText('')
    setAddingSubFor(null)
    setExpandedParents(prev => new Set(prev).add(parentId))
    loadTasks()
  }

  const toggle = async (id: number) => {
    await window.aura.tasks.toggle(id)
    loadTasks()
  }

  const remove = async (id: number) => {
    await window.aura.tasks.remove(id)
    loadTasks()
  }

  const toggleExpand = (id: number) => {
    setExpandedParents(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const pendingCount = parentTasks.filter(t => !t.done).length
  const doneCount = parentTasks.filter(t => t.done).length

  return (
    <div data-tutorial="task-panel-root" className="p-5 h-full flex flex-col" style={{ fontFamily: PX }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="1" width="7" height="7" rx="1" fill="rgba(234,179,8,0.6)" />
            <rect x="10" y="1" width="7" height="7" rx="1" fill="rgba(234,179,8,0.3)" />
            <rect x="1" y="10" width="7" height="7" rx="1" fill="rgba(234,179,8,0.3)" />
            <rect x="10" y="10" width="7" height="7" rx="1" fill="rgba(234,179,8,0.15)" />
          </svg>
          <span style={{ fontSize: 9, color: 'rgba(232,197,106,0.8)', letterSpacing: '0.12em' }}>
            TASKS
          </span>
        </div>
        <div className="flex gap-3" style={{ fontSize: 7, color: 'rgba(200,160,140,0.4)' }}>
          <span>{pendingCount} active</span>
          <span>·</span>
          <span>{doneCount} done</span>
        </div>
      </div>

      {/* Add task */}
      <div className="flex gap-2 mb-4">
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTask() }}
          placeholder="New task..."
          className="flex-1 bg-transparent outline-none px-3 py-2 rounded-lg"
          style={{
            fontSize: 8,
            color: 'rgba(230,200,190,0.8)',
            border: '1px solid rgba(139,58,58,0.15)',
            background: 'rgba(10,6,6,0.6)',
          }}
        />
        {/* Priority selector */}
        <div className="flex gap-1">
          {(['low', 'mid', 'high'] as const).map(p => (
            <button key={p} onClick={() => setNewPriority(p)}
              className="w-7 h-7 rounded flex items-center justify-center transition-all"
              style={{
                background: newPriority === p ? PRIORITY_COLORS[p].bg : 'transparent',
                border: `1px solid ${newPriority === p ? PRIORITY_COLORS[p].border : 'rgba(255,255,255,0.05)'}`,
              }}>
              <div className="w-2 h-2 rounded-full" style={{ background: PRIORITY_COLORS[p].dot, opacity: newPriority === p ? 1 : 0.3 }} />
            </button>
          ))}
        </div>
        <button onClick={addTask}
          className="px-3 py-2 rounded-lg transition-all"
          style={{
            fontSize: 8,
            color: 'rgba(232,197,106,0.7)',
            background: newText.trim() ? 'rgba(234,179,8,0.12)' : 'transparent',
            border: `1px solid ${newText.trim() ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.05)'}`,
          }}>
          +
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,58,58,0.15) transparent' }}>
        {parentTasks.length === 0 && (
          <div className="flex items-center justify-center h-32" style={{ fontSize: 7, color: 'rgba(200,160,140,0.2)' }}>
            No tasks yet. Add one or tell Wispucci AI.
          </div>
        )}

        {parentTasks.map(task => {
          const subs = getSubtasks(task.id)
          const expanded = expandedParents.has(task.id)
          const doneSubs = subs.filter(s => s.done).length
          const pc = PRIORITY_COLORS[task.priority]

          return (
            <div key={task.id}>
              {/* Parent task */}
              <div className="group flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all"
                style={{
                  background: task.done ? 'rgba(34,197,94,0.04)' : pc.bg,
                  border: `1px solid ${task.done ? 'rgba(34,197,94,0.1)' : pc.border}`,
                  opacity: task.done ? 0.5 : 1,
                }}>
                {/* Checkbox */}
                <button onClick={() => toggle(task.id)}
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                  style={{
                    border: `1.5px solid ${task.done ? '#22c55e' : pc.dot}`,
                    background: task.done ? 'rgba(34,197,94,0.3)' : 'transparent',
                  }}>
                  {task.done && <span style={{ fontSize: 8, color: '#22c55e' }}>✓</span>}
                </button>

                {/* Expand subtasks arrow */}
                {subs.length > 0 && (
                  <button onClick={() => toggleExpand(task.id)}
                    className="w-4 h-4 flex items-center justify-center shrink-0 transition-transform"
                    style={{
                      fontSize: 7, color: 'rgba(200,160,140,0.3)',
                      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}>
                    ▸
                  </button>
                )}

                {/* Text */}
                <span className="flex-1 truncate" style={{
                  fontSize: 8, color: task.done ? 'rgba(200,160,140,0.3)' : 'rgba(230,200,190,0.75)',
                  textDecoration: task.done ? 'line-through' : 'none',
                }}>
                  {task.text}
                </span>

                {/* Subtask count */}
                {subs.length > 0 && (
                  <span style={{ fontSize: 6, color: 'rgba(200,160,140,0.25)' }}>
                    {doneSubs}/{subs.length}
                  </span>
                )}

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setAddingSubFor(addingSubFor === task.id ? null : task.id); setSubText('') }}
                    className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ fontSize: 8, color: 'rgba(200,160,140,0.3)', background: 'rgba(255,255,255,0.03)' }}
                    title="Add sub-task">
                    ⊞
                  </button>
                  <button onClick={() => remove(task.id)}
                    className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ fontSize: 8, color: 'rgba(239,68,68,0.3)', background: 'rgba(255,255,255,0.03)' }}
                    title="Delete">
                    ✕
                  </button>
                </div>
              </div>

              {/* Add subtask input */}
              {addingSubFor === task.id && (
                <div className="ml-6 mt-1 flex gap-2">
                  <input
                    value={subText}
                    onChange={e => setSubText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addSubtask(task.id); if (e.key === 'Escape') setAddingSubFor(null) }}
                    placeholder="Sub-task..."
                    autoFocus
                    className="flex-1 bg-transparent outline-none px-2 py-1.5 rounded"
                    style={{
                      fontSize: 7,
                      color: 'rgba(230,200,190,0.7)',
                      border: '1px solid rgba(139,58,58,0.12)',
                      background: 'rgba(10,6,6,0.5)',
                    }}
                  />
                  <button onClick={() => addSubtask(task.id)}
                    className="px-2 py-1 rounded"
                    style={{ fontSize: 7, color: 'rgba(232,197,106,0.6)', border: '1px solid rgba(234,179,8,0.2)' }}>
                    +
                  </button>
                </div>
              )}

              {/* Subtasks */}
              {expanded && subs.length > 0 && (
                <div className="ml-6 mt-1 space-y-1 border-l" style={{ borderColor: 'rgba(139,58,58,0.08)', paddingLeft: 8 }}>
                  {subs.map(sub => (
                    <div key={sub.id} className="group flex items-center gap-2 px-2 py-1.5 rounded transition-all"
                      style={{
                        background: sub.done ? 'rgba(34,197,94,0.03)' : 'rgba(255,255,255,0.02)',
                        opacity: sub.done ? 0.4 : 0.85,
                      }}>
                      <button onClick={() => toggle(sub.id)}
                        className="w-3 h-3 rounded flex items-center justify-center shrink-0"
                        style={{
                          border: `1px solid ${sub.done ? '#22c55e' : 'rgba(200,160,140,0.2)'}`,
                          background: sub.done ? 'rgba(34,197,94,0.3)' : 'transparent',
                        }}>
                        {sub.done && <span style={{ fontSize: 6, color: '#22c55e' }}>✓</span>}
                      </button>
                      <span className="flex-1 truncate" style={{
                        fontSize: 7, color: sub.done ? 'rgba(200,160,140,0.25)' : 'rgba(230,200,190,0.6)',
                        textDecoration: sub.done ? 'line-through' : 'none',
                      }}>
                        {sub.text}
                      </span>
                      <button onClick={() => remove(sub.id)}
                        className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100"
                        style={{ fontSize: 6, color: 'rgba(239,68,68,0.25)' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
