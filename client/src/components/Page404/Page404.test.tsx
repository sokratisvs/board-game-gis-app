import React from 'react'
import { render, screen } from '@testing-library/react'
import Page404 from './Page404'

describe('Page404', () => {
  test('renders not found message', () => {
    render(<Page404 />)
    expect(screen.getByRole('heading', { name: /this page could not be found/i })).toBeInTheDocument()
  })

  test('renders not-found image with alt text', () => {
    render(<Page404 />)
    const img = screen.getByRole('img', { name: /not-found/i })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://i.imgur.com/qIufhof.png')
  })
})
