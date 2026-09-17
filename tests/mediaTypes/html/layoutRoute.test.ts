/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { HtmlOptions } from '@/mediaTypes/html/HtmlOptions'
import { applyContentLayoutClass, applyRendererLayoutClass, applyRootDirectionClass } from '@/mediaTypes/html/renderer/layout/applyLayoutClasses'
import { CONTENT_LAYOUT_CLASSES, LAYOUT_ROUTE_IDS, RENDERER_LAYOUT_CLASSES } from '@/mediaTypes/html/renderer/layout/layoutRouteIds'
import { getLayoutGeometry, resolveLayoutRouteId } from '@/mediaTypes/html/renderer/layout/resolveLayoutRoute'

const routeOptions = (partial: Partial<HtmlOptions>) => Object.assign(new HtmlOptions(), partial)

describe('layout routes', () => {
  it('resolves all 12 flipMode × writingMode × direction combinations', () => {
    const ids = new Set<string>()
    for (const flipMode of ['scroll', 'page'] as const) {
      for (const writingMode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const) {
        for (const direction of ['ltr', 'rtl'] as const) {
          ids.add(resolveLayoutRouteId(routeOptions({ flipMode, writingMode, direction })))
        }
      }
    }
    expect([...ids].sort()).toEqual([...LAYOUT_ROUTE_IDS].sort())
  })

  it('defaults to scroll + horizontal-tb + ltr', () => {
    const geometry = getLayoutGeometry(new HtmlOptions())
    expect(geometry.id).toBe('scroll-horizontal-tb-ltr')
    expect(geometry.rootClass).toBe('dir-ltr')
    expect(geometry.rendererClass).toBe('layout-scroll-horizontal-tb-ltr')
    expect(geometry.contentClass).toBe('content-scroll-horizontal-tb-ltr')
    expect(geometry.getPageTranslateCss(120)).toBe('translate3d(-120px,0,0)')
    expect(geometry.getPageStartOffset({ offsetLeft: 40, contentWidth: 300, containerWidth: 900 })).toBe(40)
  })

  it('keeps horizontal RTL page start and translate independent of the default route', () => {
    const geometry = getLayoutGeometry(routeOptions({
      flipMode: 'page',
      writingMode: 'horizontal-tb',
      direction: 'rtl',
    }))
    expect(geometry.id).toBe('page-horizontal-tb-rtl')
    expect(geometry.rootClass).toBe('dir-rtl')
    expect(geometry.pageSign).toBe(-1)
    expect(geometry.usesRtlPageStart).toBe(true)
    expect(geometry.getPageTranslateCss(120)).toBe('translate3d(120px,0,0)')
    expect(geometry.getPageStartOffset({
      offsetLeft: 100,
      contentWidth: 300,
      containerWidth: 900,
    })).toBe(500)
    // 7 * 408 = 2856. A missing 1px wrapper.clientLeft makes offsetLeft 490
    // and the same call return 2857, which shifts the page one pixel right.
    expect(geometry.getPageTransformOffset({
      offsetLeft: 491,
      contentWidth: 408,
      containerWidth: 899,
    }, 8, 408)).toBe(2856)
  })

  it('maps vertical page CSS column-width to page height without changing the physical column box', () => {
    const geometry = getLayoutGeometry(routeOptions({
      flipMode: 'page',
      writingMode: 'vertical-lr',
      direction: 'ltr',
    }))
    expect(geometry.getColumnWidthForCss(368, 600)).toBe(600)
    expect(geometry.getColumnWidthForCss(368, 600)).not.toBe(368)
  })

  it('copies vertical-rl ltr/rtl geometry while keeping separate files and classes', () => {
    const ltr = getLayoutGeometry(routeOptions({
      flipMode: 'page',
      writingMode: 'vertical-rl',
      direction: 'ltr',
    }))
    const rtl = getLayoutGeometry(routeOptions({
      flipMode: 'page',
      writingMode: 'vertical-rl',
      direction: 'rtl',
    }))
    expect(ltr.id).toBe('page-vertical-rl-ltr')
    expect(rtl.id).toBe('page-vertical-rl-rtl')
    expect(ltr.rendererClass).not.toBe(rtl.rendererClass)
    expect(ltr.contentClass).not.toBe(rtl.contentClass)
    expect(ltr.pageAxis).toBe('y')
    expect(rtl.pageAxis).toBe('y')
    expect(ltr.pageSign).toBe(1)
    expect(rtl.pageSign).toBe(1)
    expect(ltr.getPageTranslateCss(80)).toBe('translate3d(0,-80px,0)')
    expect(rtl.getPageTranslateCss(80)).toBe('translate3d(0,-80px,0)')
  })

  it('hangs exclusive classes on the three layers without sharing names', () => {
    const root = document.createElement('div')
    const renderer = document.createElement('div')
    const content = document.createElement('html')
    const first = getLayoutGeometry(new HtmlOptions())
    applyRootDirectionClass(root, first)
    applyRendererLayoutClass(renderer, first)
    applyContentLayoutClass(content, first)
    expect(root.className).toBe('dir-ltr')
    expect(renderer.className).toBe('layout-scroll-horizontal-tb-ltr')
    expect(content.classList.contains('document-layout')).toBe(true)
    expect(content.classList.contains('content-scroll-horizontal-tb-ltr')).toBe(true)

    const next = getLayoutGeometry(routeOptions({
      flipMode: 'page',
      writingMode: 'vertical-rl',
      direction: 'rtl',
    }))
    applyRootDirectionClass(root, next)
    applyRendererLayoutClass(renderer, next)
    applyContentLayoutClass(content, next)
    expect(root.className).toBe('dir-rtl')
    expect(renderer.className).toBe('layout-page-vertical-rl-rtl')
    expect(content.classList.contains('content-page-vertical-rl-rtl')).toBe(true)
    expect(content.classList.contains('content-scroll-horizontal-tb-ltr')).toBe(false)
    expect(RENDERER_LAYOUT_CLASSES.filter((name) => renderer.classList.contains(name))).toEqual([
      'layout-page-vertical-rl-rtl',
    ])
    expect(CONTENT_LAYOUT_CLASSES.filter((name) => content.classList.contains(name))).toEqual([
      'content-page-vertical-rl-rtl',
    ])
    expect(renderer.classList.contains(next.contentClass)).toBe(false)
    expect(content.classList.contains(next.rendererClass)).toBe(false)
    expect(root.classList.contains(next.rendererClass)).toBe(false)
  })

  it('forces scroll when forceScroll is set', () => {
    const geometry = getLayoutGeometry(routeOptions({
      flipMode: 'page',
      forceScroll: true,
      writingMode: 'horizontal-tb',
      direction: 'ltr',
    }))
    expect(geometry.id).toBe('scroll-horizontal-tb-ltr')
    expect(geometry.flipMode).toBe('scroll')
  })
})
