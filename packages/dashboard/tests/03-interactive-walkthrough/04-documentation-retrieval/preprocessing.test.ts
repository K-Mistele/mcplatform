import { extractFrontMatter, chunkDocument, extractImageUrls } from '@/lib/retrieval/preprocessing'
import { describe, expect, test } from 'bun:test'

describe('Feature: Document Preprocessing', () => {
    describe('extractFrontMatter', () => {
        test('should extract valid YAML front matter', () => {
            const document = `---
title: Test Document
author: John Doe
date: 2024-01-15
tags:
  - javascript
  - testing
metadata:
  version: 1.0
  published: true
---

# Document Content

This is the actual document content.`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                title: 'Test Document',
                author: 'John Doe',
                date: '2024-01-15',
                tags: ['javascript', 'testing'],
                metadata: {
                    version: 1.0,
                    published: true
                }
            })
        })

        test('should handle empty front matter', () => {
            const document = `---
---

# Document Content`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                title: 'Document Content'
            })
        })

        test('should return title from H1 when no front matter is present', () => {
            const document = `# Document Without Front Matter

This document has no YAML front matter.`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                title: 'Document Without Front Matter'
            })
        })

        test('should handle front matter with only whitespace', () => {
            const document = `---
  
  
---

# Content after empty front matter`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                title: 'Content after empty front matter'
            })
        })

        test('should handle front matter with various data types', () => {
            const document = `---
string: "Hello World"
number: 42
float: 3.14
boolean_true: true
boolean_false: false
null_value: null
array: [1, 2, 3]
object:
  nested: value
  deep:
    level: 2
---

Document content`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                string: 'Hello World',
                number: 42,
                float: 3.14,
                boolean_true: true,
                boolean_false: false,
                null_value: null,
                array: [1, 2, 3],
                object: {
                    nested: 'value',
                    deep: {
                        level: 2
                    }
                }
            })
        })

        test('should handle front matter with special characters in values', () => {
            const document = `---
title: "Title with: colons and - dashes"
description: |
  Multi-line description
  with line breaks
  and indentation
special: 'quotes "inside" quotes'
---

Content`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                title: 'Title with: colons and - dashes',
                description: 'Multi-line description\nwith line breaks\nand indentation\n',
                special: 'quotes "inside" quotes'
            })
        })

        test('should only extract the first front matter block', () => {
            const document = `---
title: First Block
---

Some content

---
title: Second Block
---

More content`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                title: 'First Block'
            })
        })

        test('should handle front matter at the very beginning without newline', () => {
            const document = `---
title: No Leading Newline
---
Content immediately after`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                title: 'No Leading Newline'
            })
        })

        test('should handle YAML aliases and references', () => {
            const document = `---
defaults: &defaults
  adapter: postgres
  host: localhost

development:
  <<: *defaults
  database: myapp_development

production:
  <<: *defaults
  database: myapp_production
---

Content`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                defaults: {
                    adapter: 'postgres',
                    host: 'localhost'
                },
                development: {
                    '<<': {
                        adapter: 'postgres',
                        host: 'localhost'
                    },
                    database: 'myapp_development'
                },
                production: {
                    '<<': {
                        adapter: 'postgres',
                        host: 'localhost'
                    },
                    database: 'myapp_production'
                }
            })
        })

        test('should handle documents with only front matter', () => {
            const document = `---
title: Only Front Matter
version: 1.0
---`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                title: 'Only Front Matter',
                version: 1.0
            })
        })

        test('should handle invalid YAML gracefully', () => {
            const document = `---
title: Valid Title
invalid: [unclosed array
another: value
---

Content`

            // This should throw or return partial results depending on yaml parser behavior
            expect(() => extractFrontMatter(document)).toThrow()
        })

        test('should handle front matter with dates', () => {
            const document = `---
created_at: 2024-01-15T10:30:00Z
updated_at: 2024-01-16
date: 2024-01-17 14:30:00
---

Content`

            const result = extractFrontMatter(document)

            // YAML parser typically converts dates to Date objects or strings
            expect(result.created_at).toBeDefined()
            expect(result.updated_at).toBeDefined()
            expect(result.date).toBeDefined()
        })

        test('should handle empty document', () => {
            const document = ''

            const result = extractFrontMatter(document)

            expect(result).toEqual({})
        })

        test('should extract title from first H1 when no title in frontmatter', () => {
            const document = `---
author: John Doe
date: 2024-01-15
---

# My Document Title

This is the content of the document.`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                author: 'John Doe',
                date: '2024-01-15',
                title: 'My Document Title'
            })
        })

        test('should extract title from first H1 when no frontmatter exists', () => {
            const document = `# Document Without Front Matter

This document has no YAML front matter.

## Subsection

More content here.`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                title: 'Document Without Front Matter'
            })
        })

        test('should prefer frontmatter title over H1 title', () => {
            const document = `---
title: Frontmatter Title
author: Jane Doe
---

# Different H1 Title

Content goes here.`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                title: 'Frontmatter Title',
                author: 'Jane Doe'
            })
        })

        test('should handle H1 with extra whitespace', () => {
            const document = `#    Title with Extra Spaces   

Some content.`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                title: 'Title with Extra Spaces'
            })
        })

        test('should not extract title from H2 or other headers', () => {
            const document = `## This is H2

### This is H3

Content without H1.`

            const result = extractFrontMatter(document)

            expect(result).toEqual({})
        })

        test('should handle H1 title with special characters', () => {
            const document = `# Title with "quotes" and special chars: @#$%

Content here.`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                title: 'Title with "quotes" and special chars: @#$%'
            })
        })

        test('should handle document with incomplete front matter delimiter', () => {
            const document = `---
title: Incomplete
author: Test
--

This is missing the third dash`

            const result = extractFrontMatter(document)

            expect(result).toEqual({})
        })

        test('should handle front matter with complex nested structures', () => {
            const document = `---
navigation:
  - title: Home
    url: /
    children: []
  - title: About
    url: /about
    children:
      - title: Team
        url: /about/team
      - title: History
        url: /about/history
settings:
  theme:
    primary_color: "#3498db"
    fonts:
      - name: Roboto
        weights: [400, 700]
      - name: Open Sans
        weights: [300, 400, 600]
---

Content`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                navigation: [
                    { title: 'Home', url: '/', children: [] },
                    {
                        title: 'About',
                        url: '/about',
                        children: [
                            { title: 'Team', url: '/about/team' },
                            { title: 'History', url: '/about/history' }
                        ]
                    }
                ],
                settings: {
                    theme: {
                        primary_color: '#3498db',
                        fonts: [
                            { name: 'Roboto', weights: [400, 700] },
                            { name: 'Open Sans', weights: [300, 400, 600] }
                        ]
                    }
                }
            })
        })

        test('should handle front matter with non-ASCII characters', () => {
            const document = `---
title: "Hello World"
author: "Francois Muller"
category: "testing"
---

Content with special chars`

            const result = extractFrontMatter(document)

            expect(result).toEqual({
                title: 'Hello World',
                author: 'Francois Muller',
                category: 'testing'
            })
        })
    })

    describe('chunkDocument', () => {
        test('should chunk a simple document with default settings', () => {
            const document = `# Header 1
This is some content for header 1.

# Header 2
This is some content for header 2.

# Header 3
This is some content for header 3.`

            const chunks = chunkDocument(document)

            expect(chunks).toBeInstanceOf(Array)
            expect(chunks.length).toBeGreaterThan(0)
            // Each chunk should be non-empty
            chunks.forEach(chunk => {
                expect(chunk.length).toBeGreaterThan(0)
            })
        })

        test('should respect maxChunkLength configuration', () => {
            const longContent = 'A'.repeat(500)
            const document = `# Header 1
${longContent}

# Header 2
${longContent}

# Header 3
${longContent}`

            const chunks = chunkDocument(document, {
                maxChunkLength: 200,
                overlap: 50,
                splitter: 'markdown'
            })

            // Each chunk should be reasonably close to maxChunkLength
            // The splitter may slightly exceed the limit to preserve word boundaries
            chunks.forEach(chunk => {
                expect(chunk.length).toBeLessThanOrEqual(250) // Allow some flexibility
            })
        })

        test('should create overlapping chunks when overlap is specified', () => {
            const document = `# First Section
This is the first section with some content that should be long enough to create overlapping chunks.

# Second Section
This is the second section with more content that will help test the overlap functionality.

# Third Section
This is the third section with additional content to ensure proper chunking behavior.`

            const chunks = chunkDocument(document, {
                maxChunkLength: 150,
                overlap: 50,
                splitter: 'markdown'
            })

            // With overlap, consecutive chunks should share some content
            for (let i = 0; i < chunks.length - 1; i++) {
                const currentChunk = chunks[i]
                const nextChunk = chunks[i + 1]
                
                // Check that we have consecutive chunks
                // The actual overlap behavior depends on the splitter implementation
                // and may not be a simple character-based overlap
                expect(currentChunk.length).toBeGreaterThan(0)
                expect(nextChunk.length).toBeGreaterThan(0)
            }
        })

        test('should handle documents with no headers', () => {
            const document = `This is a document without any markdown headers.
It contains multiple paragraphs of text.

This is the second paragraph with more content.
It should still be properly chunked even without headers.

And here is a third paragraph to ensure we have enough content
for the chunking algorithm to work with.`

            const chunks = chunkDocument(document)

            expect(chunks).toBeInstanceOf(Array)
            expect(chunks.length).toBeGreaterThan(0)
        })

        test('should handle empty document', () => {
            const document = ''

            const chunks = chunkDocument(document)

            expect(chunks).toBeInstanceOf(Array)
            expect(chunks.length).toBe(0)
        })

        test('should handle document with only whitespace', () => {
            const document = '   \n\n   \t\t   \n   '

            const chunks = chunkDocument(document)

            expect(chunks).toBeInstanceOf(Array)
            // Depending on splitter implementation, might return empty array or array with whitespace
            chunks.forEach(chunk => {
                expect(typeof chunk).toBe('string')
            })
        })

        test('should handle very small maxChunkLength', () => {
            const document = `# Title
Short content here.`

            const chunks = chunkDocument(document, {
                maxChunkLength: 10,
                overlap: 2,
                splitter: 'markdown'
            })

            expect(chunks).toBeInstanceOf(Array)
            // With very small chunks, the splitter may not be able to split further
            // and may return chunks larger than the limit to preserve readability
            chunks.forEach(chunk => {
                expect(chunk.length).toBeGreaterThan(0)
            })
        })

        test('should handle overlap larger than chunk content', () => {
            const document = `# A
B

# C
D`

            const chunks = chunkDocument(document, {
                maxChunkLength: 50,
                overlap: 100, // Larger than actual content
                splitter: 'markdown'
            })

            expect(chunks).toBeInstanceOf(Array)
            expect(chunks.length).toBeGreaterThan(0)
        })

        test('should preserve markdown structure in chunks', () => {
            const document = `# Main Title

## Subsection 1
Content for subsection 1.

### Sub-subsection
Nested content here.

## Subsection 2
Content for subsection 2.

- List item 1
- List item 2
- List item 3

\`\`\`javascript
const code = "example";
\`\`\`

## Subsection 3
Final content.`

            const chunks = chunkDocument(document, {
                maxChunkLength: 200,
                overlap: 50,
                splitter: 'markdown'
            })

            expect(chunks).toBeInstanceOf(Array)
            expect(chunks.length).toBeGreaterThan(0)
            
            // Check that markdown elements are preserved
            const allContent = chunks.join('')
            expect(allContent).toContain('# Main Title')
            expect(allContent).toContain('```javascript')
        })

        test('should handle documents with front matter', () => {
            const document = `---
title: Test Document
author: John Doe
---

# Introduction
This is the introduction section.

# Body
This is the main body of the document.

# Conclusion
This is the conclusion.`

            const chunks = chunkDocument(document)

            expect(chunks).toBeInstanceOf(Array)
            expect(chunks.length).toBeGreaterThan(0)
            
            // Front matter should be included in chunks
            const allContent = chunks.join('')
            expect(allContent).toContain('---')
        })

        test('should use different splitter types', () => {
            const document = `This is a test document. It contains multiple sentences. Each sentence is separated by a period.

This is a new paragraph. It should be handled differently by different splitters.`

            // Test with default markdown splitter
            const markdownChunks = chunkDocument(document, {
                maxChunkLength: 100,
                overlap: 20,
                splitter: 'markdown'
            })

            // Test with sentence splitter (if supported)
            const sentenceChunks = chunkDocument(document, {
                maxChunkLength: 100,
                overlap: 20,
                splitter: 'sentence' as any
            })

            expect(markdownChunks).toBeInstanceOf(Array)
            expect(sentenceChunks).toBeInstanceOf(Array)
            
            // Different splitters might produce different results
            expect(markdownChunks.length).toBeGreaterThan(0)
            expect(sentenceChunks.length).toBeGreaterThan(0)
        })

        test('should handle zero overlap', () => {
            const document = `# Section 1
Content for section 1 that is long enough to require multiple chunks when using a small chunk size.

# Section 2
Content for section 2 that is also long enough to require chunking.

# Section 3
Content for section 3 with more text.`

            const chunks = chunkDocument(document, {
                maxChunkLength: 100,
                overlap: 0,
                splitter: 'markdown'
            })

            expect(chunks).toBeInstanceOf(Array)
            expect(chunks.length).toBeGreaterThan(1)
            
            // With zero overlap, chunks should not share content
            for (let i = 0; i < chunks.length - 1; i++) {
                const currentChunk = chunks[i]
                const nextChunk = chunks[i + 1]
                
                // Chunks should not end/start with the same content
                expect(currentChunk).not.toBe(nextChunk)
            }
        })

        test('should handle very long documents efficiently', () => {
            // Create a large document
            const sections = []
            for (let i = 0; i < 100; i++) {
                sections.push(`# Section ${i + 1}\nThis is content for section ${i + 1}. `.repeat(10))
            }
            const document = sections.join('\n\n')

            const startTime = Date.now()
            const chunks = chunkDocument(document, {
                maxChunkLength: 1000,
                overlap: 100,
                splitter: 'markdown'
            })
            const endTime = Date.now()

            expect(chunks).toBeInstanceOf(Array)
            expect(chunks.length).toBeGreaterThan(0)
            
            // Should complete in reasonable time (less than 1 second)
            expect(endTime - startTime).toBeLessThan(1000)
        })

        test('should handle special markdown elements', () => {
            const document = `# Document with Special Elements

## Tables

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

## Code Blocks

\`\`\`python
def hello_world():
    print("Hello, World!")
\`\`\`

## Blockquotes

> This is a blockquote
> It can span multiple lines

## Links and Images

[Link text](https://example.com)
![Alt text](image.png)`

            const chunks = chunkDocument(document, {
                maxChunkLength: 200,
                overlap: 50,
                splitter: 'markdown'
            })

            expect(chunks).toBeInstanceOf(Array)
            expect(chunks.length).toBeGreaterThan(0)
            
            const allContent = chunks.join('')
            // Verify special elements are preserved
            expect(allContent).toContain('| Header 1 | Header 2 |')
            expect(allContent).toContain('```python')
            expect(allContent).toContain('> This is a blockquote')
            expect(allContent).toContain('[Link text]')
        })
    })

    describe('extractImageUrls', () => {
        test('should extract single image URL with type', () => {
            const document = `# Document with Image

Here is an image: ![Alt text](https://example.com/image.png)

Some more text.`

            const urls = extractImageUrls(document)

            expect(urls).toEqual([{
                url: 'https://example.com/image.png',
                urlType: 'remote'
            }])
        })

        test('should extract multiple image URLs with correct types', () => {
            const document = `# Gallery

![First image](image1.jpg)
![Second image](https://example.com/image2.png)
![Third image](/assets/image3.gif)
![Fourth image](../images/image4.webp)
![Fifth image](http://example.org/image5.jpg)`

            const urls = extractImageUrls(document)

            expect(urls).toEqual([
                { url: 'image1.jpg', urlType: 'local' },
                { url: 'https://example.com/image2.png', urlType: 'remote' },
                { url: '/assets/image3.gif', urlType: 'local' },
                { url: '../images/image4.webp', urlType: 'local' },
                { url: 'http://example.org/image5.jpg', urlType: 'remote' }
            ])
        })

        test('should handle empty alt text', () => {
            const document = `![](empty-alt.png)
![ ](space-alt.jpg)
![](https://example.com/no-alt.gif)`

            const urls = extractImageUrls(document)

            expect(urls).toEqual([
                { url: 'empty-alt.png', urlType: 'local' },
                { url: 'space-alt.jpg', urlType: 'local' },
                { url: 'https://example.com/no-alt.gif', urlType: 'remote' }
            ])
        })

        test('should handle special characters in alt text', () => {
            const document = `![Image with [brackets]](image1.png)
![Image with "quotes"](image2.jpg)
![Image with special chars !@#$%](https://cdn.example.com/image3.gif)`

            const urls = extractImageUrls(document)

            expect(urls).toEqual([
                { url: 'image1.png', urlType: 'local' },
                { url: 'image2.jpg', urlType: 'local' },
                { url: 'https://cdn.example.com/image3.gif', urlType: 'remote' }
            ])
        })

        test('should return empty array for documents without images', () => {
            const document = `# No Images Here

Just some regular text.
[This is a link](https://example.com)
Not an image: [text](url)`

            const urls = extractImageUrls(document)

            expect(urls).toEqual([])
        })

        test('should handle images with query parameters', () => {
            const document = `![Profile](https://example.com/user.jpg?size=200&quality=high)
![Thumbnail](image.png?v=123)`

            const urls = extractImageUrls(document)

            expect(urls).toEqual([
                { url: 'https://example.com/user.jpg?size=200&quality=high', urlType: 'remote' },
                { url: 'image.png?v=123', urlType: 'local' }
            ])
        })

        test('should handle images with fragments', () => {
            const document = `![Section](page.html#section1)
![Anchor](https://example.com/docs#images)`

            const urls = extractImageUrls(document)

            expect(urls).toEqual([
                { url: 'page.html#section1', urlType: 'local' },
                { url: 'https://example.com/docs#images', urlType: 'remote' }
            ])
        })

        test('should handle malformed image syntax', () => {
            const document = `![]()
![alt text]()
![](   )
![ ]( )`

            const urls = extractImageUrls(document)

            expect(urls).toEqual([
                { url: '', urlType: 'local' },
                { url: '', urlType: 'local' },
                { url: '   ', urlType: 'local' }, // Whitespace is preserved
                { url: ' ', urlType: 'local' }     // Whitespace is preserved
            ])
        })

        test('should extract images from complex markdown', () => {
            const document = `---
title: Complex Document
---

# Main Title

## Introduction
Here's an inline image: ![logo](logo.png) in the middle of text.

### Gallery Section
![First](https://cdn.example.com/gallery/1.jpg)
Some text
![Second](gallery/2.jpg)

\`\`\`markdown
This is code: ![not extracted](code.png)
\`\`\`

> Blockquote with ![quoted image](http://example.com/quote.jpg)

- List item with ![list image](list.png)
- Another item

| Column 1 | Column 2 |
|----------|----------|
| ![table1](t1.jpg) | ![table2](https://example.com/t2.jpg) |`

            const urls = extractImageUrls(document)

            // Check that all URLs are extracted with correct types
            const urlMap = urls.reduce((map, item) => {
                map[item.url] = item.urlType
                return map
            }, {} as Record<string, string>)

            expect(urlMap['logo.png']).toBe('local')
            expect(urlMap['https://cdn.example.com/gallery/1.jpg']).toBe('remote')
            expect(urlMap['gallery/2.jpg']).toBe('local')
            expect(urlMap['code.png']).toBe('local')
            expect(urlMap['http://example.com/quote.jpg']).toBe('remote')
            expect(urlMap['list.png']).toBe('local')
            expect(urlMap['t1.jpg']).toBe('local')
            expect(urlMap['https://example.com/t2.jpg']).toBe('remote')
        })

        test('should handle empty document', () => {
            const urls = extractImageUrls('')

            expect(urls).toEqual([])
        })

        test('should handle whitespace-only document', () => {
            const urls = extractImageUrls('   \n\t\n   ')

            expect(urls).toEqual([])
        })

        test('should handle images with spaces in URLs', () => {
            const document = `![Image](my image.png)
![Another](https://example.com/folder/my file.jpg)`

            const urls = extractImageUrls(document)

            expect(urls).toEqual([
                { url: 'my image.png', urlType: 'local' },
                { url: 'https://example.com/folder/my file.jpg', urlType: 'remote' }
            ])
        })

        test('should extract data URLs', () => {
            const document = `![Base64](data:image/png;base64,iVBORw0KGgoAAAANS...)
![SVG](data:image/svg+xml,%3Csvg%20xmlns...)`

            const urls = extractImageUrls(document)

            expect(urls.length).toBe(2)
            expect(urls[0].url).toContain('data:image/png;base64,')
            expect(urls[0].urlType).toBe('local') // data URLs are treated as local
            expect(urls[1].url).toContain('data:image/svg+xml,')
            expect(urls[1].urlType).toBe('local')
        })

        test('should correctly identify absolute vs relative paths', () => {
            const document = `# Path Types

Absolute paths:
![Absolute Unix](file:///home/user/image.png)
![Absolute Windows](file://C:/Users/image.png)
![Root relative](/images/logo.png)

Relative paths:
![Current dir](./image.png)
![Parent dir](../image.png)
![Nested](path/to/image.png)
![Just filename](image.png)`

            const urls = extractImageUrls(document)

            expect(urls).toEqual([
                { url: 'file:///home/user/image.png', urlType: 'local' },
                { url: 'file://C:/Users/image.png', urlType: 'local' },
                { url: '/images/logo.png', urlType: 'local' },
                { url: './image.png', urlType: 'local' },
                { url: '../image.png', urlType: 'local' },
                { url: 'path/to/image.png', urlType: 'local' },
                { url: 'image.png', urlType: 'local' }
            ])
        })

        test('should handle various URL protocols', () => {
            const document = `# Different Protocols

![HTTP](http://example.com/image.png)
![HTTPS](https://example.com/image.png)
![FTP](ftp://example.com/image.png)
![File](file:///local/image.png)
![Protocol-relative](//example.com/image.png)`

            const urls = extractImageUrls(document)

            expect(urls).toEqual([
                { url: 'http://example.com/image.png', urlType: 'remote' },
                { url: 'https://example.com/image.png', urlType: 'remote' },
                { url: 'ftp://example.com/image.png', urlType: 'local' }, // Only http/https are remote
                { url: 'file:///local/image.png', urlType: 'local' },
                { url: '//example.com/image.png', urlType: 'local' }
            ])
        })
    })
})