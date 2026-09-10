/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from '@/kernal/EventEmitter'
import { FileLoader } from '@/kernal/FileLoader'
import { Options } from '@/kernal/Options'
import { Reader } from '@/kernal/Reader'
import { FileLoadPipeline } from '@/kernal/pipelines/FileLoadPipeline'
import { InputFormatter } from '@/kernal/pipelines/InputFormatter'
import { FilePackage, type IFileParser } from '@/kernal/IFileParser'
import { Metadata } from '@/kernal/Metadata'
import { OpenOptions } from '@/kernal/OpenOptions'
import { WebBrowser } from '@/kernal/device/WebBrowser'

class TestReader extends Reader {}

describe('Reader / FileLoader split', () => {
  it('requires container on Reader.open', async () => {
    const reader = new TestReader(new Options(), { device: new WebBrowser() })
    await expect(reader.open('book.pdf' as any, undefined as any, undefined as any)).rejects.toThrow(/container is required/)
  })

  it('FileLoader.load parses without DOM via pipeline', async () => {
    const fileParser = {
      load: vi.fn(async () => undefined),
      getFileHash: vi.fn(async () => 'hash-1'),
      getMetadata: vi.fn(async () => new Metadata()),
      dispose: vi.fn(async () => undefined),
    } as unknown as IFileParser

    const mediaTypeRegistry = {
      createFileParser: vi.fn(async () => fileParser),
    }

    const inputFormatter = {
      guardUrl: vi.fn(),
      formatInputParameters: vi.fn(async () => ({
        url: 'book.pdf',
        openOptions: {},
        extension: '.pdf',
      })),
      getIds: vi.fn(async () => ({
        simpleId: 'simple-1',
        resourceId: '',
        isExternalId: false,
      })),
      formatParserUrl: vi.fn(() => ({ url: 'book.pdf', abortController: undefined })),
      formatLocation: vi.fn(() => ({ location: undefined, percentage: undefined })),
    }

    const pipeline = new FileLoadPipeline({
      inputFormatter: inputFormatter as any,
      mediaTypeRegistry: mediaTypeRegistry as any,
      services: { get: vi.fn() } as any,
      options: new Options(),
      events: new EventEmitter(),
      lifecycle: {},
    })

    const result = await pipeline.load('book.pdf')

    expect(result.extension).toBe('.pdf')
    expect(result.resourceId).toBe('hash-1')
    expect(result.fileParser).toBe(fileParser)
    expect(result.context.rootContainer).toBeUndefined()
    expect(fileParser.load).toHaveBeenCalledOnce()
  })

  it('overlays OpenOptions.metadata onto file metadata', async () => {
    const fileMetadata = new Metadata()
    fileMetadata.title = 'File Title'
    fileMetadata.author = ['Bob']
    fileMetadata.language = 'en'
    fileMetadata.isbn = '9780000000000'

    const overlay = new Metadata()
    overlay.title = 'User Title'
    overlay.author = ['Alice']
    overlay.fileName = 'user-book.epub'

    const fileParser = {
      load: vi.fn(async () => undefined),
      getFileHash: vi.fn(async () => 'hash-1'),
      getMetadata: vi.fn(async () => fileMetadata),
      dispose: vi.fn(async () => undefined),
    } as unknown as IFileParser

    const pipeline = new FileLoadPipeline({
      inputFormatter: {
        guardUrl: vi.fn(),
        formatInputParameters: vi.fn(async () => ({
          url: 'book.epub',
          openOptions: { metadata: overlay },
          extension: '.epub',
        })),
        getIds: vi.fn(async () => ({
          simpleId: 'simple-1',
          resourceId: 'sha-1',
          isExternalId: true,
        })),
        formatParserUrl: vi.fn(() => ({ url: 'book.epub', abortController: undefined })),
        formatLocation: vi.fn(() => ({ location: undefined, percentage: undefined })),
      } as any,
      mediaTypeRegistry: {
        createFileParser: vi.fn(async () => fileParser),
      } as any,
      services: { get: vi.fn() } as any,
      options: new Options(),
      events: new EventEmitter(),
      lifecycle: {},
    })

    const result = await pipeline.load('book.epub')

    expect(result.metadata.title).toBe('User Title')
    expect(result.metadata.author).toEqual(['Alice'])
    expect(result.metadata.fileName).toBe('user-book.epub')
    expect(result.metadata.language).toBe('en')
    expect(result.metadata.isbn).toBe('9780000000000')
    expect(result.context.metadata).toBe(result.metadata)
  })

  it('exposes FileLoader composition on Reader', () => {
    const reader = new TestReader(new Options(), { device: new WebBrowser() })
    expect(reader.fileLoader).toBeInstanceOf(FileLoader)
    expect(reader.mediaTypeRegistry).toBe(reader.fileLoader.mediaTypeRegistry)
    expect(reader.services).toBe(reader.fileLoader.services)
  })

  it('registers core services on FileLoader and UI services on Reader', () => {
    const loader = new FileLoader(new Options(), { device: new WebBrowser() })
    expect(loader.services.has('httpClient')).toBe(true)
    expect(loader.services.has('notifier' as any)).toBe(false)
    expect(loader.services.has('loading' as any)).toBe(false)

    const reader = new TestReader(new Options(), { device: new WebBrowser() })
    expect(reader.services.has('httpClient')).toBe(true)
    expect(reader.services.has('notifier')).toBe(true)
    expect(reader.services.has('loading')).toBe(true)
  })
})

describe('InputFormatter.formatParserUrl', () => {
  const formatter = new InputFormatter({} as never, new Options())

  it('does not copy overlay metadata onto the parser url', () => {
    const openOptions = Object.assign(new OpenOptions(), {
      fileName: 'a.epub',
      metadata: Object.assign(new Metadata(), { title: 'User Title' }),
    })
    const { url } = formatter.formatParserUrl('/a.epub', '.epub', openOptions)
    expect(url).toBeInstanceOf(FilePackage)
    expect(url.fileName).toBe('a.epub')
    expect(url.metadata).toBeUndefined()
  })

  it('keeps metadata that already lives on a FilePackage', () => {
    const pkg = new FilePackage()
    pkg.fileUrl = '/a.epub'
    pkg.metadata = Object.assign(new Metadata(), { title: 'Package Title' })
    const openOptions = Object.assign(new OpenOptions(), {
      metadata: Object.assign(new Metadata(), { title: 'User Title' }),
    })
    const { url } = formatter.formatParserUrl(pkg, '.epub', openOptions)
    expect(url.metadata?.title).toBe('Package Title')
  })
})
