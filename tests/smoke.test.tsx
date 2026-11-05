import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { renderApp } from './ui/render'

test('renders the app title', async () => {
  renderApp('/')
  expect(await screen.findByText('Hay Day Manager')).toBeInTheDocument()
})
