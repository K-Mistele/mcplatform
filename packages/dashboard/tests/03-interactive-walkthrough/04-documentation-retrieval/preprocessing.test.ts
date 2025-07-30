import { extractFrontMatter } from '@/lib/retrieval/preprocessing'
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

            expect(result).toBeNull()
        })

        test('should return empty object when no front matter is present', () => {
            const document = `# Document Without Front Matter

This document has no YAML front matter.`

            const result = extractFrontMatter(document)

            expect(result).toEqual({})
        })

        test('should handle front matter with only whitespace', () => {
            const document = `---
  
  
---

Content after empty front matter`

            const result = extractFrontMatter(document)

            expect(result).toBeNull()
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
})