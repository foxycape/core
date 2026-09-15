import { describe, expect, it } from 'vitest'
import { DefaultInternalUrlBuilder } from '@/kernal/services/internalUrlBuilder/DefaultInternalUrlBuilder'

describe('DefaultInternalUrlBuilder', () => {
  it('does not resolve Windows drive paths against the web base', async () => {
    const builder = new DefaultInternalUrlBuilder('http://localhost:5173/', '1')
    await expect(
      builder.getAbsoluteUrl('H:\\BaiduNetdiskWorkspace\\test\\epub\\四川深度游Follow Me.epub', true),
    ).resolves.toBe('H:\\BaiduNetdiskWorkspace\\test\\epub\\四川深度游Follow Me.epub')
  })

  it('does not resolve file URLs against the web base', async () => {
    const builder = new DefaultInternalUrlBuilder('http://localhost:5173/', '1')
    await expect(builder.getAbsoluteUrl('file:///H:/a/%E5%9B%9B.epub', true)).resolves.toBe(
      'file:///H:/a/%E5%9B%9B.epub',
    )
  })

  it('still resolves relative web assets', async () => {
    const builder = new DefaultInternalUrlBuilder('http://localhost:5173/', '1')
    await expect(builder.getAbsoluteUrl('config/appsettings.json', true)).resolves.toBe(
      'http://localhost:5173/config/appsettings.json',
    )
  })
})
