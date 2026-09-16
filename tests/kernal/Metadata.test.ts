/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { fillMetadata, Metadata, toMetadataList } from '@/kernal/Metadata'
import { formatMetadata } from '@/kernal/pipelines/metadata'

describe('fillMetadata', () => {
  it('maps shared EPUB / MOBI / FB2 bibliographic fields', () => {
    const metadata = fillMetadata(new Metadata(), {
      title: '  Book  ',
      author: [{ name: 'Author A' }, 'Author B'],
      contributor: ['Editor'],
      publisher: 'Press',
      published: '2020-01-01',
      modified: '2021-02-02',
      language: ['ar-SA', 'en'],
      identifier: 'urn:uuid:123',
      isbn: '9780000000000',
      asin: 'B00TEST',
      subject: ['Fiction', 'History'],
      description: 'A story',
      rights: 'All rights reserved',
      source: 'https://example.com',
      series: 'Saga',
      seriesIndex: 2,
      size: 1024,
    })

    expect(metadata.title).toBe('Book')
    expect(metadata.author).toEqual(['Author A', 'Author B'])
    expect(metadata.contributor).toEqual(['Editor'])
    expect(metadata.publisher).toBe('Press')
    expect(metadata.issueDate).toBe('2020-01-01')
    expect(metadata.modifiedDate).toBe('2021-02-02')
    expect(metadata.language).toBe('ar-SA')
    expect(metadata.identifier).toBe('urn:uuid:123')
    expect(metadata.isbn).toBe('9780000000000')
    expect(metadata.asin).toBe('B00TEST')
    expect(metadata.subject).toEqual(['Fiction', 'History'])
    expect(metadata.description).toBe('A story')
    expect(metadata.rights).toBe('All rights reserved')
    expect(metadata.source).toBe('https://example.com')
    expect(metadata.series).toBe('Saga')
    expect(metadata.seriesIndex).toBe('2')
    expect(metadata.size).toBe(1024)
  })

  it('normalizes mixed list values', () => {
    expect(toMetadataList('Alice')).toEqual(['Alice'])
    expect(toMetadataList([{ name: 'Bob' }, 'Carol'])).toEqual(['Bob', 'Carol'])
  })

  it('strips html tags and decodes entities in bibliographic fields', () => {
    const metadata = fillMetadata(new Metadata(), {
      title: '<i>The Book</i>',
      author: ['<b>Author</b>'],
      description: '<p>First &amp; second</p>',
      rights: 'Copyright &copy; 2020',
    })
    expect(metadata.title).toBe('The Book')
    expect(metadata.author).toEqual(['Author'])
    expect(metadata.description).toBe('First & second')
    expect(metadata.rights).toBe('Copyright © 2020')

    const escaped = fillMetadata(new Metadata(), {
      title: '&lt;i&gt;Escaped&lt;/i&gt;',
    })
    expect(escaped.title).toBe('<i>Escaped</i>')
  })

  it('keeps lone angle brackets and comparison text', () => {
    const metadata = fillMetadata(new Metadata(), {
      title: 'A < B',
      description: 'score > 90 and 3 < 5',
      subject: ['only >', 'only <'],
    })
    expect(metadata.title).toBe('A < B')
    expect(metadata.description).toBe('score > 90 and 3 < 5')
    expect(metadata.subject).toEqual(['only >', 'only <'])
  })
})

describe('formatMetadata', () => {
  it('keeps language and identifier after sanitizing', () => {
    const metadata = formatMetadata(
      fillMetadata(new Metadata(), { title: 'Book', language: 'he', identifier: 'id-1' }),
      'book.epub',
      '.epub',
    )
    expect(metadata.language).toBe('he')
    expect(metadata.identifier).toBe('id-1')
    expect(metadata.extension).toBe('.epub')
    expect(metadata.author).toEqual([])
  })

  it('uses fallbackFileName instead of a content URI last segment', () => {
    const uri =
      'content://com.android.externalstorage.documents/document/primary%3A%2Fstorage%2Femulated%2F0%2FDocuments%2F%E5%A4%B8%E5%85%8B.pdf'
    const metadata = formatMetadata(new Metadata(), uri, '.pdf', '夸克网盘使用指南.pdf')
    expect(metadata.title).toBe('夸克网盘使用指南.pdf')
    expect(metadata.fileName).toBe('夸克网盘使用指南.pdf')
  })

  it('keeps a real document title even when fallbackFileName is present', () => {
    const uri =
      'content://com.android.externalstorage.documents/document/primary%3A%2Fstorage%2Femulated%2F0%2FDocuments%2Fbook.pdf'
    const metadata = formatMetadata(
      fillMetadata(new Metadata(), { title: 'Real Title' }),
      uri,
      '.pdf',
      '夸克网盘使用指南.pdf',
    )
    expect(metadata.title).toBe('Real Title')
    expect(metadata.fileName).toBe('夸克网盘使用指南.pdf')
  })

  it('does not use a SAF document id as the title when no fallback exists', () => {
    const uri =
      'content://com.android.externalstorage.documents/document/primary%3A%2Fstorage%2Femulated%2F0%2FDocuments%2Fbook.pdf'
    const metadata = formatMetadata(new Metadata(), uri, '.pdf')
    expect(metadata.title).toBe('')
    expect(metadata.fileName).toBe('')
  })
})
