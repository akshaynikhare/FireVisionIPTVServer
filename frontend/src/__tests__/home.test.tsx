import { render, screen } from '@testing-library/react';
import Home from '../app/page';

describe('Home page', () => {
  it('renders the heading', () => {
    render(<Home />);
    expect(screen.getByText('FireVision IPTV')).toBeInTheDocument();
  });

  it('renders sign in and register links', () => {
    render(<Home />);
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByText('Register')).toBeInTheDocument();
  });
});
