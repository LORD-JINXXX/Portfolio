import React from 'react'
import type { ResponsiveMode } from '@platform/contracts'
import type { NodeDropPosition } from '@platform/builder-core'
import { canvasBoundsFromRects, findRuntimeNodeElement, type CanvasRect } from './canvas-geometry'

interface CanvasChromeOverlayProps {
  surfaceRef: React.RefObject<HTMLDivElement>
  contentRef: React.RefObject<HTMLDivElement>
  selectedNodeId: string | null
  dropTargetId: string | null
  dropPosition: NodeDropPosition | null
  mode: ResponsiveMode
  zoom: number
  geometryVersion: unknown
  canTransform?: boolean
  onTransform?: (next: { x: number; y: number; width: number; height: number }) => void
}

interface OverlayGeometry {
  selection: CanvasRect | null
  drop: CanvasRect | null
}

const EMPTY_GEOMETRY: OverlayGeometry = { selection: null, drop: null }

function sameRect(left: CanvasRect | null, right: CanvasRect | null): boolean {
  if (left === right) return true
  if (!left || !right) return false
  return Math.abs(left.left - right.left) < 0.1 && Math.abs(left.top - right.top) < 0.1 && Math.abs(left.width - right.width) < 0.1 && Math.abs(left.height - right.height) < 0.1
}

export function CanvasChromeOverlay({ surfaceRef, contentRef, selectedNodeId, dropTargetId, dropPosition, mode, zoom, geometryVersion, canTransform = false, onTransform }: CanvasChromeOverlayProps) {
  const [geometry, setGeometry] = React.useState<OverlayGeometry>(EMPTY_GEOMETRY)

  React.useLayoutEffect(() => {
    const surface = surfaceRef.current
    const content = contentRef.current
    if (!surface || !content) { setGeometry(EMPTY_GEOMETRY); return }
    let active = true
    let frame = 0

    const update = () => {
      if (!active) return
      const surfaceRect = surface.getBoundingClientRect()
      const toBounds = (nodeId: string | null) => {
        const element = findRuntimeNodeElement(content, nodeId)
        return element ? canvasBoundsFromRects(element.getBoundingClientRect(), surfaceRect, surface.offsetWidth, surface.offsetHeight) : null
      }
      const next = { selection: toBounds(selectedNodeId), drop: toBounds(dropTargetId) }
      setGeometry((current) => sameRect(current.selection, next.selection) && sameRect(current.drop, next.drop) ? current : next)
    }
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    content.addEventListener('load', schedule, true)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    resizeObserver?.observe(surface)
    resizeObserver?.observe(content)
    const selectedElement = findRuntimeNodeElement(content, selectedNodeId)
    const dropElement = findRuntimeNodeElement(content, dropTargetId)
    if (selectedElement instanceof Element) resizeObserver?.observe(selectedElement)
    if (dropElement instanceof Element && dropElement !== selectedElement) resizeObserver?.observe(dropElement)
    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule)
    mutationObserver?.observe(content, { subtree: true, childList: true, attributes: true, characterData: true })
    void document.fonts?.ready.then(schedule)

    return () => {
      active = false
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      content.removeEventListener('load', schedule, true)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
    }
  }, [contentRef, dropPosition, dropTargetId, geometryVersion, mode, selectedNodeId, surfaceRef, zoom])

  const beginTransform = React.useCallback((event: React.PointerEvent, kind: 'move' | 'resize') => {
    if (!canTransform || !onTransform || !geometry.selection) return
    event.preventDefault()
    event.stopPropagation()
    const start = { clientX: event.clientX, clientY: event.clientY, rect: geometry.selection }
    const surface = surfaceRef.current
    const renderedScale = surface && surface.offsetWidth > 0 ? surface.getBoundingClientRect().width / surface.offsetWidth : Math.max(zoom, 0.01)
    const scale = Math.max(renderedScale, 0.01)
    const move = (pointer: PointerEvent) => {
      const dx = (pointer.clientX - start.clientX) / scale
      const dy = (pointer.clientY - start.clientY) / scale
      if (kind === 'move') onTransform({ x: Math.round(start.rect.left + dx), y: Math.round(start.rect.top + dy), width: Math.max(1, Math.round(start.rect.width)), height: Math.max(1, Math.round(start.rect.height)) })
      else onTransform({ x: Math.round(start.rect.left), y: Math.round(start.rect.top), width: Math.max(16, Math.round(start.rect.width + dx)), height: Math.max(16, Math.round(start.rect.height + dy)) })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
    window.addEventListener('pointercancel', up, { once: true })
  }, [canTransform, geometry.selection, onTransform, surfaceRef, zoom])

  const scale = Math.max(zoom, 0.01)
  const selectionStroke = 2 / scale
  const dropStroke = 3 / scale
  const selection = geometry.selection
  const drop = geometry.drop
  return <div data-studio-canvas-overlay aria-hidden="true" style={{position:'absolute',inset:0,zIndex:1,pointerEvents:'none',overflow:'visible'}}>
    {selection&&<div data-studio-overlay="selection" style={{position:'absolute',boxSizing:'border-box',left:selection.left-selectionStroke,top:selection.top-selectionStroke,width:selection.width+selectionStroke*2,height:selection.height+selectionStroke*2,border:`${selectionStroke}px solid #2563eb`,boxShadow:`0 0 0 ${1/scale}px rgba(255,255,255,.72)`,borderRadius:2/scale}}>
      {canTransform&&<>
        <button type="button" aria-label="Move absolute element" data-studio-transform-handle="move" onPointerDown={(event)=>beginTransform(event,'move')} style={{position:'absolute',pointerEvents:'auto',left:'50%',top:-18/scale,transform:'translateX(-50%)',width:36/scale,height:14/scale,border:`${1/scale}px solid #2563eb`,borderRadius:4/scale,background:'#2563eb',cursor:'move',padding:0}} />
        <button type="button" aria-label="Resize absolute element" data-studio-transform-handle="resize" onPointerDown={(event)=>beginTransform(event,'resize')} style={{position:'absolute',pointerEvents:'auto',right:-5/scale,bottom:-5/scale,width:10/scale,height:10/scale,border:`${1/scale}px solid white`,borderRadius:2/scale,background:'#2563eb',cursor:'nwse-resize',padding:0}} />
      </>}
    </div>}
    {drop&&dropPosition==='inside'&&<div data-studio-overlay="drop-inside" style={{position:'absolute',boxSizing:'border-box',left:drop.left-dropStroke,top:drop.top-dropStroke,width:drop.width+dropStroke*2,height:drop.height+dropStroke*2,border:`${dropStroke}px solid #22d3ee`,background:'rgba(34,211,238,.08)',borderRadius:2/scale}}/>}
    {drop&&(dropPosition==='before'||dropPosition==='after')&&<div data-studio-overlay={`drop-${dropPosition}`} style={{position:'absolute',left:drop.left,top:(dropPosition==='before'?drop.top:drop.top+drop.height)-dropStroke/2,width:drop.width,height:dropStroke,background:'#22d3ee',boxShadow:`0 0 ${6/scale}px rgba(34,211,238,.8)`}}/>}
  </div>
}
