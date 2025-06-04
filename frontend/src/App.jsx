import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ProjectBrief from './pages/ProjectBrief';
import Prompts from './pages/Prompts';
import ApiKey from './pages/ApiKey';
import Results from './pages/Results';
import Navbar from './components/Navbar';
import EditProject from './pages/EditProject';

function App() {
  return (
    <ChakraProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="py-10">
            <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
              <Routes>
                <Route path="/" element={<Welcome />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/api-key" element={<ApiKey />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/project/new" element={<ProjectBrief />} />
                <Route path="/project/edit/:projectId" element={<EditProject />} />
                <Route path="/prompts/:projectId" element={<Prompts />} />
                <Route path="/results/:projectId" element={<Results />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </Router>
    </ChakraProvider>
  );
}

export default App;
