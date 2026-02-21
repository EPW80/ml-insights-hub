import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AuthProvider } from '../hooks/useAuth';
import AuthPage from './AuthPage';
import App from '../App';
import { apiService, tokenManager } from '../services/api';

// Mock react-router-dom to avoid JSDOM TextEncoder issue with react-router v7
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom') as Record<string, unknown>,
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Routes: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Route: () => null,
  NavLink: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  Navigate: () => null,
  useNavigate: () => jest.fn(),
}));

// Mock the api service
jest.mock('../services/api', () => ({
  apiService: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    makePrediction: jest.fn(),
    uploadData: jest.fn(),
    getPropertyData: jest.fn(),
    getPredictionHistory: jest.fn(),
    getDataSummary: jest.fn(),
  },
  tokenManager: {
    getToken: jest.fn(() => null),
    setToken: jest.fn(),
    clearToken: jest.fn(),
  },
}));

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <AuthProvider>
      {ui}
    </AuthProvider>
  );
};

describe('AuthPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tokenManager.getToken as jest.Mock).mockReturnValue(null);
  });

  it('renders login form by default', () => {
    renderWithProviders(<AuthPage />);
    expect(screen.getByText('ML Insights Hub', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    // Submit button has type="submit"
    const submitBtn = screen.getByText((content, element) =>
      /sign in/i.test(content) && element?.getAttribute('type') === 'submit'
    );
    expect(submitBtn).toBeInTheDocument();
  });

  it('switches to registration form when Sign Up tab is clicked', async () => {
    renderWithProviders(<AuthPage />);
    fireEvent.click(screen.getByText('Sign Up'));
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows validation error when passwords do not match during registration', async () => {
    renderWithProviders(<AuthPage />);
    fireEvent.click(screen.getByText('Sign Up'));

    await userEvent.type(screen.getByLabelText('Username'), 'testuser');
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'StrongP@ss1');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'DifferentP@ss1');

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('shows password requirements for weak password on registration', async () => {
    renderWithProviders(<AuthPage />);
    fireEvent.click(screen.getByText('Sign Up'));

    await userEvent.type(screen.getByLabelText('Username'), 'testuser');
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'weakpass');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'weakpass');

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/uppercase, lowercase, number, and special character/i)).toBeInTheDocument();
    });
  });

  it('calls login API when sign in form is submitted', async () => {
    (apiService.login as jest.Mock).mockResolvedValue({
      token: 'test-token',
      user: { id: '1', username: 'testuser', email: 'test@example.com', role: 'user' },
    });

    renderWithProviders(<AuthPage />);

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'StrongP@ss1');

    const submitBtn = screen.getByText((content, element) =>
      /sign in/i.test(content) && element?.getAttribute('type') === 'submit'
    );
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'StrongP@ss1',
      });
    });
  });

  it('shows error message when login fails', async () => {
    (apiService.login as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));

    renderWithProviders(<AuthPage />);

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'WrongP@ss1');

    const submitBtn = screen.getByText((content, element) =>
      /sign in/i.test(content) && element?.getAttribute('type') === 'submit'
    );
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows auth page when not authenticated', async () => {
    (tokenManager.getToken as jest.Mock).mockReturnValue(null);
    renderWithProviders(<App />);

    // Should show the auth page (lazy loaded)
    await waitFor(() => {
      expect(screen.getByText('ML Insights Hub', { exact: false })).toBeInTheDocument();
    });
  });

  it('shows main app with navigation when authenticated', async () => {
    // Simulate a valid JWT token
    const payload = { id: '1', username: 'testuser', email: 'test@test.com', role: 'user', exp: Math.floor(Date.now() / 1000) + 3600 };
    const fakeToken = `header.${btoa(JSON.stringify(payload))}.signature`;
    (tokenManager.getToken as jest.Mock).mockReturnValue(fakeToken);

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard', { exact: false })).toBeInTheDocument();
    });
    expect(screen.getByText('Predictions', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Visualization', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Upload Data', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });
});
