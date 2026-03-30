import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Grubify prompt', () => {
  render(<App />);
  const prompt = screen.getByText(/what would you like to cook today/i);
  expect(prompt).toBeInTheDocument();
});
