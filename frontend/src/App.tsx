import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Datasets from './pages/Datasets';
import ExecutiveBoard from './pages/ExecutiveBoard';
import DataModeling from './pages/DataModeling';
import Auth from './pages/Auth';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/board" 
              element={
                <ProtectedRoute>
                  <ExecutiveBoard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/modeling" 
              element={
                <ProtectedRoute>
                  <DataModeling />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/datasets" 
              element={
                <ProtectedRoute>
                  <Datasets />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
