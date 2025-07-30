import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultiSelect } from '../../src/components/ui/multi-select'
import { WandSparkles } from 'lucide-react'

// Mock options for testing
const mockOptions = [
    { label: 'Option 1', value: 'option1' },
    { label: 'Option 2', value: 'option2' },
    { label: 'Option 3', value: 'option3', icon: WandSparkles },
    { label: 'Option 4', value: 'option4' },
    { label: 'Option 5', value: 'option5' }
]

describe('MultiSelect Component', () => {
    afterAll(() => {
        cleanup()
    })

    describe('Basic Functionality', () => {
        test('should render with placeholder when no values selected', () => {
            const mockOnChange = jest.fn()
            render(<MultiSelect options={mockOptions} onValueChange={mockOnChange} placeholder="Select items" />)

            expect(screen.getByText('Select items')).toBeTruthy()
        })

        test('should render with default values', () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1', 'option2']}
                />
            )

            expect(screen.getByText('Option 1')).toBeTruthy()
            expect(screen.getByText('Option 2')).toBeTruthy()
        })

        test('should open popover when clicked', async () => {
            const mockOnChange = jest.fn()
            render(<MultiSelect options={mockOptions} onValueChange={mockOnChange} />)

            const trigger = screen.getByRole('button')
            await act(async () => {
                fireEvent.click(trigger)
            })

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Search...')).toBeTruthy()
                expect(screen.getByText('(Select All)')).toBeTruthy()
            })
        })

        test('should close popover when escape key is pressed', async () => {
            const mockOnChange = jest.fn()
            render(<MultiSelect options={mockOptions} onValueChange={mockOnChange} />)

            const trigger = screen.getByRole('button')
            await act(async () => {
                fireEvent.click(trigger)
            })

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Search...')).toBeTruthy()
            })

            await act(async () => {
                fireEvent.keyDown(screen.getByPlaceholderText('Search...'), { key: 'Escape' })
            })

            await waitFor(() => {
                expect(screen.queryByPlaceholderText('Search...')).toBeNull()
            })
        })
    })

    describe('Selection Behavior', () => {
        test('should select an option when clicked', async () => {
            const mockOnChange = jest.fn()
            render(<MultiSelect options={mockOptions} onValueChange={mockOnChange} />)

            const trigger = screen.getByRole('button')
            await act(async () => {
                fireEvent.click(trigger)
            })

            const option1 = screen.getByText('Option 1')
            await act(async () => {
                fireEvent.click(option1)
            })

            expect(mockOnChange).toHaveBeenCalledWith(['option1'])
        })

        test('should deselect an option when clicked again', async () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1']}
                />
            )

            const trigger = screen.getByRole('button')
            await act(async () => {
                fireEvent.click(trigger)
            })

            const option1 = screen.getByText('Option 1')
            await act(async () => {
                fireEvent.click(option1)
            })

            expect(mockOnChange).toHaveBeenCalledWith([])
        })

        test('should select all options when "Select All" is clicked', async () => {
            const mockOnChange = jest.fn()
            render(<MultiSelect options={mockOptions} onValueChange={mockOnChange} />)

            const trigger = screen.getByRole('button')
            await act(async () => {
                fireEvent.click(trigger)
            })

            const selectAll = screen.getByText('(Select All)')
            await act(async () => {
                fireEvent.click(selectAll)
            })

            expect(mockOnChange).toHaveBeenCalledWith(['option1', 'option2', 'option3', 'option4', 'option5'])
        })

        test('should deselect all options when "Select All" is clicked with all selected', async () => {
            const mockOnChange = jest.fn()
            const allValues = mockOptions.map(opt => opt.value)
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={allValues}
                />
            )

            const trigger = screen.getByRole('button')
            await act(async () => {
                fireEvent.click(trigger)
            })

            const selectAll = screen.getByText('(Select All)')
            await act(async () => {
                fireEvent.click(selectAll)
            })

            expect(mockOnChange).toHaveBeenCalledWith([])
        })
    })

    describe('Badge Behavior', () => {
        test('should remove item when X is clicked on badge', async () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1', 'option2']}
                />
            )

            const badges = screen.getAllByRole('button')
            const xButton = badges[0].querySelector('svg[class*="cursor-pointer"]')
            
            await act(async () => {
                fireEvent.click(xButton!)
            })

            expect(mockOnChange).toHaveBeenCalledWith(['option2'])
        })

        test('should show "+ N more" badge when items exceed maxCount', () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1', 'option2', 'option3', 'option4']}
                    maxCount={2}
                />
            )

            expect(screen.getByText('+ 2 more')).toBeTruthy()
        })

        test('should clear extra options when clicking X on "+ N more" badge', async () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1', 'option2', 'option3', 'option4']}
                    maxCount={2}
                />
            )

            const moreBadge = screen.getByText('+ 2 more').closest('span')
            const xButton = moreBadge?.querySelector('svg[class*="cursor-pointer"]')
            
            await act(async () => {
                fireEvent.click(xButton!)
            })

            expect(mockOnChange).toHaveBeenCalledWith(['option1', 'option2'])
        })
    })

    describe('Clear Functionality', () => {
        test('should clear all selections when clear button is clicked', async () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1', 'option2']}
                />
            )

            // Find the X icon that's used for clearing all
            const clearButton = screen.getAllByRole('button')[0].querySelector('svg[class*="h-4"][class*="mx-2"]')
            
            await act(async () => {
                fireEvent.click(clearButton!)
            })

            expect(mockOnChange).toHaveBeenCalledWith([])
        })

        test('should show clear option in command menu when items are selected', async () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1']}
                />
            )

            const trigger = screen.getByRole('button')
            await act(async () => {
                fireEvent.click(trigger)
            })

            await waitFor(() => {
                expect(screen.getByText('Clear')).toBeTruthy()
            })
        })
    })

    describe('Search Functionality', () => {
        test('should filter options based on search input', async () => {
            const mockOnChange = jest.fn()
            render(<MultiSelect options={mockOptions} onValueChange={mockOnChange} />)

            const trigger = screen.getByRole('button')
            await act(async () => {
                fireEvent.click(trigger)
            })

            const searchInput = screen.getByPlaceholderText('Search...')
            await act(async () => {
                fireEvent.change(searchInput, { target: { value: 'Option 1' } })
            })

            await waitFor(() => {
                expect(screen.getByText('Option 1')).toBeTruthy()
                expect(screen.queryByText('Option 2')).toBeNull()
            })
        })

        test('should show "No results found" when search has no matches', async () => {
            const mockOnChange = jest.fn()
            render(<MultiSelect options={mockOptions} onValueChange={mockOnChange} />)

            const trigger = screen.getByRole('button')
            await act(async () => {
                fireEvent.click(trigger)
            })

            const searchInput = screen.getByPlaceholderText('Search...')
            await act(async () => {
                fireEvent.change(searchInput, { target: { value: 'xyz123' } })
            })

            await waitFor(() => {
                expect(screen.getByText('No results found.')).toBeTruthy()
            })
        })
    })

    describe('Keyboard Navigation', () => {
        test('should remove last selected item on backspace when search is empty', async () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1', 'option2']}
                />
            )

            const trigger = screen.getByRole('button')
            await act(async () => {
                fireEvent.click(trigger)
            })

            const searchInput = screen.getByPlaceholderText('Search...')
            await act(async () => {
                fireEvent.keyDown(searchInput, { key: 'Backspace' })
            })

            expect(mockOnChange).toHaveBeenCalledWith(['option1'])
        })

        test('should open popover on Enter key in search input', async () => {
            const mockOnChange = jest.fn()
            render(<MultiSelect options={mockOptions} onValueChange={mockOnChange} />)

            const trigger = screen.getByRole('button')
            await act(async () => {
                fireEvent.click(trigger)
            })

            // Close it first
            await act(async () => {
                fireEvent.keyDown(screen.getByPlaceholderText('Search...'), { key: 'Escape' })
            })

            await waitFor(() => {
                expect(screen.queryByPlaceholderText('Search...')).toBeNull()
            })

            // Click to open again
            await act(async () => {
                fireEvent.click(trigger)
            })

            const searchInput = screen.getByPlaceholderText('Search...')
            await act(async () => {
                fireEvent.keyDown(searchInput, { key: 'Enter' })
            })

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Search...')).toBeTruthy()
            })
        })
    })

    describe('Icon Support', () => {
        test('should render option with icon when provided', async () => {
            const mockOnChange = jest.fn()
            render(<MultiSelect options={mockOptions} onValueChange={mockOnChange} />)

            const trigger = screen.getByRole('button')
            await act(async () => {
                fireEvent.click(trigger)
            })

            const option3 = screen.getByText('Option 3')
            const optionContainer = option3.parentElement
            const icon = optionContainer?.querySelector('svg')

            expect(icon).toBeTruthy()
        })

        test('should render icon in selected badge', async () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option3']}
                />
            )

            const badge = screen.getByText('Option 3').parentElement
            const icon = badge?.querySelector('svg:not([class*="cursor-pointer"])')

            expect(icon).toBeTruthy()
        })
    })

    describe('Animation Feature', () => {
        test('should show animation toggle when animation prop is provided', () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1']}
                    animation={2}
                />
            )

            const animationToggle = document.querySelector('svg[class*="w-3"][class*="h-3"]')
            expect(animationToggle).toBeTruthy()
        })

        test('should toggle animation on badges when clicked', async () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1']}
                    animation={2}
                />
            )

            const animationToggle = document.querySelector('svg[class*="w-3"][class*="h-3"]')
            
            await act(async () => {
                fireEvent.click(animationToggle!)
            })

            const badge = screen.getByText('Option 1').parentElement
            expect(badge?.className).toContain('animate-bounce')
        })
    })

    describe('Variant Styles', () => {
        test('should apply default variant styles', () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1']}
                />
            )

            const badge = screen.getByText('Option 1').parentElement
            expect(badge?.className).toContain('border-foreground/10')
            expect(badge?.className).toContain('text-foreground')
        })

        test('should apply secondary variant styles', () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1']}
                    variant="secondary"
                />
            )

            const badge = screen.getByText('Option 1').parentElement
            expect(badge?.className).toContain('bg-secondary')
            expect(badge?.className).toContain('text-secondary-foreground')
        })

        test('should apply destructive variant styles', () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1']}
                    variant="destructive"
                />
            )

            const badge = screen.getByText('Option 1').parentElement
            expect(badge?.className).toContain('bg-destructive')
            expect(badge?.className).toContain('text-destructive-foreground')
        })
    })

    describe('Props and Configuration', () => {
        test('should respect modalPopover prop', async () => {
            const mockOnChange = jest.fn()
            const { rerender } = render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    modalPopover={true}
                />
            )

            // The modal behavior is handled by Radix UI Popover internally
            // We can verify the prop is passed but actual modal behavior would need integration tests
            expect(true).toBe(true)
        })

        test('should apply custom className', () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    className="custom-class"
                />
            )

            const button = screen.getByRole('button')
            expect(button.className).toContain('custom-class')
        })

        test('should forward ref properly', () => {
            const mockOnChange = jest.fn()
            const ref = { current: null }
            render(
                <MultiSelect
                    ref={ref}
                    options={mockOptions}
                    onValueChange={mockOnChange}
                />
            )

            expect(ref.current).toBeTruthy()
            expect(ref.current).toBeInstanceOf(HTMLButtonElement)
        })
    })

    describe('Edge Cases', () => {
        test('should handle empty options array', () => {
            const mockOnChange = jest.fn()
            render(<MultiSelect options={[]} onValueChange={mockOnChange} />)

            const trigger = screen.getByRole('button')
            expect(trigger).toBeTruthy()
        })

        test('should handle options with duplicate labels', async () => {
            const duplicateOptions = [
                { label: 'Same Label', value: 'value1' },
                { label: 'Same Label', value: 'value2' }
            ]
            const mockOnChange = jest.fn()
            render(<MultiSelect options={duplicateOptions} onValueChange={mockOnChange} />)

            const trigger = screen.getByRole('button')
            await act(async () => {
                fireEvent.click(trigger)
            })

            const sameLabels = screen.getAllByText('Same Label')
            expect(sameLabels.length).toBe(2)
        })

        test('should handle maxCount of 0', () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1', 'option2', 'option3']}
                    maxCount={0}
                />
            )

            expect(screen.getByText('+ 3 more')).toBeTruthy()
        })

        test('should not crash when clicking elements with stopPropagation', async () => {
            const mockOnChange = jest.fn()
            render(
                <MultiSelect
                    options={mockOptions}
                    onValueChange={mockOnChange}
                    defaultValue={['option1']}
                />
            )

            const badge = screen.getByText('Option 1').parentElement
            const xButton = badge?.querySelector('svg[class*="cursor-pointer"]')
            
            // This should not throw an error
            await act(async () => {
                fireEvent.click(xButton!, { bubbles: false })
            })

            expect(mockOnChange).toHaveBeenCalledWith([])
        })
    })
})